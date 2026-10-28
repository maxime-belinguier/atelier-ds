// Faux serveur MCP Figma (stdio) pour qualifier le connecteur sans Figma.
// Il exécute le script reçu sur une petite simulation de l'API variables.
import { createInterface } from 'node:readline';
import { appendFileSync } from 'node:fs';

const store = new Map([
  ['color/brand', { type: 'COLOR', value: { r: 1, g: 0, b: 0 } }],
  ['space/md', { type: 'FLOAT', value: 20 }],
  ['Other name', { type: 'FLOAT', value: 3 }],
]);
function fakeFigma() {
  const col = {
    id: 'c1',
    name: 'DS-Studio',
    defaultModeId: 'm1',
    modes: [{ name: 'Mode 1' }],
  };
  const vars = () =>
    [...store.entries()].map(([name, v], i) => ({
      id: `v${i}-${name}`,
      name,
      resolvedType: v.type,
      valuesByMode: { m1: v.value },
      variableCollectionId: 'c1',
      set scopes(_s) {},
      setValueForMode(_m, val) {
        store.get(name).value = val;
      },
    }));
  return {
    variables: {
      getLocalVariableCollectionsAsync: async () => [
        { ...col, variableIds: vars().map((v) => v.id) },
      ],
      getVariableByIdAsync: async (id) =>
        vars().find((v) => v.id === id) ?? null,
      createVariableCollection: () => col,
      createVariable: (name, _c, type) => {
        store.set(name, { type, value: null });
        return vars().find((v) => v.name === name);
      },
    },
  };
}
const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
createInterface({ input: process.stdin }).on('line', async (line) => {
  const m = JSON.parse(line);
  if (m.method === 'initialize')
    return send({
      jsonrpc: '2.0',
      id: m.id,
      result: {
        protocolVersion: m.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'fake-figma', version: '1' },
      },
    });
  if (m.method === 'tools/list')
    return send({
      jsonrpc: '2.0',
      id: m.id,
      result: {
        tools: [
          {
            name: 'use_figma',
            description: 'Run Figma Plugin API JavaScript in a file',
            inputSchema: {
              type: 'object',
              properties: {
                fileKey: { type: 'string' },
                code: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['fileKey', 'code', 'description'],
            },
          },
          {
            name: 'get_metadata',
            description: 'Read metadata',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
    });
  if (m.method === 'tools/call') {
    if (process.env.FAKE_LOG)
      appendFileSync(process.env.FAKE_LOG, JSON.stringify(m.params) + '\n');
    try {
      const fn = new Function(
        'figma',
        `return (async () => {${m.params.arguments.code}\n})()`,
      );
      const value = await fn(fakeFigma());
      return send({
        jsonrpc: '2.0',
        id: m.id,
        result: { content: [{ type: 'text', text: JSON.stringify(value) }] },
      });
    } catch (e) {
      return send({
        jsonrpc: '2.0',
        id: m.id,
        result: { isError: true, content: [{ type: 'text', text: String(e) }] },
      });
    }
  }
  if (m.id !== undefined) send({ jsonrpc: '2.0', id: m.id, result: {} });
});
