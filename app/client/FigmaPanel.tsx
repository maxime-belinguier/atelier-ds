import { useEffect, useState } from 'react';
import { request } from './api.js';
import { labelOf } from './tokenMeta.js';
import type { Proposal } from '../shared/model.js';
import type { ProjectSnapshot } from '../shared/project.js';

// Onglet Figma des Paramètres : connexion (Claude Code + serveur MCP officiel
// de Figma), lecture vers l'atelier et envoi vers Figma avec validation.

type Status = {
  state: 'connected' | 'needs-auth' | 'missing' | 'error' | 'no-cli';
  detail: string;
  fileUrl: string;
  fileKey: string | null;
  snapshot: { readAt: string; count: number; sameFile: boolean } | null;
};
type Patch = {
  key: string;
  name: string;
  figma: string | number | null;
  studio: string | number;
};
type Preview = { approvalId: string | null; patches: Patch[]; message: string };

const stateLabel: Record<Status['state'], [string, 'ok' | 'off']> = {
  connected: ['Connecté', 'ok'],
  'needs-auth': ['Compte à connecter', 'off'],
  missing: ['Non connecté', 'off'],
  error: ['Injoignable', 'off'],
  'no-cli': ['Claude Code absent', 'off'],
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

function Value({ v }: { v: string | number | null }) {
  if (v === null) return <em className="patch-absent">absente</em>;
  return (
    <span className="patch-values">
      {typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) && (
        <span className="swatch" style={{ background: v }} aria-hidden="true" />
      )}
      {v}
    </span>
  );
}

