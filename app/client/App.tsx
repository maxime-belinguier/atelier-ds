import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { DSProvider, Scenario, components, screens } from './DesignSystem.js';
import ProjectBrief from './ProjectBrief.js';
import ScreenPicker from './ScreenPicker.js';
import { useDrafts } from './useTokenDraft.js';
import {
  bootstrap,
  commit,
  exportTokens,
  getState,
  request,
  type Bootstrap,
} from './api.js';
import {
  tokensSchema,
  type Proposal,
  type State,
  type TokenKey,
  type Tokens,
} from '../shared/model.js';
import {
  contrastFor,
  fonts,
  sliderRange,
  tokenGroups,
  tokenLabels,
} from './tokenMeta.js';

const devices = [
  { id: 'xs', label: '320', title: 'Mobile compact', width: 320, height: 760 },
  { id: 'sm', label: '375', title: 'Mobile', width: 375, height: 760 },
  { id: 'md', label: '430', title: 'Grand mobile', width: 430, height: 820 },
  { id: 'tab', label: '768', title: 'Tablette', width: 768, height: 1024 },
  { id: 'lg', label: '1024', title: 'Ordinateur', width: 1024, height: 820 },
  { id: 'xl', label: '1440', title: 'Grand écran', width: 1440, height: 900 },
];

const sourceLabels: Record<string, string> = {
  manual: 'Fait à la main',
  codex: 'Proposé par Codex',
  claude: 'Proposé par Claude',
  import: 'Fichier importé',
  undo: 'Retour en arrière',
};

function useDesignState() {
  const [state, setState] = useState<State>();
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || !live) return;
      inFlight = true;
      try {
        const s = await getState();
        if (live) {
          // Même révision : on garde l'objet courant (pas de rendu inutile).
          setState((current) =>
            !current || s.revision > current.revision ? s : current,
          );
          setError('');
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        inFlight = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 1200);
    const channel = new BroadcastChannel('ds-studio');
    channel.onmessage = refresh;
    return () => {
      live = false;
      clearInterval(timer);
      channel.close();
    };
  }, []);
  return { state, setState, error };
}
function announceChange() {
  const c = new BroadcastChannel('ds-studio');
  c.postMessage('updated');
  c.close();
}

// L'iframe affiche les valeurs enregistrées, ou l'aperçu des modifications
// envoyé par l'atelier (même origine uniquement, valeurs revalidées).
export function Preview() {
  const { state, error } = useDesignState();
  const [override, setOverride] = useState<Tokens | null>(null);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      if (e.data?.type !== 'ds-preview') return;
      if (e.data.tokens === null) return setOverride(null);
      const parsed = tokensSchema.safeParse(e.data.tokens);
      if (parsed.success) setOverride(parsed.data);
    };
    addEventListener('message', onMessage);
    window.parent.postMessage({ type: 'ds-preview-ready' }, location.origin);
    return () => removeEventListener('message', onMessage);
  }, []);
  const scenario =
    new URLSearchParams(location.search).get('scenario') ?? 'cards';
  return state ? (
    <Scenario tokens={override ?? state.tokens} scenario={scenario} />
  ) : (
    <p role="alert">{error || 'Chargement du scénario…'}</p>
  );
}

function readLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem('ds-studio-layout') || '{}');
    return {
      split:
        typeof saved.split === 'number' &&
        saved.split >= 28 &&
        saved.split <= 72
          ? saved.split
          : 50,
      fit: saved.fit !== false,
    };
  } catch {
    return { split: 50, fit: true };
  }
}

function Swatch({ value }: { value: string | number }) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? (
    <span className="swatch" style={{ background: value }} aria-hidden="true" />
  ) : null;
}

type Selection =
  | { kind: 'tokens'; id: string }
  | { kind: 'component'; id: string }
  | { kind: 'screen'; id: string };

