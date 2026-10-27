import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CodexAdapter,
  restrictedArgs,
  runCli,
} from '../connectors/agents/codex.js';
import { unvalidatedAdapter } from '../connectors/agents/unvalidated.js';
test('CLI réellement absent : erreur exploitable et mode manuel disponible', async () => {
  const adapter = new CodexAdapter('ds-studio-definitely-missing-cli');
  assert.equal((await adapter.status()).available, false);
  await assert.rejects(
    () =>
      runCli('ds-studio-definitely-missing-cli', [], '', {}, undefined, 500),
    /CLI Codex absent/,
  );
});
test('erreur CLI non authentifié simulée, stderr sensible jamais exposé', async () => {
  await assert.rejects(
    () =>
      runCli(
        process.execPath,
        [
          '-e',
          "process.stderr.write('FAKE_PRIVATE_AUTH_DETAIL');process.exit(1)",
        ],
        '',
      ),
    (e) =>
      /Codex indisponible/.test((e as Error).message) &&
      !(e as Error).message.includes('PRIVATE'),
  );
});
test('arrêt interrompt réellement un processus enfant', async () => {
  const c = new AbortController();
  const result = runCli(
    process.execPath,
    ['-e', 'setInterval(()=>{},1000)'],
    '',
    {},
    c.signal,
  );
  c.abort();
  await assert.rejects(() => result, /interrompue/);
});
test('timeout du processus enfant exécuté', async () => {
  await assert.rejects(
    () =>
      runCli(
        process.execPath,
        ['-e', 'setInterval(()=>{},1000)'],
        '',
        {},
        undefined,
        50,
      ),
    /Délai CLI/,
  );
});
test('Claude et Gemini indisponibles explicitement', async () => {
  for (const id of ['claude', 'gemini'] as const) {
    const a = unvalidatedAdapter(id);
    assert.equal((await a.status()).available, false);
    await assert.rejects(() => a.reply('test', {} as never), /non implémenté/);
  }
});
test('configuration restrictive ne contient aucune permission automatique', () => {
  assert(restrictedArgs.includes('--ignore-user-config'));
  assert(restrictedArgs.includes('read-only'));
  assert(restrictedArgs.includes('mcp_servers={}'));
  assert(
    !restrictedArgs.some(
      (a) => a.includes('dangerously') || a.includes('approve-for-me'),
    ),
  );
});

test('sortie UTF-8 scindée entre buffers conservée', async () => {
  const result = await runCli(
    process.execPath,
    [
      '-e',
      'process.stdout.write(Buffer.from([0xc3]));setTimeout(()=>process.stdout.write(Buffer.from([0xa9])),20)',
    ],
    '',
  );
  assert.equal(result, 'é');
});

// ---- Claude Code (expérimental) ----
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ClaudeAdapter,
  claudeArgs,
  parseClaudeOutput,
} from '../connectors/agents/claude.js';

const ok = (result: string, extra = {}) =>
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    num_turns: 1,
    permission_denials: [],
    result,
    ...extra,
  });

test('Claude : CLI absent, adaptateur indisponible et mode manuel conservé', async () => {
  const a = new ClaudeAdapter('ds-studio-definitely-missing-cli');
  const s = await a.status();
  assert.equal(s.available, false);
  assert.match(s.detail, /CLI Claude absent/);
  await assert.rejects(() => a.reply('test', {} as never), /CLI Claude absent/);
});

test('Claude : profil sans outils ni permission automatique', () => {
  const i = claudeArgs.indexOf('--tools');
  assert(i >= 0 && claudeArgs[i + 1] === '');
  for (const flag of [
    '--no-chrome',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--no-session-persistence',
  ])
    assert(claudeArgs.includes(flag));
  assert.equal(claudeArgs[claudeArgs.indexOf('--setting-sources') + 1], '');
  assert.equal(
    claudeArgs[claudeArgs.indexOf('--permission-mode') + 1],
    'dontAsk',
  );
  assert(
    !claudeArgs.some(
      (a) =>
        a.includes('dangerously') ||
        a.includes('bypassPermissions') ||
        a.includes('acceptEdits') ||
        a === '--bare',
    ),
  );
});

test('Claude : sortie valide, bloc de code toléré', () => {
  const r = parseClaudeOutput(
    ok(
      '```json\n{"message":"ok","changes":[{"key":"color.brand","value":"#1F4D3A"}]}\n```',
    ),
  );
  assert.equal(r.changes[0].value, '#1F4D3A');
});

test('Claude : outil, erreur ou format invalide refusés', () => {
  assert.throws(
    () =>
      parseClaudeOutput(ok('{"message":"x","changes":[]}', { num_turns: 2 })),
    /outil inattendu/,
  );
  assert.throws(
    () =>
      parseClaudeOutput(
        ok('{"message":"x","changes":[]}', { permission_denials: [{}] }),
      ),
    /outil inattendu/,
  );
  assert.throws(
    () => parseClaudeOutput(ok('x', { is_error: true, subtype: 'error' })),
    /Échec Claude/,
  );
  assert.throws(() => parseClaudeOutput('pas du json'), /illisible/);
  assert.throws(() => parseClaudeOutput(ok('Bonjour')), /hors format/);
});

test(
  'Claude : faux CLI réel, contexte via stdin, stderr jamais exposé',
  { skip: process.platform === 'win32' && 'script shebang POSIX' },
  async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ds-fake-claude-'));
    const bin = path.join(dir, 'claude');
    await writeFile(
      bin,
      `#!${process.execPath}
if (process.argv.includes('--version')) { console.log('9.9.9 (Claude Code)'); process.exit(0); }
let input = '';
process.stdin.on('data', (b) => (input += b));
process.stdin.on('end', () => {
  const { message } = JSON.parse(input);
  if (message === 'fail') { process.stderr.write('PRIVATE_ACCOUNT_DETAIL'); process.exit(1); }
  process.stdout.write(${JSON.stringify(ok('__R__'))}.replace('"__R__"', JSON.stringify(JSON.stringify({ message: 'reçu ' + message, changes: [] }))));
});
`,
    );
    await chmod(bin, 0o755);
    try {
      const a = new ClaudeAdapter(bin);
      assert.equal((await a.status()).available, true);
      const ctx = { tokens: {}, brief: '', rules: '', history: [] } as never;
      assert.equal((await a.reply('test', ctx)).message, 'reçu test');
      await assert.rejects(
        () => a.reply('fail', ctx),
        (e) =>
          /Claude indisponible/.test((e as Error).message) &&
          !(e as Error).message.includes('PRIVATE'),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
