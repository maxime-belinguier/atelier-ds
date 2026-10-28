import { contrast } from '../shared/model.js';

// Apparence de l'atelier (pas le Design System) : fond, accent et police.
// Préférence locale au navigateur, appliquée par variables CSS.
export const themeKey = 'ds-studio-theme';

export const backgrounds = [
  { id: 'lavande', label: 'Lavande', value: '#FBFAFF' },
  { id: 'neutre', label: 'Neutre', value: '#F8F8FA' },
  { id: 'creme', label: 'Crème', value: '#FCFAF5' },
  { id: 'blanc', label: 'Blanc', value: '#FFFFFF' },
  { id: 'ciel', label: 'Ciel', value: '#EEF4FF' },
  { id: 'glacier', label: 'Glacier', value: '#EDF1F5' },
  { id: 'peche', label: 'Pêche', value: '#FFF1E8' },
  { id: 'rose', label: 'Rose poudré', value: '#FCEEF3' },
  { id: 'sable', label: 'Sable', value: '#F6F1E6' },
] as const;
export const accents = [
  { id: 'corail', label: 'Corail', value: '#FF5A36' },
  { id: 'bleu', label: 'Bleu', value: '#3B6FF5' },
  { id: 'vert', label: 'Vert', value: '#1F9D6B' },
  { id: 'violet', label: 'Violet', value: '#7C5CF5' },
] as const;
// Polices installées avec macOS : aucun téléchargement, marche hors ligne.
// Si une police manque (autre système), la police suivante de la liste prend le relais.
export const uiFonts = [
  {
    id: 'systeme',
    label: 'Système (SF Pro)',
    kind: 'Sans',
    value:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
  },
  {
    id: 'helvetica',
    label: 'Helvetica Neue',
    kind: 'Sans',
    value: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  {
    id: 'avenir',
    label: 'Avenir Next',
    kind: 'Sans',
    value: "'Avenir Next', Avenir, 'Segoe UI', system-ui, sans-serif",
  },
  {
    id: 'futura',
    label: 'Futura',
    kind: 'Sans',
    value: "Futura, 'Century Gothic', sans-serif",
  },
  {
    id: 'gill',
    label: 'Gill Sans',
    kind: 'Sans',
    value: "'Gill Sans', 'Gill Sans MT', Calibri, sans-serif",
  },
  {
    id: 'optima',
    label: 'Optima',
    kind: 'Sans',
    value: 'Optima, Candara, sans-serif',
  },
  {
    id: 'lucida',
    label: 'Lucida Grande',
    kind: 'Sans',
    value: "'Lucida Grande', 'Lucida Sans Unicode', sans-serif",
  },
  {
    id: 'geneva',
    label: 'Geneva',
    kind: 'Sans',
    value: 'Geneva, Tahoma, sans-serif',
  },
  {
    id: 'trebuchet',
    label: 'Trebuchet MS',
    kind: 'Sans',
    value: "'Trebuchet MS', sans-serif",
  },
  {
    id: 'verdana',
    label: 'Verdana',
    kind: 'Sans',
    value: 'Verdana, Geneva, sans-serif',
  },
  {
    id: 'arial',
    label: 'Arial',
    kind: 'Sans',
    value: 'Arial, Helvetica, sans-serif',
  },
  {
    id: 'serif',
    label: 'New York',
    kind: 'Serif',
    value: "'New York', ui-serif, Georgia, 'Times New Roman', serif",
  },
  { id: 'georgia', label: 'Georgia', kind: 'Serif', value: 'Georgia, serif' },
  {
    id: 'charter',
    label: 'Charter',
    kind: 'Serif',
    value: "Charter, 'Bitstream Charter', Georgia, serif",
  },
  {
    id: 'iowan',
    label: 'Iowan Old Style',
    kind: 'Serif',
    value: "'Iowan Old Style', Palatino, Georgia, serif",
  },
  {
    id: 'baskerville',
    label: 'Baskerville',
    kind: 'Serif',
    value: "Baskerville, 'Baskerville Old Face', Georgia, serif",
  },
  {
    id: 'palatino',
    label: 'Palatino',
    kind: 'Serif',
    value: "Palatino, 'Palatino Linotype', Georgia, serif",
  },
  {
    id: 'hoefler',
    label: 'Hoefler Text',
    kind: 'Serif',
    value: "'Hoefler Text', Garamond, Georgia, serif",
  },
  {
    id: 'didot',
    label: 'Didot',
    kind: 'Serif',
    value: "Didot, 'Bodoni 72', Georgia, serif",
  },
  {
    id: 'times',
    label: 'Times New Roman',
    kind: 'Serif',
    value: "'Times New Roman', Times, serif",
  },
  {
    id: 'rockwell',
    label: 'Rockwell',
    kind: 'Serif',
    value: "Rockwell, 'Courier New', serif",
  },
  {
    id: 'typewriter',
    label: 'American Typewriter',
    kind: 'Serif',
    value: "'American Typewriter', 'Courier New', serif",
  },
  {
    id: 'mono',
    label: 'SF Mono',
    kind: 'Mono',
    value: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  },
  {
    id: 'menlo',
    label: 'Menlo',
    kind: 'Mono',
    value: 'Menlo, Consolas, monospace',
  },
  {
    id: 'monaco',
    label: 'Monaco',
    kind: 'Mono',
    value: 'Monaco, Consolas, monospace',
  },
  {
    id: 'courier',
    label: 'Courier New',
    kind: 'Mono',
    value: "'Courier New', Courier, monospace",
  },
] as const;

export const modes = [
  { id: 'light', label: 'Clair' },
  { id: 'dark', label: 'Sombre' },
  { id: 'auto', label: 'Auto (Mac)' },
] as const;
export interface Theme {
  bg: string;
  accent: string;
  font: (typeof uiFonts)[number]['id'];
  mode: (typeof modes)[number]['id'];
}
export const defaultTheme: Theme = {
  bg: '#FBFAFF',
  accent: '#FF5A36',
  font: 'systeme',
  mode: 'light',
};

const hex6 = /^#[0-9a-fA-F]{6}$/;
export function readTheme(): Theme {
  try {
    const t = JSON.parse(localStorage.getItem(themeKey) || '{}');
    return {
      bg: hex6.test(t.bg) ? t.bg : defaultTheme.bg,
      accent: hex6.test(t.accent) ? t.accent : defaultTheme.accent,
      font: uiFonts.some((f) => f.id === t.font) ? t.font : defaultTheme.font,
      mode: modes.some((m) => m.id === t.mode) ? t.mode : defaultTheme.mode,
    };
  } catch {
    return defaultTheme;
  }
}
export function saveTheme(t: Theme) {
  try {
    localStorage.setItem(themeKey, JSON.stringify(t));
  } catch {
    /* stockage indisponible : le thème vaut pour cette session */
  }
}

const rgb = (h: string) =>
  h
    .slice(1)
    .match(/../g)!
    .map((x) => parseInt(x, 16));
const hex = (c: number[]) =>
  '#' +
  c
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase();
// Mélange avec le blanc (t > 0) ou le noir (t < 0).
export const mix = (h: string, t: number) =>
  hex(rgb(h).map((v) => (t < 0 ? v * (1 + t) : v + (255 - v) * t)));
// Assombrit jusqu'au contraste demandé contre une couleur de référence.
const darkenTo = (h: string, against: string, min: number) => {
  let c = h;
  for (let i = 0; i < 60 && contrast(c, against) < min; i++) c = mix(c, -0.04);
  return c;
};

const lightenTo = (h: string, against: string, min: number) => {
  let c = h;
  for (let i = 0; i < 60 && contrast(c, against) < min; i++) c = mix(c, 0.05);
  return c;
};
const darkQuery = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-color-scheme: dark)').matches;
export const isDark = (t: Theme) =>
  t.mode === 'dark' || (t.mode === 'auto' && darkQuery());