export default function App() {
  const { state, setState, error: stateError } = useDesignState();
  const drafts = useDrafts(state?.tokens);
  const [boot, setBoot] = useState<Bootstrap>();
  const [selection, setSelection] = useState<Selection>({
    kind: 'tokens',
    id: 'colors',
  });
  const [search, setSearch] = useState('');
  const [proposal, setProposal] = useState<Proposal>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [device, setDevice] = useState('sm');
  const [scenario, setScenario] = useState('cards');
  const [layout, setLayout] = useState(readLayout);
  const [full, setFull] = useState(false);
  const [stageWidth, setStageWidth] = useState(0);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  // Assistant
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [agents, setAgents] = useState<Bootstrap['agents']>([]);
  const [agent, setAgent] = useState('claude');
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<
    { role: 'user' | 'assistant'; text: string }[]
  >([]);
  const [thinking, setThinking] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const historyDialog = useRef<HTMLDialogElement>(null);
  const briefDialog = useRef<HTMLDialogElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLElement>(null);
  const chatInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bootstrap()
      .then(setBoot)
      .catch((e) => setError(e.message));
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('ds-studio-layout', JSON.stringify(layout));
    } catch {
      /* Préférence d'affichage facultative. */
    }
  }, [layout]);
  useEffect(() => {
    // Les conversations de fournisseurs différents ne sont jamais mélangées.
    setChat([]);
    if (chatOpen && agent !== 'manual')
      request<Bootstrap['agents']>('agents')
        .then(setAgents)
        .catch((e) => setError(e.message));
  }, [agent]);
  useEffect(() => {
    if (chatOpen) {
      setUnread(false);
      if (!agents.length)
        request<Bootstrap['agents']>('agents')
          .then(setAgents)
          .catch((e) => setError(e.message));
      chatInput.current?.focus();
    }
  }, [chatOpen]);
  useEffect(() => {
    const d = historyDialog.current;
    if (historyOpen && !d?.open) d?.showModal();
    if (!historyOpen && d?.open) d.close();
  }, [historyOpen]);
  useEffect(() => {
    const d = briefDialog.current;
    if (briefOpen && !d?.open) d?.showModal();
    if (!briefOpen && d?.open) d.close();
  }, [briefOpen]);
  useEffect(() => {
    if (proposal) {
      dialog.current?.showModal();
      cancelButton.current?.focus();
    } else dialog.current?.close();
  }, [proposal]);
  const ready = !!state && !!drafts.preview;
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageWidth(el.clientWidth));
    ro.observe(el);
    setStageWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [ready]);

  // Aperçu en direct dans l'iframe : rien n'est écrit sur disque.
  const previewTokens = drafts.changes.length ? drafts.preview : undefined;
  useEffect(() => {
    const post = () =>
      iframe.current?.contentWindow?.postMessage(
        { type: 'ds-preview', tokens: previewTokens ?? null },
        location.origin,
      );
    post();
    const onReady = (e: MessageEvent) => {
      if (
        e.origin === location.origin &&
        e.source === iframe.current?.contentWindow &&
        e.data?.type === 'ds-preview-ready'
      )
        post();
    };
    addEventListener('message', onReady);
    return () => removeEventListener('message', onReady);
  }, [previewTokens]);

  const clearError = () => {
    setError('');
    setNotice('');
  };
  async function perform(action: () => Promise<void>) {
    clearError();
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function proposeDrafts() {
    if (!state || !drafts.changes.length) return;
    await perform(async () => {
      setProposal(
        await request<Proposal>('proposals', {
          revision: state.revision,
          changes: drafts.changes,
        }),
      );
    });
  }
  async function accept() {
    if (!proposal) return;
    setSaving(true);
    await perform(async () => {
      const next = await commit(proposal);
      setState(next);
      setProposal(undefined);
      announceChange();
      setNotice(`Changement n°${next.revision} enregistré sur votre machine.`);
    });
    setSaving(false);
  }
  async function sendMessage() {
    if (!state || !message.trim() || thinking) return;
    const text = message;
    setMessage('');
    setThinking(true);
    clearError();
    const previous = chat.slice(-10);
    setChat([...chat, { role: 'user', text }]);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const result = await request<{
        message: string;
        proposal: Proposal | null;
      }>(
        'agent',
        { agent, message: text, revision: state.revision, history: previous },
        abort.signal,
      );
      setChat((c) => [...c, { role: 'assistant', text: result.message }]);
      if (result.proposal) {
        // La bulle se replie : le diff et l'aperçu prennent la place.
        setChatOpen(false);
        setUnread(true);
        setProposal(result.proposal);
      } else if (!chatOpenRef.current) setUnread(true);
    } catch (e) {
      setChat((c) => [
        ...c,
        {
          role: 'assistant',
          text: abort.signal.aborted
            ? 'Demande interrompue. Aucun changement accepté.'
            : (e as Error).message,
        },
      ]);
    } finally {
      setThinking(false);
      controller.current = null;
    }
  }
  const saveRef = useRef(proposeDrafts);
  saveRef.current = proposeDrafts;
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveRef.current();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;

  if (!state || !drafts.preview)
    return (
      <main className="loading">
        <h1>DS-Studio</h1>
        <p role="alert">{stateError || 'Ouverture du Design System…'}</p>
        <p>Lancez le serveur local puis rechargez cette page.</p>
      </main>
    );

  const preview = drafts.preview;
  const errorCount = Object.keys(drafts.errors).length;
  const pendingCount = Object.keys(drafts.drafts).length;
  const selectedAgent = agents.find((a) => a.id === agent);
  const agentName = agent === 'codex' ? 'Codex' : 'Claude';
  const staleProposal = !!proposal && proposal.revision !== state.revision;
  const dev = devices.find((d) => d.id === device) ?? devices[1];
  const available = Math.max(0, stageWidth - 32);
  const scale =
    layout.fit && available > 0 && dev.width > available
      ? available / dev.width
      : 1;
  const query = search.trim().toLowerCase();
  const matches = query
    ? (Object.keys(tokenLabels) as TokenKey[]).filter(
        (k) =>
          k.toLowerCase().includes(query) ||
          tokenLabels[k].toLowerCase().includes(query),
      )
    : [];

  let title = '';
  let description = '';
  let keys: TokenKey[] = [];
  let demo: (() => ReactNode) | undefined;
  if (query) {
    title = 'Résultats';
    description = `${matches.length} token${matches.length > 1 ? 's' : ''} pour « ${search.trim()} ».`;
    keys = matches;
  } else if (selection.kind === 'tokens') {
    const g = tokenGroups.find((x) => x.id === selection.id) ?? tokenGroups[0];
    title = g.label;
    description = `${g.keys.length} token${g.keys.length > 1 ? 's' : ''}. Modifiez autant de valeurs que vous voulez : l’aperçu suit, puis un seul « Enregistrer » valide tout.`;
    keys = g.keys;
  } else if (selection.kind === 'component') {
    const c = components.find((x) => x.id === selection.id) ?? components[0];
    title = c.label;
    description = c.description;
    keys = c.tokens;
    demo = c.render;
  } else {
    const s = screens.find((x) => x.id === selection.id) ?? screens[0];
    title = s.label;
    description = `${s.description} Affiché dans l’aperçu.`;
    keys = s.tokens;
  }

  function select(next: Selection) {
    setSearch('');
    setSelection(next);
    if (next.kind === 'screen') setScenario(next.id);
  }
  function onSplitterKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 10 : 2;
    let split = layout.split;
    if (e.key === 'ArrowLeft') split -= step;
    else if (e.key === 'ArrowRight') split += step;
    else if (e.key === 'Home') split = 28;
    else if (e.key === 'End') split = 72;
    else return;
    e.preventDefault();
    setLayout({ ...layout, split: Math.min(72, Math.max(28, split)) });
  }
  function onSplitterDown(e: PointerEvent<HTMLDivElement>) {
    const box = workspace.current?.getBoundingClientRect();
    if (!box) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    document.body.classList.add('is-resizing');
    target.onpointermove = (m) => {
      const pct = ((m.clientX - box.left) / box.width) * 100;
      setLayout((l) => ({ ...l, split: Math.min(72, Math.max(28, pct)) }));
    };
    target.onpointerup = () => {
      target.onpointermove = null;
      document.body.classList.remove('is-resizing');
    };
  }

  const renderRow = (k: TokenKey) => {
    const saved = state.tokens[k].$value;
    const raw = drafts.drafts[k] ?? String(saved);
    const err = drafts.errors[k];
    const modified = k in drafts.drafts;
    const type = state.tokens[k].$type;
    const label = tokenLabels[k];
    const contrast =
      type === 'color' && !err ? contrastFor(preview, k) : undefined;
    const errId = `err-${k.replace('.', '-')}`;
    const range = sliderRange[k] ?? [0, 128];
    return (
      <li
        key={k}
        className={`token-row${modified ? ' is-modified' : ''}${err ? ' has-error' : ''}`}
      >
        <div className="token-id">
          <span className="token-name">
            {label}
            {modified && !err && (
              <span className="modified-dot" title="Modifié, non enregistré">
                <span className="sr-only">(modifié, non enregistré)</span>
              </span>
            )}
          </span>
          <code>{k}</code>
        </div>
        <div className="token-control">
          {type === 'color' && (
            <>
              <label
                className="swatch-picker"
                style={{
                  background: err ? String(saved) : String(preview[k].$value),
                }}
              >
                <input
                  type="color"
                  aria-label={`Choisir visuellement : ${label}`}
                  value={
                    err
                      ? String(saved)
                      : String(preview[k].$value).toLowerCase()
                  }
                  onChange={(e) => drafts.set(k, e.target.value.toUpperCase())}
                />
              </label>
              <input
                className="hex-input"
                aria-label={label}
                aria-invalid={!!err}
                aria-describedby={err ? errId : undefined}
                value={raw}
                maxLength={7}
                spellCheck={false}
                onChange={(e) => drafts.set(k, e.target.value)}
              />
            </>
          )}
          {type === 'dimension' && (
            <>
              <input
                type="range"
                className="range-input"
                aria-label={`${label} (curseur)`}
                min={range[0]}
                max={range[1]}
                step={1}
                value={err ? Number(saved) : Number(preview[k].$value)}
                onChange={(e) => drafts.set(k, e.target.value)}
              />
              <input
                className="number-input"
                type="number"
                aria-label={label}
                aria-invalid={!!err}
                aria-describedby={err ? errId : undefined}
                min={0}
                max={128}
                step="any"
                value={raw}
                onChange={(e) => drafts.set(k, e.target.value)}
              />
              <span className="unit">px</span>
            </>
          )}
          {type === 'fontFamily' && (
            <select
              aria-label={label}
              value={raw}
              onChange={(e) => drafts.set(k, e.target.value)}
            >
              {fonts.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="row-reset"
            aria-label={`Rétablir : ${label}`}
            title="Rétablir la valeur enregistrée"
            disabled={!modified}
            onClick={() => drafts.reset(k)}
          >
            ↺
          </button>
        </div>
        {err && (
          <p className="row-error" id={errId}>
            {err}
          </p>
        )}
        {contrast && (
          <p className={`contrast-chip ${contrast.ok ? 'ok' : 'low'}`}>
            Contraste {contrast.label} : {contrast.ratio.toFixed(2)}:1 ·{' '}
            {contrast.ok
              ? contrast.min === 3
                ? 'AA élément graphique'
                : 'AA texte courant'
              : 'contraste à améliorer'}
          </p>
        )}
      </li>
    );
  };

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#ds-title"
        onClick={(e) => {
          e.preventDefault();
          setFull(false);
          document.getElementById('ds-title')?.focus();
        }}
      >
        Aller aux tokens
      </a>
      <header className="studio-header">
        <div className="wordmark">
          <span className="brand-symbol">ds.</span>
          <div>
            <strong>DS-Studio</strong>
            <span>Gutt · prototype PFE</span>
          </div>
        </div>
        <div
          className={`save-status ${
            saving
              ? 'is-saving'
              : !pendingCount
                ? 'is-saved'
                : errorCount
                  ? 'is-error'
                  : 'is-dirty'
          }`}
        >
          <p
            role="status"
            title={
              drafts.recovered && pendingCount
                ? 'Modifications reprises après rechargement de la page'
                : undefined
            }
          >
            <span className="save-dot" aria-hidden="true" />
            {saving
              ? 'Enregistrement…'
              : !pendingCount
                ? 'Enregistré'
                : errorCount
                  ? `${errorCount} valeur${errorCount > 1 ? 's' : ''} à corriger`
                  : `${drafts.changes.length} modif${drafts.changes.length > 1 ? 's' : ''} non enregistrée${drafts.changes.length > 1 ? 's' : ''}`}
          </p>
          {pendingCount > 0 && (
            <>
              <button
                className="save-cancel"
                aria-label="Annuler les modifications non enregistrées"
                onClick={drafts.clear}
              >
                Annuler
              </button>
              <button
                className="studio-primary save-button"
                title="Enregistrer (Ctrl ou Cmd + S)"
                disabled={!boot || errorCount > 0 || !drafts.changes.length}
                onClick={() => void proposeDrafts()}
              >
                Enregistrer ({drafts.changes.length})
              </button>
            </>
          )}
        </div>
        <div className="header-actions">
          <span className="muted figma-status">
            {boot?.figma.label ?? 'Figma non connecté'}
          </span>
          <button onClick={() => setBriefOpen(true)}>Mon PFE</button>
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            aria-expanded={historyOpen}
          >
            Historique
          </button>
          <button onClick={() => void perform(exportTokens)}>
            Exporter les tokens
          </button>
          <label className="file-button">
            Importer un JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file)
                  void perform(async () => {
                    if (file.size > 128000)
                      throw new Error(
                        'Fichier trop volumineux (128 Ko maximum).',
                      );
                    const tokens = JSON.parse(await file.text());
                    setProposal(
                      await request('import', {
                        revision: state.revision,
                        tokens,
                      }),
                    );
                  });
              }}
            />
          </label>
        </div>
      </header>
      <div className="feedback" aria-live="polite">
        {(error || stateError) && !proposal && (
          <p className="error" role="alert">
            {error || stateError}
            <button
              className="feedback-close"
              aria-label="Fermer le message"
              onClick={clearError}
            >
              ×
            </button>
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
            <button
              className="feedback-close"
              aria-label="Fermer le message"
              onClick={clearError}
            >
              ×
            </button>
          </p>
        )}
      </div>

      <main
        ref={workspace}
        className={`workspace${full ? ' is-full' : ''}`}
        style={{ '--split': `${layout.split}%` } as CSSProperties}
      >
        <section className="pane ds-pane" aria-labelledby="ds-title">
          <div className="pane-head">
            <h2 id="ds-title" tabIndex={-1}>
              Design System
            </h2>
            <span className="muted">r{state.revision}</span>
          </div>
          <div className="ds-layout">
            <nav className="ds-sidebar" aria-label="Contenu du Design System">
              <input
                type="search"
                className="sidebar-search"
                aria-label="Rechercher un token"
                placeholder="Rechercher un token"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <p className="side-group">Tokens</p>
              {tokenGroups.map((g) => {
                const changed = g.keys.filter((k) => k in drafts.drafts).length;
                return (
                  <button
                    key={g.id}
                    className="side-item"
                    aria-current={
                      !query &&
                      selection.kind === 'tokens' &&
                      selection.id === g.id
                        ? 'page'
                        : undefined
                    }
                    onClick={() => select({ kind: 'tokens', id: g.id })}
                  >
                    {g.label}
                    <span className="side-count">
                      {changed ? `${changed} mod.` : g.keys.length}
                    </span>
                  </button>
                );
              })}
              <p className="side-group">Composants</p>
              {components.map((c) => (
                <button
                  key={c.id}
                  className="side-item"
                  aria-current={
                    !query &&
                    selection.kind === 'component' &&
                    selection.id === c.id
                      ? 'page'
                      : undefined
                  }
                  onClick={() => select({ kind: 'component', id: c.id })}
                >
                  {c.label}
                </button>
              ))}
              <p className="side-group">Écrans</p>
              {screens.map((s) => (
                <button
                  key={s.id}
                  className="side-item"
                  aria-current={
                    !query &&
                    selection.kind === 'screen' &&
                    selection.id === s.id
                      ? 'page'
                      : undefined
                  }
                  onClick={() => select({ kind: 'screen', id: s.id })}
                >
                  {s.label}
                </button>
              ))}
            </nav>
            <div className="ds-content">
              <div className="content-head">
                <h3>{title}</h3>
                <p role={query ? 'status' : undefined}>{description}</p>
              </div>
              {demo && (
                <div
                  className="component-stage"
                  aria-label={`Aperçu : ${title}`}
                >
                  <DSProvider tokens={preview}>
                    <div className="stage-inner">{demo()}</div>
                  </DSProvider>
                </div>
              )}
              {selection.kind !== 'tokens' && !query && (
                <p className="rows-title">Tokens utilisés</p>
              )}
              {keys.length ? (
                <ul className="token-rows">{keys.map(renderRow)}</ul>
              ) : (
                <p className="empty">
                  Aucun token ne correspond. Essayez « couleur », « space » ou «
                  police ».
                </p>
              )}
            </div>
          </div>
        </section>

        <div
          className="splitter"
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Largeur du panneau Design System"
          aria-valuemin={28}
          aria-valuemax={72}
          aria-valuenow={Math.round(layout.split)}
          onKeyDown={onSplitterKey}
          onPointerDown={onSplitterDown}
          onDoubleClick={() => setLayout({ ...layout, split: 50 })}
          title="Glisser pour redimensionner · double-clic pour centrer"
        >
          <span />
        </div>

        <section className="pane preview-pane" aria-labelledby="preview-title">
          <div className="pane-head preview-head">
            <h2 id="preview-title" tabIndex={-1}>
              Aperçu
            </h2>
            <ScreenPicker
              screens={screens}
              value={scenario}
              onChange={(id) => {
                setScenario(id);
                if (selection.kind === 'screen')
                  setSelection({ kind: 'screen', id });
              }}
            />
            <div
              className="segmented"
              role="group"
              aria-label="Largeur d’écran"
            >
              {devices.map((d) => (
                <button
                  key={d.id}
                  aria-pressed={device === d.id}
                  title={`${d.title} · ${d.width} px`}
                  aria-label={`${d.title} ${d.width} px`}
                  onClick={() => setDevice(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="preview-tools">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={layout.fit}
                  onChange={(e) =>
                    setLayout({ ...layout, fit: e.target.checked })
                  }
                />
                Ajuster
              </label>
              <button
                className="icon-button"
                aria-pressed={full}
                aria-label={full ? 'Quitter le plein écran' : 'Plein écran'}
                title={full ? 'Quitter le plein écran' : 'Plein écran'}
                onClick={() => setFull(!full)}
              >
                {full ? '⤡' : '⤢'}
              </button>
            </div>
          </div>
          <div className="stage" ref={stage}>
            <div
              className="frame-holder"
              style={{
                width: dev.width * scale,
                height: dev.height * scale,
              }}
            >
              <iframe
                ref={iframe}
                title="Aperçu responsive"
                src={`/?preview=1&scenario=${scenario}`}
                width={dev.width}
                height={dev.height}
                style={{ transform: `scale(${scale})` }}
              />
            </div>
          </div>
          <div className="pane-foot">
            {dev.title} · {dev.width} px CSS ·{' '}
            {scale < 1
              ? `affiché à ${Math.round(scale * 100)} %`
              : 'taille réelle'}
            {previewTokens
              ? ' · aperçu des modifications non enregistrées'
              : ''}
          </div>
        </section>
      </main>

      <button
        className={`chat-bubble${chatOpen ? ' is-open' : ''}`}
        aria-expanded={chatOpen}
        aria-controls="chat-panel"
        aria-label={chatOpen ? 'Fermer l’assistant' : 'Ouvrir l’assistant'}
        onClick={() => setChatOpen(!chatOpen)}
      >
        {chatOpen ? '×' : '✦'}
        {unread && !chatOpen && <span className="unread-dot" />}
      </button>
      <aside
        id="chat-panel"
        className="chat-panel"
        hidden={!chatOpen}
        aria-labelledby="chat-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setChatOpen(false);
        }}
      >
        <div className="chat-head">
          <h2 id="chat-title">Assistant</h2>
          <select
            aria-label="Assistant utilisé"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
          >
            <option value="claude">Claude</option>
            <option value="codex">Codex</option>
            <option value="gemini" disabled>
              Gemini (non disponible)
            </option>
          </select>
          <button
            className="drawer-close"
            aria-label="Fermer l’assistant"
            onClick={() => setChatOpen(false)}
          >
            ×
          </button>
        </div>
        <p className="chat-status">
          {selectedAgent?.detail ?? 'Détection de l’assistant…'}
        </p>
        <div className="chat-log" aria-label="Conversation" aria-live="polite">
          {!chat.length && (
            <p className="chat-empty">
              Décrivez ce que vous voulez changer. L’assistant propose des
              valeurs de tokens, vous validez toujours le diff.
            </p>
          )}
          {chat.map((c, i) => (
            <article className={`chat-message ${c.role}`} key={i}>
              <strong>{c.role === 'user' ? 'Vous' : agentName}</strong>
              <p>{c.text}</p>
            </article>
          ))}
          {thinking && <p className="chat-thinking">Réflexion en cours…</p>}
        </div>
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
        >
          <textarea
            ref={chatInput}
            aria-label="Votre demande"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            maxLength={8000}
            placeholder="Propose une couleur de marque plus chaleureuse"
            disabled={thinking}
          />
          {thinking ? (
            <button type="button" onClick={() => controller.current?.abort()}>
              Arrêter
            </button>
          ) : (
            <button
              className="studio-primary"
              disabled={!message.trim() || !selectedAgent?.available}
            >
              Envoyer
            </button>
          )}
        </form>
        <p className="chat-foot">
          Envoyé : tokens, PFE.md, brief, règles et 10 derniers messages. Aucun
          outil, propositions seulement.
        </p>
      </aside>

      <dialog
        ref={briefDialog}
        className="drawer"
        aria-labelledby="brief-title"
        onClose={() => setBriefOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setBriefOpen(false);
        }}
      >
        <div className="drawer-inner">
          <header className="drawer-head">
            <div>
              <span className="drawer-kicker">Brief privé · sur ce poste</span>
              <h2 id="brief-title">Mon PFE</h2>
            </div>
            <button
              className="drawer-close"
              aria-label="Fermer le brief"
              onClick={() => setBriefOpen(false)}
            >
              ×
            </button>
          </header>
          <ProjectBrief />
        </div>
      </dialog>

      <dialog
        ref={historyDialog}
        className="drawer"
        aria-labelledby="history-title"
        onClose={() => setHistoryOpen(false)}
        onClick={(e) => {
          // Clic sur le fond assombri : fermeture.
          if (e.target === e.currentTarget) setHistoryOpen(false);
        }}
      >
        <div className="drawer-inner">
          <header className="drawer-head">
            <div>
              <span className="drawer-kicker">
                {state.history.length} changement
                {state.history.length > 1 ? 's' : ''} enregistré
                {state.history.length > 1 ? 's' : ''}
              </span>
              <h2 id="history-title">Historique</h2>
            </div>
            <button
              className="drawer-close"
              aria-label="Fermer l’historique"
              onClick={() => setHistoryOpen(false)}
            >
              ×
            </button>
          </header>
          <p className="drawer-intro">
            Chaque changement validé apparaît ici, du plus récent au plus
            ancien. Vous pouvez revenir en arrière sur un seul changement : tous
            les autres restent en place, et rien n’est effacé.
          </p>
          {!state.history.length && (
            <p className="drawer-empty">Aucun changement pour l’instant.</p>
          )}
          <ol className="timeline">
            {[...state.history].reverse().map((event) => (
              <li key={event.id}>
                <div className="timeline-top">
                  <strong>Changement n°{event.revision}</strong>
                  <span className={`source-chip ${event.source}`}>
                    {sourceLabels[event.source] ?? event.source}
                  </span>
                </div>
                <time dateTime={event.date}>
                  {new Date(event.date).toLocaleString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
                <ul className="patch-list">
                  {event.patches.map((p) => (
                    <li key={p.key}>
                      <span className="patch-name">
                        {tokenLabels[p.key] ?? p.key}
                        <code>{p.key}</code>
                      </span>
                      <span className="patch-values">
                        <Swatch value={p.before} />
                        <del>{p.before}</del>
                        <span aria-hidden="true">→</span>
                        <Swatch value={p.after} />
                        <ins>{p.after}</ins>
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  className="timeline-undo"
                  aria-label={`Revenir en arrière sur le changement n°${event.revision}`}
                  onClick={() =>
                    void perform(async () => {
                      const next = await request<Proposal>('undo', {
                        revision: state.revision,
                        id: event.id,
                      });
                      // Le panneau se ferme : le diff prend le relais.
                      setHistoryOpen(false);
                      setProposal(next);
                    })
                  }
                >
                  Revenir en arrière sur ce changement
                </button>
              </li>
            ))}
          </ol>
        </div>
      </dialog>

      <dialog
        ref={dialog}
        onCancel={(e) => {
          if (saving) e.preventDefault();
          else setProposal(undefined);
        }}
        aria-labelledby="diff-title"
      >
        <h2 id="diff-title">Valider les changements</h2>
        <p>
          {sourceLabels[proposal?.source ?? 'manual']} ·{' '}
          {proposal?.revision
            ? `basé sur le changement n°${proposal.revision}`
            : 'basé sur la version initiale'}
          . Ces valeurs seront enregistrées sur votre machine.
        </p>
        {staleProposal && (
          <p role="alert" className="error">
            Une autre validation a modifié le DS. Fermez ce diff et refaites
            votre proposition ; aucun écrasement n’est permis.
          </p>
        )}
        <div className="diff-scroll">
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Avant</th>
                <th>Après</th>
              </tr>
            </thead>
            <tbody>
              {proposal?.patches.map((p) => (
                <tr key={p.key}>
                  <th>
                    <span className="patch-name">
                      {tokenLabels[p.key] ?? p.key}
                      <code>{p.key}</code>
                    </span>
                  </th>
                  <td>
                    <span className="patch-values">
                      <Swatch value={p.before} />
                      <del>{p.before}</del>
                    </span>
                  </td>
                  <td>
                    <span className="patch-values">
                      <Swatch value={p.after} />
                      <ins>{p.after}</ins>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            ref={cancelButton}
            onClick={() => setProposal(undefined)}
            disabled={saving}
          >
            Ne pas appliquer
          </button>
          <button
            className="studio-primary"
            onClick={() => void accept()}
            disabled={saving || staleProposal}
          >
            {saving ? 'Enregistrement…' : 'Valider et enregistrer'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
