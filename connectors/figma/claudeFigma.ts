import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../agents/codex.js';
import {
  readCode,
  writeCode,
  type FigmaRead,
  type FigmaVariable,
  type PushPlan,
} from './scripts.js';

// Connexion Figma par le serveur MCP officiel de Figma, utilisé à travers
// Claude Code (client autorisé par Figma, compte et OAuth de l'étudiant).
// L'atelier ne lit, ne reçoit et ne stocke aucun jeton : Claude Code s'en charge.
//
// Garde-fous :
// - seul l'outil use_figma est chargé et autorisé ; aucun outil intégré ;
// - le script Plugin API est généré par l'atelier, et une garde PreToolUse
//   bloque tout appel dont le script, le fichier ou le nombre diffèrent ;
// - le résultat est lu dans la réponse de l'outil, pas dans le texte du modèle ;
// - l'écriture contrôle dans Figma les valeurs attendues puis relit.

export const figmaMcpUrl = 'https://mcp.figma.com/mcp';
// Même nom, type et URL que la commande d'installation : Claude Code
// retrouve ainsi l'autorisation OAuth enregistrée pour ce serveur.
export const figmaMcpConfig = {
  mcpServers: { figma: { type: 'http', url: figmaMcpUrl } },
};
export const figmaSetupCommand = `claude mcp add --transport http --scope user figma ${figmaMcpUrl}`;

const guardPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'guard.mjs',
);

const systemPrompt = `Tu es le transport Figma de DS-Studio. Tu dois appeler l'outil mcp__figma__use_figma exactement une fois, avec exactement les arguments JSON fournis, sans changer un seul caractère du code. N'appelle aucun autre outil. Ne commente pas le code. Après le résultat de l'outil, réponds seulement FIN.`;

export interface FigmaStatus {
  state: 'connected' | 'needs-auth' | 'missing' | 'error' | 'no-cli';
  detail: string;
}

export interface FigmaConnectorOptions {
  binary?: string;
  // Remplaçable pour les tests (serveur MCP simulé).
  mcpConfig?: object;
  model?: string;
}

export class ClaudeFigmaConnector {
  private binary: string;
  private mcpConfig: object;
  private model: string;
  constructor(options: FigmaConnectorOptions = {}) {
    this.binary = options.binary ?? 'claude';
    this.mcpConfig = options.mcpConfig ?? figmaMcpConfig;
    this.model = options.model ?? 'sonnet';
  }

  // État de la connexion sans appel au modèle ni à Figma (pas de quota).
  async status(): Promise<FigmaStatus> {
    let out: string;
    try {
      out = await runCli(
        this.binary,
        ['mcp', 'get', 'figma'],
        '',
        { env: safeEnv() },
        undefined,
        30_000,
        'Claude',
      );
    } catch (e) {
      const message = (e as Error).message;
      if (message.startsWith('CLI Claude absent'))
        return {
          state: 'no-cli',
          detail:
            'Claude Code introuvable. Lance l’atelier depuis un terminal où « claude » fonctionne.',
        };
      return {
        state: 'missing',
        detail: 'Serveur Figma pas encore ajouté à Claude Code.',
      };
    }
    return parseMcpGet(out);
  }

  async read(fileKey: string, signal?: AbortSignal): Promise<FigmaRead> {
    const result = await this.run(
      fileKey,
      readCode(),
      'DS-Studio : lire les variables de la collection DS-Studio',
      signal,
    );
    return parseRead(result);
  }

  async write(fileKey: string, plan: PushPlan, signal?: AbortSignal) {
    const result = await this.run(
      fileKey,
      writeCode(plan),
      'DS-Studio : mettre à jour les variables validées dans l’atelier',
      signal,
    );
    return parseWrite(result, plan);
  }

