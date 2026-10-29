import { useEffect, useRef, useState, type ReactNode } from 'react';
import ColorPicker from './ColorPicker.js';
import {
  accents,
  backgrounds,
  defaultTheme,
  modes,
  themeWarnings,
  uiFonts,
  type Theme,
} from './theme.js';
import {
  defaultIdentity,
  logoText,
  maxLogoBytes,
  type Identity,
} from './identity.js';
import ProjectsPane from './ProjectsPane.js';
import { version } from '../../package.json';

// Paramètres de l'atelier : préférences locales, appliquées tout de suite.
// Rien ici ne touche au Design System ni aux fichiers du projet.

type Agent = { id: string; available: boolean; detail: string };
type Option = { id: string; label: string };
export type Prefs = { device: string; profile: string };

const tabs = [
  { id: 'look', label: 'Apparence' },
  { id: 'ai', label: 'Assistants IA' },
  { id: 'figma', label: 'Figma' },
  { id: 'projects', label: 'Projets' },
  { id: 'general', label: 'Général' },
] as const;
// Couleurs proposées pour le carré du logo (vide = accent de l'atelier).
const logoColors = [
  { label: 'Encre', value: '#2C2650' },
  { label: 'Océan', value: '#2F5BD8' },
  { label: 'Forêt', value: '#1A7F57' },
  { label: 'Lilas', value: '#6A48E8' },
  { label: 'Brique', value: '#D2401E' },
];
export type Tab = (typeof tabs)[number]['id'];

const agentInfo: Record<string, { name: string; how: string }> = {
  claude: {
    name: 'Claude',
    how: 'Compte Claude (abonnement). Connexion dans le Terminal avec « claude », puis relance de l’atelier.',
  },
  codex: {
    name: 'Codex (ChatGPT)',
    how: 'Prévu : compte ChatGPT. Bientôt dans l’atelier.',
  },
  gemini: {
    name: 'Gemini',
    how: 'Prévu : compte Google. Bientôt dans l’atelier.',
  },
};

