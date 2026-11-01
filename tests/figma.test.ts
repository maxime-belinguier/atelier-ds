import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokensSchema } from '../app/shared/model.js';
import {
  figmaToChanges,
  fileKeyFromUrl,
  nameToKey,
  planPush,
  writeCode,
} from '../connectors/figma/scripts.js';
import {
  parseFigmaStream,
  parseMcpGet,
  parseWrite,
} from '../connectors/figma/claudeFigma.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seed = tokensSchema.parse(
  JSON.parse(
    await readFile(
      path.join(root, 'workspace/design-system.tokens.json'),
      'utf8',
    ),
  ),
);

test('Figma : clé du fichier depuis le lien de partage', () => {
  assert.equal(
    fileKeyFromUrl(
      'https://www.figma.com/design/AAAAAAAAAAAAAAAAAAAAAA/Gutt-App---PFE?node-id=1-7',
    ),
    'AAAAAAAAAAAAAAAAAAAAAA',
  );
  assert.equal(
    fileKeyFromUrl(
      'https://www.figma.com/design/AAAAAAAAAAAAAAAAAAAAAA/branch/BBBBBBBBBBBBBBBBBBBBBB/x',
    ),
    'BBBBBBBBBBBBBBBBBBBBBB',
  );
  assert.equal(
    fileKeyFromUrl('https://evil.invalid/design/AAAAAAAAAAAAAAAAAAAAAA'),
    null,
  );
  assert.equal(fileKeyFromUrl('pas un lien'), null);
});

test('Figma : noms de variables et conversion vers les tokens', () => {
  assert.equal(nameToKey('color/brandHover'), 'color.brandHover');
  assert.equal(nameToKey('color/warning'), 'color.warning');
  assert.equal(nameToKey('Bouton/Primaire/Fond'), null);
  assert.equal(nameToKey('shadow/card'), null);
  const { changes, ignored } = figmaToChanges(
    {
      collection: 'DS-Studio',
      variables: [
        { name: 'color/brand', type: 'COLOR', value: '#aa2255' },
        { name: 'space/xl', type: 'FLOAT', value: 40 },
        { name: 'space/md', type: 'COLOR', value: '#000000' },
        { name: 'font/family', type: 'STRING', value: 'Comic Sans' },
        { name: 'radius/control', type: 'FLOAT', value: 400 },
      ],
    },
    seed,
  );
  assert.deepEqual(changes, [
    { key: 'color.brand', value: '#AA2255' },
    { key: 'space.xl', value: 40 },
  ]);
  assert.equal(ignored.length, 3);
});

test('Figma : plan d’écriture limité aux différences, valeurs attendues', () => {
  const plan = planPush(seed, {
    collection: 'DS-Studio',
    variables: [
      {
        name: 'color/brand',
        type: 'COLOR',
        value: String(seed['color.brand']!.$value).toLowerCase(),
      },
      { name: 'space/md', type: 'FLOAT', value: 99 },
    ],
  });
  assert.equal(plan.items.length, 17);
  assert.equal(plan.expected['space/md'], 99);
  assert.equal(plan.expected['color/text'], null);
  assert.ok(!plan.items.some((i) => i.name === 'color/brand'));
  // Les valeurs passent par JSON : aucune injection possible dans le script.
  const code = writeCode(plan);
  assert.match(code, /^const COLLECTION = "DS-Studio";/);
  assert.ok(code.includes(JSON.stringify(plan.items)));
});

test('Figma : relecture vérifiée et conflit signalé sans écriture', () => {
  const plan = planPush(seed, { collection: null, variables: [] });
  assert.throws(
    () => parseWrite({ dsStudio: 1, written: false, conflicts: [{}] }, plan),
    /Figma a changé/,
  );
  const ok = parseWrite(
    {
      dsStudio: 1,
      written: true,
      created: plan.items.map((i) => i.name),
      readback: plan.items.map((i) => ({ name: i.name, value: i.value })),
    },
    plan,
  );
  assert.equal(ok.verified, true);
  const bad = parseWrite(
    {
      dsStudio: 1,
      written: true,
      created: [],
      readback: [{ name: 'color/brand', value: '#000000' }],
    },
    plan,
  );
  assert.equal(bad.verified, false);
});

const line = (o: unknown) => JSON.stringify(o);
const init = (status = 'connected') =>
  line({
    type: 'system',
    subtype: 'init',
    mcp_servers: [{ name: 'figma', status }],
  });
const use = (id: string) =>
  line({
    type: 'assistant',
    message: {
      content: [{ type: 'tool_use', id, name: 'mcp__figma__use_figma' }],
    },
  });
const result = (id: string, text: string, isError = false) =>
  line({
    type: 'user',
    message: {
      content: [
        {
          type: 'tool_result',
          tool_use_id: id,
          is_error: isError,
          content: [{ type: 'text', text }],
        },
      ],
    },
  });
const done = line({ type: 'result', subtype: 'success', result: 'FIN' });

