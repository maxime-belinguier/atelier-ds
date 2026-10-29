import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// Zoom libre : paliers des boutons − / +, bornes du pincement.
export const zoomSteps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
export const clampZoom = (z: number) =>
  Math.min(2, Math.max(0.25, Math.round(z * 100) / 100));
export function stepZoom(from: number, dir: 1 | -1) {
  const next =
    dir > 0
      ? zoomSteps.find((s) => s > from + 0.001)
      : [...zoomSteps].reverse().find((s) => s < from - 0.001);
  return next ?? from;
}

// Pincement du pavé tactile (ctrl + molette) ou Cmd / Ctrl + molette : zoom
// libre sur l'élément, sans zoomer toute la page.
export function usePinchZoom(
  target: React.RefObject<HTMLElement | null>,
  current: () => number,
  onZoom: (z: number) => void,
) {
  const latest = useRef({ current, onZoom });
  latest.current = { current, onZoom };
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const { current, onZoom } = latest.current;
      onZoom(clampZoom(current() * Math.exp(-e.deltaY * 0.01)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // Sans dépendances : l'élément peut apparaître après le premier rendu.
  });
}

// Glisser pour déplacer la vue zoomée (main, comme dans Figma). Un clic
// simple reste un clic : le déplacement démarre après 4 px. Espace + glisser
// marche aussi au-dessus d'une iframe (classe is-panning : voir styles.css).
export function useDragPan(
  target: React.RefObject<HTMLElement | null>,
  scrollers: () => { x: HTMLElement | null; y: HTMLElement | null },
) {
  const latest = useRef(scrollers);
  latest.current = scrollers;
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let space = false;
    const editable = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      !!t.closest(
        'input, textarea, select, [contenteditable="true"], .resize-handle',
      );
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || editable(e.target)) return;
      // Espace ne sert à déplacer que si la souris est sur la zone.
      if (e.type === 'keydown' && !el.matches(':hover')) return;
      if (e.type === 'keydown') e.preventDefault();
      space = e.type === 'keydown';
      el.classList.toggle('is-panning', space);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || (!space && editable(e.target))) return;
      const { x, y } = latest.current();
      const start = {
        px: e.clientX,
        py: e.clientY,
        x: x?.scrollLeft ?? 0,
        y: y?.scrollTop ?? 0,
      };
      let dragging = false;
      const onMove = (m: PointerEvent) => {
        const dx = m.clientX - start.px;
        const dy = m.clientY - start.py;
        if (!dragging && Math.hypot(dx, dy) < 4) return;
        if (!dragging) {
          dragging = true;
          el.classList.add('is-dragging');
          el.setPointerCapture(e.pointerId);
        }
        if (x) x.scrollLeft = start.x - dx;
        if (y) y.scrollTop = start.y - dy;
      };
      const onUp = () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
        if (!dragging) return;
        el.classList.remove('is-dragging');
        // Le glissé ne doit pas finir en clic sur un bouton de la planche.
        el.addEventListener('click', (c) => c.stopPropagation(), {
          capture: true,
          once: true,
        });
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    };
    el.addEventListener('pointerdown', onDown);
    addEventListener('keydown', onKey);
    addEventListener('keyup', onKey);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      removeEventListener('keydown', onKey);
      removeEventListener('keyup', onKey);
      el.classList.remove('is-panning', 'is-dragging');
    };
    // Sans dépendances : l'élément peut apparaître après le premier rendu.
  });
}

// Fit | − NN % + : Fit fait tout tenir, NN % revient à la taille réelle.
export function ZoomControl({
  label,
  fit,
  shown,
  onFit,
  onZoom,
  disabled = false,
  title,
}: {
  label: string;
  fit: boolean;
  /** Échelle affichée (celle de Fit quand Fit est actif). */
  shown: number;
  onFit: () => void;
  onZoom: (z: number) => void;
  disabled?: boolean;
  title?: string;
}) {
  const pct = Math.round(shown * 100);
  return (
    <div
      className={`segmented zoom-control${disabled ? ' is-disabled' : ''}`}
      role="group"
      aria-label={label}
      title={title}
    >
      <button
        className="zoom-fit"
        aria-pressed={fit}
        title="Ajuster : tout l’écran tient dans le panneau"
        onClick={onFit}
      >
        Ajuster
      </button>
      <button
        className="zoom-step"
        aria-label="Dézoomer"
        title="Dézoomer"
        disabled={shown <= zoomSteps[0]}
        onClick={() => onZoom(stepZoom(shown, -1))}
      >
        −
      </button>
      {/* Niveau affiché seulement : un bouton caché derrière le % n'était pas compris. */}
      <span className="zoom-value" aria-live="polite">
        {pct} %
      </span>
      <button
        className="zoom-step"
        aria-label="Zoomer"
        title="Zoomer"
        disabled={shown >= zoomSteps[zoomSteps.length - 1]}
        onClick={() => onZoom(stepZoom(shown, 1))}
      >
        +
      </button>
    </div>
  );
}

// Contenu réduit pour tenir dans la largeur disponible (jamais agrandi), ou
// affiché au zoom choisi avec défilement si besoin.
export default function FitBox({
  fit,
  zoom = 1,
  children,
  onScale,
}: {
  fit: boolean;
  zoom?: number;
  children: ReactNode;
  onScale?: (scale: number) => void;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, width: 0, height: 0 });
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const scale = fit ? Math.min(1, o.clientWidth / i.scrollWidth) : zoom;
      setBox({
        scale,
        width: i.scrollWidth * scale,
        height: i.offsetHeight * scale,
      });
      onScale?.(scale);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, zoom]);
  return (
    <div ref={outer} className={`fit-box${fit ? '' : ' is-real'}`}>
      <div
        className="fit-sizer"
        style={{ width: box.width || undefined, height: box.height }}
      >
        <div
          ref={inner}
          className="fit-inner"
          style={
            box.scale !== 1
              ? { transform: `scale(${box.scale})`, transformOrigin: '0 0' }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
