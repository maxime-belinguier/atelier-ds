import { useEffect, useRef, useState } from 'react';
import type { Tokens } from '../shared/model.js';
import {
  createProject,
  listProjects,
  openProject,
  projectsChanged,
  type Palette,
  type ProjectList,
} from './api.js';
import { projectKey } from './chatHistory.js';

// Après la création, la page se recharge : ce drapeau affiche l'accueil du
// nouveau projet une seule fois.
export const newProjectKey = 'ds-studio-new-project';

const ago = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
function since(t: number) {
  if (!t) return 'Pas encore ouvert';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'À l’instant';
  if (s < 3600) return ago.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return ago.format(-Math.round(s / 3600), 'hour');
  if (s < 86400 * 7) return ago.format(-Math.round(s / 86400), 'day');
  return new Date(t).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}
const paletteOf = (tokens: Tokens | undefined): Palette => ({
  colors: ['color.brand', 'color.canvas', 'color.text', 'color.border']
    .map((k) => tokens?.[k as keyof Tokens]?.$value)
    .filter((v): v is string => typeof v === 'string'),
  radius: Number(tokens?.['radius.control' as keyof Tokens]?.$value ?? 8),
});

// Mini écran qui montre ce qu'on obtient : fond, texte, bouton de marque.
function Preview({ palette }: { palette: Palette }) {
  const [brand, canvas, text, border] = palette.colors;
  const r = Math.min(palette.radius, 10);
  return (
    <span
      className="start-preview"
      aria-hidden="true"
      style={{ background: canvas, borderColor: border }}
    >
      <span className="start-line" style={{ background: text }} />
      <span
        className="start-line is-short"
        style={{ background: text, opacity: 0.45 }}
      />
      <span
        className="start-button"
        style={{ background: brand, borderRadius: r }}
      />
    </span>
  );
}

function NewProject({
  sourceName,
  base,
  copy,
  onClose,
  onError,
}: {
  sourceName: string;
  base: Palette;
  copy: Palette;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [from, setFrom] = useState<'neutre' | 'copie'>('neutre');
  const [working, setWorking] = useState(false);
  const box = useRef<HTMLFormElement>(null);
  const options = [
    {
      id: 'neutre' as const,
      title: 'Partir de zéro',
      text: 'Le style par défaut de l’atelier, à personnaliser.',
      palette: base,
    },
    {
      id: 'copie' as const,
      title: `Copier ${sourceName}`,
      text: `Mêmes couleurs, typo et espacements. ${sourceName} ne change pas.`,
      palette: copy,
    },
  ];

  async function submit() {
    if (!name.trim() || working) return;
    setWorking(true);
    try {
      const next = await createProject(name.trim(), from);
      try {
        localStorage.setItem(projectKey, next.current);
        sessionStorage.setItem(newProjectKey, name.trim());
      } catch {
        /* facultatif */
      }
      location.reload();
    } catch (e) {
      setWorking(false);
      onError((e as Error).message);
    }
  }

  return (
    <div
      className="settings-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        ref={box}
        className="new-project"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
          // Garde le focus dans la fenêtre.
          if (e.key === 'Tab') {
            const f = [
              ...box.current!.querySelectorAll<HTMLElement>(
                'input:not([type="radio"]), input[type="radio"]:checked, button:not(:disabled)',
              ),
            ];
            const i = f.indexOf(document.activeElement as HTMLElement);
            if (e.shiftKey && i <= 0) {
              e.preventDefault();
              f[f.length - 1]?.focus();
            } else if (!e.shiftKey && i === f.length - 1) {
              e.preventDefault();
              f[0]?.focus();
            }
          }
        }}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <header className="new-project-head">
          <div>
            <h2 id="new-project-title">Nouveau projet</h2>
            <p>
              Un espace à part, avec ses tokens, son brief, son historique et
              ses conversations.
            </p>
          </div>
          <button
            type="button"
            className="settings-close"
            aria-label="Fermer"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <label className="new-project-name">
          Nom du projet
          <input
            autoFocus
            maxLength={60}
            value={name}
            placeholder="Ex. Betclic Poker"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <fieldset className="start-cards">
          <legend>Point de départ</legend>
          {options.map((o) => (
            <label
              key={o.id}
              className={`start-card${from === o.id ? ' is-on' : ''}`}
            >
              <input
                type="radio"
                name="new-project-from"
                checked={from === o.id}
                onChange={() => setFrom(o.id)}
              />
              <Preview palette={o.palette} />
              <strong>{o.title}</strong>
              <span>{o.text}</span>
            </label>
          ))}
        </fieldset>
        <footer className="new-project-foot">
          <button type="button" className="save-cancel" onClick={onClose}>
            Annuler
          </button>
          <button
            type="submit"
            className="studio-primary"
            disabled={working || !name.trim()}
          >
            {working ? 'Création…' : 'Créer le projet'}
          </button>
        </footer>
      </form>
    </div>
  );
}

