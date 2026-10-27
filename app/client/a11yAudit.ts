import { contrast, type TokenKey, type Tokens } from '../shared/model.js';

// Audit d'accessibilité calculé depuis les tokens (aperçu compris).
// Références : WCAG 2.2, critères 1.4.3 (contraste du texte, 4.5:1),
// 1.4.11 (contraste des éléments d'interface, 3:1) et 2.5.8 (taille des
// cibles, 24 px minimum). Les « conseils » ne comptent pas dans le score.

export type CheckStatus = 'ok' | 'fail' | 'tip';
export interface Check {
  id: string;
  group: 'Contrastes' | 'Couleurs distinctes' | 'Texte' | 'Zones cliquables';
  label: string;
  value: string;
  rule: string;
  status: CheckStatus;
  keys: TokenKey[];
  // Token à ajuster pour corriger ce point (affiché sur sa ligne dans Couleurs).
  target?: TokenKey;
  // Correction proposée : jamais appliquée seule, elle devient un brouillon.
  fix?: { key: TokenKey; value: string };
  // Pour « Couleurs distinctes » : couleurs telles que perçues par le profil.
  seen?: [string, string];
}

// Profils de vision. Malvoyance : contrastes WCAG (AA ou AAA).
// Daltonismes et vision sans couleur : les couleurs qui portent un sens
// doivent rester différentes une fois simulées.
export const profiles = [
  {
    id: 'aa',
    label: 'Malvoyance',
    hint: 'Le texte doit être lisible. Norme WCAG 2.2 AA : contraste 4,5:1 pour le texte, 3:1 pour l’interface.',
  },
  {
    id: 'aaa',
    label: 'Malvoyance forte',
    hint: 'Contraste renforcé, WCAG AAA : 7:1 pour le texte. L’interface reste à 3:1 (pas de niveau AAA).',
  },
  {
    id: 'deuteranopia',
    label: 'Deutéranopie',
    hint: 'Rouge et vert se confondent. La plus fréquente, environ 5 % des hommes. Aperçu simulé à droite.',
  },
  {
    id: 'protanopia',
    label: 'Protanopie',
    hint: 'Rouge et vert se confondent, les rouges paraissent sombres. Aperçu simulé à droite.',
  },
  {
    id: 'tritanopia',
    label: 'Tritanopie',
    hint: 'Bleu et jaune se confondent. Rare. Aperçu simulé à droite.',
  },
  {
    id: 'achromatopsia',
    label: 'Sans couleur',
    hint: 'Seule la luminosité reste. Les couleurs de sens doivent se distinguer par leur clarté. Aperçu simulé à droite.',
  },
] as const;
export type Profile = (typeof profiles)[number]['id'];
export const isColorProfile = (p: Profile) => p !== 'aa' && p !== 'aaa';

// [texte, fond, type (texte ou interface), libellé, token à corriger]
const pairs: [TokenKey, TokenKey, 't' | 'u', string, TokenKey][] = [
  [
    'color.text',
    'color.surface',
    't',
    'Texte principal sur les cartes',
    'color.text',
  ],
  [
    'color.text',
    'color.canvas',
    't',
    'Texte principal sur le fond de page',
    'color.text',
  ],
  [
    'color.muted',
    'color.surface',
    't',
    'Texte secondaire sur les cartes',
    'color.muted',
  ],
  [
    'color.muted',
    'color.canvas',
    't',
    'Texte secondaire sur le fond de page',
    'color.muted',
  ],
  ['color.onBrand', 'color.brand', 't', 'Texte des boutons', 'color.brand'],
  [
    'color.onBrand',
    'color.brandHover',
    't',
    'Texte des boutons au survol',
    'color.brandHover',
  ],
  ['color.danger', 'color.surface', 't', 'Message d’alerte', 'color.danger'],
  [
    'color.success',
    'color.surface',
    't',
    'Message de réussite',
    'color.success',
  ],
  [
    'color.brand',
    'color.surface',
    'u',
    'Bouton visible sur les cartes',
    'color.brand',
  ],
  [
    'color.border',
    'color.surface',
    'u',
    'Contour des champs (si seul repère)',
    'color.border',
  ],
  [
    'color.focus',
    'color.surface',
    'u',
    'Contour du focus sur les cartes',
    'color.focus',
  ],
  [
    'color.focus',
    'color.canvas',
    'u',
    'Contour du focus sur le fond de page',
    'color.focus',
  ],
];

// Couleurs qui portent un sens et ne doivent pas se confondre.
const meaningPairs: [TokenKey, TokenKey, string][] = [
  ['color.danger', 'color.success', 'Alerte et réussite'],
  ['color.brand', 'color.danger', 'Marque et alerte'],
  ['color.success', 'color.brand', 'Réussite et marque'],
  ['color.brand', 'color.focus', 'Marque et contour du focus'],
];

const fmt = (n: number) => `${n.toFixed(2).replace('.', ',')}:1`;
const num = (n: number) => String(n).replace('.', ',');

// --- Couleur : conversions, simulation, écart perçu -------------------------
const rgb = (h: string) =>
  h
    .slice(1)
    .match(/../g)!
    .map((x) => parseInt(x, 16) / 255);
const hex = (c: number[]) =>
  '#' +
  c
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase();
const lin = (x: number) =>
  x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
const gam = (x: number) =>
  x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;

