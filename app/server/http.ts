import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { proposeSchema } from '../shared/model.js';
import { Store, StudioError } from './store.js';
import { ProjectStore } from './project.js';
import { Projects, newProjectSchema } from './projects.js';
import { readPrivate } from './files.js';
import { projectSchema } from '../shared/project.js';
import { CodexAdapter } from '../../connectors/agents/codex.js';
import { ClaudeAdapter } from '../../connectors/agents/claude.js';
import { unvalidatedAdapter } from '../../connectors/agents/unvalidated.js';
import {
  loginCommands,
  openTerminal,
  openFolder,
  type TerminalOpener,
} from '../../connectors/agents/login.js';
import {
  claudeEfforts,
  claudeModels,
  type AgentAdapter,
} from '../../connectors/agents/types.js';
import { ClaudeFigmaConnector } from '../../connectors/figma/claudeFigma.js';
import { FigmaSync, type FigmaConnector } from './figma.js';
import type { RecordInfo } from '../../scripts/runtime.mjs';

export async function createStudioServer(options: {
  root: string;
  store: Store;
  agent?: AgentAdapter;
  claude?: AgentAdapter;
  terminal?: TerminalOpener;
  // Ouvre le dossier des données dans le Finder (remplaçable pour les tests).
  folder?: (dir: string) => Promise<boolean>;
  figma?: FigmaConnector;
  projects?: Projects;
  dev?: boolean;
  control?: { record: RecordInfo; stop: () => void };
}) {
  const { root } = options;
  const appVersion = String(
    JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
      .version ?? '',
  );
  let store = options.store;
  const adapters: Record<string, AgentAdapter> = {
    codex: options.agent ?? new CodexAdapter(),
    claude: options.claude ?? new ClaudeAdapter(),
    gemini: unvalidatedAdapter('gemini'),
  };
  const figmaConnector = options.figma ?? new ClaudeFigmaConnector();
  const projects = options.projects ?? new Projects(store.directory);
  let projectId = (await projects.read()).current;
  let project = new ProjectStore(store.directory);
  let figma = new FigmaSync(store, project, figmaConnector, store.directory);
  // Changer de projet remplace les trois magasins d'un coup. Refusé pendant
  // une demande Claude ou Figma pour ne jamais écrire dans le mauvais projet.
  async function openProject(id: string, seed = options.store.seed) {
    if (busy)
      throw new StudioError(
        'Attends la fin de la demande Claude ou Figma avant de changer de projet.',
        429,
      );
    const directory = projects.dirFor(id);
    const next = new Store(directory, seed);
    await next.init();
    await store.flush();
    await projects.open(id);
    store = next;
    project = new ProjectStore(directory);
    figma = new FigmaSync(store, project, figmaConnector, directory);
    projectId = id;
  }
  // Aperçu visuel d'un jeu de tokens : quelques couleurs et l'arrondi.
  const palette = (tokens: Record<string, { $value: unknown }>) => ({
    colors: ['color.brand', 'color.canvas', 'color.text', 'color.border']
      .map((k) => tokens[k]?.$value)
      .filter((v): v is string => typeof v === 'string'),
    radius: Number(tokens['radius.control']?.$value ?? 8),
  });
  const brandOf = async (id: string) => {
    if (id === projectId)
      return String(store.snapshot().tokens['color.brand']?.$value ?? '');
    try {
      const raw = await readPrivate(
        path.join(projects.dirFor(id), 'state.json'),
      );
      const v = JSON.parse(raw)?.tokens?.['color.brand']?.$value;
      return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : '';
    } catch {
      return '';
    }
  };
  const projectList = async () => {
    const r = await projects.read();
    return {
      current: r.current,
      projects: await Promise.all(
        r.projects.map(async (p) => ({ ...p, brand: await brandOf(p.id) })),
      ),
      base: palette(options.store.seed),
    };
  };
  const csrf = randomBytes(32).toString('hex');
  let busy = false;
  const active = new Set<AbortController>();
  // Une seule opération CLI (IA ou Figma) à la fois ; annulée si l'onglet ferme.
  async function exclusive<T>(
    res: http.ServerResponse,
    work: (signal: AbortSignal) => Promise<T>,
  ) {
    if (busy)
      throw new StudioError(
        'Une demande Claude ou Figma est déjà en cours.',
        429,
      );
    busy = true;
    const controller = new AbortController();
    active.add(controller);
    const cancel = () => controller.abort();
    res.once('close', cancel);
    try {
      return await work(controller.signal);
    } finally {
      busy = false;
      active.delete(controller);
      res.off('close', cancel);
    }
  }
  const vite = options.dev
    ? await (
        await import('vite')
      ).createServer({
        root,
        server: { middlewareMode: true, host: '127.0.0.1' },
        appType: 'spa',
      })
    : null;
  const server = http.createServer(async (req, res) => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const origin = `http://127.0.0.1:${port}`;
    const send = (status: number, value: unknown) => {
      if (!res.destroyed) {
        res.writeHead(status, {
          'Content-Type': 'application/json; charset=utf-8',
        });
        res.end(JSON.stringify(value));
      }
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'${options.dev ? ' ws://127.0.0.1:*' : ''}; frame-ancestors 'self'; base-uri 'none'; form-action 'self'`,
    );
    try {
      if (req.headers.host !== `127.0.0.1:${port}`)
        throw new StudioError(
          'Hôte refusé. Utilise l’adresse 127.0.0.1 affichée au démarrage.',
          403,
        );
      if (req.headers.origin && req.headers.origin !== origin)
        throw new StudioError('Origine non autorisée.', 403);
      if (req.headers['sec-fetch-site'] === 'cross-site')
        throw new StudioError('Requête externe refusée.', 403);
      const url = new URL(req.url ?? '/', origin);
      if (url.pathname.startsWith('/_studio/')) {
        const control = options.control;
        if (
          !control ||
          req.headers['x-studio-control'] !== control.record.token
        )
          throw new StudioError('Contrôle privé refusé.', 403);
        const { token: _token, ...identity } = control.record;
        if (url.pathname === '/_studio/health' && req.method === 'GET')
          return send(200, identity);
        if (url.pathname === '/_studio/stop' && req.method === 'POST') {
          send(200, identity);
          setImmediate(control.stop);
          return;
        }
        throw new StudioError('Route inconnue.', 404);
      }
      if (url.pathname.startsWith('/api/')) {
        if (req.method === 'GET') {
          if (url.pathname === '/api/bootstrap')
            return send(200, {
              csrf,
              project: projectId,
              figma: { connected: false, label: 'Figma' },
              agents: [],
            });
          if (url.pathname === '/api/figma/status')
            return send(200, await figma.status());
          if (url.pathname === '/api/figma/components')
            return send(200, await figma.components());
          if (url.pathname === '/api/agents')
            return send(
              200,
              await Promise.all(
                Object.values(adapters).map(async (a) => ({
                  id: a.id,
                  ...(await a.status()),
                })),
              ),
            );
          if (url.pathname === '/api/project')
            return send(200, await project.read());
          if (url.pathname === '/api/projects')
            return send(200, await projectList());
          if (url.pathname === '/api/data-info')
            return send(200, {
              dir: options.store.directory,
              version: appVersion,
            });
          if (url.pathname === '/api/state') return send(200, store.snapshot());
          if (url.pathname === '/api/export')
            return send(200, store.snapshot().tokens);
          throw new StudioError('Route inconnue.', 404);
        }
        if (req.method !== 'POST')
          throw new StudioError('Méthode non autorisée.', 405);
        if (req.headers['x-ds-studio'] !== csrf)
          throw new StudioError(
            'Validation de session manquante. Recharge la page.',
            403,
          );
        if (!req.headers['content-type']?.startsWith('application/json'))
          throw new StudioError('JSON requis.', 415);
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 128_000)
            throw new StudioError('Requête trop volumineuse.', 413);
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString('utf8');
        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          throw new StudioError('JSON invalide.');
        }
        if (url.pathname === '/api/projects/open') {
          const b = z
            .object({ id: z.string().max(40) })
            .strict()
            .parse(body);
          if (!(await projects.read()).projects.some((p) => p.id === b.id))
            throw new StudioError('Projet introuvable.', 404);
          await openProject(b.id);
          return send(200, await projectList());
        }
        if (url.pathname === '/api/projects/create') {
          const b = newProjectSchema.parse(body);
          const seed =
            b.from === 'copie' ? store.snapshot().tokens : options.store.seed;
          const id = await projects.create(b.name);
          await openProject(id, seed);
          await project.save('', {
            name: b.name,
            audience: '',
            goal: '',
            figmaUrl: '',
          });
          return send(200, await projectList());
        }
        if (url.pathname === '/api/projects/rename') {
          const b = z
            .object({
              id: z.string().max(40),
              name: z.string().trim().min(1, 'Nom du projet requis.').max(60),
            })
            .strict()
            .parse(body);
          await projects.rename(b.id, b.name);
          return send(200, await projectList());
        }
        if (url.pathname === '/api/projects/delete') {
          const b = z
            .object({ id: z.string().max(40) })
            .strict()
            .parse(body);
          await projects.remove(b.id);
          return send(200, await projectList());
        }
        if (url.pathname === '/api/open-data-folder') {
          z.object({}).strict().parse(body);
          const opened = await (options.folder ?? openFolder)(
            options.store.directory,
          );
          return send(200, { opened, dir: options.store.directory });
        }
        // Un onglet resté sur un autre projet ne peut rien écrire ici.
        const sentProject = req.headers['x-ds-project'];
        if (typeof sentProject === 'string' && sentProject !== projectId)
          throw new StudioError(
            'Projet changé dans un autre onglet. Recharge la page.',
            409,
          );
        if (url.pathname === '/api/project') {
          const b = z
            .object({ base: z.string().max(64), project: projectSchema })
            .strict()
            .parse(body);
          return send(200, await project.save(b.base, b.project));
        }
        if (url.pathname === '/api/proposals') {
          const b = proposeSchema.parse(body);
          return send(200, store.propose(b.revision, b.changes));
        }
        if (url.pathname === '/api/import') {
          const b = z
            .object({
              revision: z.number().int().nonnegative(),
              tokens: z.unknown(),
            })
            .strict()
            .parse(body);
          return send(200, store.proposeImport(b.revision, b.tokens));
        }
        if (url.pathname === '/api/undo') {
          const b = z
            .object({
              revision: z.number().int().nonnegative(),
              id: z.string().uuid(),
            })
            .strict()
            .parse(body);
          return send(200, store.proposeUndo(b.revision, b.id));
        }
        if (url.pathname === '/api/commit') {
          const b = z.object({ id: z.string().uuid() }).strict().parse(body);
          return send(200, await store.commit(b.id));
        }
        if (url.pathname === '/api/agent-login') {
          const b = z
            .object({ agent: z.enum(['claude', 'figma']) })
            .strict()
            .parse(body);
          const command = loginCommands[b.agent];
          const opened = await (options.terminal ?? openTerminal)(command);
          return send(200, { opened, command });
        }
        if (url.pathname === '/api/agent') {
          const b = z
            .object({
              agent: z.enum(['codex', 'claude', 'gemini']),
              message: z.string().trim().min(1).max(8000),
              revision: z.number().int().nonnegative(),
              history: z
                .array(
                  z
                    .object({
                      role: z.enum(['user', 'assistant']),
                      text: z.string().max(12000),
                    })
                    .strict(),
                )
                .max(10),
              model: z.enum(claudeModels).optional(),
              effort: z.enum(claudeEfforts).optional(),
            })
            .strict()
            .parse(body);
          if (b.revision !== store.snapshot().revision)
            throw new StudioError(
              'DS modifié depuis ton dernier affichage. Réessaie.',
              409,
            );
          const result = await exclusive(res, async (signal) => {
            const gutt = projectId === 'gutt';
            const context = async (name: string) => {
              const file = path.join(root, 'workspace', name);
              const stat = await fs.lstat(file);
              if (stat.isSymbolicLink() || stat.size > 32_000)
                throw new StudioError(
                  `Contexte ${name} refusé (lien ou taille).`,
                );
              return fs.readFile(file, 'utf8');
            };
            const snap = await figma.snapshot();
            const reply = await adapters[b.agent].reply(
              b.message,
              {
                tokens: store.snapshot().tokens,
                // PFE.md et les règles Gutt ne concernent que le projet Gutt.
                brief:
                  (gutt ? await context('PFE.md') : '') +
                  '\nBrief privé DS-Studio :\n' +
                  JSON.stringify((await project.read()).project),
                rules: gutt
                  ? await context('DESIGN_RULES.md')
                  : (await context('DESIGN_RULES.md')).split(
                      '## Règles Gutt',
                    )[0],
                figma: snap
                  ? {
                      readAt: snap.readAt,
                      collection: snap.collection,
                      variables: snap.variables.slice(0, 200),
                    }
                  : null,
                history: b.history,
              },
              signal,
              { model: b.model, effort: b.effort },
            );
            const proposal = reply.changes.length
              ? store.propose(
                  b.revision,
                  reply.changes,
                  b.agent === 'claude' ? 'claude' : 'codex',
                )
              : null;
            return {
              message: reply.message,
              proposal,
              usage: reply.usage ?? null,
              limits: reply.limits ?? null,
            };
          });
          return send(200, result);
        }
        if (url.pathname === '/api/figma/pull') {
          const b = z
            .object({ revision: z.number().int().nonnegative() })
            .strict()
            .parse(body);
          return send(
            200,
            await exclusive(res, (signal) => figma.pull(b.revision, signal)),
          );
        }
        if (url.pathname === '/api/figma/preview') {
          const b = z
            .object({ revision: z.number().int().nonnegative() })
            .strict()
            .parse(body);
          return send(
            200,
            await exclusive(res, (signal) => figma.preview(b.revision, signal)),
          );
        }
        if (url.pathname === '/api/figma/apply') {
          const b = z
            .object({ approvalId: z.string().uuid() })
            .strict()
            .parse(body);
          return send(
            200,
            await exclusive(res, (signal) => figma.apply(b.approvalId, signal)),
          );
        }
        throw new StudioError('Route inconnue.', 404);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD')
        throw new StudioError('Méthode non autorisée.', 405);
      if (vite) {
        const allowed = [
          '/app/client/',
          '/app/shared/',
          '/node_modules/',
          '/@vite/',
          '/@id/',
        ];
        if (
          url.pathname !== '/' &&
          url.pathname !== '/index.html' &&
          !allowed.some((prefix) => url.pathname.startsWith(prefix))
        )
          throw new StudioError('Source privée non distribuée.', 403);
        vite.middlewares(req, res);
        return;
      }
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('..') || pathname.includes('\\'))
        throw new StudioError('Chemin refusé.', 403);
      let file: string;
      if (pathname.startsWith('/assets/'))
        file = path.join(root, 'dist', pathname);
      else if (pathname === '/' || pathname === '/index.html')
        file = path.join(root, 'dist', 'index.html');
      else throw new StudioError('Fichier introuvable.', 404);
      const data = await fs.readFile(file);
      const ext = path.extname(file);
      res.setHeader(
        'Content-Type',
        (
          {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.svg': 'image/svg+xml',
          } as Record<string, string>
        )[ext] ?? 'application/octet-stream',
      );
      res.end(data);
    } catch (error) {
      if (error instanceof z.ZodError)
        return send(400, {
          error:
            'Données invalides : ' +
            error.issues
              .map((i) => `${i.path.join('.')}: ${i.message}`)
              .join('; '),
        });
      if (error instanceof StudioError)
        return send(error.status, { error: error.message });
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return send(404, {
          error: 'Fichier introuvable. Lance npm run build avant npm start.',
        });
      return send(500, { error: urlSafeMessage(error) });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return {
    server,
    flush: () => store.flush(),
    close: async () => {
      for (const c of active) c.abort();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
      await vite?.close();
    },
  };
}
function urlSafeMessage(error: unknown) {
  // Les erreurs agent sont rédigées dans l'adaptateur, jamais de stderr brut ni de stack.
  const message = (error as Error).message ?? '';
  if (
    /^(CLI |Codex |Claude |Figma|Version non|Échec Codex|Échec Claude|Délai CLI|Demande interrompue|Le CLI|Réponse CLI|claude non|gemini non|Impossible de démarrer)/.test(
      message,
    )
  )
    return message;
  return 'Opération impossible. Aucune validation automatique. Vérifie les données et relance si nécessaire.';
}
