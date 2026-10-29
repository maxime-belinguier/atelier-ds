import { test } from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../app/server/store.js';
import { tokensSchema } from '../app/shared/model.js';
import { createStudioServer } from '../app/server/http.js';
import type { AgentAdapter } from '../connectors/agents/types.js';
import type { FigmaConnector } from '../app/server/figma.js';
import {
  fakeFigmaConnector,
  sampleComponent,
} from './fixtures/fakeFigmaConnector.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seed = tokensSchema.parse(
  JSON.parse(
    await readFile(
      path.join(root, 'workspace/design-system.tokens.json'),
      'utf8',
    ),
  ),
);
async function fixture(
  t: { after: (fn: () => Promise<void>) => void },
  dev = false,
  claude?: AgentAdapter,
  figma?: FigmaConnector,
) {
  const directory = await mkdtemp(path.join(tmpdir(), 'ds-http-'));
  const store = new Store(directory, seed);
  await store.init();
  // Jamais de vrai Terminal dans les tests : on note seulement la commande.
  const terminal: string[] = [];
  const app = await createStudioServer({
    root,
    store,
    dev,
    figma,
    terminal: async (command) => {
      terminal.push(command);
      return false;
    },
    // Jamais de vrai Finder dans les tests.
    folder: async () => false,
    agent: {
      id: 'codex',
      async status() {
        return { available: false, detail: 'Non authentifié (simulation)' };
      },
      async reply() {
        throw new Error('Codex indisponible : authentification nécessaire.');
      },
    },
    // Jamais le vrai CLI dans les tests : aucun appel réseau ni quota.
    claude: claude ?? {
      id: 'claude',
      async status() {
        return { available: false, detail: 'Non connecté (simulation)' };
      },
      async reply() {
        throw new Error('Claude indisponible : connexion nécessaire.');
      },
    },
  });
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  const port = (app.server.address() as { port: number }).port;
  const origin = `http://127.0.0.1:${port}`;
  const boot = await (await fetch(origin + '/api/bootstrap')).json();
  const post = (
    route: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) =>
    fetch(origin + '/api/' + route, {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'X-DS-Studio': boot.csrf,
        ...headers,
      },
      body: JSON.stringify(body),
    });
  return { origin, post, store, terminal, directory };
}
test('API manuelle complète sans IA ni Figma, export égal au disque', async (t) => {
  const { origin, post, store } = await fixture(t);
  const boot = await (await fetch(origin + '/api/bootstrap')).json();
  assert.equal(boot.figma.connected, false);
  const proposed = await post('proposals', {
    revision: 0,
    changes: [{ key: 'color.brand', value: '#112233' }],
  });
  assert.equal(proposed.status, 200);
  const p = await proposed.json();
  assert.equal(store.snapshot().revision, 0);
  const accepted = await post('commit', { id: p.id });
  assert.equal(accepted.status, 200);
  assert.equal(
    (await (await fetch(origin + '/api/export')).json())['color.brand'].$value,
    '#112233',
  );
  const undo = await (await post('undo', { revision: 1, id: p.id })).json();
  assert.equal((await post('commit', { id: undo.id })).status, 200);
  assert.equal(
    store.snapshot().tokens['color.brand'].$value,
    seed['color.brand'].$value,
  );
});
test('CSRF, origine étrangère, rebinding Host et périmètre refusés', async (t) => {
  const { origin, post, store } = await fixture(t);
  const body = {
    revision: 0,
    changes: [{ key: 'color.brand', value: '#112233' }],
  };
  assert.equal(
    (await post('proposals', body, { 'X-DS-Studio': '' })).status,
    403,
  );
  assert.equal(
    (await post('proposals', body, { Origin: 'https://evil.invalid' })).status,
    403,
  );
  const hostStatus = await new Promise<number | undefined>(
    (resolve, reject) => {
      http
        .get(
          origin + '/api/state',
          { headers: { Host: 'evil.invalid' } },
          (res) => {
            res.resume();
            resolve(res.statusCode);
          },
        )
        .on('error', reject);
    },
  );
  assert.equal(hostStatus, 403);
  assert.equal(
    (await post('proposals', { ...body, path: '../../outside' })).status,
    400,
  );
  assert.equal(
    (
      await post('proposals', {
        revision: 0,
        changes: [{ key: '../../outside', value: '#112233' }],
      })
    ).status,
    400,
  );
  assert.equal((await post('figma/write', {})).status, 404);
  assert.equal((await fetch(origin + '/.ds-studio/state.json')).status, 404);
  assert.equal((await fetch(origin + '/workspace/PFE.md')).status, 404);
  assert.equal(store.snapshot().revision, 0);
});
test('requêtes malformées et trop grandes refusées', async (t) => {
  const { origin, post } = await fixture(t);
  assert.equal(
    (await post('import', { revision: 0, tokens: { wrong: true } })).status,
    400,
  );
  assert.equal((await post('proposals', {})).status, 400);
  assert.equal((await post('agent', { data: 'x'.repeat(129000) })).status, 413);
  const boot = await (await fetch(origin + '/api/bootstrap')).json();
  assert.equal(
    (
      await fetch(origin + '/api/commit', {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          'X-DS-Studio': boot.csrf,
        },
        body: '{bad',
      })
    ).status,
    400,
  );
});
test('IA sans compte et adaptateurs non implémentés échouent sans mutation', async (t) => {
  const { post, store } = await fixture(t);
  const body = { agent: 'codex', revision: 0, message: 'Bonjour', history: [] };
  const response = await post('agent', body);
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /authentification/);
  assert.equal((await post('agent', { ...body, agent: 'claude' })).status, 500);
  assert.equal((await post('agent', { ...body, agent: 'gemini' })).status, 500);
  assert.equal(store.snapshot().revision, 0);
});

