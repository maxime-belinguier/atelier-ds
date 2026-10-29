import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// Contenu réduit pour tenir dans la largeur disponible (jamais agrandi).
// fit = false : taille réelle, défilement horizontal si besoin.
export default function FitBox({
  fit,
  children,
  onScale,
}: {
  fit: boolean;
  children: ReactNode;
  onScale?: (scale: number) => void;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const scale = fit ? Math.min(1, o.clientWidth / i.scrollWidth) : 1;
      setBox({ scale, height: i.offsetHeight * scale });
      onScale?.(scale);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit]);
  return (
    <div
      ref={outer}
      className={`fit-box${fit ? '' : ' is-real'}`}
      style={fit ? { height: box.height } : undefined}
    >
      <div
        ref={inner}
        className="fit-inner"
        style={
          fit && box.scale < 1
            ? { transform: `scale(${box.scale})`, transformOrigin: '0 0' }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