  private async run(
    fileKey: string,
    code: string,
    description: string,
    signal?: AbortSignal,
  ) {
    if (!/^[0-9a-zA-Z]{22,128}$/.test(fileKey))
      throw new Error('Figma : lien de fichier invalide.');
    const cwd = await mkdtemp(path.join(tmpdir(), 'ds-studio-figma-'));
    try {
      const once = path.join(cwd, `figma-${randomUUID()}.once`);
      const hook = `${quote(process.execPath)} ${quote(guardPath)}`;
      const settings = {
        hooks: {
          PreToolUse: [
            { matcher: '.*', hooks: [{ type: 'command', command: hook }] },
          ],
        },
      };
      const args = [
        '-p',
        '--output-format',
        'stream-json',
        '--verbose',
        '--tools',
        '',
        '--no-chrome',
        '--disable-slash-commands',
        '--strict-mcp-config',
        '--mcp-config',
        JSON.stringify(this.mcpConfig),
        '--setting-sources',
        '',
        '--settings',
        JSON.stringify(settings),
        '--allowedTools',
        'mcp__figma__use_figma',
        '--permission-mode',
        'dontAsk',
        '--no-session-persistence',
        '--model',
        this.model,
        '--system-prompt',
        systemPrompt,
      ];
      const input = `Arguments JSON de l'appel unique à mcp__figma__use_figma :\n${JSON.stringify({ fileKey, description, code })}`;
      const raw = await runCli(
        this.binary,
        args,
        input,
        {
          cwd,
          env: {
            ...safeEnv(),
            DS_FIGMA_FILE: fileKey,
            DS_FIGMA_EXPECT: createHash('sha256').update(code).digest('hex'),
            DS_FIGMA_ONCE: once,
          },
        },
        signal,
        180_000,
        'Claude',
      );
      return parseFigmaStream(raw);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }
}

function quote(p: string) {
  if (/["$`\\\n]/.test(p))
    throw new Error(
      'Figma : chemin de l’atelier non pris en charge (caractère spécial).',
    );
  return `"${p}"`;
}

// Même liste que l'adaptateur Claude : aucune clé d'API transmise.
function safeEnv() {
  const names = [
    'PATH',
    'HOME',
    'USER',
    'LOGNAME',
    'TMPDIR',
    'LANG',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'SystemRoot',
    'WINDIR',
    'COMSPEC',
    'PATHEXT',
    'TEMP',
    'TMP',
    'XDG_CONFIG_HOME',
    'XDG_DATA_HOME',
    'CLAUDE_CONFIG_DIR',
    'HTTPS_PROXY',
    'HTTP_PROXY',
    'NO_PROXY',
    'SSL_CERT_FILE',
    'SSL_CERT_DIR',
    'NODE_EXTRA_CA_CERTS',
  ];
  return Object.fromEntries(
    names
      .filter((n) => process.env[n] !== undefined)
      .map((n) => [n, process.env[n]!]),
  );
}

export function parseMcpGet(out: string): FigmaStatus {
  if (/No MCP server named/i.test(out))
    return {
      state: 'missing',
      detail: 'Serveur Figma pas encore ajouté à Claude Code.',
    };
  if (!out.includes(figmaMcpUrl) || !/Type:\s*http/i.test(out))
    return {
      state: 'error',
      detail: `Un serveur « figma » existe mais pas avec l’adresse officielle ${figmaMcpUrl} en http.`,
    };
  const status = out.match(/Status:\s*(.+)/)?.[1] ?? '';
  if (/connected/i.test(status) && !/fail|not/i.test(status))
    return { state: 'connected', detail: 'Figma connecté via Claude Code.' };
  if (/auth/i.test(status))
    return {
      state: 'needs-auth',
      detail:
        'Serveur Figma ajouté, connexion à ton compte Figma à faire (/mcp dans Claude Code).',
    };
  return {
    state: 'error',
    detail: 'Serveur Figma injoignable pour le moment (réseau ou Figma).',
  };
}

type ToolContent = string | { type?: string; text?: string }[] | undefined;
const textOf = (c: ToolContent) =>
  typeof c === 'string'
    ? c
    : (c ?? [])
        .filter((x) => x.type === 'text')
        .map((x) => x.text ?? '')
        .join('\n');

// Lecture du flux Claude Code : on ne croit que la réponse de l'outil.
export function parseFigmaStream(raw: string): Record<string, unknown> {
  const ids = new Set<string>();
  let figmaState: string | undefined;
  let otherTool = false;
  const errors: string[] = [];
  let success: Record<string, unknown> | undefined;
  let finalOk = false;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let item: Record<string, unknown>;
    try {
      item = JSON.parse(line);
    } catch {
      continue;
    }
    if (item.type === 'system' && item.subtype === 'init') {
      const servers = (item.mcp_servers ?? []) as {
        name?: string;
        status?: string;
      }[];
      figmaState = servers.find((s) => s.name === 'figma')?.status;
    }
    if (item.type === 'assistant') {
      const content = ((item.message as { content?: unknown[] })?.content ??
        []) as { type?: string; name?: string; id?: string }[];
      for (const c of content)
        if (c.type === 'tool_use') {
          if (c.name === 'mcp__figma__use_figma' && c.id) ids.add(c.id);
          else otherTool = true;
        }
    }
    if (item.type === 'user') {
      const content = ((item.message as { content?: unknown[] })?.content ??
        []) as {
        type?: string;
        tool_use_id?: string;
        is_error?: boolean;
        content?: ToolContent;
      }[];
      for (const c of content) {
        if (c.type !== 'tool_result' || !ids.has(c.tool_use_id ?? '')) continue;
        const text = textOf(c.content);
        if (c.is_error) {
          errors.push(text);
          continue;
        }
        try {
          const value = JSON.parse(text);
          if (value && typeof value === 'object' && value.dsStudio === 1)
            success ??= value;
          else errors.push(text);
        } catch {
          errors.push(text);
        }
      }
    }
    if (item.type === 'result') finalOk = item.subtype === 'success';
  }
  if (figmaState && figmaState !== 'connected')
    throw new Error(
      figmaState === 'needs-auth'
        ? 'Figma : connecte ton compte dans Claude Code (Paramètres › Figma).'
        : `Figma : serveur MCP non joignable (${figmaState.slice(0, 30)}). Vérifie Internet et Paramètres › Figma.`,
    );
  if (success) return success;
  const all = errors.join(' ');
  if (/rate limit|tool call limit|limite/i.test(all))
    throw new Error(
      'Figma : limite d’appels MCP atteinte (10 par minute, 200 par jour sur le plan Éducation). Réessaie plus tard.',
    );
  if (/DS-Studio a bloqué/.test(all))
    throw new Error(
      'Figma : appel bloqué par l’atelier (script recopié de travers). Rien n’a été écrit. Réessaie.',
    );
  if (otherTool && !ids.size)
    throw new Error('Figma : outil inattendu refusé. Rien n’a été écrit.');
  if (!ids.size)
    throw new Error(
      finalOk
        ? 'Figma : Claude n’a pas appelé Figma. Réessaie.'
        : 'Claude indisponible : vérifie ta connexion et ton quota.',
    );
  throw new Error(
    `Figma : erreur renvoyée par Figma. ${all.replace(/\s+/g, ' ').slice(0, 240)}`,
  );
}

export function parseRead(value: Record<string, unknown>): FigmaRead {
  const list = Array.isArray(value.variables) ? value.variables : [];
  const variables: FigmaVariable[] = [];
  for (const v of list.slice(0, 500)) {
    if (!v || typeof v !== 'object') continue;
    const { name, type, value: val } = v as Record<string, unknown>;
    if (typeof name !== 'string' || name.length > 200) continue;
    if (!['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'].includes(String(type)))
      continue;
    const ok =
      val === null ||
      typeof val === 'number' ||
      typeof val === 'boolean' ||
      (typeof val === 'string' && val.length <= 200);
    variables.push({
      name,
      type: type as FigmaVariable['type'],
      value: ok ? (val as FigmaVariable['value']) : null,
    });
  }
  return {
    collection:
      typeof value.collection === 'string'
        ? value.collection.slice(0, 100)
        : null,
    variables,
  };
}

export function parseWrite(value: Record<string, unknown>, plan: PushPlan) {
  if (value.written === false) {
    const conflicts = Array.isArray(value.conflicts) ? value.conflicts : [];
    throw new Error(
      `Figma a changé depuis l’aperçu (${conflicts.length} variable${conflicts.length > 1 ? 's' : ''}). Rien n’a été écrit : relance « Envoyer vers Figma ».`,
    );
  }
  if (value.written !== true) throw new Error('Figma : réponse inattendue.');
  const readback = new Map(
    (Array.isArray(value.readback) ? value.readback : []).map(
      (r: { name?: unknown; value?: unknown }) => [String(r.name), r.value],
    ),
  );
  const mismatches = plan.items.filter((i) => {
    const got = readback.get(i.name);
    return typeof got === 'string' && typeof i.value === 'string'
      ? got.toUpperCase() !== i.value.toUpperCase()
      : got !== i.value;
  });
  return {
    written: plan.items.length,
    created: Array.isArray(value.created) ? value.created.length : 0,
    verified: mismatches.length === 0,
    mismatches: mismatches.map((m) => m.name),
  };
}