test('Claude simulé : proposition sourcée claude, jamais appliquée sans validation', async (t) => {
  const { post, store } = await fixture(t, false, {
    id: 'claude',
    async status() {
      return { available: true, detail: 'simulation' };
    },
    async reply() {
      return {
        message: 'Proposition',
        changes: [{ key: 'color.brand', value: '#1F4D3A' }],
      };
    },
  });
  const before = store.snapshot().tokens['color.brand'].$value;
  const response = await post('agent', {
    agent: 'claude',
    revision: 0,
    message: 'Marque en vert',
    history: [],
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.proposal.source, 'claude');
  assert.equal(store.snapshot().revision, 0);
  assert.equal(store.snapshot().tokens['color.brand'].$value, before);
});

test('Claude simulé : modèle et effort transmis, valeur libre refusée', async (t) => {
  let received: unknown;
  const { post } = await fixture(t, false, {
    id: 'claude',
    async status() {
      return { available: true, detail: 'simulation' };
    },
    async reply(_m, _c, _s, options) {
      received = options;
      return {
        message: 'ok',
        changes: [],
        usage: { model: 'claude-opus-5-5', inputTokens: 10, outputTokens: 2 },
      };
    },
  });
  const body = {
    agent: 'claude',
    revision: 0,
    message: 'Bonjour',
    history: [],
    model: 'opus',
    effort: 'high',
  };
  const ok = await post('agent', body);
  assert.equal(ok.status, 200);
  assert.deepEqual(received, { model: 'opus', effort: 'high' });
  assert.equal((await ok.json()).usage.inputTokens, 10);
  assert.equal(
    (await post('agent', { ...body, model: '--dangerously-skip-permissions' }))
      .status,
    400,
  );
});

test('mode dev : frontend servi, workspace et backend non distribués', async (t) => {
  const { origin } = await fixture(t, true);
  for (const route of [
    '/',
    '/app/client/main.tsx',
    '/app/shared/model.ts',
    '/@vite/client',
  ])
    assert.equal((await fetch(origin + route)).status, 200);
  for (const route of [
    '/workspace/PFE.md',
    '/app/server/http.ts',
    '/connectors/agents/codex.ts',
    '/.ds-studio/state.json',
    '/.git/config',
  ])
    assert.equal((await fetch(origin + route)).status, 403);
});

test('brief : API fermée, révision conflictuelle et aucun fichier privé servi', async (t) => {
  const { origin, post, store } = await fixture(t);
  const initial = await (await fetch(origin + '/api/project')).json();
  const body = {
    ...initial,
    project: { ...initial.project, name: 'PFE test' },
  };
  assert.equal(
    (await post('project', body, { 'X-DS-Studio': '' })).status,
    403,
  );
  assert.equal((await post('project', body)).status, 200);
  assert.equal((await post('project', body)).status, 409);
  assert.equal(
    (await post('project', { ...body, path: '../../escape' })).status,
    400,
  );
  assert.equal((await fetch(origin + '/.ds-studio/project.json')).status, 404);
  assert.equal(store.snapshot().revision, 0);
});

test('mode manuel disponible immédiatement même si la détection IA ne répond jamais', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ds-no-agent-'));
  const store = new Store(directory, seed);
  await store.init();
  const app = await createStudioServer({
    root,
    store,
    agent: {
      id: 'codex',
      async status() {
        return new Promise(() => {});
      },
      async reply() {
        throw new Error('Non disponible');
      },
    },
  });
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  const response = await fetch(origin + '/api/bootstrap', {
    signal: AbortSignal.timeout(2000),
  });
  assert.equal(response.status, 200);
  assert.equal(typeof (await response.json()).csrf, 'string');
});

