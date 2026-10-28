import {
  Fragment,
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
import ProjectMenu, { newProjectKey } from './ProjectMenu.js';
import ColorPicker from './ColorPicker.js';
import AddToken from './AddToken.js';
import { useDrafts } from './useTokenDraft.js';
import {
  chatTitle,
  currentProject,
  projectKey,
  readChats,
  writeChats,
  type SavedChat,
} from './chatHistory.js';
import Tour, { tourKey, type TourStep } from './Tour.js';
import Settings, { type Prefs, type Tab as SettingsTab } from './Settings.js';
import FigmaPanel from './FigmaPanel.js';
import RichText from './RichText.js';
import { applyTheme, readTheme, saveTheme, type Theme } from './theme.js';
import {
  identityKey,
  logoText,
  readIdentity,
  saveIdentity,
  type Identity,
} from './identity.js';
import { buildDocHtml } from './docExport.js';
import { VisionFilters, visionFilter, visions, type Vision } from './vision.js';
import dsCss from './ds-components.css?raw';
import {
  auditAll,
  auditTokens,
  isColorProfile,
  profiles,
  type Profile,
  measureTargets,
  score as auditScore,
  type Check,
} from './a11yAudit.js';
import { toCssVariables, toTailwindV3, toTailwindV4 } from './exporters.js';
import {
  bootstrap,
  commit,
  downloadText,
  exportTokens,
  getState,
  request,
  type Bootstrap,
} from './api.js';
import {
  allKeys,
  isCustomKey,
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
  groupsFor,
  labelOf,
  prefixOfGroup,
} from './tokenMeta.js';

const devices = [
  { id: 'xs', label: '320', title: 'Mobile compact', width: 320, height: 640 },
  { id: 'sm', label: '375', title: 'Mobile', width: 375, height: 812 },
  { id: 'md', label: '430', title: 'Grand mobile', width: 430, height: 932 },
  { id: 'tab', label: '768', title: 'Tablette', width: 768, height: 1024 },
  { id: 'lg', label: '1280', title: 'Ordinateur', width: 1280, height: 800 },
  { id: 'xl', label: '1440', title: 'Grand écran', width: 1440, height: 900 },
];
type FrameKind = 'phone' | 'tablet' | 'browser' | 'none';
const frameKind = (w: number): Exclude<FrameKind, 'none'> =>
  w < 600 ? 'phone' : w < 1000 ? 'tablet' : 'browser';
const frameLabel = {
  phone: 'téléphone',
  tablet: 'tablette',
  browser: 'navigateur',
};
// Épaisseur du cadre autour de l'écran : [horizontal, vertical], en px.
const frameInset: Record<FrameKind, [number, number]> = {
  phone: [24, 24],
  tablet: [36, 36],
  browser: [2, 40],
  none: [2, 2],
};
const clampSize = (w: number, h: number) => ({
  w: Math.round(Math.min(1920, Math.max(240, w || 375))),
  h: Math.round(Math.min(1600, Math.max(320, h || 812))),
});

const sourceLabels: Record<string, string> = {
  manual: 'Fait à la main',
  codex: 'Proposé par Codex',
  claude: 'Proposé par Claude',
  figma: 'Lu dans Figma',
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

const models = [
  {
    id: 'sonnet',
    label: 'Sonnet · équilibré',
    hint: 'Sonnet : bon équilibre entre qualité, vitesse et quota.',
  },
  {
    id: 'opus',
    label: 'Opus · le plus poussé',
    hint: 'Opus : réponses plus fines, plus lent, consomme plus de quota.',
  },
  {
    id: 'haiku',
    label: 'Haiku · rapide',
    hint: 'Haiku : très rapide et économe, pour des demandes simples.',
  },
] as const;
const efforts = [
  { id: 'low', label: 'Faible' },
  { id: 'medium', label: 'Moyen' },
  { id: 'high', label: 'Élevé' },
  { id: 'xhigh', label: 'Très élevé' },
] as const;
type AssistantPrefs = {
  model: (typeof models)[number]['id'];
  effort: (typeof efforts)[number]['id'];
};
type ChatEntry = {
  role: 'user' | 'assistant';
  text: string;
  usage?: { model: string; inputTokens: number; outputTokens: number };
  effort?: AssistantPrefs['effort'];
};
// Préférences de démarrage choisies dans les Paramètres.
const prefsKey = 'ds-studio-prefs';
function readPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(prefsKey) || '{}');
    return {
      device: typeof p.device === 'string' ? p.device : 'sm',
      profile: typeof p.profile === 'string' ? p.profile : 'aa',
    };
  } catch {
    return { device: 'sm', profile: 'aa' };
  }
}
function readAgent() {
  try {
    const a = localStorage.getItem('ds-studio-agent');
    return a === 'codex' || a === 'gemini' ? a : 'claude';
  } catch {
    return 'claude';
  }
}
function readAssistant(): AssistantPrefs {
  try {
    const saved = JSON.parse(
      localStorage.getItem('ds-studio-assistant') || '{}',
    );
    return {
      model: models.some((m) => m.id === saved.model) ? saved.model : 'sonnet',
      effort: efforts.some((e) => e.id === saved.effort)
        ? saved.effort
        : 'medium',
    };
  } catch {
    return { model: 'sonnet', effort: 'medium' };
  }
}
const fmt = (n: number) => n.toLocaleString('fr-FR');
type Limits = {
  id: 'five_hour' | 'seven_day';
  utilization: number;
  resetsAt: number;
}[];
const limitLabels = { five_hour: 'Session (5 h)', seven_day: 'Semaine' };
function readLimits(): { limits: Limits; at: number } | undefined {
  try {
    const saved = JSON.parse(
      localStorage.getItem('ds-studio-limits') || 'null',
    );
    return Array.isArray(saved?.limits) && typeof saved.at === 'number'
      ? saved
      : undefined;
  } catch {
    return undefined;
  }
}
function resetLabel(id: Limits[number]['id'], ts: number) {
  const d = new Date(ts * 1000);
  return id === 'five_hour'
    ? `remise à zéro à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : `remise à zéro ${d.toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}`;
}
function modelName(id: string) {
  const m = id.match(/(opus|sonnet|haiku|fable)/i)?.[1];
  return m ? m[0].toUpperCase() + m.slice(1).toLowerCase() : 'Claude';
}

const exportsList: {
  id: string;
  label: string;
  hint: string;
  file: string;
  type: string;
  make: (t: Tokens) => string;
}[] = [
  {
    id: 'json',
    label: 'Tokens JSON',
    hint: 'Format DS-Studio, réimportable',
    file: 'design-system.tokens.json',
    type: 'application/json',
    make: () => '',
  },
  {
    id: 'css',
    label: 'Variables CSS',
    hint: 'tokens.css, pour tout projet web',
    file: 'tokens.css',
    type: 'text/css',
    make: toCssVariables,
  },
  {
    id: 'tw4',
    label: 'Tailwind v4',
    hint: 'theme.css avec @theme',
    file: 'theme.css',
    type: 'text/css',
    make: toTailwindV4,
  },
  {
    id: 'tw3',
    label: 'Tailwind v3',
    hint: 'tailwind.config.js',
    file: 'tailwind.config.js',
    type: 'text/javascript',
    make: toTailwindV3,
  },
  {
    id: 'doc',
    label: 'Documentation',
    hint: 'Page HTML, imprimable en PDF',
    file: 'gutt-design-system.html',
    type: 'text/html',
    make: () => '',
  },
];

// Documentation : composants rendus en HTML statique avec les valeurs
// enregistrées, styles des composants inclus.
async function makeDoc(tokens: Tokens) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return buildDocHtml({
    tokens,
    componentCss: dsCss,
    components: components.map((c) => ({
      label: c.label,
      description: c.description,
      tokens: c.tokens,
      html: renderToStaticMarkup(
        <DSProvider tokens={tokens}>{c.render()}</DSProvider>,
      ),
    })),
  });
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
      frame: saved.frame !== false,
      free: clampSize(saved.free?.w ?? 600, saved.free?.h ?? 900),
    };
  } catch {
    return { split: 50, fit: true, frame: true, free: clampSize(600, 900) };
  }
}

// Valeur d'un diff : null veut dire « absent » (token créé ou supprimé).
function PatchValue({
  value,
  kind,
}: {
  value: string | number | null;
  kind: 'del' | 'ins';
}) {
  if (value === null)
    return (
      <em className="patch-absent">
        {kind === 'del' ? 'nouveau token' : 'supprimé'}
      </em>
    );
  return (
    <>
      <Swatch value={value} />
      {kind === 'del' ? <del>{value}</del> : <ins>{value}</ins>}
    </>
  );
}

function Swatch({ value }: { value: string | number }) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? (
    <span className="swatch" style={{ background: value }} aria-hidden="true" />
  ) : null;
}

type Selection =
  | { kind: 'tokens'; id: string }
  | { kind: 'component'; id: string }
  | { kind: 'screen'; id: string }
  | { kind: 'audit'; id: string };

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
  // Accueil affiché une fois, juste après la création d'un projet.
  const [welcome, setWelcome] = useState(() => {
    try {
      const name = sessionStorage.getItem(newProjectKey);
      sessionStorage.removeItem(newProjectKey);
      return name;
    } catch {
      return null;
    }
  });
  const [prefs, setPrefs] = useState(readPrefs);
  const [device, setDevice] = useState(() =>
    devices.some((d) => d.id === prefs.device) ? prefs.device : 'sm',
  );
  const [freeOpen, setFreeOpen] = useState(false);
  // Mode Comparer : deux formats côte à côte (mobile et desktop par défaut).
  const [compare, setCompare] = useState(false);
  // Comparer deux formats, ou l'avant (enregistré) et l'après (modifs en cours).
  const [compareMode, setCompareMode] = useState<'formats' | 'before'>(
    'formats',
  );
  const beforeAfter = compare && compareMode === 'before';
  const [pair, setPair] = useState<[string, string]>(['sm', 'xl']);
  const [scenario, setScenario] = useState('cards');
  const [layout, setLayout] = useState(readLayout);
  const [full, setFull] = useState(false);
  const [stageWidth, setStageWidth] = useState(0);
  const [stageHeight, setStageHeight] = useState(0);
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  // Assistant
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [agents, setAgents] = useState<Bootstrap['agents']>([]);
  const [agent, setAgent] = useState(readAgent);
  const [message, setMessage] = useState('');
  // Conversations gardées dans le navigateur : la dernière se rouvre au
  // chargement ; on peut en démarrer une nouvelle ou en rouvrir une ancienne.
  const [chats, setChats] = useState(() => readChats<ChatEntry>());
  const [chatId, setChatId] = useState<string | null>(
    () => chats[0]?.id ?? null,
  );
  const [chat, setChat] = useState<ChatEntry[]>(() => chats[0]?.entries ?? []);
  const [chatListOpen, setChatListOpen] = useState(false);
  useEffect(() => {
    if (!chat.length) return;
    const id = chatId ?? crypto.randomUUID();
    if (!chatId) setChatId(id);
    setChats((list) => {
      const first = chat.find((e) => e.role === 'user');
      const entry: SavedChat<ChatEntry> = {
        id,
        agent,
        title: chatTitle(first?.text ?? ''),
        updated: Date.now(),
        entries: chat,
      };
      return writeChats([entry, ...list.filter((c) => c.id !== id)]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat]);
  const newChat = () => {
    setChat([]);
    setChatId(null);
    setChatListOpen(false);
  };
  const [assistant, setAssistant] = useState(readAssistant);
  const [limits, setLimits] = useState(readLimits);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState<TokenKey | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  // Visite guidée : ouverte au premier lancement, puis avec le bouton « ? ».
  // État de l'atelier avant la visite, rétabli à la fin (chat, Comparer).
  const tourPrev = useRef<{
    compare: boolean;
    chatOpen: boolean;
    selection?: Selection;
  }>({
    compare: false,
    chatOpen: false,
    selection: { kind: 'tokens', id: 'colors' },
  });
  const [tourOpen, setTourOpen] = useState(() => {
    try {
      return !localStorage.getItem(tourKey);
    } catch {
      return false;
    }
  });
  // Profil de vision vérifié dans l'audit ; les daltonismes et la vision sans
  // couleur s'appliquent aussi à l'aperçu.
  const [profile, setProfile] = useState<Profile>(() =>
    profiles.some((p) => p.id === prefs.profile)
      ? (prefs.profile as Profile)
      : 'aa',
  );
  // Paramètres de l'atelier (modale) et apparence.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('look');
  // Pastille de la bulle Figma : revérifiée à la fermeture des Paramètres
  // ou du Brief (lien Figma). « claude mcp get » ne consomme aucun quota.
  const [figmaState, setFigmaState] = useState<'checking' | 'ok' | 'off'>(
    'checking',
  );
  useEffect(() => {
    if (settingsOpen || briefOpen) return;
    let live = true;
    request<{ state: string; fileKey: string | null }>('figma/status')
      .then((s) => {
        if (live)
          setFigmaState(s.state === 'connected' && s.fileKey ? 'ok' : 'off');
      })
      .catch(() => live && setFigmaState('off'));
    return () => {
      live = false;
    };
  }, [settingsOpen, briefOpen]);
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
    if (theme.mode !== 'auto') return;
    // Mode auto : suit le réglage clair / sombre du Mac en direct.
    const q = matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme(theme);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, [theme]);
  const [identity, setIdentity] = useState<Identity>(readIdentity);
  useEffect(() => {
    saveIdentity(identity);
    document.title = `${identity.name} · Atelier local`;
  }, [identity]);
  useEffect(() => {
    try {
      localStorage.setItem(prefsKey, JSON.stringify(prefs));
      localStorage.setItem('ds-studio-agent', agent);
    } catch {
      /* stockage indisponible : préférences valables pour la session */
    }
  }, [prefs, agent]);
  // Nouvelle page du Design System : on repart du haut.
  useEffect(() => {
    document.querySelector('.ds-content')?.scrollTo({ top: 0 });
  }, [selection.kind, selection.id]);
  // Ligne mise en avant après « Corriger dans … » depuis le contrôle.
  const [focusKey, setFocusKey] = useState<TokenKey | null>(null);
  useEffect(() => {
    if (!focusKey) return;
    const t = setTimeout(() => {
      document
        .getElementById(`row-${focusKey.replace('.', '-')}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
    const end = setTimeout(() => setFocusKey(null), 2600);
    return () => {
      clearTimeout(t);
      clearTimeout(end);
    };
  }, [focusKey]);
  const vision: Vision = isColorProfile(profile) ? profile : 'none';
  // Catégories du menu repliables ; l'élément affiché reste toujours visible.
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    try {
      const v = JSON.parse(
        localStorage.getItem('ds-studio-nav-collapsed') ?? '[]',
      );
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(
        'ds-studio-nav-collapsed',
        JSON.stringify(collapsed),
      );
    } catch {
      /* stockage indisponible : le repli reste valable pour la session */
    }
  }, [collapsed]);
  useEffect(() => {
    if (!exportOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.('.export-wrap'))
        setExportOpen(false);
    };
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false);
    };
    addEventListener('mousedown', close);
    addEventListener('keydown', key);
    return () => {
      removeEventListener('mousedown', close);
      removeEventListener('keydown', key);
    };
  }, [exportOpen]);
  const [limitsMissing, setLimitsMissing] = useState(false);
  useEffect(() => {
    if (!creditsOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.('.credit-wrap'))
        setCreditsOpen(false);
    };
    addEventListener('mousedown', close);
    return () => removeEventListener('mousedown', close);
  }, [creditsOpen]);
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
      .then((b) => {
        setBoot(b);
        // Projet changé ailleurs (autre onglet) : on affiche ses conversations.
        if (b.project !== currentProject()) {
          try {
            localStorage.setItem(projectKey, b.project);
          } catch {
            /* facultatif */
          }
          const list = readChats<ChatEntry>(b.project);
          setChats(list);
          setChatId(list[0]?.id ?? null);
          setChat(list[0]?.entries ?? []);
        }
      })
      .catch((e) => setError(e.message));
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('ds-studio-assistant', JSON.stringify(assistant));
    } catch {
      /* Préférence facultative. */
    }
  }, [assistant]);
  useEffect(() => {
    try {
      localStorage.setItem('ds-studio-layout', JSON.stringify(layout));
    } catch {
      /* Préférence d'affichage facultative. */
    }
  }, [layout]);
  useEffect(() => {
    // Les conversations de fournisseurs différents ne sont jamais mélangées.
    if (chats.find((c) => c.id === chatId)?.agent !== agent) {
      setChat([]);
      setChatId(null);
    }
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
    const ws = workspace.current;
    if (!el || !ws) return;
    const ro = new ResizeObserver(() => {
      setStageWidth(el.clientWidth);
      setStageHeight(el.clientHeight);
      setWorkspaceWidth(ws.clientWidth);
    });
    ro.observe(el);
    ro.observe(ws);
    setStageWidth(el.clientWidth);
    setStageHeight(el.clientHeight);
    setWorkspaceWidth(ws.clientWidth);
    return () => ro.disconnect();
  }, [ready]);

  // Aperçu en direct dans l'iframe : rien n'est écrit sur disque.
  const previewTokens = drafts.changes.length ? drafts.preview : undefined;
  useEffect(() => {
    // Une ou deux iframes (mode Comparer) : toutes reçoivent l'aperçu.
    const frames = () => [...(stage.current?.querySelectorAll('iframe') ?? [])];
    // Une iframe marquée « avant » garde les valeurs enregistrées.
    const post = () =>
      frames().forEach((f) =>
        f.contentWindow?.postMessage(
          {
            type: 'ds-preview',
            tokens:
              f.dataset.saved !== undefined ? null : (previewTokens ?? null),
          },
          location.origin,
        ),
      );
    post();
    const onReady = (e: MessageEvent) => {
      if (
        e.origin === location.origin &&
        frames().some((f) => e.source === f.contentWindow) &&
        e.data?.type === 'ds-preview-ready'
      )
        post();
    };
    addEventListener('message', onReady);
    return () => removeEventListener('message', onReady);
  }, [previewTokens]);

  // Zones cliquables mesurées dans l'écran affiché, tant que l'audit est ouvert.
  const [targets, setTargets] = useState<Check[]>([]);
  useEffect(() => {
    if (selection.kind !== 'audit') return;
    let last = '';
    const run = () => {
      const next = measureTargets(iframe.current?.contentDocument);
      const key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setTargets(next);
      }
    };
    run();
    const t = setInterval(run, 700);
    return () => clearInterval(t);
  }, [selection.kind]);

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
  // Proposition directe (ajout ou suppression d'un token) : ouvre le diff.
  async function proposeChanges(
    changes: { key: string; value: string | number | null }[],
  ) {
    if (!state) return;
    await perform(async () => {
      setProposal(
        await request<Proposal>('proposals', {
          revision: state.revision,
          changes,
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
  async function sendMessage(override?: string) {
    const text = override ?? message;
    if (!state || !text.trim() || thinking) return;
    if (override === undefined) setMessage('');
    setChatOpen(true);
    setThinking(true);
    clearError();
    // Seul le texte part au fournisseur : les compteurs restent dans l'atelier.
    const previous = chat.slice(-10).map(({ role, text }) => ({ role, text }));
    setChat([...chat, { role: 'user', text }]);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const result = await request<{
        message: string;
        proposal: Proposal | null;
        usage: ChatEntry['usage'] | null;
        limits: Limits | null;
      }>(
        'agent',
        {
          agent,
          message: text,
          revision: state.revision,
          history: previous,
          ...(agent === 'claude' ? assistant : {}),
        },
        abort.signal,
      );
      // Réponse Claude sans limites : le CLI installé ne les transmet pas.
      if (agent === 'claude' && result.usage)
        setLimitsMissing(!result.limits?.length);
      if (result.limits?.length) {
        const next = { limits: result.limits, at: Date.now() };
        setLimits(next);
        try {
          localStorage.setItem('ds-studio-limits', JSON.stringify(next));
        } catch {
          /* Affichage seulement. */
        }
      }
      setChat((c) => [
        ...c,
        {
          role: 'assistant',
          text: result.message,
          usage: result.usage ?? undefined,
          effort: agent === 'claude' ? assistant.effort : undefined,
        },
      ]);
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
  const groups = groupsFor(state.tokens);
  const errorCount = Object.keys(drafts.errors).length;
  const pendingCount = Object.keys(drafts.drafts).length;
  const selectedAgent = agents.find((a) => a.id === agent);
  const agentName = agent === 'codex' ? 'Codex' : 'Claude';
  // Le cercle montre la fenêtre la plus entamée (souvent la session de 5 h).
  const ringPct = limits
    ? Math.round(Math.max(...limits.limits.map((l) => l.utilization)) * 100)
    : undefined;
  const totalTokens = chat.reduce(
    (n, c) => n + (c.usage ? c.usage.inputTokens + c.usage.outputTokens : 0),
    0,
  );
  const staleProposal = !!proposal && proposal.revision !== state.revision;
  const isFree = device === 'free';
  const preset = devices.find((d) => d.id === device) ?? devices[1];
  const dev = isFree
    ? { title: 'Format libre', width: layout.free.w, height: layout.free.h }
    : preset;
  const kind: FrameKind =
    !isFree && layout.frame ? frameKind(dev.width) : 'none';
  const [insetX, insetY] = frameInset[kind];
  const outerW = dev.width + insetX;
  const outerH = dev.height + insetY;
  // « Fit » fait tenir tout l'appareil (largeur et hauteur) dans le panneau.
  const availableW = Math.max(0, stageWidth - 64);
  const availableH = Math.max(0, stageHeight - 64);
  const scale =
    layout.fit && availableW > 0 && availableH > 0
      ? Math.min(1, availableW / outerW, availableH / outerH)
      : 1;
  // Comparer : chaque appareil tient dans la moitié du panneau.
  const pairDevices = (beforeAfter ? [pair[0], pair[0]] : pair).map(
    (id) => devices.find((d) => d.id === id) ?? devices[1],
  );
  // Les deux appareils sont affichés à la même hauteur, côte à côte.
  const pairBoxes = pairDevices.map((d) => {
    const k: FrameKind = layout.frame ? frameKind(d.width) : 'none';
    const [ix, iy] = frameInset[k];
    return { d, k, w: d.width + ix, h: d.height + iy };
  });
  const pairRowW = Math.max(0, stageWidth - 64 - 24);
  const pairH = Math.max(
    0,
    Math.min(
      availableH - 30,
      pairRowW / pairBoxes.reduce((t, b) => t + b.w / b.h, 0),
    ),
  );
  const pairFrames = pairBoxes.map((b) => ({
    ...b,
    sc: pairH > 0 ? Math.min(1, pairH / b.h) : 1,
  }));
  function startResize(
    e: PointerEvent<HTMLSpanElement>,
    axis: 'x' | 'y' | 'xy',
  ) {
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, ...layout.free };
    document.body.classList.add('is-resizing');
    target.onpointermove = (m) => {
      const dx = axis === 'y' ? 0 : (m.clientX - start.x) / scale;
      const dy = axis === 'x' ? 0 : (m.clientY - start.y) / scale;
      setLayout((l) => ({ ...l, free: clampSize(start.w + dx, start.h + dy) }));
    };
    target.onpointerup = () => {
      target.onpointermove = null;
      document.body.classList.remove('is-resizing');
    };
  }
  const query = search.trim().toLowerCase();
  const matches = query
    ? allKeys(state.tokens).filter(
        (k) =>
          k.toLowerCase().includes(query) ||
          labelOf(k).toLowerCase().includes(query),
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
    const g = groups.find((x) => x.id === selection.id) ?? groups[0];
    title = g.label;
    description = `${g.keys.length} token${g.keys.length > 1 ? 's' : ''}. Modifiez autant de valeurs que vous voulez : l’aperçu suit, puis un seul « Enregistrer » valide tout.`;
    keys = g.keys;
  } else if (selection.kind === 'component') {
    const c = components.find((x) => x.id === selection.id) ?? components[0];
    title = c.label;
    description = c.description;
    keys = c.tokens;
    demo = c.render;
  } else if (selection.kind === 'audit') {
    title = 'Contrôle d’accessibilité';
    description =
      'Bilan de ton Design System pour chaque profil de vision. Ici on contrôle ; les corrections se font dans Couleurs ou Typographie.';
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
  // Bornes en pixels : le Design System garde 440 px et l'Aperçu 380 px.
  const W = workspaceWidth || 1200;
  const minSplit = Math.min(50, Math.max(28, Math.ceil((440 / W) * 100)));
  const maxSplit = Math.max(
    50,
    Math.min(72, Math.floor(100 - (380 / W) * 100)),
  );
  const clampSplit = (v: number) => Math.min(maxSplit, Math.max(minSplit, v));
  const split = clampSplit(layout.split);
  function onSplitterKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 10 : 2;
    let next = split;
    if (e.key === 'ArrowLeft') next -= step;
    else if (e.key === 'ArrowRight') next += step;
    else if (e.key === 'Home') next = minSplit;
    else if (e.key === 'End') next = maxSplit;
    else return;
    e.preventDefault();
    setLayout({ ...layout, split: clampSplit(next) });
  }
  function onSplitterDown(e: PointerEvent<HTMLDivElement>) {
    const box = workspace.current?.getBoundingClientRect();
    if (!box) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    document.body.classList.add('is-resizing');
    target.onpointermove = (m) => {
      const pct = ((m.clientX - box.left) / box.width) * 100;
      setLayout((l) => ({ ...l, split: clampSplit(pct) }));
    };
    target.onpointerup = () => {
      target.onpointermove = null;
      document.body.classList.remove('is-resizing');
    };
  }

  // Catégorie repliée : tout est masqué. Si elle contient la page ouverte, son
  // titre est mis en avant pour qu'on sache où l'on est.
  const show = (id: string, _active: boolean) => !collapsed.includes(id);
  const groupOf: Record<Selection['kind'], string> = {
    tokens: 'tokens',
    component: 'components',
    screen: 'screens',
    audit: 'quality',
  };
  const groupHead = (id: string, label: string, count: number) => {
    const open = !collapsed.includes(id);
    const holdsCurrent = !open && !query && groupOf[selection.kind] === id;
    return (
      <button
        className={`side-group${holdsCurrent ? ' has-current' : ''}`}
        aria-expanded={open}
        title={
          open
            ? `Replier ${label}`
            : holdsCurrent
              ? `Déplier ${label} (page ouverte ici)`
              : `Déplier ${label}`
        }
        onClick={() =>
          setCollapsed((c) => (open ? [...c, id] : c.filter((x) => x !== id)))
        }
      >
        <span>{label}</span>
        {!open && count > 1 && (
          <span className="side-group-count">{count}</span>
        )}
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    );
  };
  // Couleurs : vérification du profil choisi, ligne par ligne.
  const profileChecks = auditTokens(preview, profile);
  const profileLabel =
    profiles.find((p) => p.id === profile)?.label ?? 'Vision classique';
  // Bilan d'accessibilité en texte, pour le faire commenter par Claude.
  const auditMessage = () => {
    const lines = auditAll(preview).map((r) => {
      const issues = r.checks
        .filter((c) => c.status !== 'ok')
        .map(
          (c) =>
            `  - ${c.status === 'fail' ? 'À corriger' : 'Conseil'} · ${c.label} : ${c.value} (${c.rule})${c.fix ? ` · proposition ${c.fix.key} = ${c.fix.value}` : ''}`,
        );
      return [
        `- ${r.profile.label} : ${r.score} %, ${r.fails} à corriger`,
        ...issues,
      ].join('\n');
    });
    const zones = targets
      .filter((c) => c.status !== 'ok')
      .map((c) => `- Zones cliquables · ${c.label} : ${c.value} (${c.rule})`);
    return `Commente ce bilan d’accessibilité (WCAG 2.2) de mon Design System. Priorise ce qui bloque, explique simplement pourquoi, et propose les changements de tokens utiles (je validerai le diff).\n\n${[...lines, ...zones].join('\n')}`.slice(
      0,
      7900,
    );
  };
  const starters: { label: string; text?: string; make?: () => string }[] = [
    { label: 'Commenter l’accessibilité', make: auditMessage },
    {
      label: 'Comparer avec Figma',
      text: 'Compare mes tokens avec la dernière lecture de mes variables Figma. Liste les écarts et dis-moi lesquels garder.',
    },
    {
      label: 'Proposer des tokens manquants',
      text: 'Quels tokens manquent à mon Design System (états, alertes, espacements) ? Propose les plus utiles comme nouveaux tokens.',
    },
    {
      label: 'Rédiger la doc pour le PFE',
      text: 'Rédige une courte documentation de mon Design System pour mon dossier de PFE : rôle de chaque famille de tokens, règles d’usage et choix d’accessibilité.',
    },
  ];
  // Badge du menu : norme de base (WCAG AA) et zones cliquables mesurées.
  const auditFails = [...auditTokens(preview), ...targets].filter(
    (c) => c.status === 'fail',
  ).length;
  // Visite courte : une étape par grande zone de l'atelier.
  // Visite courte, dans l'ordre du travail : modifier, contrôler, enregistrer,
  // voir et comparer, puis demander à Claude.
  const goToAudit = () => {
    setChatOpen(false);
    setCompare(false);
    setCollapsed((c) => c.filter((x) => x !== 'quality'));
    setSearch('');
    setSelection({ kind: 'audit', id: 'a11y' });
    // Le lien du menu est tout en bas : on le fait apparaître.
    setTimeout(
      () =>
        document
          .querySelector('[data-tour="quality"]')
          ?.scrollIntoView({ block: 'nearest' }),
      0,
    );
  };
  const tourSteps: TourStep[] = [
    {
      target: '.ds-layout',
      title: 'Ton Design System',
      text: 'Choisis une catégorie dans le menu, puis modifie une couleur ou une taille : l’aperçu suit tout de suite.',
      before: () => {
        setChatOpen(false);
        setCompare(false);
        setSearch('');
        setSelection({ kind: 'tokens', id: 'colors' });
      },
    },
    {
      target: '.ds-layout',
      title: 'Contrôle l’accessibilité',
      text: 'Avant d’enregistrer, vérifie : Contrôle qualité › Accessibilité, en bas du menu, donne un score par type de vision. Les corrections se font dans Couleurs.',
      before: goToAudit,
    },
    {
      target: 'save',
      title: 'Enregistre quand tu es prêt',
      text: 'Rien n’est écrit tant que tu ne valides pas. « Enregistrer » (ou Cmd + S) ouvre le diff : tu vérifies, puis tu valides.',
      before: () => {
        setSearch('');
        setSelection({ kind: 'tokens', id: 'colors' });
      },
    },
    {
      target: 'preview',
      title: 'Vois le résultat',
      text: 'Change d’écran avec les flèches et teste les formats, du mobile 320 au grand écran 1440.',
      before: () => {
        setChatOpen(false);
        setCompare(false);
      },
    },
    {
      target: 'preview',
      title: 'Compare',
      text: '« Formats » : mobile et desktop côte à côte. « Avant / après » : tes modifs à gauche, l’écran enregistré à droite.',
      before: () => {
        setChatOpen(false);
        setCompareMode('formats');
        setCompare(true);
      },
    },
    {
      target: '#chat-panel',
      title: 'Demande à Claude',
      text: 'Décris ce que tu veux changer, Claude propose et tu valides. Choisis le modèle et surveille ton quota avec le cercle. Pour finir, en haut à droite : exporte, règle l’atelier avec la roue crantée, et relance cette visite avec « ? ».',
      before: () => {
        setCompare(false);
        setChatOpen(true);
      },
    },
  ];
  const colorKeys = groups[0].keys;
  const renderRow = (k: TokenKey) => {
    const saved = state.tokens[k].$value;
    const raw = drafts.drafts[k] ?? String(saved);
    const err = drafts.errors[k];
    const modified = k in drafts.drafts;
    const type = state.tokens[k].$type;
    const label = labelOf(k);
    const added = isCustomKey(k);
    // Points d'accessibilité dont ce token est la clé, pour le profil choisi.
    const checks = err
      ? []
      : profileChecks.filter(
          (c) => c.target === k && c.id !== 'not-color-only',
        );
    const issues = checks.filter((c) => c.status !== 'ok');
    const errId = `err-${k.replace('.', '-')}`;
    const range = sliderRange[k] ?? [0, 128];
    return (
      <li
        key={k}
        id={`row-${k.replace('.', '-')}`}
        className={`token-row${modified ? ' is-modified' : ''}${err ? ' has-error' : ''}${focusKey === k ? ' is-target' : ''}`}
      >
        <div className="token-id">
          <span className="token-name">
            {label}
            {added && <span className="added-tag">Ajouté</span>}
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
              <div className="swatch-wrap">
                <button
                  type="button"
                  className="swatch-button"
                  style={{
                    background: err ? String(saved) : String(preview[k].$value),
                  }}
                  aria-label={`Ouvrir le sélecteur de couleur : ${label}`}
                  aria-expanded={pickerFor === k}
                  onClick={() => setPickerFor(pickerFor === k ? null : k)}
                />
                {pickerFor === k && (
                  <ColorPicker
                    label={label}
                    value={err ? String(saved) : String(preview[k].$value)}
                    initial={String(saved)}
                    palette={colorKeys
                      .filter((c) => c !== k)
                      .map((c) => ({
                        label: labelOf(c),
                        value: String(preview[c].$value),
                      }))}
                    onChange={(hex) => drafts.set(k, hex)}
                    onClose={() => setPickerFor(null)}
                  />
                )}
              </div>
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
          {added && (
            <button
              type="button"
              className="row-reset row-delete"
              aria-label={`Supprimer le token : ${label}`}
              title="Supprimer ce token (diff à valider)"
              onClick={() => void proposeChanges([{ key: k, value: null }])}
            >
              ×
            </button>
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
        {checks.length > 0 && !issues.length && (
          <p className="contrast-chip ok">
            ✓ {profileLabel} : {checks.length} vérification
            {checks.length > 1 ? 's' : ''} OK
          </p>
        )}
        {issues.map((c) => (
          <div key={c.id} className={`row-fix is-${c.status}`}>
            <p>
              <strong>{c.status === 'fail' ? 'À corriger' : 'Conseil'}</strong>{' '}
              · {c.label} : {c.value}
              <span> ({c.rule})</span>
            </p>
            {c.fix && (
              <p className="row-fix-proposal">
                <span>
                  Proposition{' '}
                  {type === 'color' && (
                    <span
                      className="audit-chip"
                      style={{ background: c.fix.value }}
                      aria-hidden="true"
                    />
                  )}
                  <code>
                    {c.fix.value}
                    {type === 'dimension' ? ' px' : ''}
                  </code>
                </span>
                <button
                  className="audit-apply"
                  onClick={() => drafts.set(c.fix!.key, c.fix!.value)}
                  aria-label={`Appliquer ${c.fix.value} à ${label}`}
                >
                  Appliquer
                </button>
              </p>
            )}
          </div>
        ))}
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
          <span
            className="brand-symbol"
            aria-hidden="true"
            style={
              identity.logo !== 'image' && identity.color
                ? { background: identity.color }
                : undefined
            }
          >
            {identity.logo === 'image' && identity.image ? (
              <img src={identity.image} alt="" />
            ) : (
              logoText(identity)
            )}
          </span>
          <div>
            <strong>{identity.name}</strong>
            <ProjectMenu
              current={boot?.project}
              tokens={state?.tokens}
              locked={
                pendingCount
                  ? 'Enregistre ou annule tes modifications avant de changer de projet.'
                  : thinking
                    ? 'Attends la réponse de Claude avant de changer de projet.'
                    : null
              }
              onError={setError}
            />
          </div>
        </div>
        <div
          data-tour="save"
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
          <button
            className="brief-pill figma-pill"
            title={
              figmaState === 'ok'
                ? 'Figma connecté'
                : figmaState === 'off'
                  ? 'Figma à connecter'
                  : 'Vérification de Figma…'
            }
            data-figma={figmaState}
            onClick={() => {
              setSettingsTab('figma');
              setSettingsOpen(true);
            }}
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2H8.5a3.5 3.5 0 0 0 0 7H12z" />
              <path d="M12 9H8.5a3.5 3.5 0 0 0 0 7H12z" />
              <path d="M12 16H8.5A3.5 3.5 0 1 0 12 19.5z" />
              <path d="M12 2h3.5a3.5 3.5 0 0 1 0 7H12z" />
              <circle cx="15.5" cy="12.5" r="3.5" />
            </svg>
            <span className="figma-dot" aria-hidden="true" />
            Figma
          </button>
          <button
            className="brief-pill"
            title="Brief du projet"
            onClick={() => setBriefOpen(true)}
          >
            <svg
              aria-hidden="true"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M8 13h8" />
              <path d="M8 17h5" />
            </svg>
            Brief
          </button>
          <div
            className="icon-group"
            role="group"
            aria-label="Historique et fichiers"
          >
            <button
              className="header-icon"
              aria-label="Historique"
              title="Historique des changements"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              <svg
                aria-hidden="true"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
                <path d="M12 7v5l3 2" />
              </svg>
            </button>
            <label
              className="header-icon file-icon"
              title="Importer un JSON de tokens"
            >
              <svg
                aria-hidden="true"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M17 8l-5-5-5 5" />
                <path d="M12 3v12" />
              </svg>
              <span className="sr-only">Importer un JSON</span>
              <input
                type="file"
                aria-label="Importer un JSON"
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
            <div className="export-wrap" data-tour="export">
              <button
                className="header-icon"
                aria-label="Exporter"
                title="Exporter"
                aria-haspopup="menu"
                aria-expanded={exportOpen}
                onClick={() => setExportOpen(!exportOpen)}
              >
                <svg
                  aria-hidden="true"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M7 10l5 5 5-5" />
                  <path d="M12 15V3" />
                </svg>
              </button>
              {exportOpen && (
                <div className="export-menu" role="menu" aria-label="Exporter">
                  {pendingCount > 0 && (
                    <p className="export-note">
                      Valeurs enregistrées seulement : tes modifications en
                      cours ne sont pas incluses.
                    </p>
                  )}
                  {exportsList.map((x) => (
                    <button
                      key={x.id}
                      role="menuitem"
                      onClick={() => {
                        setExportOpen(false);
                        void perform(async () => {
                          if (x.id === 'json') return exportTokens();
                          const text =
                            x.id === 'doc'
                              ? await makeDoc(state.tokens)
                              : x.make(state.tokens);
                          downloadText(x.file, text, x.type);
                          setNotice(`${x.file} téléchargé.`);
                        });
                      }}
                    >
                      <strong>{x.label}</strong>
                      <span>{x.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="header-icon"
              aria-label="Paramètres"
              title="Paramètres de l’atelier"
              aria-haspopup="dialog"
              onClick={() => {
                setSettingsTab('look');
                setSettingsOpen(true);
              }}
            >
              <svg
                aria-hidden="true"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </button>
            <button
              className="header-icon"
              aria-label="Visite guidée"
              title="Visite guidée de l’atelier"
              data-tour="help"
              onClick={() => {
                tourPrev.current = { compare, chatOpen, selection };
                setTourOpen(true);
              }}
            >
              <svg
                aria-hidden="true"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.2-2.4 3.8" />
                <path d="M12 17h.01" />
              </svg>
            </button>
          </div>
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
        {welcome && (
          <div className="project-welcome" role="status">
            <div>
              <strong>Projet « {welcome} » créé.</strong>
              <span>
                Tes autres projets restent dans le menu sous DS-Studio. Pour
                démarrer :
              </span>
            </div>
            <div className="project-welcome-actions">
              <button
                onClick={() => {
                  setWelcome(null);
                  setSelection({ kind: 'tokens', id: 'colors' });
                  setTimeout(() => {
                    const input = document.querySelector<HTMLInputElement>(
                      'input[aria-label="Couleur de marque"]',
                    );
                    input?.scrollIntoView({ block: 'center' });
                    input?.focus();
                  }, 50);
                }}
              >
                Choisir la couleur de marque
              </button>
              <button
                onClick={() => {
                  setWelcome(null);
                  setBriefOpen(true);
                }}
              >
                Remplir le brief
              </button>
              <button
                onClick={() => {
                  setWelcome(null);
                  setSettingsTab('figma');
                  setSettingsOpen(true);
                }}
              >
                Lier un fichier Figma
              </button>
            </div>
            <button
              className="feedback-close"
              aria-label="Fermer le message"
              onClick={() => setWelcome(null)}
            >
              ×
            </button>
          </div>
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
        style={{ '--split': `${split}%` } as CSSProperties}
      >
        <section className="pane ds-pane" aria-labelledby="ds-title">
          <div className="pane-head">
            <h2 id="ds-title" tabIndex={-1}>
              Design System
            </h2>
          </div>
          <div className="ds-layout">
            <nav
              className="ds-sidebar"
              aria-label="Contenu du Design System"
              data-tour="menu"
            >
              <input
                type="search"
                className="sidebar-search"
                aria-label="Rechercher un token"
                placeholder="Rechercher"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {/* Panneau étroit : le menu devient une liste déroulante. */}
              <select
                className="ds-nav-select"
                aria-label="Section du Design System"
                value={`${selection.kind}:${selection.id}`}
                onChange={(e) => {
                  const [kind, id] = e.target.value.split(':');
                  select({ kind, id } as Selection);
                }}
              >
                <optgroup label="Tokens">
                  {groups.map((g) => (
                    <option key={g.id} value={`tokens:${g.id}`}>
                      {g.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Composants">
                  {components.map((c) => (
                    <option key={c.id} value={`component:${c.id}`}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Écrans">
                  {screens.map((sc) => (
                    <option key={sc.id} value={`screen:${sc.id}`}>
                      {sc.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Contrôle qualité">
                  <option value="audit:a11y">Test d’accessibilité</option>
                </optgroup>
              </select>
              {groupHead('tokens', 'Tokens', groups.length)}
              {groups
                .filter((g) =>
                  show(
                    'tokens',
                    selection.kind === 'tokens' && selection.id === g.id,
                  ),
                )
                .map((g) => {
                  const changed = g.keys.filter(
                    (k) => k in drafts.drafts,
                  ).length;
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
              {groupHead('components', 'Composants', components.length)}
              {components
                .filter((c) =>
                  show(
                    'components',
                    selection.kind === 'component' && selection.id === c.id,
                  ),
                )
                .map((c) => (
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
              {groupHead('screens', 'Écrans', screens.length)}
              {screens
                .filter((s) =>
                  show(
                    'screens',
                    selection.kind === 'screen' && selection.id === s.id,
                  ),
                )
                .map((s) => (
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
              {groupHead('quality', 'Contrôle qualité', 1)}
              {show('quality', selection.kind === 'audit') && (
                <button
                  className="side-item"
                  aria-current={
                    !query && selection.kind === 'audit' ? 'page' : undefined
                  }
                  data-tour="quality"
                  onClick={() => select({ kind: 'audit', id: 'a11y' })}
                >
                  Accessibilité
                  <span
                    className={`side-count${auditFails ? ' is-alert' : ''}`}
                  >
                    {auditFails ? (
                      <>
                        {auditFails}
                        <span className="sr-only"> à corriger</span>
                      </>
                    ) : (
                      'OK'
                    )}
                  </span>
                </button>
              )}
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
              {selection.kind === 'audit' && !query ? (
                <AuditView
                  onAsk={
                    agents.some((a) => a.id === agent && a.available)
                      ? () => void sendMessage(auditMessage())
                      : undefined
                  }
                  report={auditAll(preview)}
                  targets={targets}
                  onGo={(p, k) => {
                    if (isColorProfile(p) || groups[0].keys.includes(k))
                      setProfile(p);
                    const g = groups.find((x) => x.keys.includes(k));
                    if (g) select({ kind: 'tokens', id: g.id });
                    setFocusKey(k);
                  }}
                />
              ) : selection.kind !== 'tokens' && !query ? (
                <p className="rows-title">Tokens utilisés</p>
              ) : null}
              {!query &&
                selection.kind === 'tokens' &&
                selection.id === 'colors' && (
                  <div className="profile-bar">
                    <label htmlFor="profile-select">Type de vision</label>
                    <select
                      id="profile-select"
                      value={profile}
                      onChange={(e) => setProfile(e.target.value as Profile)}
                    >
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <p>
                      {profiles.find((p) => p.id === profile)?.hint}{' '}
                      {profileChecks.some((c) => c.status === 'fail')
                        ? `${profileChecks.filter((c) => c.status === 'fail').length} point(s) à corriger ci-dessous.`
                        : 'Tout est OK pour ce profil.'}
                    </p>
                  </div>
                )}
              {selection.kind === 'audit' && !query ? null : keys.length ? (
                <>
                  <ul className="token-rows" data-tour="tokens">
                    {keys.map(renderRow)}
                  </ul>
                  {selection.kind === 'tokens' && !query && (
                    <AddToken
                      key={selection.id}
                      prefixes={prefixOfGroup[selection.id] ?? ['color']}
                      tokens={state.tokens}
                      onPropose={(key, value) =>
                        proposeChanges([{ key, value }])
                      }
                    />
                  )}
                </>
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
          aria-valuemin={minSplit}
          aria-valuemax={maxSplit}
          aria-valuenow={Math.round(split)}
          onKeyDown={onSplitterKey}
          onPointerDown={onSplitterDown}
          onDoubleClick={() => setLayout({ ...layout, split: 50 })}
          title="Glisser pour redimensionner · double-clic pour centrer"
        >
          <span />
        </div>

        <section
          className="pane preview-pane"
          aria-labelledby="preview-title"
          data-tour="preview"
        >
          <div className="pane-head preview-head">
            <div className="preview-row">
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
              <div className="preview-tools">
                <div
                  className={`segmented${compare ? ' is-disabled' : ''}`}
                  role="group"
                  aria-label="Zoom"
                  title={
                    compare
                      ? 'Comparer ajuste toujours les deux aperçus'
                      : undefined
                  }
                >
                  <button
                    aria-pressed={layout.fit}
                    title="Fit : l’aperçu tient entièrement dans le panneau"
                    onClick={() => setLayout({ ...layout, fit: true })}
                  >
                    Fit
                  </button>
                  <button
                    aria-pressed={!layout.fit}
                    title="100 % : taille réelle, défilement si besoin"
                    onClick={() => setLayout({ ...layout, fit: false })}
                  >
                    100 %
                  </button>
                </div>
                <label
                  className={`toggle${isFree && !compare ? ' is-disabled' : ''}`}
                  title={
                    isFree
                      ? 'Mockup disponible pour les formats prédéfinis'
                      : `Mockup ${frameLabel[frameKind(dev.width)]}`
                  }
                >
                  <input
                    type="checkbox"
                    checked={(compare || !isFree) && layout.frame}
                    disabled={isFree && !compare}
                    onChange={(e) =>
                      setLayout({ ...layout, frame: e.target.checked })
                    }
                  />
                  Mockup
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
            {compare ? (
              <div className="preview-row compare-row">
                <div
                  className="segmented compare-mode"
                  role="group"
                  aria-label="Type de comparaison"
                >
                  <button
                    aria-pressed={compareMode === 'formats'}
                    title="Deux formats côte à côte"
                    onClick={() => setCompareMode('formats')}
                  >
                    Formats
                  </button>
                  <button
                    aria-pressed={compareMode === 'before'}
                    title="Modifications en cours à gauche, valeurs enregistrées à droite"
                    onClick={() => setCompareMode('before')}
                  >
                    Avant / après
                  </button>
                </div>
                {(compareMode === 'before'
                  ? (['affiché'] as const)
                  : (['gauche', 'droite'] as const)
                ).map((side, i) => (
                  <Fragment key={side}>
                    {i === 1 && (
                      <span className="compare-and" aria-hidden="true">
                        et
                      </span>
                    )}
                    <select
                      className="compare-select"
                      aria-label={`Format ${side}`}
                      value={pair[i]}
                      onChange={(e) =>
                        setPair(
                          i === 0
                            ? [e.target.value, pair[1]]
                            : [pair[0], e.target.value],
                        )
                      }
                    >
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title} · {d.width}
                        </option>
                      ))}
                    </select>
                  </Fragment>
                ))}
                <button
                  className="compare-toggle"
                  data-tour="compare"
                  aria-label="Comparer"
                  aria-pressed={compare}
                  title="Afficher deux formats côte à côte"
                  onClick={() => {
                    // Comparer s'ouvre toujours sur les deux formats.
                    if (!compare) setCompareMode('formats');
                    setCompare(!compare);
                    setFreeOpen(false);
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="8" height="16" rx="2" />
                    <rect x="13" y="6" width="9" height="12" rx="1.5" />
                  </svg>
                  <span className="compare-label">Comparer</span>
                </button>
              </div>
            ) : (
              <div className="preview-row" data-tour="formats">
                <span className="row-label" aria-hidden="true">
                  Format
                </span>
                <div
                  className="segmented"
                  role="group"
                  aria-label="Format d’écran"
                >
                  {devices.map((d) => (
                    <button
                      key={d.id}
                      aria-pressed={device === d.id}
                      title={`${d.title} · ${d.width} × ${d.height} px`}
                      aria-label={`${d.title} ${d.width} px`}
                      onClick={() => {
                        setDevice(d.id);
                        setFreeOpen(false);
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                  <button
                    aria-pressed={isFree}
                    aria-expanded={freeOpen}
                    aria-label={`Format libre ${layout.free.w} × ${layout.free.h} px`}
                    onClick={() => {
                      setDevice('free');
                      setFreeOpen(!isFree || !freeOpen);
                    }}
                  >
                    {isFree ? `${layout.free.w} × ${layout.free.h}` : 'Libre'}
                  </button>
                </div>
                {freeOpen && isFree && (
                  <div
                    className="free-pop"
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node))
                        setFreeOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' || e.key === 'Enter')
                        setFreeOpen(false);
                    }}
                  >
                    <input
                      type="number"
                      aria-label="Largeur en px"
                      min={240}
                      max={1920}
                      defaultValue={layout.free.w}
                      key={`w${layout.free.w}`}
                      autoFocus
                      onBlur={(e) =>
                        setLayout({
                          ...layout,
                          free: clampSize(
                            Number(e.target.value),
                            layout.free.h,
                          ),
                        })
                      }
                    />
                    <span>×</span>
                    <input
                      type="number"
                      aria-label="Hauteur en px"
                      min={320}
                      max={1600}
                      defaultValue={layout.free.h}
                      key={`h${layout.free.h}`}
                      onBlur={(e) =>
                        setLayout({
                          ...layout,
                          free: clampSize(
                            layout.free.w,
                            Number(e.target.value),
                          ),
                        })
                      }
                    />
                    <span className="free-hint">px · ou étirez l’aperçu</span>
                  </div>
                )}
                <button
                  className="compare-toggle"
                  data-tour="compare"
                  aria-label="Comparer"
                  aria-pressed={compare}
                  title="Afficher deux formats côte à côte"
                  onClick={() => {
                    // Comparer s'ouvre toujours sur les deux formats.
                    if (!compare) setCompareMode('formats');
                    setCompare(!compare);
                    setFreeOpen(false);
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="8" height="16" rx="2" />
                    <rect x="13" y="6" width="9" height="12" rx="1.5" />
                  </svg>
                  <span className="compare-label">Comparer</span>
                </button>
              </div>
            )}
          </div>
          <div className="stage" ref={stage}>
            {vision !== 'none' && (
              <div className="vision-sticky">
                <span className="vision-chip" role="status">
                  Vue : {visions.find((v) => v.id === vision)?.label}
                  <button
                    aria-label="Revenir à la vision normale"
                    onClick={() => setProfile('aa')}
                  >
                    <svg
                      aria-hidden="true"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              </div>
            )}
            <VisionFilters />
            {compare ? (
              <div className="compare-stage">
                {pairFrames.map(({ d, k, w, h, sc }, i) => (
                  <figure key={`${compareMode}-${i}`} className="compare-cell">
                    <div
                      className="frame-holder"
                      style={{ width: w * sc, height: h * sc }}
                    >
                      <div
                        className={`device device-${k}`}
                        style={{
                          width: w,
                          height: h,
                          transform: `scale(${sc})`,
                        }}
                      >
                        {k === 'browser' && (
                          <div className="browser-bar" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                            <span>gutt.app</span>
                          </div>
                        )}
                        {k === 'phone' && (
                          <span className="device-island" aria-hidden="true" />
                        )}
                        <iframe
                          ref={i === 0 ? iframe : undefined}
                          data-saved={beforeAfter && i === 1 ? '' : undefined}
                          style={{ filter: visionFilter(vision) }}
                          title={
                            beforeAfter
                              ? i === 0
                                ? 'Aperçu après'
                                : 'Aperçu avant'
                              : `Aperçu ${d.title} ${d.width} px`
                          }
                          src={`/?preview=1&scenario=${scenario}`}
                          width={d.width}
                          height={d.height}
                        />
                      </div>
                    </div>
                    <figcaption>
                      {beforeAfter ? (
                        i === 1 ? (
                          <>
                            <strong>Avant</strong> · enregistré
                          </>
                        ) : (
                          <>
                            <strong>Après</strong> ·{' '}
                            {previewTokens
                              ? `${pendingCount} modif${pendingCount > 1 ? 's' : ''} en cours`
                              : 'aucune modif en cours'}
                          </>
                        )
                      ) : (
                        <>
                          {d.title} · {d.width} px · {Math.round(sc * 100)} %
                        </>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div
                className="frame-holder"
                style={{ width: outerW * scale, height: outerH * scale }}
              >
                <div
                  className={`device device-${kind}`}
                  style={{
                    width: outerW,
                    height: outerH,
                    transform: `scale(${scale})`,
                  }}
                >
                  {kind === 'browser' && (
                    <div className="browser-bar" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <span>gutt.app</span>
                    </div>
                  )}
                  {kind === 'phone' && (
                    <span className="device-island" aria-hidden="true" />
                  )}
                  <iframe
                    ref={iframe}
                    style={{ filter: visionFilter(vision) }}
                    title="Aperçu responsive"
                    src={`/?preview=1&scenario=${scenario}`}
                    width={dev.width}
                    height={dev.height}
                  />
                </div>
                {isFree && (
                  <>
                    <span
                      className="resize-handle handle-x"
                      aria-hidden="true"
                      onPointerDown={(e) => startResize(e, 'x')}
                    />
                    <span
                      className="resize-handle handle-y"
                      aria-hidden="true"
                      onPointerDown={(e) => startResize(e, 'y')}
                    />
                    <span
                      className="resize-handle handle-xy"
                      aria-hidden="true"
                      onPointerDown={(e) => startResize(e, 'xy')}
                    />
                  </>
                )}
              </div>
            )}
          </div>
          <div className="pane-foot">
            {beforeAfter ? (
              <>
                Avant / après · {pairDevices[0].title} {pairDevices[0].width} px
                · à gauche tes modifications en cours, à droite les valeurs
                enregistrées
              </>
            ) : compare ? (
              <>
                Comparaison · {pairDevices[0].title} {pairDevices[0].width} px
                et {pairDevices[1].title} {pairDevices[1].width} px · même
                écran, mêmes modifications
              </>
            ) : (
              <>
                {dev.title} · {dev.width} × {dev.height} px CSS
                {kind !== 'none' ? ` · mockup ${frameLabel[kind]}` : ''} ·{' '}
                {scale < 1
                  ? `affiché à ${Math.round(scale * 100)} %`
                  : 'taille réelle'}
                {previewTokens
                  ? ' · aperçu des modifications non enregistrées'
                  : ''}
              </>
            )}
          </div>
        </section>
      </main>

      {settingsOpen && (
        <Settings
          onClose={() => setSettingsOpen(false)}
          initialTab={settingsTab}
          figmaPanel={
            <FigmaPanel
              revision={state.revision}
              onConnect={() =>
                request<{ opened: boolean; command: string }>('agent-login', {
                  agent: 'figma',
                })
              }
              onProposal={(p) => {
                setSettingsOpen(false);
                setProposal(p);
              }}
            />
          }
          agents={agents}
          onRefreshAgents={() =>
            request<Bootstrap['agents']>('agents')
              .then(setAgents)
              .catch((e) => setError(e.message))
          }
          onConnect={(id) =>
            request<{ opened: boolean; command: string }>('agent-login', {
              agent: id,
            })
          }
          agent={agent}
          onAgent={setAgent}
          models={models}
          efforts={efforts}
          assistant={assistant}
          onAssistant={(a) => setAssistant(a as AssistantPrefs)}
          theme={theme}
          onTheme={setTheme}
          identity={identity}
          onIdentity={setIdentity}
          project={boot?.project}
          onClearChats={() => {
            setChats(writeChats([]));
            newChat();
          }}
          locked={
            pendingCount
              ? 'Enregistre ou annule tes modifications avant de changer de projet.'
              : thinking
                ? 'Attends la réponse de Claude.'
                : null
          }
          devices={devices}
          profiles={profiles}
          prefs={prefs}
          onPrefs={(p) => {
            setPrefs(p);
            if (p.device !== prefs.device) setDevice(p.device);
            if (p.profile !== prefs.profile) setProfile(p.profile as Profile);
          }}
          onTour={() => {
            setSettingsOpen(false);
            tourPrev.current = { compare, chatOpen, selection };
            setTourOpen(true);
          }}
          onReset={() => {
            try {
              for (const k of [
                'ds-studio-theme',
                identityKey,
                'ds-studio-assistant',
                'ds-studio-agent',
                prefsKey,
                'ds-studio-layout',
                'ds-studio-nav-collapsed',
                'ds-studio-color-mode',
                tourKey,
              ])
                localStorage.removeItem(k);
            } catch {
              /* rien à effacer */
            }
            // Recharge : les modifications en cours restent (onglet).
            location.reload();
          }}
        />
      )}
      {tourOpen && (
        <Tour
          steps={tourSteps}
          onClose={() => {
            setTourOpen(false);
            setCompare(tourPrev.current.compare);
            setChatOpen(tourPrev.current.chatOpen);
            if (tourPrev.current.selection)
              setSelection(tourPrev.current.selection);
          }}
        />
      )}
      <button
        className={`chat-bubble${chatOpen ? ' is-open' : ''}`}
        data-tour="chat"
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
          {agent === 'claude' && (
            <div className="credit-wrap" data-tour="chat-quota">
              <button
                className="credit-ring"
                aria-expanded={creditsOpen}
                aria-controls="credits-pop"
                aria-label={
                  limits
                    ? `Crédits : ${limits.limits
                        .map(
                          (l) =>
                            `${limitLabels[l.id]} ${Math.round(l.utilization * 100)} %`,
                        )
                        .join(', ')}`
                    : 'Crédits : pas encore connus'
                }
                title="Crédits de l’abonnement"
                onClick={() => setCreditsOpen(!creditsOpen)}
              >
                <svg viewBox="0 0 36 36" aria-hidden="true">
                  <circle cx="18" cy="18" r="15" className="ring-track" />
                  {ringPct !== undefined && (
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      className={`ring-value${ringPct >= 90 ? ' is-high' : ringPct >= 70 ? ' is-mid' : ''}`}
                      strokeDasharray={`${(ringPct / 100) * 94.25} 94.25`}
                    />
                  )}
                </svg>
                <span>{ringPct !== undefined ? ringPct : '–'}</span>
              </button>
              {creditsOpen && (
                <div
                  className="limits"
                  id="credits-pop"
                  role="dialog"
                  aria-label="Crédits de l’abonnement Claude"
                >
                  {limits ? (
                    <>
                      {limits.limits.map((l) => {
                        const pct = Math.round(l.utilization * 100);
                        return (
                          <div className="limit" key={l.id}>
                            <div className="limit-top">
                              <span>{limitLabels[l.id]}</span>
                              <strong>{pct} %</strong>
                            </div>
                            <div
                              className="limit-bar"
                              role="progressbar"
                              aria-label={`${limitLabels[l.id]} : crédits utilisés`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={pct}
                            >
                              <span
                                className={
                                  pct >= 90
                                    ? 'is-high'
                                    : pct >= 70
                                      ? 'is-mid'
                                      : ''
                                }
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="limit-reset">
                              {resetLabel(l.id, l.resetsAt)}
                            </span>
                          </div>
                        );
                      })}
                      <p className="limit-note">
                        Mis à jour à{' '}
                        {new Date(limits.at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        , après la dernière réponse.
                      </p>
                    </>
                  ) : (
                    <p className="limit-note">
                      {limitsMissing
                        ? 'Ton CLI Claude ne transmet pas cette information. Mets-le à jour avec « claude update » dans un terminal, puis redémarre DS-Studio.'
                        : 'Tes crédits s’affichent après la première réponse.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
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
        {agent === 'claude' && (
          <div className="chat-options" data-tour="chat-models">
            <label>
              Modèle
              <select
                value={assistant.model}
                onChange={(e) =>
                  setAssistant({
                    ...assistant,
                    model: e.target.value as AssistantPrefs['model'],
                  })
                }
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Effort
              <select
                value={assistant.effort}
                onChange={(e) =>
                  setAssistant({
                    ...assistant,
                    effort: e.target.value as AssistantPrefs['effort'],
                  })
                }
              >
                {efforts.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="chat-total">
              {totalTokens
                ? `Conversation : ${fmt(totalTokens)} tokens`
                : models.find((m) => m.id === assistant.model)?.hint}
            </p>
          </div>
        )}
        <p className="chat-status">
          {selectedAgent?.detail ?? 'Détection de l’assistant…'}
        </p>
        <div className="chat-bar">
          <button
            className="chat-bar-btn"
            onClick={newChat}
            disabled={thinking || (!chat.length && !chatListOpen)}
          >
            <span aria-hidden="true">+</span> Nouvelle conversation
          </button>
          <button
            className="chat-bar-btn"
            aria-expanded={chatListOpen}
            aria-controls="chat-list"
            onClick={() => setChatListOpen(!chatListOpen)}
            disabled={thinking}
          >
            Conversations
            {chats.length > 0 && (
              <span className="chat-bar-count">{chats.length}</span>
            )}
          </button>
        </div>
        {chatListOpen && (
          <div className="chat-list" id="chat-list">
            <p className="chat-list-note">
              Gardées dans ce navigateur. Rouvrir une conversation ne consomme
              aucun token.
            </p>
            {chats.length ? (
              <ul>
                {chats.map((c) => (
                  <li
                    key={c.id}
                    className={c.id === chatId ? 'is-current' : undefined}
                  >
                    <button
                      className="chat-list-open"
                      onClick={() => {
                        setAgent(c.agent);
                        setChat(c.entries);
                        setChatId(c.id);
                        setChatListOpen(false);
                      }}
                    >
                      <strong>{c.title}</strong>
                      <span>
                        {new Date(c.updated).toLocaleString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {c.entries.length} message
                        {c.entries.length > 1 ? 's' : ''}
                      </span>
                    </button>
                    <button
                      className="chat-list-delete"
                      aria-label={`Supprimer la conversation : ${c.title}`}
                      onClick={() => {
                        setChats(
                          writeChats(chats.filter((x) => x.id !== c.id)),
                        );
                        if (c.id === chatId) newChat();
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="chat-list-note">
                Aucune conversation pour l’instant.
              </p>
            )}
          </div>
        )}
        <div className="chat-log" aria-label="Conversation" aria-live="polite">
          {!chat.length && (
            <div className="chat-empty">
              <p>
                Demande un changement de tokens (même un nouveau token), une
                explication, une relecture ou un texte pour ton PFE. Chaque
                changement proposé passe par le diff, tu valides.
              </p>
              <div className="chat-starters">
                {starters.map((st) => (
                  <button
                    key={st.label}
                    type="button"
                    disabled={thinking}
                    onClick={() =>
                      void sendMessage(st.make ? st.make() : st.text)
                    }
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {chat.map((c, i) => (
            <article className={`chat-message ${c.role}`} key={i}>
              <strong>{c.role === 'user' ? 'Vous' : agentName}</strong>
              {c.role === 'assistant' ? (
                <>
                  <RichText text={c.text} />
                  {c.text.length > 280 && (
                    <button
                      type="button"
                      className="chat-copy"
                      onClick={() =>
                        navigator.clipboard
                          ?.writeText(c.text)
                          .catch(() => undefined)
                      }
                    >
                      Copier
                    </button>
                  )}
                </>
              ) : (
                <p>
                  {c.text.length > 600 ? c.text.slice(0, 600) + '…' : c.text}
                </p>
              )}
              {c.usage && (
                <span className="chat-usage">
                  {modelName(c.usage.model)}
                  {c.effort
                    ? ` · effort ${efforts.find((x) => x.id === c.effort)?.label.toLowerCase()}`
                    : ''}{' '}
                  · {fmt(c.usage.inputTokens)} tokens envoyés ·{' '}
                  {fmt(c.usage.outputTokens)} générés
                </span>
              )}
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
          Envoyé : tokens, PFE.md, brief, règles, dernière lecture Figma et 10
          derniers messages. Aucun outil, propositions seulement.
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
              <h2 id="brief-title">Brief du projet</h2>
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
                        {labelOf(p.key)}
                        <code>{p.key}</code>
                      </span>
                      <span className="patch-values">
                        <PatchValue value={p.before} kind="del" />
                        <span aria-hidden="true">→</span>
                        <PatchValue value={p.after} kind="ins" />
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
                      {labelOf(p.key)}
                      <code>{p.key}</code>
                    </span>
                  </th>
                  <td>
                    <span className="patch-values">
                      <PatchValue value={p.before} kind="del" />
                    </span>
                  </td>
                  <td>
                    <span className="patch-values">
                      <PatchValue value={p.after} kind="ins" />
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

function AuditView({
  report,
  targets,
  onGo,
  onAsk,
}: {
  onAsk?: () => void;
  report: ReturnType<typeof auditAll>;
  targets: Check[];
  onGo: (profile: Profile, key: TokenKey) => void;
}) {
  const where = (k: TokenKey) =>
    tokenGroups.find((g) => g.keys.includes(k))?.label ?? 'Couleurs';
  return (
    <div className="audit">
      {onAsk && (
        <button type="button" className="audit-ask" onClick={onAsk}>
          Faire commenter ce bilan par Claude
        </button>
      )}
      <ul className="report-cards" aria-label="Score par profil">
        {report.map((r) => (
          <li key={r.profile.id}>
            <a
              href={`#profil-${r.profile.id}`}
              className={`report-card ${r.fails ? 'is-fail' : 'is-ok'}`}
            >
              <span>{r.profile.label}</span>
              <strong>{r.score} %</strong>
              <small>
                {r.fails ? `${r.fails} à corriger` : 'Rien à corriger'}
              </small>
            </a>
          </li>
        ))}
      </ul>
      {report.map((r) => {
        const issues = r.checks
          .filter((c) => c.status !== 'ok')
          .sort(
            (a, b) =>
              (a.status === 'fail' ? -1 : 1) - (b.status === 'fail' ? -1 : 1),
          );
        return (
          <section
            key={r.profile.id}
            id={`profil-${r.profile.id}`}
            className="audit-group"
            aria-label={r.profile.label}
          >
            <p className="rows-title">
              {r.profile.label} · {r.score} %
            </p>
            {issues.length ? (
              <ul className="audit-list">
                {issues.map((c) => (
                  <li key={c.id} className={`audit-row is-${c.status}`}>
                    {c.seen ? (
                      <span className="audit-pair" aria-hidden="true">
                        <span style={{ background: c.seen[0] }} />
                        <span style={{ background: c.seen[1] }} />
                      </span>
                    ) : (
                      <span />
                    )}
                    <div className="audit-text">
                      <strong>{c.label}</strong>
                      <span>
                        {c.value} · {c.rule}
                      </span>
                    </div>
                    <span className={`audit-status is-${c.status}`}>
                      {c.status === 'fail' ? 'À corriger' : 'Conseil'}
                    </span>
                    {c.target && c.id !== 'not-color-only' ? (
                      <button
                        className="audit-edit"
                        onClick={() => onGo(r.profile.id, c.target!)}
                      >
                        Corriger dans {where(c.target)}
                      </button>
                    ) : (
                      <span />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="report-ok">✓ Rien à corriger pour ce profil.</p>
            )}
          </section>
        );
      })}
      <section className="audit-group" aria-label="Zones cliquables">
        <p className="rows-title">Zones cliquables · écran affiché</p>
        {targets.length ? (
          <ul className="audit-list">
            {targets.map((c) => (
              <li key={c.id} className={`audit-row is-${c.status}`}>
                <span />
                <div className="audit-text">
                  <strong>{c.label}</strong>
                  <span>
                    {c.value} · {c.rule}
                  </span>
                </div>
                <span className={`audit-status is-${c.status}`}>
                  {c.status === 'ok'
                    ? 'OK'
                    : c.status === 'fail'
                      ? 'À corriger'
                      : 'Conseil'}
                </span>
                <span />
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">
            Mesure en cours sur l’écran affiché dans l’aperçu.
          </p>
        )}
      </section>
    </div>
  );
}
