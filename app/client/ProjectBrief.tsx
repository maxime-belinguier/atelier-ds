import { useEffect, useState } from 'react';
import type { ProjectSnapshot } from '../shared/project.js';
import { downloadText, listProjects, request } from './api.js';

export default function ProjectBrief() {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  // Le nom vient du projet (Paramètres › Projets) : une seule source.
  const [projectName, setProjectName] = useState('');
  async function load() {
    try {
      const [snap, list] = await Promise.all([
        request<ProjectSnapshot>('project'),
        listProjects(),
      ]);
      setSnapshot(snap);
      setProjectName(
        list.projects.find((p) => p.id === list.current)?.name ?? '',
      );
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <div className="project-brief">
      <p>
        Ton contexte de travail, stocké sur ce poste, hors Git. Le nom se change
        dans Paramètres › Projets, le lien Figma dans Paramètres › Figma.
      </p>
      {projectName && (
        <p className="brief-project">
          Projet : <strong>{projectName}</strong>
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {snapshot && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            setNotice('');
            try {
              setSnapshot(
                await request('project', {
                  ...snapshot,
                  project: {
                    ...snapshot.project,
                    name: projectName || snapshot.project.name,
                  },
                }),
              );
              setNotice('Brief enregistré sur ce poste.');
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {(
            [
              ['audience', 'Public concerné', 1000],
              ['goal', 'Objectif et critères de réussite', 2000],
            ] as const
          ).map(([key, label, max]) => (
            <label className="field" key={key}>
              {label}
              <textarea
                maxLength={max}
                value={snapshot.project[key]}
                disabled={busy}
                onChange={(e) =>
                  setSnapshot({
                    ...snapshot,
                    project: { ...snapshot.project, [key]: e.target.value },
                  })
                }
              />
            </label>
          ))}
          <button className="studio-primary" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer le brief'}
          </button>
        </form>
      )}
      <button type="button" disabled={busy} onClick={() => void load()}>
        Recharger le brief
      </button>
      <button
        type="button"
        disabled={busy || !snapshot}
        onClick={() => {
          void request<ProjectSnapshot>('project')
            .then(({ project: p }) => {
              downloadText(
                'brief.md',
                `# ${projectName || p.name || 'Mon projet'}\n\n## Public\n\n${p.audience}\n\n## Objectif\n\n${p.goal}\n\n## Fichier Figma\n\n${p.figmaUrl}\n`,
              );
            })
            .catch((e) => setError(e.message));
        }}
      >
        Exporter le brief enregistré (.md)
      </button>
      <p className="privacy-note">
        Le chat Claude reçoit ce brief avec ta demande. Ne saisis pas de données
        sensibles.
      </p>
    </div>
  );
}