test('connexion d’un assistant : commande officielle fixe, rien d’autre', async (t) => {
  const { post, terminal } = await fixture(t);
  const ok = await post('agent-login', { agent: 'claude' });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { opened: false, command: 'claude' });
  assert.deepEqual(terminal, ['claude']);
  // Autre assistant ou commande fournie par le navigateur : refusé.
  for (const agent of ['codex', 'gemini'])
    assert.equal((await post('agent-login', { agent })).status, 400);
  assert.equal(
    (await post('agent-login', { agent: 'claude', command: 'rm -rf ~' }))
      .status,
    400,
  );
  assert.deepEqual(terminal, ['claude']);
});

test('Figma : lien requis, lecture en diff, écriture validée une seule fois', async (t) => {
  const fake = fakeFigmaConnector(
    [
      { name: 'color/brand', type: 'COLOR', value: '#b85c00' },
      { name: 'color/warning', type: 'COLOR', value: '#9A5B00' },
      { name: 'space/md', type: 'STRING', value: 'oops' },
      { name: 'Bouton/Primaire/Fond', type: 'COLOR', value: '#000000' },
    ],
    [sampleComponent],
  );
  const { origin, post, store } = await fixture(
    t,
    false,
    undefined,
    fake.connector,
  );
  // Sans lien Figma : refus clair, aucun appel.
  const none = await post('figma/pull', { revision: 0 });
  assert.equal(none.status, 400);
  assert.match(
    (await none.json()).error,
    /lien de ton fichier dans Paramètres › Figma/,
  );
  assert.equal(fake.calls.length, 0);
  const brief = await (await fetch(origin + '/api/project')).json();
  await post('project', {
    base: brief.base,
    project: {
      ...brief.project,
      figmaUrl:
        'https://www.figma.com/design/A7nqzQVmFo6pLvDMB7aWHg/Gutt?node-id=1-7',
    },
  });
  const status = await (await fetch(origin + '/api/figma/status')).json();
  assert.equal(status.state, 'connected');
  assert.equal(status.fileKey, 'A7nqzQVmFo6pLvDMB7aWHg');
  // Lecture : proposition « figma », rien d'écrit avant validation.
  const pulled = await (await post('figma/pull', { revision: 0 })).json();
  assert.equal(pulled.proposal.source, 'figma');
  assert.deepEqual(
    pulled.proposal.patches.map((p: { key: string }) => p.key).sort(),
    ['color.brand', 'color.warning'],
  );
  assert.equal(pulled.ignored.length, 2);
  // Composants lus avec la lecture, servis en lecture seule.
  const comps = await (await fetch(origin + '/api/figma/components')).json();
  assert.equal(comps.components[0].name, 'Tag');
  assert.equal(comps.components[0].variants[0].root.f.v, 'color/danger');
  assert.equal(store.snapshot().revision, 0);
  assert.equal((await post('commit', { id: pulled.proposal.id })).status, 200);
  assert.equal(store.snapshot().tokens['color.warning'].$value, '#9A5B00');
  // Écriture : aperçu, validation unique, révision contrôlée.
  const preview = await (await post('figma/preview', { revision: 1 })).json();
  assert.ok(preview.approvalId);
  assert.ok(preview.patches.some((p: { key: string }) => p.key === 'space.md'));
  assert.equal(fake.calls.filter((c) => c.startsWith('write')).length, 0);
  const applied = await post('figma/apply', { approvalId: preview.approvalId });
  assert.equal(applied.status, 200);
  assert.equal((await applied.json()).verified, true);
  assert.equal(fake.variables.get('space/md')?.value, 16);
  // L'envoi relit sans les composants mais garde les derniers lus.
  const kept = await (await fetch(origin + '/api/figma/components')).json();
  assert.equal(kept.components.length, 1);
  const replay = await post('figma/apply', { approvalId: preview.approvalId });
  assert.equal(replay.status, 404);
  // Aperçu périmé si le DS change entre-temps.
  const change = async (revision: number, value: number) => {
    const p = await (
      await post('proposals', {
        revision,
        changes: [{ key: 'space.lg', value }],
      })
    ).json();
    assert.equal((await post('commit', { id: p.id })).status, 200);
  };
  await change(1, 30);
  const preview2 = await (await post('figma/preview', { revision: 2 })).json();
  assert.ok(preview2.approvalId);
  await change(2, 32);
  const stale = await post('figma/apply', { approvalId: preview2.approvalId });
  assert.equal(stale.status, 409);
  assert.equal(fake.calls.filter((c) => c.startsWith('write')).length, 1);
});