// Matrices de Machado, Oliveira et Fernandes (2009), sévérité maximale,
// en RGB linéaire. Mêmes valeurs que le filtre de l'aperçu.
const machado: Record<string, number[]> = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882,
    -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182,
    0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733,
    0.691367, 0.3039,
  ],
};
export function simulate(h: string, p: Profile) {
  const c = rgb(h).map(lin);
  if (p === 'achromatopsia') {
    const y = gam(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]);
    return hex([y, y, y]);
  }
  const m = machado[p];
  if (!m) return h;
  return hex(
    [0, 1, 2].map((i) =>
      gam(m[i * 3] * c[0] + m[i * 3 + 1] * c[1] + m[i * 3 + 2] * c[2]),
    ),
  );
}
const lab = (h: string) => {
  const [r, g, b] = rgb(h).map(lin);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
// Écart perçu CIE76 (distance dans l'espace Lab).
export function deltaE(a: string, b: string) {
  const x = lab(a);
  const y = lab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
// Seuil choisi pour l'atelier (hypothèse, pas une norme) : en dessous de 20,
// deux couleurs de sens risquent d'être prises l'une pour l'autre.
export const distinctMin = 20;

// Variante plus claire (t > 0) ou plus foncée (t < 0) en gardant la teinte.
const shade = (h: string, t: number) =>
  hex(rgb(h).map((v) => (t < 0 ? v * (1 + t) : v + (1 - v) * t)));

// Plus petit ajustement de clarté qui satisfait le test ; undefined sinon.
function nearest(h: string, ok: (c: string) => boolean) {
  for (let i = 1; i <= 100; i++) {
    for (const t of [-i / 100, i / 100]) {
      const c = shade(h, t);
      if (ok(c)) return c;
    }
  }
  return undefined;
}

export function auditTokens(tokens: Tokens, profile: Profile = 'aa'): Check[] {
  const v = (k: TokenKey) => tokens[k].$value;
  const s = (k: TokenKey) => String(v(k));
  if (isColorProfile(profile)) {
    const checks: Check[] = meaningPairs.map(([a, b, label]) => {
      const seen: [string, string] = [
        simulate(s(a), profile),
        simulate(s(b), profile),
      ];
      const d = deltaE(seen[0], seen[1]);
      const ok = d >= distinctMin;
      // La correction garde la couleur lisible sur les cartes (4,5:1).
      const value = ok
        ? undefined
        : nearest(
            s(b),
            (c) =>
              deltaE(seen[0], simulate(c, profile)) >= distinctMin &&
              contrast(c, s('color.surface')) >=
                (b === 'color.focus' ? 3 : 4.5),
          );
      return {
        id: `${a}~${b}`,
        group: 'Couleurs distinctes',
        label,
        value: `Écart perçu ${Math.round(d)}`,
        rule: `${distinctMin} conseillé (seuil de l’atelier, pas une norme)`,
        status: ok ? 'ok' : 'fail',
        keys: [a, b],
        target: b,
        seen,
        fix: value ? { key: b, value } : undefined,
      };
    });
    checks.push({
      id: 'not-color-only',
      group: 'Couleurs distinctes',
      label: 'Ne pas compter sur la couleur seule',
      value: 'Ajoute une icône ou un mot aux badges et messages',
      rule: 'WCAG 1.4.1',
      status: 'tip',
      keys: ['color.danger', 'color.success'],
    });
    return checks;
  }
  const textMin = profile === 'aaa' ? 7 : 4.5;
  const checks: Check[] = pairs.map(([fg, bg, kind, label, adjust]) => {
    const min = kind === 't' ? textMin : 3;
    const ratio = contrast(s(fg), s(bg));
    const ok = ratio >= min;
    const other = adjust === fg ? s(bg) : s(fg);
    const value = ok
      ? undefined
      : nearest(s(adjust), (c) => contrast(c, other) >= min);
    return {
      id: `${fg}|${bg}`,
      group: 'Contrastes',
      label,
      value: fmt(ratio),
      rule: `${num(min)}:1 minimum (WCAG ${kind === 'u' ? '1.4.11' : profile === 'aaa' ? '1.4.6' : '1.4.3'})`,
      status: ok ? 'ok' : 'fail',
      keys: [fg, bg],
      target: adjust,
      fix: value ? { key: adjust, value } : undefined,
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
      target: 'font.body',
      fix: body >= 16 ? undefined : { key: 'font.body', value: '16' },
    },
    {
      id: 'hierarchy',
      group: 'Texte',
      label: 'Titres plus grands que le texte',
      value: `${heading} px / ${body} px`,
      rule: 'Au moins 1,25 fois la taille du texte',
      status: heading >= body * 1.25 ? 'ok' : 'tip',
      keys: ['font.heading', 'font.body'],
      target: 'font.heading',
      fix:
        heading >= body * 1.25
          ? undefined
          : { key: 'font.heading', value: String(Math.ceil(body * 1.25)) },
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
    (c) =>
      c.group === 'Contrastes' ||
      (c.group === 'Couleurs distinctes' && c.status !== 'tip') ||
      c.id === 'targets-min',
  );
  const passed = required.filter((c) => c.status === 'ok').length;
  return required.length ? Math.round((passed / required.length) * 100) : 100;
}

// Bilan de tous les profils, pour l'écran de contrôle.
export function auditAll(tokens: Tokens) {
  return profiles.map((p) => {
    const checks = auditTokens(tokens, p.id);
    return {
      profile: p,
      checks,
      score: score(checks),
      fails: checks.filter((c) => c.status === 'fail').length,
    };
  });
}