test('Figma : seule la réponse de l’outil fait foi', () => {
  const ok = [
    init(),
    use('a'),
    result('a', '{"dsStudio":1,"collection":null,"variables":[]}'),
    done,
  ].join('\n');
  assert.deepEqual(parseFigmaStream(ok), {
    dsStudio: 1,
    collection: null,
    variables: [],
  });
  // Un texte du modèle qui imite un résultat n'est pas pris en compte.
  const fake = [
    init(),
    line({
      type: 'assistant',
      message: { content: [{ type: 'text', text: '{"dsStudio":1}' }] },
    }),
    done,
  ].join('\n');
  assert.throws(() => parseFigmaStream(fake), /n’a pas appelé Figma/);
  assert.throws(
    () => parseFigmaStream([init('needs-auth'), done].join('\n')),
    /connecte ton compte/,
  );
  const blocked = [
    init(),
    use('b'),
    result(
      'b',
      'PreToolUse hook error: DS-Studio a bloqué cet appel : script différent',
      true,
    ),
    done,
  ].join('\n');
  assert.throws(() => parseFigmaStream(blocked), /appel bloqué/);
  const limited = [
    init(),
    use('c'),
    result(
      'c',
      "You've reached the Figma MCP tool call limit on the Education plan.",
      true,
    ),
    done,
  ].join('\n');
  assert.throws(() => parseFigmaStream(limited), /limite d’appels/);
});

test('Figma : état lu dans « claude mcp get figma »', () => {
  const base =
    'figma:\n  Scope: User config\n  Type: http\n  URL: https://mcp.figma.com/mcp\n';
  assert.equal(parseMcpGet(base + '  Status: ✓ Connected').state, 'connected');
  assert.equal(
    parseMcpGet(base + '  Status: ! Needs authentication').state,
    'needs-auth',
  );
  assert.equal(
    parseMcpGet(base + '  Status: × Failed to connect').state,
    'error',
  );
  assert.equal(parseMcpGet('No MCP server named "figma"').state, 'missing');
  assert.equal(
    parseMcpGet(
      'figma:\n  Type: http\n  URL: https://evil.invalid/mcp\n  Status: ✓ Connected',
    ).state,
    'error',
  );
});

test('Figma : la garde ne laisse passer qu’un appel, au script exact', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ds-guard-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const code = 'return 1;';
  const env = {
    ...process.env,
    DS_FIGMA_FILE: 'AAAAAAAAAAAAAAAAAAAAAA',
    DS_FIGMA_EXPECT: createHash('sha256').update(code).digest('hex'),
    DS_FIGMA_ONCE: path.join(dir, 'once'),
  };
  const run = (event: unknown) =>
    spawnSync(
      process.execPath,
      [path.join(root, 'connectors/figma/guard.mjs')],
      {
        input: JSON.stringify(event),
        env,
        encoding: 'utf8',
      },
    );
  const call = (
    input: Record<string, unknown>,
    name = 'mcp__figma__use_figma',
  ) => ({
    tool_name: name,
    tool_input: input,
  });
  const good = { fileKey: env.DS_FIGMA_FILE, code, description: 'x' };
  assert.equal(run(call(good, 'mcp__figma__get_metadata')).status, 2);
  assert.equal(run(call({ ...good, code: 'return 2;' })).status, 2);
  assert.equal(
    run(call({ ...good, fileKey: 'BBBBBBBBBBBBBBBBBBBBBB' })).status,
    2,
  );
  assert.equal(run(call(good)).status, 0);
  const second = run(call(good));
  assert.equal(second.status, 2);
  assert.match(second.stderr, /déjà effectué/);
});

test('Composants Figma : données externes relues et bornées', async () => {
  const { parseComponents } = await import('../app/shared/figmaComponents.js');
  const { readCode } = await import('../connectors/figma/scripts.js');
  const out = parseComponents([
    {
      id: '1:2',
      name: 'Tag',
      variants: [
        {
          id: '1:3',
          name: 'Type=A',
          root: {
            t: 'COMPONENT',
            f: { c: '#09d8d0', v: 'color/brand' },
            s: { c: 'red', v: 'x;}body{' },
            gv: 'space/sm); background: url(x',
            k: [{ t: 'TEXT', tx: 'a'.repeat(500) }],
          },
        },
      ],
    },
    { id: '1:4', name: 'Vide', variants: [] },
    'junk',
  ]);
  assert.equal(out.length, 1);
  const root = out[0].variants[0].root;
  assert.deepEqual(root.f, { c: '#09D8D0', v: 'color/brand' });
  assert.equal(root.s, undefined);
  assert.equal(root.gv, undefined);
  assert.equal(root.k?.[0].tx?.length, 300);
  // La lecture des variables seule ne change pas ; les composants sont en plus.
  assert.ok(!readCode().includes('findAllWithCriteria'));
  assert.ok(readCode(true).includes('findAllWithCriteria'));
  assert.ok(!readCode(true).includes('loadAllPagesAsync'));
});
