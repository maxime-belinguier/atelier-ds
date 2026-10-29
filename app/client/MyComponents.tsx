import { useRef, useState, type CSSProperties } from 'react';
import { contrast, type Tokens, type TokenKey } from '../shared/model.js';
import { kindLabels, type MyComponent } from '../shared/myComponents.js';
import { DSProvider } from './DesignSystem.js';

// Composants créés dans l'atelier, sans Claude : un modèle habillé avec les
// tokens du projet (var(--…)), donc ils suivent chaque modification.

const v = (key: string) => `var(--${key.replace('.', '-')})`;
const radius = (c: MyComponent) =>
  c.shape === 'pill'
    ? '999px'
    : c.shape === 'square'
      ? '0'
      : v('radius.control');

export function MyComponentView({ c }: { c: MyComponent }) {
  const base: CSSProperties = {
    background: v(c.bg),
    color: v(c.fg),
    border: c.border ? `1px solid ${v(c.border)}` : '0',
    borderRadius: radius(c),
    fontFamily: v('font.family'),
    boxSizing: 'border-box',
  };
  if (c.kind === 'card')
    return (
      <div
        className="my-card"
        style={{ ...base, padding: v('space.lg'), width: 300 }}
      >
        <strong style={{ fontSize: `calc(${v('font.body')} * 1.125)` }}>
          {c.text}
        </strong>
        {c.sub && (
          <p style={{ fontSize: `calc(${v('font.body')} * 0.875)` }}>{c.sub}</p>
        )}
      </div>
    );
  if (c.kind === 'tag')
    return (
      <span
        className="my-tag"
        style={{
          ...base,
          padding: `4px ${v('space.sm')}`,
          fontSize: `calc(${v('font.body')} * 0.75)`,
        }}
      >
        {c.text}
      </span>
    );
  return (
    <button
      type="button"
      className="my-button"
      style={{
        ...base,
        padding: `${v('space.sm')} ${v('space.md')}`,
        fontSize: v('font.body'),
      }}
    >
      {c.text}
    </button>
  );
}

/** Tokens utilisés par le composant, dans l'ordre d'affichage. */
export function myComponentKeys(c: MyComponent): TokenKey[] {
  const keys = [
    c.bg,
    c.fg,
    c.border,
    c.shape === 'control' ? 'radius.control' : '',
    c.kind === 'card' ? 'space.lg' : 'space.sm',
    c.kind === 'button' ? 'space.md' : '',
    'font.family',
    'font.body',
  ].filter(Boolean);
  return [...new Set(keys)] as TokenKey[];
}

const defaults: Record<
  MyComponent['kind'],
  Pick<MyComponent, 'bg' | 'fg' | 'border' | 'shape' | 'text'>
> = {
  button: {
    bg: 'color.brand',
    fg: 'color.onBrand',
    border: '',
    shape: 'control',
    text: 'Valider',
  },
  card: {
    bg: 'color.surface',
    fg: 'color.text',
    border: 'color.border',
    shape: 'control',
    text: 'Titre de la carte',
  },
  tag: {
    bg: 'color.canvas',
    fg: 'color.text',
    border: '',
    shape: 'pill',
    text: 'Nouveau',
  },
};

const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36) || 'composant';

