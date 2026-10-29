import {
  allKeys,
  customKeyPattern,
  customType,
  isCoreKey,
  type Tokens,
  type TokenValue,
} from '../../app/shared/model.js';
import type { FigmaComponent } from '../../app/shared/figmaComponents.js';

// Correspondance tokens de l'atelier ↔ variables Figma, et scripts Plugin API
// exécutés par l'outil use_figma du serveur MCP officiel de Figma.
// Tout ce qui part vers Figma est généré ici à partir de valeurs déjà
// validées par le schéma : aucun texte venant du navigateur ou d'un modèle.

export const collectionName = 'DS-Studio';
export const fontChoices = ['system-ui', 'Arial', 'Georgia', 'Verdana'];

export type FigmaType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
export interface FigmaVariable {
  name: string;
  type: FigmaType;
  value: string | number | boolean | null;
}
export interface FigmaRead {
  collection: string | null;
  variables: FigmaVariable[];
  /** Présent seulement quand la lecture inclut les composants. */
  components?: FigmaComponent[];
}

// Lien de partage Figma → clé du fichier (les branches gardent leur clé propre).
export function fileKeyFromUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !/(^|\.)figma\.com$/.test(url.hostname))
      return null;
    const branch = url.pathname.match(
      /^\/(?:design|file)\/[0-9a-zA-Z]{22,128}\/branch\/([0-9a-zA-Z]{22,128})/,
    );
    if (branch) return branch[1];
    const m = url.pathname.match(/^\/(?:design|file)\/([0-9a-zA-Z]{22,128})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// « color.brandHover » ↔ « color/brandHover »
export const keyToName = (key: string) => key.replace('.', '/');
export function nameToKey(name: string) {
  const parts = name.split('/');
  if (parts.length !== 2) return null;
  const key = `${parts[0]}.${parts[1]}`;
  return isCoreKey(key) || customKeyPattern.test(key) ? key : null;
}

function typeOfKey(tokens: Tokens, key: string) {
  if (Object.hasOwn(tokens, key)) return tokens[key].$type;
  return customType(key);
}
const figmaTypeOf = (t: string): FigmaType =>
  t === 'color' ? 'COLOR' : t === 'dimension' ? 'FLOAT' : 'STRING';

function scopesOf(key: string) {
  const [group] = key.split('.');
  if (key === 'font.family') return ['FONT_FAMILY'];
  if (group === 'color') {
    if (/text|onBrand|muted/i.test(key)) return ['TEXT_FILL'];
    if (/border|focus/i.test(key)) return ['STROKE_COLOR'];
    return ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR'];
  }
  if (group === 'font' || group === 'size') return ['FONT_SIZE'];
  if (group === 'space') return ['GAP'];
  if (group === 'radius') return ['CORNER_RADIUS'];
  return ['ALL_SCOPES'];
}

// Variables Figma → changements proposés à l'atelier (ajouts et mises à jour).
export function figmaToChanges(read: FigmaRead, tokens: Tokens) {
  const changes: { key: string; value: TokenValue }[] = [];
  const ignored: { name: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const v of read.variables) {
    const key = nameToKey(v.name);
    if (!key) {
      ignored.push({
        name: v.name,
        reason: 'nom hors convention (famille/nom, ex. color/brand)',
      });
      continue;
    }
    if (seen.has(key)) {
      ignored.push({ name: v.name, reason: 'en double' });
      continue;
    }
    seen.add(key);
    const type = typeOfKey(tokens, key);
    if (v.type !== figmaTypeOf(type)) {
      ignored.push({
        name: v.name,
        reason: `type ${v.type} au lieu de ${figmaTypeOf(type)}`,
      });
      continue;
    }
    if (type === 'color') {
      if (typeof v.value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v.value)) {
        ignored.push({ name: v.name, reason: 'couleur illisible' });
        continue;
      }
      changes.push({ key, value: v.value.toUpperCase() });
    } else if (type === 'dimension') {
      if (
        typeof v.value !== 'number' ||
        !Number.isFinite(v.value) ||
        v.value < 0 ||
        v.value > 128
      ) {
        ignored.push({ name: v.name, reason: 'nombre hors 0 à 128' });
        continue;
      }
      changes.push({ key, value: Math.round(v.value * 100) / 100 });
    } else {
      if (typeof v.value !== 'string' || !fontChoices.includes(v.value)) {
        ignored.push({
          name: v.name,
          reason: `police non prise en charge (${fontChoices.join(', ')})`,
        });
        continue;
      }
      changes.push({ key, value: v.value });
    }
  }
  return { changes, ignored };
}

