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
  // Chaque étape attend que sa zone ne bouge plus (panneau qui s'ouvre, aperçu
  // qui change) avant d'afficher la carte : pas de saut visible.
  const [settled, setSettled] = useState(false);
  // Zone affichée : ne change qu'une fois la nouvelle zone stable.
  const [shown, setShown] = useState<Box | null>(null);
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
    let last = '';
    let since = performance.now();
    setSettled(false);
    const measure = () => {
      // Un nom simple vise data-tour ; un sélecteur CSS (« .classe ») est accepté.
      const el = document.querySelector<HTMLElement>(
        /^[.#[]/.test(step.target)
          ? step.target
          : `[data-tour="${step.target}"]`,
      );
      const r = el?.getBoundingClientRect();
      const next =
        r && r.width > 0 && r.height > 0
          ? {
              top: Math.round(r.top),
              left: Math.round(r.left),
              width: Math.round(r.width),
              height: Math.round(r.height),
            }
          : null;
      const key = JSON.stringify(next);
      const now = performance.now();
      if (key !== last) {
        last = key;
        since = now;
      } else if (now - since > 180) {
        setShown(next);
        setSettled(true);
      }
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [step.target, i]);

  // Le focus revient sur la carte, même si l'étape ouvre un panneau qui le prend.
  useEffect(() => {
    if (settled) card.current?.focus();
  }, [settled, i]);

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
  if (shown) {
    const vw = innerWidth;
    const vh = innerHeight;
    const clampTop = (t: number) => Math.max(pad, Math.min(t, vh - 240));
    const clampLeft = (l: number) => Math.max(pad, Math.min(l, vw - W - pad));
    // Petit élément (bouton, barre) : carte dessous, ou dessus faute de place.
    // Grande zone (menu, liste, panneau) : carte à côté.
    if (shown.height < 140) {
      const below = shown.top + shown.height + pad;
      style = {
        top: below + 220 < vh ? below : Math.max(pad, shown.top - pad - 220),
        left: clampLeft(shown.left + shown.width / 2 - W / 2),
      };
    } else if (shown.left + shown.width + pad + W < vw)
      style = {
        top: clampTop(shown.top),
        left: shown.left + shown.width + pad,
      };
    else if (shown.left - pad - W > 0)
      style = { top: clampTop(shown.top), left: shown.left - pad - W };
    else
      style = {
        top: clampTop(shown.top + shown.height + pad),
        left: clampLeft(shown.left),
      };
  }

  return (
    <div className="tour" role="presentation">
      {/* Un seul voile : la zone visée est découpée dedans, sinon voile plein. */}
      <div
        className={`tour-hole${shown ? '' : ' is-empty'}`}
        style={
          shown
            ? {
                top: shown.top - 6,
                left: shown.left - 6,
                width: shown.width + 12,
                height: shown.height + 12,
              }
            : { top: '50%', left: '50%', width: 0, height: 0 }
        }
      />
      <div
        ref={card}
        className={`tour-card${settled ? ' is-on' : ''}`}
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