test('Figma : connexion par la commande officielle, liste fermée', async (t) => {
  const { post, terminal } = await fixture(t);
  const r = await (await post('agent-login', { agent: 'figma' })).json();
  assert.match(
    r.command,
    /^claude mcp add --transport http --scope user figma https:\/\/mcp\.figma\.com\/mcp/,
  );
  assert.deepEqual(terminal, [r.command]);
  assert.equal((await post('agent-login', { agent: 'rm -rf' })).status, 400);
});
test('projets : créer, isoler les tokens et le brief, rouvrir, onglet périmé refusé', async (t) => {
  const { origin, post, directory } = await fixture(t);
  const get = async (route: string) =>
    (await fetch(origin + '/api/' + route)).json();
  const first = await get('projects');
  assert.equal(first.current, 'gutt');
  // Gutt garde le dossier d'origine : une modif y est faite avant la création.
  const p = await (
    await post('proposals', {
      revision: 0,
      changes: [{ key: 'color.brand', value: '#112233' }],
    })
  ).json();
  assert.equal((await post('commit', { id: p.id })).status, 200);
  assert.equal(
    (await post('projects/create', { name: '', from: 'neutre' })).status,
    400,
  );
  const created = await (
    await post('projects/create', { name: 'Betclic Poker', from: 'neutre' })
  ).json();
  assert.equal(created.current, 'betclic-poker');
  assert.equal(created.projects.length, 2);
  const state = await get('state');
  assert.equal(state.revision, 0);
  // Départ neutre : pas la couleur de Gutt.
  assert.equal(state.tokens['color.brand'].$value, '#3A3A3A');
  assert.equal((await get('project')).project.name, 'Betclic Poker');
  assert.equal((await get('bootstrap')).project, 'betclic-poker');
  // Un onglet resté sur Gutt ne peut pas écrire dans le nouveau projet.
  assert.equal(
    (
      await post(
        'proposals',
        { revision: 0, changes: [{ key: 'color.brand', value: '#445566' }] },
        { 'X-DS-Project': 'gutt' },
      )
    ).status,
    409,
  );
  // Copie : reprend les tokens du projet ouvert.
  await post('projects/open', { id: 'gutt' });
  assert.equal((await get('state')).tokens['color.brand'].$value, '#112233');
  const copy = await (
    await post('projects/create', { name: 'Gutt', from: 'copie' })
  ).json();
  assert.equal(copy.current, 'gutt-2');
  assert.equal((await get('state')).tokens['color.brand'].$value, '#112233');
  assert.equal((await post('projects/open', { id: 'inconnu' })).status, 404);
  const registry = JSON.parse(
    await readFile(path.join(directory, 'projets.json'), 'utf8'),
  );
  assert.equal(registry.current, 'gutt-2');
  assert.equal(registry.projects.length, 3);
});

