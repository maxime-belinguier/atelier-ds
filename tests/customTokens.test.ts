import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../app/server/store.js';
import {
  allKeys,
  applyChanges,
  changeSchema,
  tokensSchema,
} from '../app/shared/model.js';
import { toCssVariables, toTailwindV4 } from '../app/client/exporters.js';

const seed = tokensSchema.parse(
  JSON.parse(
    await readFile(
      new URL('../workspace/design-system.tokens.json', import.meta.url),
      'utf8',
    ),
  ),
);

test('token ajouté : création, diff, enregistrement, relecture et annulation', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ds-custom-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir, seed);
  await store.init();
  const p = store.propose(0, [{ key: 'color.warning', value: '#B85C00' }]);
  assert.deepEqual(p.patches, [
    { key: 'color.warning', before: null, after: '#B85C00' },
  ]);
  await store.commit(p.id);
  const reopened = new Store(dir, seed);
  await reopened.init();
  const tokens = reopened.snapshot().tokens;
  assert.deepEqual(tokens['color.warning'], {
    $type: 'color',
    $value: '#B85C00',
  });
  assert.equal(allKeys(tokens).at(-1), 'color.warning');
  // Annulation : le token disparaît.
  const undo = reopened.proposeUndo(1, reopened.snapshot().history[0].id);
  assert.deepEqual(undo.patches, [
    { key: 'color.warning', before: '#B85C00', after: null },
  ]);
  await reopened.commit(undo.id);
  assert.equal(reopened.snapshot().tokens['color.warning'], undefined);
  const again = new Store(dir, seed);
  await again.init();
  assert.equal(again.snapshot().revision, 2);
});

test('token ajouté : type fixé par le préfixe, noms et suppressions contrôlés', () => {
  const t = applyChanges(seed, [{ key: 'space.xl', value: 40 }]);
  assert.equal(t['space.xl'].$type, 'dimension');
  assert.throws(() => applyChanges(seed, [{ key: 'space.xl', value: 'big' }]));
  assert.throws(() =>
    applyChanges(seed, [{ key: 'color.warning', value: 12 }]),
  );
  assert.throws(() =>
    applyChanges(seed, [{ key: 'color.brand', value: null }]),
  );
  assert.throws(() =>
    applyChanges(seed, [{ key: 'shadow.card', value: '#000000' }]),
  );
  assert.equal(
    changeSchema.safeParse({ key: '__proto__', value: 1 }).success,
    false,
  );
  assert.equal(
    changeSchema.safeParse({ key: 'color.Warning', value: '#000000' }).success,
    false,
  );
  // Un fichier ajouté à la main avec un mauvais type est refusé.
  assert.equal(
    tokensSchema.safeParse({
      ...seed,
      'radius.card': { $type: 'color', $value: '#000000' },
    }).success,
    false,
  );
});

test('token ajouté : présent dans les exports CSS et Tailwind', () => {
  const t = applyChanges(seed, [
    { key: 'color.warning', value: '#B85C00' },
    { key: 'space.xl', value: 40 },
  ]);
  assert.match(toCssVariables(t), /--color-warning: #B85C00;/);
  assert.match(toTailwindV4(t), /--spacing-xl: 40px;/);
});