// Choix du projet dans l'en-tête : derniers projets ouverts, nouveau projet.
// Changer de projet recharge la page pour repartir d'un état propre.
export default function ProjectMenu({
  current,
  tokens,
  locked,
  onError,
  onManage,
}: {
  current: string | undefined;
  /** Tokens enregistrés du projet ouvert (aperçu « Copier »). */
  tokens: Tokens | undefined;
  /** Raison qui empêche de changer de projet (modifs en cours, demande IA). */
  locked: string | null;
  onError: (message: string) => void;
  /** Ouvre Paramètres › Projets (renommer, supprimer). */
  onManage: () => void;
}) {
  const [list, setList] = useState<ProjectList>();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!current) return;
    try {
      localStorage.setItem(projectKey, current);
    } catch {
      /* facultatif */
    }
    listProjects()
      .then(setList)
      // Serveur lancé avant la mise à jour : pas de route projets.
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
  // Renommage ou suppression depuis les Paramètres.
  useEffect(() => {
    const reload = () => void listProjects().then(setList, () => {});
    addEventListener(projectsChanged, reload);
    return () => removeEventListener(projectsChanged, reload);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    addEventListener('mousedown', onDown);
    return () => removeEventListener('mousedown', onDown);
  }, [open]);

  const projects = [...(list?.projects ?? [])].sort((a, b) =>
    a.id === current ? -1 : b.id === current ? 1 : b.opened - a.opened,
  );
  const active = projects.find((p) => p.id === current);
  const brand = String(tokens?.['color.brand']?.$value ?? active?.brand ?? '');

  async function switchTo(id: string) {
    setWorking(true);
    try {
      const next = await openProject(id);
      try {
        localStorage.setItem(projectKey, next.current);
      } catch {
        /* facultatif */
      }
      location.reload();
    } catch (e) {
      setWorking(false);
      onError((e as Error).message);
    }
  }

  return (
    <div
      className="project-menu"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className="project-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="project-pop"
        title="Changer de projet"
        onClick={() => setOpen(!open)}
      >
        <span
          className="project-dot"
          aria-hidden="true"
          style={{ background: brand || undefined }}
        />
        <span className="project-trigger-name">{active?.name ?? 'Projet'}</span>
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="picker-pop project-pop" id="project-pop">
          <p className="project-pop-title">Projets</p>
          {failed && (
            <p className="project-note">
              Projets indisponibles : ferme DS-Studio puis relance-le pour
              activer la mise à jour.
            </p>
          )}
          {locked && <p className="project-note">{locked}</p>}
          <ul aria-label="Projets">
            {projects.map((p) => {
              const here = p.id === current;
              return (
                <li key={p.id}>
                  <button
                    className="project-item"
                    aria-current={here ? 'true' : undefined}
                    disabled={working || (!here && !!locked)}
                    onClick={() =>
                      here ? setOpen(false) : void switchTo(p.id)
                    }
                  >
                    <span
                      className="project-swatch"
                      aria-hidden="true"
                      style={{
                        background: (here ? brand : p.brand) || undefined,
                      }}
                    >
                      {p.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="project-item-text">
                      <strong>{p.name}</strong>
                      <span>{here ? 'Projet ouvert' : since(p.opened)}</span>
                    </span>
                    {here && (
                      <svg
                        className="project-check"
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            className="project-new"
            disabled={working || !!locked || !list}
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
          >
            <span aria-hidden="true">+</span> Nouveau projet
          </button>
          <button
            className="project-manage"
            onClick={() => {
              setOpen(false);
              onManage();
            }}
          >
            Renommer ou supprimer…
          </button>
        </div>
      )}
      {creating && list && (
        <NewProject
          sourceName={active?.name ?? 'ce projet'}
          base={list.base}
          copy={paletteOf(tokens)}
          onError={onError}
          onClose={() => {
            setCreating(false);
            trigger.current?.focus();
          }}
        />
      )}
    </div>
  );
}