export default function Settings({
  onClose,
  agents,
  onRefreshAgents,
  onConnect,
  agent,
  onAgent,
  models,
  efforts,
  assistant,
  onAssistant,
  theme,
  onTheme,
  devices,
  profiles,
  prefs,
  onPrefs,
  onTour,
  onReset,
  figmaPanel,
  identity,
  onIdentity,
  project,
  onClearChats,
  locked,
  initialTab = 'look',
}: {
  onClose: () => void;
  agents: Agent[];
  onRefreshAgents: () => void;
  onConnect: (id: 'claude') => Promise<{
    opened: boolean;
    command: string;
  }>;
  agent: string;
  onAgent: (id: string) => void;
  models: readonly (Option & { hint: string })[];
  efforts: readonly Option[];
  assistant: { model: string; effort: string };
  onAssistant: (a: { model: string; effort: string }) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  devices: readonly { id: string; title: string; width: number }[];
  profiles: readonly Option[];
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  onTour: () => void;
  onReset: () => void;
  figmaPanel: ReactNode;
  identity: Identity;
  onIdentity: (i: Identity) => void;
  project: string | undefined;
  onClearChats: () => void;
  locked: string | null;
  initialTab?: Tab;
}) {
  const [confirmChats, setConfirmChats] = useState(false);
  const [chatsCleared, setChatsCleared] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [tab, setTab] = useState<Tab>(initialTab);
  const [confirmReset, setConfirmReset] = useState(false);
  // Couleur « Au choix » : même sélecteur que dans Couleurs.
  const [picker, setPicker] = useState<'bg' | 'accent' | 'logo' | null>(null);
  const [fontQuery, setFontQuery] = useState('');
  // Retour de « Connecter » : Terminal ouvert, ou commande à taper.
  const [login, setLogin] = useState<
    Record<string, { opened: boolean; command: string } | 'busy' | string>
  >({});
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  }, []);

  const warnings = themeWarnings(theme);
  const q = fontQuery.trim().toLowerCase();
  const fonts = uiFonts.filter(
    (f) =>
      !q ||
      f.label.toLowerCase().includes(q) ||
      f.kind.toLowerCase().includes(q),
  );
  // Pastille « Au choix » : ouvre le sélecteur de couleur de l'atelier.
  const customSwatch = (
    key: 'bg' | 'accent' | 'logo',
    label: string,
    presets: readonly { label: string; value: string }[],
  ) => {
    // Logo : vide = accent de l'atelier (pas une couleur au choix).
    const raw = key === 'logo' ? identity.color : theme[key];
    const value = raw.toUpperCase();
    const isCustom = !!value && !presets.some((p) => p.value === value);
    return (
      <div className="swatch-wrap custom-wrap">
        <button
          className="swatch-pick custom"
          aria-pressed={isCustom}
          aria-expanded={picker === key}
          aria-label={`${label} au choix`}
          onClick={() => setPicker(picker === key ? null : key)}
        >
          <span
            className={isCustom ? '' : 'rainbow'}
            style={isCustom ? { background: value } : undefined}
          />
          {isCustom ? value : 'Au choix'}
        </button>
        {picker === key && (
          <ColorPicker
            label={label}
            value={value || '#2C2650'}
            initial={value || '#2C2650'}
            palette={presets.map((p) => ({ label: p.label, value: p.value }))}
            paletteLabel="Couleurs proposées"
            onChange={(hex) =>
              key === 'logo'
                ? onIdentity({ ...identity, color: hex })
                : onTheme({ ...theme, [key]: hex })
            }
            onClose={() => setPicker(null)}
          />
        )}
      </div>
    );
  };
  const known = ['claude', 'codex', 'gemini'];
  const list = known.map(
    (id) =>
      agents.find((a) => a.id === id) ?? {
        id,
        available: false,
        detail: 'État inconnu : clique sur « Revérifier ».',
      },
  );

  return (
    <div
      className="settings-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={box}
        className="settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <aside className="settings-nav">
          <h2 id="settings-title">Paramètres</h2>
          <div role="tablist" aria-orientation="vertical">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => {
                  const i = tabs.findIndex((x) => x.id === tab);
                  const n =
                    e.key === 'ArrowDown'
                      ? i + 1
                      : e.key === 'ArrowUp'
                        ? i - 1
                        : null;
                  if (n === null) return;
                  e.preventDefault();
                  const next = tabs[(n + tabs.length) % tabs.length].id;
                  setTab(next);
                  setTimeout(() =>
                    document.getElementById(`tab-${next}`)?.focus(),
                  );
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="settings-note">
            Préférences de l’atelier, gardées dans ce navigateur. Ton Design
            System n’est pas modifié.
          </p>
        </aside>

        <section
          className="settings-panel"
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
        >
          <button
            className="settings-close"
            aria-label="Fermer les paramètres"
            onClick={onClose}
          >
            ×
          </button>

          {tab === 'ai' && (
            <>
              <h3>Assistants IA</h3>
              <p className="settings-lead">
                Claude est l’assistant du chat. « Changer de compte » ouvre le
                Terminal avec la commande officielle : l’atelier ne voit jamais
                tes identifiants. D’autres assistants arrivent bientôt.
              </p>
              <fieldset className="settings-cards">
                <legend className="sr-only">Assistant utilisé</legend>
                {list
                  .filter((a) => a.id === 'claude' || a.available)
                  .map((a) => {
                    const info = agentInfo[a.id];
                    const canLogin = a.id === 'claude';
                    const res = login[a.id];
                    return (
                      <div
                        key={a.id}
                        className={`agent-card${agent === a.id ? ' is-on' : ''}${a.available ? '' : ' is-off'}`}
                      >
                        <label className="agent-pick">
                          <input
                            type="radio"
                            name="agent"
                            value={a.id}
                            checked={agent === a.id}
                            disabled={!a.available}
                            onChange={() => onAgent(a.id)}
                          />
                          <span className="agent-top">
                            <strong>{info.name}</strong>
                            <span
                              className={`agent-state ${a.available ? 'ok' : 'off'}`}
                            >
                              {a.available
                                ? 'Prêt'
                                : a.id !== 'claude'
                                  ? 'Bientôt'
                                  : 'Non connecté'}
                            </span>
                          </span>
                          <span className="agent-how">
                            {a.available ? a.detail : info.how}
                          </span>
                        </label>
                        {canLogin && (
                          <div className="agent-actions">
                            <button
                              className="agent-connect"
                              disabled={res === 'busy'}
                              onClick={async () => {
                                setLogin((l) => ({ ...l, [a.id]: 'busy' }));
                                try {
                                  const r = await onConnect('claude');
                                  setLogin((l) => ({ ...l, [a.id]: r }));
                                } catch (e) {
                                  setLogin((l) => ({
                                    ...l,
                                    [a.id]: (e as Error).message,
                                  }));
                                }
                              }}
                            >
                              {a.available ? 'Changer de compte' : 'Connecter'}
                            </button>
                            {res && res !== 'busy' && (
                              <p className="agent-result" role="status">
                                {typeof res === 'string' ? (
                                  res
                                ) : res.opened ? (
                                  <>
                                    Terminal ouvert : suis les étapes
                                    {a.id === 'claude'
                                      ? ' (ou tape /login pour changer de compte)'
                                      : ''}
                                    , puis clique sur « Revérifier ».
                                  </>
                                ) : (
                                  <>
                                    Ouvre le Terminal et tape{' '}
                                    <code>{res.command}</code>
                                    <button
                                      className="settings-copy"
                                      onClick={() =>
                                        navigator.clipboard
                                          ?.writeText(res.command)
                                          .catch(() => undefined)
                                      }
                                    >
                                      Copier
                                    </button>
                                    , puis clique sur « Revérifier ».
                                  </>
                                )}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </fieldset>
              {list.some((a) => a.id !== 'claude' && !a.available) && (
                <p className="settings-hint">
                  Bientôt :{' '}
                  {list
                    .filter((a) => a.id !== 'claude' && !a.available)
                    .map((a) => agentInfo[a.id]?.name ?? a.id)
                    .join(', ')}
                  . L’atelier est prévu pour changer d’assistant.
                </p>
              )}
              <button className="settings-link" onClick={onRefreshAgents}>
                Revérifier les connexions
              </button>

              <h4>Claude par défaut</h4>
              <div className="settings-row">
                <label>
                  Modèle
                  <select
                    value={assistant.model}
                    onChange={(e) =>
                      onAssistant({ ...assistant, model: e.target.value })
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
                      onAssistant({ ...assistant, effort: e.target.value })
                    }
                  >
                    {efforts.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="settings-hint">
                {models.find((m) => m.id === assistant.model)?.hint}
              </p>
            </>
          )}

          {tab === 'look' && (
            <>
              <h3>Apparence</h3>
              <p className="settings-lead">
                L’habillage de l’atelier. Les écrans Gutt de l’aperçu gardent
                leurs propres couleurs.
              </p>
              <section className="settings-block" aria-label="Identité">
                <h4>Identité de l’app</h4>
                <div className="identity-card" aria-hidden="true">
                  <span
                    className="brand-symbol"
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
                  <strong>{identity.name}</strong>
                  <span className="identity-note">Aperçu de l’en-tête</span>
                </div>
                <div className="settings-row settings-field">
                  <label>
                    Nom de l’app
                    <input
                      maxLength={30}
                      value={identity.name}
                      onChange={(e) =>
                        onIdentity({ ...identity, name: e.target.value })
                      }
                      onBlur={() =>
                        !identity.name.trim() &&
                        onIdentity({ ...identity, name: defaultIdentity.name })
                      }
                    />
                  </label>
                  <div className="settings-control">
                    <span className="settings-label" id="logo-kind">
                      Logo
                    </span>
                    <div
                      className="segmented"
                      role="group"
                      aria-labelledby="logo-kind"
                    >
                      {(
                        [
                          ['text', 'Texte'],
                          ['initials', 'Initiales'],
                          ['image', 'Image'],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          aria-pressed={identity.logo === id}
                          onClick={() => onIdentity({ ...identity, logo: id })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {identity.logo === 'text' && (
                  <div className="settings-row settings-field">
                    <label className="settings-narrow">
                      Texte du logo (3 caractères)
                      <input
                        maxLength={3}
                        value={identity.text}
                        onChange={(e) =>
                          onIdentity({ ...identity, text: e.target.value })
                        }
                      />
                    </label>
                  </div>
                )}
                {identity.logo === 'image' ? (
                  <div className="settings-field">
                    <span className="settings-label">Image du logo</span>
                    <div className="figma-actions">
                      <label className="file-button settings-link">
                        {identity.image
                          ? 'Changer l’image'
                          : 'Choisir une image'}
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            if (file.size > maxLogoBytes) {
                              setLogoError(
                                'Image trop lourde : 200 Ko maximum.',
                              );
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => {
                              setLogoError('');
                              onIdentity({
                                ...identity,
                                image: String(reader.result),
                              });
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    </div>
                    <p className="settings-hint">
                      PNG, JPEG, WebP ou SVG, carré de préférence, 200 Ko
                      maximum.
                    </p>
                  </div>
                ) : (
                  <div className="settings-field">
                    <span className="settings-label" id="logo-color">
                      Couleur du logo
                    </span>
                    <div
                      className="swatch-row"
                      role="group"
                      aria-labelledby="logo-color"
                    >
                      <button
                        className="swatch-pick"
                        aria-pressed={!identity.color}
                        onClick={() => onIdentity({ ...identity, color: '' })}
                      >
                        <span style={{ background: 'var(--accent-strong)' }} />
                        Accent
                      </button>
                      {logoColors.map((c) => (
                        <button
                          key={c.value}
                          className="swatch-pick"
                          aria-pressed={identity.color === c.value}
                          onClick={() =>
                            onIdentity({ ...identity, color: c.value })
                          }
                        >
                          <span style={{ background: c.value }} />
                          {c.label}
                        </button>
                      ))}
                      {customSwatch('logo', 'Couleur du logo', logoColors)}
                    </div>
                  </div>
                )}
                {logoError && (
                  <p className="settings-warn" role="alert">
                    {logoError}
                  </p>
                )}
                <button
                  className="settings-link"
                  onClick={() => {
                    setLogoError('');
                    onIdentity(defaultIdentity);
                  }}
                >
                  Revenir à DS-Studio
                </button>
              </section>
              <section className="settings-block" aria-label="Thème">
                <h4>Thème de l’atelier</h4>
                <h5 id="mode-title">Mode</h5>
                <div
                  className="segmented"
                  role="group"
                  aria-labelledby="mode-title"
                >
                  {modes.map((m) => (
                    <button
                      key={m.id}
                      aria-pressed={theme.mode === m.id}
                      onClick={() => onTheme({ ...theme, mode: m.id })}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <h5>Fond</h5>
                <div className="swatch-row" role="group" aria-label="Fond">
                  {backgrounds.map((b) => (
                    <button
                      key={b.id}
                      className="swatch-pick"
                      aria-pressed={theme.bg.toUpperCase() === b.value}
                      onClick={() => onTheme({ ...theme, bg: b.value })}
                    >
                      <span style={{ background: b.value }} />
                      {b.label}
                    </button>
                  ))}
                  {customSwatch('bg', 'Fond', backgrounds)}
                </div>
                <h5>Couleur d’accent</h5>
                <div
                  className="swatch-row"
                  role="group"
                  aria-label="Couleur d’accent"
                >
                  {accents.map((a) => (
                    <button
                      key={a.id}
                      className="swatch-pick"
                      aria-pressed={theme.accent.toUpperCase() === a.value}
                      onClick={() => onTheme({ ...theme, accent: a.value })}
                    >
                      <span style={{ background: a.value }} />
                      {a.label}
                    </button>
                  ))}
                  {customSwatch('accent', 'Couleur d’accent', accents)}
                </div>
              </section>
              <section className="settings-block" aria-label="Police">
                <h4>Police</h4>
                <input
                  type="search"
                  className="font-search"
                  aria-label="Rechercher une police"
                  placeholder="Rechercher une police (ex. Futura, serif)"
                  value={fontQuery}
                  onChange={(e) => setFontQuery(e.target.value)}
                />
                <div className="font-list" role="group" aria-label="Police">
                  {fonts.map((f) => (
                    <button
                      key={f.id}
                      className="font-pick"
                      aria-pressed={theme.font === f.id}
                      style={{ fontFamily: f.value }}
                      onClick={() => onTheme({ ...theme, font: f.id })}
                    >
                      {f.label}
                      <span className="font-kind">{f.kind}</span>
                    </button>
                  ))}
                  {!fonts.length && (
                    <p className="settings-hint">
                      Aucune police pour « {fontQuery.trim()} ».
                    </p>
                  )}
                </div>
                <p className="settings-hint">
                  Polices installées avec macOS : pas de téléchargement, marche
                  hors ligne.
                </p>
              </section>
              {warnings.map((w) => (
                <p key={w} className="settings-warn" role="status">
                  {w}
                </p>
              ))}
              <button
                className="settings-link"
                onClick={() => onTheme(defaultTheme)}
              >
                Revenir à l’apparence d’origine
              </button>
            </>
          )}

          {tab === 'figma' && figmaPanel}

          {tab === 'projects' && (
            <ProjectsPane current={project} locked={locked} />
          )}

          {tab === 'general' && (
            <>
              <h3>Général</h3>
              <div className="settings-row">
                <label>
                  Format d’aperçu au démarrage
                  <select
                    value={prefs.device}
                    onChange={(e) =>
                      onPrefs({ ...prefs, device: e.target.value })
                    }
                  >
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} · {d.width}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Type de vision au démarrage
                  <select
                    value={prefs.profile}
                    onChange={(e) =>
                      onPrefs({ ...prefs, profile: e.target.value })
                    }
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <h4>Visite guidée</h4>
              <button className="settings-link" onClick={onTour}>
                Relancer la visite
              </button>
              <h4>Raccourcis clavier</h4>
              <dl className="shortcuts">
                <dt>
                  <kbd>Cmd</kbd> + <kbd>S</kbd>
                </dt>
                <dd>Enregistrer (ouvre le diff)</dd>
                <dt>
                  <kbd>Échap</kbd>
                </dt>
                <dd>Fermer une fenêtre, un menu ou la visite</dd>
                <dt>
                  <kbd>←</kbd> <kbd>→</kbd>
                </dt>
                <dd>Redimensionner les panneaux (poignée sélectionnée)</dd>
                <dt>
                  <kbd>↑</kbd> <kbd>↓</kbd>
                </dt>
                <dd>Parcourir la liste des écrans</dd>
              </dl>
              <h4>Conversations</h4>
              {confirmChats ? (
                <div className="settings-row">
                  <button
                    className="studio-primary"
                    onClick={() => {
                      onClearChats();
                      setConfirmChats(false);
                      setChatsCleared(true);
                    }}
                  >
                    Oui, effacer
                  </button>
                  <button onClick={() => setConfirmChats(false)}>
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  className="settings-link"
                  onClick={() => {
                    setChatsCleared(false);
                    setConfirmChats(true);
                  }}
                >
                  Effacer les conversations de ce projet
                </button>
              )}
              <p className="settings-hint" role="status">
                {chatsCleared
                  ? 'Conversations de ce projet effacées.'
                  : 'Gardées dans ce navigateur. Les autres projets ne sont pas touchés.'}
              </p>
              <h4>Réinitialiser</h4>
              {confirmReset ? (
                <div className="settings-row">
                  <button
                    className="studio-primary"
                    onClick={() => {
                      onReset();
                      setConfirmReset(false);
                    }}
                  >
                    Oui, réinitialiser
                  </button>
                  <button onClick={() => setConfirmReset(false)}>
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  className="settings-link"
                  onClick={() => setConfirmReset(true)}
                >
                  Réinitialiser les préférences de l’atelier
                </button>
              )}
              <p className="settings-hint">
                Apparence, identité, assistant, formats, menu replié et visite.
                Tes tokens, ton historique et ton brief ne sont pas touchés.
              </p>
              <h4>À propos</h4>
              <p className="settings-hint">
                {identity.name} · version {version}. Basé sur DS-Studio V2,
                starter du cours IA (ECV). Doc dans le dossier du projet :
                README.md, docs/FIGMA.md, workspace/DECISIONS.md.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
