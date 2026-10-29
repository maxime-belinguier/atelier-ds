// Composants lus dans Figma (lecture seule) : arbre compact rendu dans
// l'atelier. Les données viennent d'un fichier externe : tout est relu et
// borné ici avant d'être stocké ou affiché.

export interface FigmaPaint {
  /** Couleur #RRGGBB. */
  c: string;
  /** Opacité 0 à 1. */
  o?: number;
  /** Variable liée (« color/brand »). */
  v?: string;
}
export interface FigmaNode {
  t: string;
  n: string;
  w?: number;
  h?: number;
  x?: number;
  y?: number;
  f?: FigmaPaint;
  s?: FigmaPaint;
  sw?: number;
  /** Auto-layout : H ou V. */
  l?: 'H' | 'V';
  g?: number;
  gv?: string;
  p?: number[];
  pv?: string;
  ph?: string;
  ai?: string;
  aj?: string;
  /** Taille : F (remplir), H (contenu), autre (fixe). */
  sh?: string;
  sv?: string;
  r?: number;
  rv?: string;
  cl?: number;
  tx?: string;
  fs?: number;
  fsv?: string;
  fw?: number;
  ff?: string;
  ta?: string;
  k?: FigmaNode[];
}
export interface FigmaComponent {
  id: string;
  name: string;
  page: string;
  desc: string;
  variants: { id: string; name: string; root: FigmaNode }[];
}

const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.slice(0, max) : undefined;
const num = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.max(-100_000, Math.min(100_000, v))
    : undefined;
const varName = (v: unknown) =>
  typeof v === 'string' && /^[\w-]{1,40}\/[\w-]{1,60}$/.test(v) ? v : undefined;

function paint(v: unknown): FigmaPaint | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const p = v as Record<string, unknown>;
  if (typeof p.c !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(p.c)) return;
  const o = num(p.o);
  return {
    c: p.c.toUpperCase(),
    o: o === undefined ? undefined : Math.max(0, Math.min(1, o)),
    v: varName(p.v),
  };
}

function node(
  v: unknown,
  budget: { left: number },
  depth = 0,
): FigmaNode | null {
  if (!v || typeof v !== 'object' || budget.left-- <= 0 || depth > 9)
    return null;
  const x = v as Record<string, unknown>;
  const out: FigmaNode = {
    t: str(x.t, 20) ?? 'FRAME',
    n: str(x.n, 60) ?? '',
    w: num(x.w),
    h: num(x.h),
    x: num(x.x),
    y: num(x.y),
    f: paint(x.f),
    s: paint(x.s),
    sw: num(x.sw),
    l: x.l === 'H' || x.l === 'V' ? x.l : undefined,
    g: num(x.g),
    gv: varName(x.gv),
    p: Array.isArray(x.p) ? x.p.slice(0, 4).map((n) => num(n) ?? 0) : undefined,
    pv: varName(x.pv),
    ph: varName(x.ph),
    ai: str(x.ai, 20),
    aj: str(x.aj, 20),
    sh: str(x.sh, 2),
    sv: str(x.sv, 2),
    r: num(x.r),
    rv: varName(x.rv),
    cl: x.cl ? 1 : undefined,
    tx: str(x.tx, 300),
    fs: num(x.fs),
    fsv: varName(x.fsv),
    fw: num(x.fw),
    ff: str(x.ff, 60),
    ta: str(x.ta, 20),
  };
  if (Array.isArray(x.k))
    out.k = x.k
      .slice(0, 60)
      .map((c) => node(c, budget, depth + 1))
      .filter((c): c is FigmaNode => !!c);
  return JSON.parse(JSON.stringify(out));
}

export function parseComponents(value: unknown): FigmaComponent[] {
  if (!Array.isArray(value)) return [];
  const budget = { left: 1200 };
  const out: FigmaComponent[] = [];
  for (const c of value.slice(0, 40)) {
    if (!c || typeof c !== 'object') continue;
    const x = c as Record<string, unknown>;
    const id = str(x.id, 40);
    const name = str(x.name, 80);
    if (!id || !name) continue;
    const variants = (Array.isArray(x.variants) ? x.variants : [])
      .slice(0, 8)
      .flatMap((v) => {
        if (!v || typeof v !== 'object') return [];
        const y = v as Record<string, unknown>;
        const root = node(y.root, budget);
        return root
          ? [{ id: str(y.id, 40) ?? id, name: str(y.name, 80) ?? '', root }]
          : [];
      });
    if (variants.length)
      out.push({
        id,
        name,
        page: str(x.page, 60) ?? '',
        desc: str(x.desc, 200) ?? '',
        variants,
      });
  }
  return out;
}
