// Qualification locale du connecteur Figma avec le vrai CLI Claude et un
// serveur MCP Figma SIMULÉ (aucun appel à Figma). Consomme un peu de quota
// Claude. Usage : npx tsx scripts/check-figma-guard.ts
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClaudeFigmaConnector } from '../connectors/figma/claudeFigma.js';
import { planPush, figmaToChanges } from '../connectors/figma/scripts.js';
import { tokensSchema } from '../app/shared/model.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const log = path.join(tmpdir(), `ds-fake-figma-${process.pid}.log`);
const connector = new ClaudeFigmaConnector({
  mcpConfig: {
    mcpServers: {
      figma: {
        type: 'stdio',
        command: process.execPath,
        args: [path.join(here, '../tests/fixtures/fake-figma-mcp.mjs')],
        env: { FAKE_LOG: log },
      },
    },
  },
});
const tokens = tokensSchema.parse(
  JSON.parse(
    await readFile(
      path.join(here, '../workspace/design-system.tokens.json'),
      'utf8',
    ),
  ),
);
const key = 'AAAAAAAAAAAAAAAAAAAAAA';
const read = await connector.read(key);
console.log(
  'lecture :',
  read.variables.length,
  'variables',
  figmaToChanges(read, tokens).changes.length,
  'changements',
);
const plan = planPush(tokens, read);
const result = await connector.write(key, plan);
console.log('écriture :', result);
const calls = (await readFile(log, 'utf8'))
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l));
console.log('appels reçus par le faux Figma :', calls.length);
await rm(log, { force: true });