export interface PushItem {
  name: string;
  type: FigmaType;
  value: string | number;
  scopes: string[];
}
export interface PushPlan {
  items: PushItem[];
  // Valeur Figma attendue juste avant l'écriture (null : variable absente).
  expected: Record<string, string | number | null>;
  patches: {
    key: string;
    name: string;
    figma: string | number | null;
    studio: string | number;
  }[];
}

// Atelier → Figma : seulement les variables à créer ou à changer.
export function planPush(tokens: Tokens, read: FigmaRead): PushPlan {
  const current = new Map(read.variables.map((v) => [v.name, v.value]));
  const plan: PushPlan = { items: [], expected: {}, patches: [] };
  for (const key of allKeys(tokens)) {
    const name = keyToName(key);
    const t = tokens[key];
    const raw = current.get(name);
    const figma =
      raw === undefined || typeof raw === 'boolean' ? null : (raw ?? null);
    const same =
      typeof figma === 'string' && typeof t.$value === 'string'
        ? figma.toUpperCase() === t.$value.toUpperCase()
        : figma === t.$value;
    if (same) continue;
    plan.items.push({
      name,
      type: figmaTypeOf(t.$type),
      value: t.$value,
      scopes: scopesOf(key),
    });
    plan.expected[name] = figma;
    plan.patches.push({ key, name, figma, studio: t.$value });
  }
  return plan;
}

// Lecture seule : variables de la collection DS-Studio, mode par défaut.
// Avec components : aussi les composants du fichier (arbre compact, valeurs
// et variables liées), pour les afficher dans l'atelier.
export function readCode(components = false) {
  return `const COLLECTION = ${JSON.stringify(collectionName)};
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const col = cols.find((c) => c.name === COLLECTION);
const out = [];
if (col) for (const id of col.variableIds) {
  const v = await figma.variables.getVariableByIdAsync(id);
  if (!v) continue;
  let val = v.valuesByMode[col.defaultModeId];
  if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
    const t = await figma.variables.getVariableByIdAsync(val.id);
    val = t ? Object.values(t.valuesByMode)[0] : null;
  }
  if (v.resolvedType === 'COLOR' && val && typeof val === 'object') val = hex(val);
  out.push({ name: v.name, type: v.resolvedType, value: val ?? null });
}
const res = { dsStudio: 1, collection: col ? col.name : null, variables: out };
${components ? componentsCode : ''}return res;`;
}