// Fenêtre de création / modification, avec aperçu en direct.
export function MyComponentEditor({
  initial,
  tokens,
  labelOf,
  onSave,
  onClose,
}: {
  initial?: MyComponent;
  tokens: Tokens;
  labelOf: (key: TokenKey) => string;
  onSave: (c: MyComponent) => Promise<void>;
  onClose: () => void;
}) {
  const [c, setC] = useState<MyComponent>(
    () =>
      initial ?? {
        id: '',
        name: '',
        kind: 'button',
        sub: '',
        ...defaults.button,
      },
  );
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const box = useRef<HTMLFormElement>(null);
  const colors = Object.keys(tokens).filter((k) =>
    k.startsWith('color.'),
  ) as TokenKey[];
  const hex = (k: string) => String(tokens[k as keyof Tokens]?.$value ?? '');
  const ratio = hex(c.fg) && hex(c.bg) ? contrast(hex(c.fg), hex(c.bg)) : null;
  const set = (patch: Partial<MyComponent>) => setC({ ...c, ...patch });
  const colorSelect = (
    label: string,
    field: 'bg' | 'fg' | 'border',
    optional = false,
  ) => (
    <label className="my-field">
      {label}
      <span className="my-color">
        <span
          className="my-swatch"
          aria-hidden="true"
          style={{ background: c[field] ? hex(c[field]) : 'transparent' }}
        />
        <select
          aria-label={label}
          value={c[field]}
          onChange={(e) => set({ [field]: e.target.value })}
        >
          {optional && <option value="">Aucune</option>}
          {colors.map((k) => (
            <option key={k} value={k}>
              {labelOf(k)} · {hex(k)}
            </option>
          ))}
        </select>
      </span>
    </label>
  );

  async function submit() {
    if (working) return;
    if (!c.name.trim()) return setError('Donne un nom au composant.');
    if (!c.text.trim()) return setError('Ajoute un texte.');
    setWorking(true);
    setError('');
    try {
      await onSave({
        ...c,
        id: c.id || `${slug(c.name)}-${Date.now().toString(36).slice(-4)}`,
      });
    } catch (e) {
      setWorking(false);
      setError((e as Error).message);
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
        className="new-project my-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-editor-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <header className="new-project-head">
          <div>
            <h2 id="my-editor-title">
              {initial ? 'Modifier le composant' : 'Créer un composant'}
            </h2>
            <p>Un modèle habillé avec tes tokens : il suit chaque modif.</p>
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
        <div className="my-preview" aria-label="Aperçu du composant">
          <DSProvider tokens={tokens}>
            <MyComponentView c={c} />
          </DSProvider>
        </div>
        {ratio !== null && ratio < 4.5 && (
          <p className="settings-warn" role="status">
            Contraste texte / fond {ratio.toFixed(1).replace('.', ',')}:1, sous
            le minimum de 4,5:1.
          </p>
        )}
        <div className="my-grid">
          <label className="my-field">
            Nom du composant
            <input
              autoFocus
              maxLength={40}
              value={c.name}
              placeholder="Ex. Bouton de réservation"
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>
          <div className="my-field">
            <span id="my-kind">Modèle</span>
            <div className="segmented" role="group" aria-labelledby="my-kind">
              {(['button', 'card', 'tag'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={c.kind === k}
                  onClick={() =>
                    k !== c.kind &&
                    set({
                      kind: k,
                      ...defaults[k],
                      text:
                        c.text === defaults[c.kind].text
                          ? defaults[k].text
                          : c.text,
                    })
                  }
                >
                  {kindLabels[k]}
                </button>
              ))}
            </div>
          </div>
          <label className="my-field">
            {c.kind === 'card' ? 'Titre' : 'Texte'}
            <input
              maxLength={80}
              value={c.text}
              onChange={(e) => set({ text: e.target.value })}
            />
          </label>
          {c.kind === 'card' && (
            <label className="my-field">
              Description
              <input
                maxLength={160}
                value={c.sub}
                onChange={(e) => set({ sub: e.target.value })}
              />
            </label>
          )}
          {colorSelect('Fond', 'bg')}
          {colorSelect('Couleur du texte', 'fg')}
          {colorSelect('Bordure', 'border', true)}
          <div className="my-field">
            <span id="my-shape">Forme</span>
            <div className="segmented" role="group" aria-labelledby="my-shape">
              {(
                [
                  ['control', 'Arrondi du DS'],
                  ['pill', 'Pilule'],
                  ['square', 'Carré'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={c.shape === id}
                  onClick={() => set({ shape: id })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {error && (
          <p className="settings-warn" role="alert">
            {error}
          </p>
        )}
        <footer className="new-project-foot">
          <button type="button" className="save-cancel" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="studio-primary" disabled={working}>
            {working ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Créer'}
          </button>
        </footer>
      </form>
    </div>
  );
}