test('projets : renommer, supprimer vers projets-supprimes, dossier des données', async (t) => {
  const { origin, post, directory } = await fixture(t);
  const get = async (route: string) =>
    (await fetch(origin + '/api/' + route)).json();
  // Supprimer le projet ouvert rouvre Gutt.
  await post('projects/create', { name: 'Brouillon', from: 'neutre' });
  const gone = await (
    await post('projects/delete', { id: 'brouillon' })
  ).json();
  assert.equal(gone.current, 'gutt');
  assert.equal((await get('bootstrap')).project, 'gutt');
  await post('projects/create', { name: 'École', from: 'neutre' });
  await post('projects/open', { id: 'gutt' });
  // Gutt ne se supprime pas.
  assert.equal((await post('projects/delete', { id: 'gutt' })).status, 400);
  assert.equal(
    (await post('projects/rename', { id: 'ecole', name: '' })).status,
    400,
  );
  const renamed = await (
    await post('projects/rename', { id: 'ecole', name: 'Projet école' })
  ).json();
  assert.equal(
    renamed.projects.find((p: { id: string }) => p.id === 'ecole').name,
    'Projet école',
  );
  const after = await (await post('projects/delete', { id: 'ecole' })).json();
  assert.deepEqual(
    after.projects.map((p: { id: string }) => p.id),
    ['gutt'],
  );
  // Rien n'est effacé : le dossier est rangé dans projets-supprimes.
  const kept = await readdir(path.join(directory, 'projets-supprimes'));
  assert.equal(kept.length, 2);
  assert.ok(kept.some((k) => /^ecole-\d+$/.test(k)));
  const info = await get('data-info');
  assert.equal(info.dir, directory);
  assert.match(info.version, /^\d+\.\d+\.\d+/);
  const open = await (await post('open-data-folder', {})).json();
  assert.deepEqual(open, { opened: false, dir: directory });
});

test('projets : le départ neutre respecte les contrastes AA', async () => {
  const { neutralTokens } = await import('../app/server/projects.js');
  const { contrast } = await import('../app/shared/model.js');
  const t = neutralTokens(seed);
  const c = (k: string) => String(t[k as keyof typeof t].$value);
  assert.ok(contrast(c('color.onBrand'), c('color.brand')) >= 4.5);
  assert.ok(contrast(c('color.text'), c('color.canvas')) >= 4.5);
  assert.ok(contrast(c('color.muted'), c('color.surface')) >= 4.5);
  assert.ok(contrast(c('color.border'), c('color.surface')) >= 3);
  assert.ok(contrast(c('color.danger'), c('color.surface')) >= 4.5);
});

test('projets : créer pendant une demande Claude attend sa fin', async (t) => {
  let release!: () => void;
  const { post, origin } = await fixture(t, false, {
    id: 'claude',
    async status() {
      return { available: true, detail: 'simulation' };
    },
    async reply() {
      await new Promise<void>((r) => (release = r));
      return { message: 'ok', changes: [] };
    },
  });
  const asking = post('agent', {
    agent: 'claude',
    revision: 0,
    message: 'Une question',
    history: [],
  });
  await new Promise((r) => setTimeout(r, 50));
  const creating = post('projects/create', { name: 'Pendant', from: 'neutre' });
  await new Promise((r) => setTimeout(r, 300));
  release();
  // La réponse reste dans Gutt, puis le projet est créé et ouvert.
  assert.equal((await asking).status, 200);
  const created = await creating;
  assert.equal(created.status, 200);
  assert.equal((await created.json()).current, 'pendant');
  const boot = await (await fetch(origin + '/api/bootstrap')).json();
  assert.equal(boot.project, 'pendant');
});
