import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tokensSchema, type Tokens } from '../app/shared/model.js';
import { auditTokens, score } from '../app/client/a11yAudit.js';

const tokens = tokensSchema.parse(
  JSON.parse(await readFile('workspace/design-system.tokens.json', 'utf8')),
);
const withValue = (key: keyof Tokens, value: string | number): Tokens => ({
  ...tokens,
  [key]: { ...tokens[key], $value: value },
});

test('audit : 12 contrastes et 2 conseils de texte', () => {
  const checks = auditTokens(tokens);
  assert.equal(checks.filter((c) => c.group === 'Contrastes').length, 12);
  assert.equal(checks.filter((c) => c.group === 'Texte').length, 2);
});

test('audit : texte gris clair sur blanc échoue en 4,5:1', () => {
  const bad = auditTokens({
    ...withValue('color.text', '#BBBBBB'),
    'color.surface': { ...tokens['color.surface'], $value: '#FFFFFF' },
  }).find((c) => c.id === 'color.text|color.surface')!;
  assert.equal(bad.status, 'fail');
  assert.equal(bad.value, '1,92:1');
});

test('audit : texte de 14 px donne un conseil, pas un échec', () => {
  const c = auditTokens(withValue('font.body', 14)).find(
    (x) => x.id === 'body-size',
  )!;
  assert.equal(c.status, 'tip');
});

test('score : les conseils ne baissent pas le score', () => {
  const base = score(auditTokens(tokens));
  assert.equal(score(auditTokens(withValue('font.body', 12))), base);
  const worse = score(
    auditTokens({
      ...withValue('color.muted', '#EEEEEE'),
      'color.surface': { ...tokens['color.surface'], $value: '#FFFFFF' },
    }),
  );
  assert.ok(worse < base || base < 100);
});
