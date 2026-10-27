import { test } from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../app/server/store.js';
import { tokensSchema } from '../app/shared/model.js';
import { createStudioServer } from '../app/server/http.js';
import type { AgentAdapter } from '../connectors/agents/types.js';
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
    terminal: async (command) => {
      terminal.push(command);
      return false;
    },
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
  return { origin, post, store, terminal };
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
