import type { CSSProperties, ReactNode } from 'react';
import type {
  FigmaComponent,
  FigmaNode,
  FigmaPaint,
} from '../shared/figmaComponents';

// Rendu approximatif d'un composant lu dans Figma. Chaque valeur liée à une
// variable devient var(--token, valeur Figma) : le rendu suit les tokens de
// l'atelier, et garde la valeur Figma si le token n'existe pas.

const cssVar = (name: string | undefined, fallback: string) =>
  name ? `var(--${name.replace('/', '-')}, ${fallback})` : fallback;

function color(p: FigmaPaint | undefined) {
  if (!p) return undefined;
  const c = cssVar(p.v, p.c);
  return p.o !== undefined && p.o < 1
    ? `color-mix(in srgb, ${c} ${Math.round(p.o * 100)}%, transparent)`
    : c;
}
const px = (v: number | undefined, name?: string) =>
  v === undefined ? undefined : cssVar(name, `${v}px`);

const align: Record<string, string> = {
  MIN: 'flex-start',
  CENTER: 'center',
  MAX: 'flex-end',
  BASELINE: 'baseline',
  SPACE_BETWEEN: 'space-between',
};

/** Clés de tokens (« color.brand ») utilisées par le composant. */
export function figmaTokenKeys(c: FigmaComponent, known: string[]) {
  const names = new Set<string>();
  const walk = (n: FigmaNode) => {
    for (const v of [n.f?.v, n.s?.v, n.gv, n.pv, n.ph, n.rv, n.fsv])
      if (v) names.add(v.replace('/', '.'));
    n.k?.forEach(walk);
  };
  c.variants.forEach((v) => walk(v.root));
  return known.filter((k) => names.has(k));
}

function Node({
  n,
  parent,
  root = false,
}: {
  n: FigmaNode;
  parent?: FigmaNode;
  root?: boolean;
}): ReactNode {
  const flex = !!n.l;
  const inFlex = !!parent?.l;
  const s: CSSProperties = {
    boxSizing: 'border-box',
    position: inFlex || root ? 'relative' : 'absolute',
    flexShrink: 0,
  };
  if (!inFlex && !root) {
    s.left = n.x;
    s.top = n.y;
  }
  // Largeur : contenu (H), remplir (F) ou fixe.
  const mainH = parent?.l === 'H';
  if (n.sh === 'H' && (flex || n.t === 'TEXT')) s.width = 'max-content';
  else if (n.sh === 'F' && inFlex) {
    if (mainH) s.flex = '1 1 0';
    else s.alignSelf = 'stretch';
  } else s.width = n.w;
  if (n.sv === 'H' && (flex || n.t === 'TEXT')) s.height = 'auto';
  else if (n.sv === 'F' && inFlex) {
    if (!mainH) s.flex = '1 1 0';
    else s.alignSelf = 'stretch';
  } else s.height = n.h;
  if (flex) {
    s.display = 'flex';
    s.flexDirection = n.l === 'H' ? 'row' : 'column';
    s.gap = px(n.g, n.gv);
    const [t = 0, r = 0, b = 0, l = 0] = n.p ?? [];
    s.padding = `${px(t, n.pv)} ${px(r, n.ph)} ${px(b, n.pv)} ${px(l, n.ph)}`;
    s.alignItems = align[n.ai ?? 'MIN'];
    s.justifyContent = align[n.aj ?? 'MIN'];
  }
  if (n.r) s.borderRadius = n.r >= 9999 ? '50%' : px(n.r, n.rv);
  if (n.s) s.boxShadow = `inset 0 0 0 ${n.sw ?? 1}px ${color(n.s)}`;
  if (n.cl) s.overflow = 'hidden';
  if (n.t === 'TEXT') {
    s.color = color(n.f);
    s.fontSize = px(n.fs ?? 14, n.fsv);
    s.fontWeight = n.fw;
    s.fontFamily = n.ff
      ? `"${n.ff.replace(/["\\]/g, '')}", var(--font-family, system-ui)`
      : 'var(--font-family, system-ui)';
    s.lineHeight = 1.25;
    s.textAlign = (n.ta?.toLowerCase() ?? 'left') as CSSProperties['textAlign'];
    s.whiteSpace = n.sh === 'H' ? 'pre' : 'pre-wrap';
    return <span style={s}>{n.tx}</span>;
  }
  s.background = color(n.f);
  return (
    <div style={s} title={root ? undefined : n.n}>
      {n.k?.map((c, i) => (
        <Node key={i} n={c} parent={n} />
      ))}
    </div>
  );
}

// Planche : une colonne par variante, comme dans Figma.
export function FigmaSheet({ c }: { c: FigmaComponent }) {
  return (
    <div className="figma-sheet">
      {c.variants.map((v) => (
        <figure key={v.id} className="figma-variant">
          <Node n={v.root} root />
          {v.name && <figcaption>{v.name.replace(/=/g, ' : ')}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