export default function FigmaPanel({
  revision,
  onConnect,
  onProposal,
}: {
  revision: number;
  onConnect: () => Promise<{ opened: boolean; command: string }>;
  onProposal: (p: Proposal) => void;
}) {
  const [status, setStatus] = useState<Status>();
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<'' | 'pull' | 'preview' | 'apply'>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Preview>();
  const [login, setLogin] = useState<{ opened: boolean; command: string }>();
  // Lien du fichier : rangé dans le projet, modifié ici seulement.
  const [link, setLink] = useState('');
  const [linkNote, setLinkNote] = useState('');
  useEffect(() => {
    request<ProjectSnapshot>('project')
      // Sans écraser ce qui a déjà été tapé pendant le chargement.
      .then((s) => setLink((cur) => cur || s.project.figmaUrl))
      .catch(() => {});
  }, []);
  const saveLink = async () => {
    setLinkNote('');
    setError('');
    try {
      const snap = await request<ProjectSnapshot>('project');
      await request('project', {
        ...snap,
        project: { ...snap.project, figmaUrl: link.trim() },
      });
      setLinkNote(link.trim() ? 'Lien enregistré.' : 'Lien retiré.');
      void check();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  async function check() {
    setChecking(true);
    try {
      setStatus(await request<Status>('figma/status'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    void check();
  }, []);

  async function run<T>(kind: typeof busy, work: () => Promise<T>) {
    setBusy(kind);
    setError('');
    setMessage('');
    try {
      return await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  const pull = () =>
    run('pull', async () => {
      const r = await request<{
        proposal: Proposal | null;
        ignored: { name: string; reason: string }[];
        message: string;
      }>('figma/pull', { revision });
      const skipped = r.ignored.length
        ? ` ${r.ignored.length} variable${r.ignored.length > 1 ? 's' : ''} ignorée${r.ignored.length > 1 ? 's' : ''} : ${r.ignored
            .slice(0, 4)
            .map((i) => `${i.name} (${i.reason})`)
            .join(', ')}.`
        : '';
      if (r.proposal) onProposal(r.proposal);
      else setMessage(r.message + skipped);
      void check();
    });

  const push = () =>
    run('preview', async () => {
      const r = await request<Preview>('figma/preview', { revision });
      if (r.approvalId) setPreview(r);
      else setMessage(r.message);
      void check();
    });

  const apply = () =>
    run('apply', async () => {
      if (!preview?.approvalId) return;
      const r = await request<{
        written: number;
        created: number;
        verified: boolean;
        mismatches: string[];
      }>('figma/apply', { approvalId: preview.approvalId });
      setPreview(undefined);
      setMessage(
        r.verified
          ? `Figma mis à jour : ${r.written} variable${r.written > 1 ? 's' : ''} (dont ${r.created} créée${r.created > 1 ? 's' : ''}), relues et conformes.`
          : `Écriture faite mais relecture différente pour : ${r.mismatches.join(', ')}. Vérifie dans Figma.`,
      );
      void check();
    });

  const [label, tone] = status
    ? stateLabel[status.state]
    : ['Vérification…', 'off'];
  const connected = status?.state === 'connected';
  const ready = connected && !!status?.fileKey;

  return (
    <>
      <h3>Figma</h3>
      <p className="settings-lead">
        <span className={`agent-state ${tone}`}>{label}</span>
        {status?.detail ??
          'Lecture et écriture des variables de la collection « DS-Studio ».'}
      </p>

      <h4>Ton fichier</h4>
      <form
        className="settings-row settings-field figma-link"
        onSubmit={(e) => {
          e.preventDefault();
          void saveLink();
        }}
      >
        <label>
          Lien du fichier Figma
          <input
            type="url"
            maxLength={500}
            placeholder="https://www.figma.com/design/…"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setLinkNote('');
            }}
          />
        </label>
        <button type="submit">Enregistrer le lien</button>
      </form>
      {linkNote && (
        <p className="settings-hint" role="status">
          {linkNote}
        </p>
      )}
      {status?.fileUrl && (
        <p className="settings-file">
          <a href={status.fileUrl} target="_blank" rel="noreferrer">
            Ouvrir le fichier dans Figma ↗
          </a>
          {!status.fileKey && (
            <span className="settings-hint"> Lien non reconnu.</span>
          )}
        </p>
      )}
      {status?.snapshot && (
        <p className="settings-hint">
          Dernière lecture : {when(status.snapshot.readAt)} ·{' '}
          {status.snapshot.count} variables. Claude s’en sert dans le chat.
        </p>
      )}

      {status && !connected && (
        <>
          <h4>Connecter Figma (une fois)</h4>
          <ol className="settings-steps">
            <li>
              « Connecter » ouvre le Terminal : la commande ajoute le serveur
              officiel de Figma à Claude Code.
            </li>
            <li>
              Dans Claude Code, tape <code>/mcp</code>, choisis{' '}
              <strong>figma</strong> puis « Authenticate » : Figma s’ouvre dans
              ton navigateur, tu autorises.
            </li>
            <li>Reviens ici et clique sur « Revérifier ».</li>
          </ol>
          <div className="figma-actions">
            <button
              className="studio-primary"
              onClick={async () => {
                try {
                  setLogin(await onConnect());
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Connecter
            </button>
            <button onClick={() => void check()} disabled={checking}>
              {checking ? 'Vérification…' : 'Revérifier'}
            </button>
          </div>
          {login && (
            <p className="settings-hint" role="status">
              {login.opened ? (
                'Terminal ouvert : suis les étapes ci-dessus.'
              ) : (
                <>
                  Ouvre le Terminal et tape <code>{login.command}</code>
                  <button
                    className="settings-copy"
                    onClick={() =>
                      navigator.clipboard
                        ?.writeText(login.command)
                        .catch(() => undefined)
                    }
                  >
                    Copier
                  </button>
                </>
              )}
            </p>
          )}
        </>
      )}

      <h4>Synchroniser</h4>
      <div className="figma-actions">
        <button
          onClick={pull}
          disabled={!ready || !!busy}
          aria-busy={busy === 'pull'}
        >
          {busy === 'pull' ? 'Lecture de Figma…' : 'Lire depuis Figma'}
        </button>
        <button
          onClick={push}
          disabled={!ready || !!busy}
          aria-busy={busy === 'preview'}
        >
          {busy === 'preview' ? 'Comparaison…' : 'Envoyer vers Figma'}
        </button>
        {connected && (
          <button
            className="settings-link"
            onClick={() => void check()}
            disabled={checking || !!busy}
          >
            Revérifier
          </button>
        )}
      </div>
      <p className="settings-hint">
        Lire : les variables Figma deviennent un diff à valider dans l’atelier.
        Envoyer : tu vois d’abord ce qui changera dans Figma, puis tu valides.
        Chaque action passe par Claude Code (20 à 60 s) et compte un appel
        Figma.
      </p>
      {busy && (
        <p className="settings-hint" role="status">
          Claude Code contacte Figma…
        </p>
      )}
      {error && (
        <p className="settings-warn" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="figma-message" role="status">
          {message}
        </p>
      )}

      {preview?.approvalId && (
        <div
          className="figma-preview"
          aria-label="Changements prévus dans Figma"
        >
          <h4>
            {preview.patches.length} variable
            {preview.patches.length > 1 ? 's' : ''} à écrire dans Figma
          </h4>
          <div className="diff-scroll">
            <table>
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Figma</th>
                  <th>Atelier</th>
                </tr>
              </thead>
              <tbody>
                {preview.patches.map((p) => (
                  <tr key={p.name}>
                    <th>
                      <span className="patch-name">
                        {labelOf(p.key)}
                        <code>{p.name}</code>
                      </span>
                    </th>
                    <td>
                      <Value v={p.figma} />
                    </td>
                    <td>
                      <Value v={p.studio} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="settings-hint">
            Rien n’est écrit si Figma a changé depuis cette comparaison. Les
            variables absentes de l’atelier ne sont jamais supprimées.
          </p>
          <div className="figma-actions">
            <button onClick={() => setPreview(undefined)} disabled={!!busy}>
              Annuler
            </button>
            <button
              className="studio-primary"
              onClick={apply}
              disabled={!!busy}
              aria-busy={busy === 'apply'}
            >
              {busy === 'apply' ? 'Écriture…' : 'Mettre à jour Figma'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
