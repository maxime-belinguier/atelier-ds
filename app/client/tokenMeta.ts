import {
  allKeys,
  contrast,
  isCustomKey,
  type TokenKey,
  type Tokens,
} from '../shared/model.js';

// Noms lisibles et regroupements de l'atelier. Les clés techniques restent
// la référence : ces libellés ne changent ni le schéma ni les fichiers.
export const tokenLabels: Record<TokenKey, string> = {
  'color.brand': 'Couleur de marque',
  'color.brandHover': 'Marque au survol',
  'color.onBrand': 'Texte sur la marque',
  'color.surface': 'Fond des cartes',
  'color.canvas': 'Fond de page',
  'color.text': 'Texte principal',
  'color.muted': 'Texte secondaire',
  'color.border': 'Bordures',
  'color.danger': 'Couleur d’alerte',
  'color.success': 'Couleur de réussite',
  'color.focus': 'Contour du focus',
  'font.family': 'Police',
  'font.body': 'Taille du texte',
  'font.heading': 'Taille des titres',
  'space.sm': 'Petit espacement',
  'space.md': 'Espacement moyen',
  'space.lg': 'Grand espacement',
  'radius.control': 'Arrondi des contrôles',
};

export const tokenGroups: {
  id: string;
  label: string;
  keys: TokenKey[];
}[] = [
  {
    id: 'colors',
    label: 'Couleurs',
    keys: [
      'color.brand',
      'color.brandHover',
      'color.onBrand',
      'color.text',
      'color.muted',
      'color.surface',
      'color.canvas',
      'color.border',
      'color.danger',
      'color.success',
      'color.focus',
    ],
  },
  {
    id: 'type',
    label: 'Typographie',
    keys: ['font.family', 'font.body', 'font.heading'],
  },
  {
    id: 'space',
    label: 'Espacements',
    keys: ['space.sm', 'space.md', 'space.lg'],
  },
  { id: 'shape', label: 'Formes', keys: ['radius.control'] },
];

// Nom lisible d'un token ajouté : « color.warningSoft » → « Warning soft ».
export function labelOf(key: TokenKey) {
  if (tokenLabels[key]) return tokenLabels[key];
  const name = (key.split('.')[1] ?? key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Groupe d'un token ajouté selon son préfixe.
export const groupOfPrefix: Record<string, string> = {
  color: 'colors',
  font: 'type',
  size: 'type',
  space: 'space',
  radius: 'shape',
};

// Groupes du menu, complétés par les tokens ajoutés (Claude, Figma ou main).
export function groupsFor(tokens: Tokens) {
  const extra = allKeys(tokens).filter(isCustomKey);
  return tokenGroups.map((g) => ({
    ...g,
    keys: [
      ...g.keys,
      ...extra.filter((k) => groupOfPrefix[k.split('.')[0]] === g.id),
    ],
  }));
}

// Préfixe proposé à l'ajout d'un token dans un groupe.
export const prefixOfGroup: Record<string, string[]> = {
  colors: ['color'],
  type: ['size', 'font'],
  space: ['space'],
  shape: ['radius'],
};

export const fonts = ['system-ui', 'Arial', 'Georgia', 'Verdana'] as const;

// Bornes du curseur seulement : le schéma accepte toujours 0 à 128.
export const sliderRange: Partial<Record<TokenKey, [number, number]>> = {
  'font.body': [10, 32],
  'font.heading': [16, 64],
  'space.sm': [0, 32],
  'space.md': [0, 48],
  'space.lg': [0, 64],
  'radius.control': [0, 32],
};

// Paires de contraste affichées à côté d'une couleur : [fond, seuil].
export const contrastPairs: Partial<
  Record<TokenKey, { against: TokenKey; min: number; label: string }>
> = {
  'color.brand': {
    against: 'color.onBrand',
    min: 4.5,
    label: 'texte sur marque',
  },
  'color.onBrand': { against: 'color.brand', min: 4.5, label: 'sur la marque' },
  'color.text': { against: 'color.surface', min: 4.5, label: 'sur fond' },
  'color.muted': { against: 'color.surface', min: 4.5, label: 'sur fond' },
  'color.danger': { against: 'color.surface', min: 4.5, label: 'sur fond' },
  'color.success': { against: 'color.surface', min: 4.5, label: 'sur fond' },
  'color.focus': { against: 'color.surface', min: 3, label: 'sur fond' },
};

export function validateValue(tokens: Tokens, key: TokenKey, raw: string) {
  const type = tokens[key].$type;
  if (type === 'color')
    return /^#[0-9a-fA-F]{6}$/.test(raw)
      ? { value: raw.toUpperCase() as string | number }
      : { error: 'Couleur attendue : #RRGGBB' };
  if (type === 'dimension') {
    const n = Number(raw);
    return raw.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 128
      ? { value: n }
      : { error: 'Nombre de 0 à 128' };
  }
  return (fonts as readonly string[]).includes(raw)
    ? { value: raw }
    : { error: 'Police non prise en charge' };
}

export function contrastFor(tokens: Tokens, key: TokenKey) {
  const pair = contrastPairs[key];
  if (!pair) return undefined;
  const ratio = contrast(
    String(tokens[key].$value),
    String(tokens[pair.against].$value),
  );
  return { ratio, ok: ratio >= pair.min, ...pair };
}
