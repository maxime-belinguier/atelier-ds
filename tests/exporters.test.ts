import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tokensSchema } from '../app/shared/model.js';
import {
  cssName,
  toCssVariables,
  toTailwindV3,
  toTailwindV4,
} from '../app/client/exporters.js';

const tokens = tokensSchema.parse(
  JSON.parse(await readFile('workspace/design-system.tokens.json', 'utf8')),
);

test('noms CSS en kebab-case', () => {
  assert.equal(cssName('color.brandHover'), 'color-brand-hover');
  assert.equal(cssName('radius.control'), 'radius-control');
});

test('variables CSS : tous les tokens, unités en px', () => {
  const css = toCssVariables(tokens);
  assert.match(css, /--color-brand: #[0-9A-Fa-f]{6};/);
  assert.match(css, /--space-md: \d+px;/);
  assert.match(css, /--font-family: .*sans-serif;/);
  assert.equal(css.match(/^\s+--/gm)?.length, 18);
});

test('Tailwind v4 : espaces de noms du thème', () => {
  const v4 = toTailwindV4(tokens);
  assert.match(v4, /@theme \{/);
  assert.match(v4, /--color-on-brand: #FFFFFF;/i);
  assert.match(v4, /--spacing-md: \d+px;/);
  assert.match(v4, /--radius-control: \d+px;/);
  assert.match(v4, /--text-heading: \d+px;/);
  assert.match(v4, /--font-sans: /);
});

test('Tailwind v3 : objet de configuration valide', () => {
  const v3 = toTailwindV3(tokens);
  const json = v3.slice(
    v3.indexOf('export default ') + 15,
    v3.lastIndexOf('}') + 1,
  );
  const config = JSON.parse(json);
  assert.equal(config.theme.extend.colors.brand, tokens['color.brand']!.$value);
  assert.equal(
    config.theme.extend.spacing.md,
    `${tokens['space.md']!.$value}px`,
  );
  assert(Array.isArray(config.theme.extend.fontFamily.sans));
});