const componentsCode = `const names = {};
for (const v of await figma.variables.getLocalVariablesAsync()) names[v.id] = v.name;
const vn = (a) => { const x = Array.isArray(a) ? a[0] : a; return (x && names[x.id]) || undefined; };
const num = (x) => (typeof x === 'number' ? Math.round(x * 10) / 10 : undefined);
const paint = (ps) => {
  if (!Array.isArray(ps)) return undefined;
  const p = ps.find((p) => p.visible !== false && p.type === 'SOLID');
  return p ? { c: hex(p.color), o: num(p.opacity), v: vn(p.boundVariables && p.boundVariables.color) } : undefined;
};
let left = 900;
const node = (n, d) => {
  if (left-- <= 0 || n.visible === false) return null;
  const b = n.boundVariables || {};
  const o = { t: n.type, n: n.name.slice(0, 60), w: num(n.width), h: num(n.height), x: num(n.x), y: num(n.y), f: paint(n.fills), s: paint(n.strokes) };
  if (o.s) o.sw = num(n.strokeWeight);
  if (n.layoutMode && n.layoutMode !== 'NONE') Object.assign(o, { l: n.layoutMode[0], g: num(n.itemSpacing), gv: vn(b.itemSpacing), p: [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft].map(num), pv: vn(b.paddingTop), ph: vn(b.paddingLeft), ai: n.counterAxisAlignItems, aj: n.primaryAxisAlignItems });
  if (n.layoutSizingHorizontal) { o.sh = n.layoutSizingHorizontal[0]; o.sv = n.layoutSizingVertical[0]; }
  if (n.type === 'ELLIPSE') o.r = 9999;
  else if (num(n.cornerRadius)) { o.r = num(n.cornerRadius); o.rv = vn(b.topLeftRadius); }
  if (n.clipsContent) o.cl = 1;
  if (n.type === 'TEXT') Object.assign(o, { tx: n.characters.slice(0, 300), fs: num(n.fontSize), fsv: vn(b.fontSize), fw: num(n.fontWeight), ff: typeof n.fontName === 'object' ? n.fontName.family : undefined, ta: n.textAlignHorizontal });
  if (d < 8 && 'children' in n) o.k = n.children.map((c) => node(c, d + 1)).filter(Boolean);
  return o;
};
res.components = [];
for (const page of figma.root.children) {
  await page.loadAsync();
  for (const c of page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })) {
    if (res.components.length >= 40 || left <= 0) break;
    if (c.type === 'COMPONENT' && c.parent && c.parent.type === 'COMPONENT_SET') continue;
    const set = c.type === 'COMPONENT_SET';
    res.components.push({ id: c.id, name: c.name.slice(0, 80), page: page.name.slice(0, 60), desc: (c.description || '').slice(0, 200),
      variants: (set ? c.children.slice(0, 8) : [c]).map((v) => ({ id: v.id, name: set ? v.name.slice(0, 80) : '', root: node(v, 0) })).filter((v) => v.root) });
  }
}
`;

// Écriture : contrôle des valeurs attendues (rien n'est écrit si Figma a
// changé depuis l'aperçu), création ou mise à jour, puis relecture.
export function writeCode(plan: PushPlan) {
  const data = { items: plan.items, expected: plan.expected };
  return `const COLLECTION = ${JSON.stringify(collectionName)};
const DATA = ${JSON.stringify(data)};
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const rgb = (h) => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find((c) => c.name === COLLECTION);
const existing = new Map();
if (col) {
  for (const id of col.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (v) existing.set(v.name, v);
  }
}
const read = (v) => {
  let val = v.valuesByMode[col.defaultModeId];
  if (v.resolvedType === 'COLOR' && val && typeof val === 'object' && 'r' in val) val = hex(val);
  return typeof val === 'object' ? null : val;
};
const conflicts = [];
for (const item of DATA.items) {
  const v = existing.get(item.name);
  const now = v ? read(v) : null;
  const want = DATA.expected[item.name];
  const same = typeof now === 'string' && typeof want === 'string' ? now.toUpperCase() === want.toUpperCase() : now === want;
  if (!same) conflicts.push({ name: item.name, now, expected: want });
}
if (conflicts.length) return { dsStudio: 1, written: false, conflicts };
if (!col) col = figma.variables.createVariableCollection(COLLECTION);
const created = [];
for (const item of DATA.items) {
  let v = existing.get(item.name);
  if (!v) {
    v = figma.variables.createVariable(item.name, col, item.type);
    v.scopes = item.scopes;
    existing.set(item.name, v);
    created.push(item.name);
  }
  v.setValueForMode(col.defaultModeId, item.type === 'COLOR' ? rgb(item.value) : item.value);
}
const readback = [];
for (const item of DATA.items) {
  const v = existing.get(item.name);
  const fresh = v ? await figma.variables.getVariableByIdAsync(v.id) : null;
  readback.push({ name: item.name, value: fresh ? read(fresh) : null });
}
return { dsStudio: 1, written: true, created, readback };`;
}
