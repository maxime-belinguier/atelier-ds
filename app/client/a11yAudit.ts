import { contrast, type TokenKey, type Tokens } from '../shared/model.js';

// Audit d'accessibilité calculé depuis les tokens (aperçu compris).
// Références : WCAG 2.2, critères 1.4.3 (contraste du texte, 4.5:1),
// 1.4.11 (contraste des éléments d'interface, 3:1) et 2.5.8 (taille des
// cibles, 24 px minimum). Les « conseils » ne comptent pas dans le score.

export type CheckStatus = 'ok' | 'fail' | 'tip';
export interface Check {
  id: string;
  group: 'Contrastes' | 'Texte' | 'Zones cliquables';
  label: string;
  value: string;
  rule: string;
  status: CheckStatus;
  keys: TokenKey[];
}

const pairs: [TokenKey, TokenKey, number, string][] = [
  ['color.text', 'color.surface', 4.5, 'Texte principal sur les cartes'],
  ['color.text', 'color.canvas', 4.5, 'Texte principal sur le fond de page'],
  ['color.muted', 'color.surface', 4.5, 'Texte secondaire sur les cartes'],
  ['color.muted', 'color.canvas', 4.5, 'Texte secondaire sur le fond de page'],
  ['color.onBrand', 'color.brand', 4.5, 'Texte des boutons'],
  ['color.onBrand', 'color.brandHover', 4.5, 'Texte des boutons au survol'],
  ['color.danger', 'color.surface', 4.5, 'Message d’alerte'],
  ['color.success', 'color.surface', 4.5, 'Message de réussite'],
  ['color.brand', 'color.surface', 3, 'Bouton visible sur les cartes'],
  ['color.border', 'color.surface', 3, 'Contour des champs (si seul repère)'],
  ['color.focus', 'color.surface', 3, 'Contour du focus sur les cartes'],
  ['color.focus', 'color.canvas', 3, 'Contour du focus sur le fond de page'],
];

const fmt = (n: number) => `${n.toFixed(2).replace('.', ',')}:1`;

export function auditTokens(tokens: Tokens): Check[] {
  const v = (k: TokenKey) => tokens[k].$value;
  const checks: Check[] = pairs.map(([fg, bg, min, label]) => {
    const ratio = contrast(String(v(fg)), String(v(bg)));
    return {
      id: `${fg}|${bg}`,
      group: 'Contrastes',
      label,
      value: fmt(ratio),
      rule: `${String(min).replace('.', ',')}:1 minimum (WCAG ${min === 3 ? '1.4.11' : '1.4.3'})`,
      status: ratio >= min ? 'ok' : 'fail',
      keys: [fg, bg],
    };
  });
  const body = Number(v('font.body'));
  const heading = Number(v('font.heading'));
  checks.push(
    {
      id: 'body-size',
      group: 'Texte',
      label: 'Taille du texte',
      value: `${body} px`,
      rule: '16 px conseillés sur mobile',
      status: body >= 16 ? 'ok' : 'tip',
      keys: ['font.body'],
    },
    {
      id: 'hierarchy',
      group: 'Texte',
      label: 'Titres plus grands que le texte',
      value: `${heading} px / ${body} px`,
      rule: 'Au moins 1,25 fois la taille du texte',
      status: heading >= body * 1.25 ? 'ok' : 'tip',
      keys: ['font.heading', 'font.body'],
    },
  );
  return checks;
}

// Mesure des zones cliquables dans l'écran affiché (iframe d'aperçu).
export function measureTargets(doc: Document | null | undefined): Check[] {
  if (!doc) return [];
  const els = [
    ...doc.querySelectorAll<HTMLElement>(
      'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]',
    ),
  ].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (!els.length) return [];
  // Une case reliée à son libellé se clique aussi par le libellé :
  // la zone réelle est celle du libellé (exception prévue par WCAG 2.5.8).
  const sizes = els.map((el) => {
    // tagName plutôt qu'instanceof : l'élément vient de l'iframe.
    const label =
      el.tagName === 'INPUT'
        ? ((el as HTMLInputElement).labels?.[0] ?? undefined)
        : undefined;
    const r = (label ?? el).getBoundingClientRect();
    return {
      name: (
        el.getAttribute('aria-label') ||
        label?.textContent ||
        el.textContent ||
        el.getAttribute('placeholder') ||
        el.tagName.toLowerCase()
      )
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40),
      min: Math.round(Math.min(r.width, r.height)),
    };
  });
  const small = sizes.filter((s) => s.min < 24);
  const tight = sizes.filter((s) => s.min >= 24 && s.min < 44);
  const list = (xs: typeof sizes) =>
    xs
      .slice(0, 3)
      .map((s) => `« ${s.name} » ${s.min} px`)
      .join(', ') + (xs.length > 3 ? '…' : '');
  return [
    {
      id: 'targets-min',
      group: 'Zones cliquables',
      label: small.length
        ? `${small.length} élément${small.length > 1 ? 's' : ''} trop petit${small.length > 1 ? 's' : ''}`
        : `${sizes.length} éléments cliquables`,
      value: small.length ? list(small) : 'Tous à 24 px ou plus',
      rule: '24 px minimum (WCAG 2.5.8)',
      status: small.length ? 'fail' : 'ok',
      keys: ['space.sm', 'font.body'],
    },
    {
      id: 'targets-comfort',
      group: 'Zones cliquables',
      label: tight.length
        ? `${tight.length} élément${tight.length > 1 ? 's' : ''} sous 44 px`
        : 'Confort tactile',
      value: tight.length ? list(tight) : 'Tous à 44 px ou plus',
      rule: '44 px conseillés au doigt (Apple)',
      status: tight.length ? 'tip' : 'ok',
      keys: ['space.sm', 'font.body'],
    },
  ];
}

// Score : part des critères WCAG obligatoires respectés (conseils exclus).
export function score(checks: Check[]) {
  const required = checks.filter(
    (c) => c.group === 'Contrastes' || c.id === 'targets-min',
  );
  const passed = required.filter((c) => c.status === 'ok').length;
  return required.length ? Math.round((passed / required.length) * 100) : 100;
}
