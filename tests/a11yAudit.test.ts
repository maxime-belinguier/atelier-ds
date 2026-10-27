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

test('profils : la malvoyance forte exige 7:1 pour le texte', () => {
  const aa = auditTokens(tokens, 'aa').find(
    (c) => c.id === 'color.muted|color.surface',
  )!;
  const aaa = auditTokens(tokens, 'aaa').find(
    (c) => c.id === 'color.muted|color.surface',
  )!;
  assert.match(aa.rule, /4,5:1/);
  assert.match(aaa.rule, /7:1/);
});

test('profils : une correction proposée passe vraiment le seuil', async () => {
  const { contrast } = await import('../app/shared/model.js');
  const bad = auditTokens({
    ...tokens,
    'color.border': { ...tokens['color.border'], $value: '#EEEEEE' },
    'color.surface': { ...tokens['color.surface'], $value: '#FFFFFF' },
  }).find((c) => c.id === 'color.border|color.surface')!;
  assert.equal(bad.status, 'fail');
  assert.equal(bad.fix?.key, 'color.border');
  assert.ok(contrast(bad.fix!.value, '#FFFFFF') >= 3);
});

test('daltonisme : rouge et vert proches sont signalés et corrigés', async () => {
  const { simulate, deltaE, distinctMin } =
    await import('../app/client/a11yAudit.js');
  const t = {
    ...tokens,
    'color.danger': { ...tokens['color.danger'], $value: '#C0392B' },
    'color.success': { ...tokens['color.success'], $value: '#4A7A2A' },
  };
  const c = auditTokens(t, 'deuteranopia').find(
    (x) => x.id === 'color.danger~color.success',
  )!;
  assert.equal(c.status, 'fail');
  assert.ok(c.fix);
  assert.ok(
    deltaE(
      simulate('#C0392B', 'deuteranopia'),
      simulate(c.fix!.value, 'deuteranopia'),
    ) >= distinctMin,
  );
});

test('sans couleur : simulation en niveaux de gris', async () => {
  const { simulate } = await import('../app/client/a11yAudit.js');
  const g = simulate('#3154C4', 'achromatopsia');
  assert.equal(g.slice(1, 3), g.slice(3, 5));
  assert.equal(g.slice(3, 5), g.slice(5, 7));
});