// Mode sombre : fond très foncé teinté par le fond choisi, accent conservé.
// Mêmes exigences de lisibilité (texte 7:1 au moins, accent 4,5:1).
function darkVars(t: Theme): Record<string, string> {
  const tint = (amount: number) => mix(t.bg, -amount);
  const bg = tint(0.9);
  return {
    '--bg': bg,
    '--bg-deep': tint(0.93),
    '--stage': tint(0.92),
    '--surface': tint(0.86),
    '--surface-2': tint(0.82),
    '--border': tint(0.74),
    '--border-strong': tint(0.64),
    '--text': '#EEEDF5',
    '--text-2': '#B4B1C6',
    '--ink': '#EEEDF5',
    '--ink-hover': '#D6D4E4',
    '--ink-text': '#17161F',
    '--accent': t.accent,
    '--accent-strong': darkenTo(t.accent, '#FFFFFF', 4.5),
    '--accent-soft': mix(darkenTo(t.accent, '#FFFFFF', 4.5), -0.7),
    '--accent-border': mix(t.accent, -0.45),
    '--accent-text': lightenTo(t.accent, bg, 4.5),
  };
}

// Variantes dérivées : texte blanc lisible sur l'accent (4,5:1), texte
// d'accent lisible sur le fond (4,5:1), fonds teintés légers.
export function themeVars(t: Theme): Record<string, string> {
  const font = uiFonts.find((f) => f.id === t.font) ?? uiFonts[0];
  if (isDark(t)) return { ...darkVars(t), '--font-ui': font.value };
  return {
    '--surface': '#FFFFFF',
    '--surface-2': '#FCFCFF',
    '--border': '#ECEBF6',
    '--border-strong': '#D9D6EA',
    '--text': '#1C1A2B',
    '--text-2': '#5B5870',
    '--ink': '#1C1A2B',
    '--ink-hover': '#34314D',
    '--ink-text': '#FFFFFF',
    '--bg': t.bg,
    '--bg-deep': mix(t.bg, -0.03),
    '--stage': mix(t.bg, -0.015),
    '--accent': t.accent,
    '--accent-strong': darkenTo(t.accent, '#FFFFFF', 4.5),
    '--accent-soft': mix(t.accent, 0.88),
    '--accent-border': mix(t.accent, 0.68),
    '--accent-text': darkenTo(t.accent, t.bg, 4.5),
    '--font-ui': font.value,
  };
}
export function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.dataset.mode = isDark(t) ? 'dark' : 'light';
  root.style.colorScheme = isDark(t) ? 'dark' : 'light';
  for (const [k, v] of Object.entries(themeVars(t)))
    root.style.setProperty(k, v);
}

// Avertissements, sans bloquer le choix.
export function themeWarnings(t: Theme) {
  const out: string[] = [];
  if (isDark(t)) return out;
  if (contrast('#1C1A2B', t.bg) < 7)
    out.push(
      'Fond trop foncé : le texte de l’atelier devient moins lisible (moins de 7:1).',
    );
  if (contrast(t.accent, t.bg) < 1.8)
    out.push(
      'Accent très proche du fond : les boutons actifs se distinguent mal.',
    );
  return out;
}
