import { tokenKeys, type TokenKey, type Tokens } from '../shared/model.js';

// Exports pour le code de l'application Gutt. Ils partent toujours des
// valeurs enregistrées, jamais des modifications en aperçu.

const kebab = (s: string) =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
// « color.brandHover » → « color-brand-hover »
export const cssName = (key: TokenKey) => kebab(key.replace('.', '-'));
const short = (key: TokenKey) => kebab(key.split('.')[1]);
const fontStack = (f: string) =>
  f === 'system-ui'
    ? "system-ui, -apple-system, 'Segoe UI', sans-serif"
    : `${f}, sans-serif`;
const cssValue = (tokens: Tokens, key: TokenKey) => {
  const t = tokens[key];
  if (t.$type === 'dimension') return `${t.$value}px`;
  if (t.$type === 'fontFamily') return fontStack(String(t.$value));
  return String(t.$value);
};
const header = (format: string) =>
  `/* Design System Gutt · ${format} · généré par DS-Studio */\n`;

export function toCssVariables(tokens: Tokens) {
  const lines = tokenKeys.map(
    (k) => `  --${cssName(k)}: ${cssValue(tokens, k)};`,
  );
  return `${header('variables CSS')}:root {\n${lines.join('\n')}\n}\n`;
}

// Tailwind v4 : variables de thème dans @theme (espaces de noms officiels
// --color-*, --font-*, --text-*, --spacing-*, --radius-*).
export function toTailwindV4(tokens: Tokens) {
  const lines: string[] = [];
  for (const k of tokenKeys) {
    const [group] = k.split('.');
    const name = short(k);
    if (group === 'color')
      lines.push(`  --color-${name}: ${cssValue(tokens, k)};`);
    else if (k === 'font.family')
      lines.push(`  --font-sans: ${cssValue(tokens, k)};`);
    else if (group === 'font')
      lines.push(`  --text-${name}: ${cssValue(tokens, k)};`);
    else if (group === 'space')
      lines.push(`  --spacing-${name}: ${cssValue(tokens, k)};`);
    else if (group === 'radius')
      lines.push(`  --radius-${name}: ${cssValue(tokens, k)};`);
  }
  return `${header('Tailwind CSS v4')}@import 'tailwindcss';\n\n@theme {\n${lines.join('\n')}\n}\n`;
}

// Tailwind v3 : extension du thème dans tailwind.config.js.
export function toTailwindV3(tokens: Tokens) {
  const colors: Record<string, string> = {};
  const fontSize: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const borderRadius: Record<string, string> = {};
  let sans = '';
  for (const k of tokenKeys) {
    const [group] = k.split('.');
    const name = short(k);
    if (group === 'color') colors[name] = cssValue(tokens, k);
    else if (k === 'font.family') sans = String(tokens[k].$value);
    else if (group === 'font') fontSize[name] = cssValue(tokens, k);
    else if (group === 'space') spacing[name] = cssValue(tokens, k);
    else if (group === 'radius') borderRadius[name] = cssValue(tokens, k);
  }
  const config = {
    theme: {
      extend: {
        colors,
        fontFamily: { sans: fontStack(sans).split(', ') },
        fontSize,
        spacing,
        borderRadius,
      },
    },
  };
  return `${header('Tailwind CSS v3').replace('/*', '//').replace(' */', '')}/** @type {import('tailwindcss').Config} */\nexport default ${JSON.stringify(config, null, 2)};\n`;
}
