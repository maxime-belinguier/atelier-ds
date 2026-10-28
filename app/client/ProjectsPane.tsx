import { useEffect, useState } from 'react';
import {
  deleteProject,
  listProjects,
  projectsChanged,
  renameProject,
  request,
  type ProjectList,
} from './api.js';
import { dropChats } from './chatHistory.js';

// Onglet Projets des Paramètres : renommer, supprimer, et où sont les données.
// Supprimer ne vide rien : le dossier part dans projets-supprimes/.
export default function ProjectsPane({
  current,
  locked,
}: {
  current: string | undefined;
  locked: string | null;
}) {
  const [list, setList] = useState<ProjectList>();
  const [names, setNames] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState<{ dir: string }>();
  const [folder, setFolder] = useState<{ opened: boolean } | null>(null);

  const apply = (next: ProjectList) => {
    setList(next);
    setNames(Object.fromEntries(next.projects.map((p) => [p.id, p.name])));
    dispatchEvent(new Event(projectsChanged));
  };
  useEffect(() => {
    listProjects()
      .then((l) => {
        setList(l);
        setNames(Object.fromEntries(l.projects.map((p) => [p.id, p.name])));
      })
      .catch(() =>
        setError('Projets indisponibles : ferme DS-Studio puis relance-le.'),
      );
    request<{ dir: string }>('data-info')
      .then(setInfo)
      .catch(() => undefined);
  }, []);

  async function run(work: () => Promise<ProjectList>, done: string) {
    setError('');
    setNotice('');
    try {
      apply(await work());
      setNotice(done);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <h3>Projets</h3>
      <p className="settings-lead">
        Renomme ou supprime un projet. Pour en créer un ou changer de projet,
        utilise le menu sous le nom de l’app.
      </p>
      {error && (
        <p className="settings-warn" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="settings-hint" role="status">
          {notice}
        </p>
      )}
      <ul className="projects-list" aria-label="Projets de l’atelier">
        {list?.projects.map((p) => {
          const name = names[p.id] ?? p.name;
          const changed = name.trim() !== p.name && !!name.trim();
          const isOpen = p.id === current;
          return (
            <li key={p.id}>
              <span
                className="project-dot"
                style={{ background: p.brand || 'var(--border-strong)' }}
                aria-hidden="true"
              />
              <input
                aria-label={`Nom du projet ${p.name}`}
                maxLength={60}
                value={name}
                onChange={(e) => setNames({ ...names, [p.id]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && changed)
                    void run(
                      () => renameProject(p.id, name),
                      `Projet renommé : ${name.trim()}.`,
                    );
                }}
              />
              {isOpen && <span className="project-tag">Ouvert</span>}
              {changed && (
                <button
                  onClick={() =>
                    void run(
                      () => renameProject(p.id, name),
                      `Projet renommé : ${name.trim()}.`,
                    )
                  }
                >
                  Renommer
                </button>
              )}
              {p.id !== 'gutt' &&
                !isOpen &&
                (confirm === p.id ? (
                  <>
                    <button
                      className="danger"
                      disabled={!!locked}
                      title={locked ?? undefined}
                      onClick={() => {
                        setConfirm(null);
                        void run(async () => {
                          const next = await deleteProject(p.id);
                          dropChats(p.id);
                          return next;
                        }, `« ${p.name} » supprimé. Son dossier est gardé dans projets-supprimes.`);
                      }}
                    >
                      Oui, supprimer
                    </button>
                    <button onClick={() => setConfirm(null)}>Annuler</button>
                  </>
                ) : (
                  <button
                    aria-label={`Supprimer ${p.name}`}
                    onClick={() => setConfirm(p.id)}
                  >
                    Supprimer
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
      <p className="settings-hint">
        Gutt et le projet ouvert ne se suppriment pas. Un projet supprimé
        disparaît de la liste avec ses conversations ; ses tokens et son
        historique restent sur le disque, dans projets-supprimes.
      </p>

      <h4>Données</h4>
      <p className="settings-hint">
        Tokens, historique, briefs et projets sont dans :
      </p>
      {info && <code className="data-path">{info.dir}</code>}
      <div className="settings-row">
        <button
          onClick={() =>
            request<{ opened: boolean }>('open-data-folder', {})
              .then(setFolder)
              .catch((e) => setError(e.message))
          }
        >
          Ouvrir le dossier
        </button>
        {info && (
          <button
            className="settings-copy"
            onClick={() =>
              navigator.clipboard?.writeText(info.dir).catch(() => undefined)
            }
          >
            Copier le chemin
          </button>
        )}
      </div>
      {folder && (
        <p className="settings-hint" role="status">
          {folder.opened
            ? 'Dossier ouvert dans le Finder.'
            : 'Ouverture impossible ici : copie le chemin et ouvre-le à la main.'}
        </p>
      )}
      <p className="settings-hint">
        Sauvegarde : arrête DS-Studio, puis copie ce dossier hors du projet
        (disque externe, iCloud). Exporter les tokens ne sauvegarde pas
        l’historique.
      </p>
    </>
  );
}
