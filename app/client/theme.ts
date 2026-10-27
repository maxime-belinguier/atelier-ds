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
export const uiFonts = [
  {
    id: 'systeme',
    label: 'Système (SF Pro)',
    value:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
  },
  {
    id: 'avenir',
    label: 'Avenir',
    value: "'Avenir Next', Avenir, 'Segoe UI', system-ui, sans-serif",
  },
  {
    id: 'serif',
    label: 'Serif',
    value: "'New York', ui-serif, Georgia, 'Times New Roman', serif",
  },
  {
    id: 'mono',
    label: 'Mono',
    value: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  },
] as const;

export interface Theme {
  bg: string;
  accent: string;
  font: (typeof uiFonts)[number]['id'];
}
export const defaultTheme: Theme = {
  bg: '#FBFAFF',
  accent: '#FF5A36',
  font: 'systeme',
};

const hex6 = /^#[0-9a-fA-F]{6}$/;
export function readTheme(): Theme {
  try {
    const t = JSON.parse(localStorage.getItem(themeKey) || '{}');
    return {
      bg: hex6.test(t.bg) ? t.bg : defaultTheme.bg,
      accent: hex6.test(t.accent) ? t.accent : defaultTheme.accent,
      font: uiFonts.some((f) => f.id === t.font) ? t.font : defaultTheme.font,
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

// Variantes dérivées : texte blanc lisible sur l'accent (4,5:1), texte
// d'accent lisible sur le fond (4,5:1), fonds teintés légers.
export function themeVars(t: Theme): Record<string, string> {
  const font = uiFonts.find((f) => f.id === t.font) ?? uiFonts[0];
  return {
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
  for (const [k, v] of Object.entries(themeVars(t)))
    root.style.setProperty(k, v);
}

// Avertissements, sans bloquer le choix.
export function themeWarnings(t: Theme) {
  const out: string[] = [];
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
