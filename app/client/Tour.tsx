import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Visite guidée : quelques étapes posées sur les vraies zones de l'atelier.
// Ouverte seule au premier lancement, puis depuis le bouton « ? » de l'en-tête.
export const tourKey = 'ds-studio-tour-done';

export interface TourStep {
  target: string; // valeur de data-tour
  title: string;
  text: string;
  before?: () => void; // prépare l'écran (ex. ouvrir Couleurs)
}

type Box = { top: number; left: number; width: number; height: number };

export default function Tour({
  steps,
  onClose,
}: {
  steps: TourStep[];
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const step = steps[i];

  // Seulement au changement d'étape : la liste est recréée à chaque rendu.
  useEffect(() => {
    steps[i].before?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // Suit la zone visée (redimensionnement, défilement, rendu asynchrone).
  useLayoutEffect(() => {
    let raf = 0;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${step.target}"]`,
      );
      const r = el?.getBoundingClientRect();
      const next =
        r && r.width > 0 && r.height > 0
          ? { top: r.top, left: r.left, width: r.width, height: r.height }
          : null;
      setBox((b) => (JSON.stringify(b) === JSON.stringify(next) ? b : next));
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [step.target]);

  useEffect(() => {
    card.current?.focus();
  }, [i]);

  const finish = () => {
    try {
      localStorage.setItem(tourKey, '1');
    } catch {
      /* stockage indisponible : la visite se rouvrira au prochain lancement */
    }
    onClose();
  };
  const last = i === steps.length - 1;

  // Carte à côté de la zone : à droite, à gauche, dessous ou au centre.
  const W = 320;
  const pad = 14;
  let style: React.CSSProperties = {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };
  if (box) {
    const vw = innerWidth;
    const vh = innerHeight;
    const clampTop = (t: number) => Math.max(pad, Math.min(t, vh - 220));
    if (box.left + box.width + pad + W < vw)
      style = { top: clampTop(box.top), left: box.left + box.width + pad };
    else if (box.left - pad - W > 0)
      style = { top: clampTop(box.top), left: box.left - pad - W };
    else
      style = {
        top: Math.min(box.top + box.height + pad, vh - 220),
        left: Math.max(pad, Math.min(box.left, vw - W - pad)),
      };
  }

  return (
    <div className="tour" role="presentation">
      {box ? (
        <div
          className="tour-hole"
          style={{
            top: box.top - 6,
            left: box.left - 6,
            width: box.width + 12,
            height: box.height + 12,
          }}
        />
      ) : (
        <div className="tour-veil" />
      )}
      <div
        ref={card}
        className="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        tabIndex={-1}
        style={style}
        onKeyDown={(e) => {
          if (e.key === 'Escape') finish();
          if (e.key === 'ArrowRight' && !last) setI(i + 1);
          if (e.key === 'ArrowLeft' && i > 0) setI(i - 1);
        }}
      >
        <p className="tour-count">
          Étape {i + 1} sur {steps.length}
        </p>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-text">{step.text}</p>
        <div className="tour-actions">
          <button className="tour-skip" onClick={finish}>
            Passer
          </button>
          <span />
          {i > 0 && <button onClick={() => setI(i - 1)}>Précédent</button>}
          <button
            className="studio-primary"
            onClick={() => (last ? finish() : setI(i + 1))}
          >
            {last ? 'Terminer' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  );
}
