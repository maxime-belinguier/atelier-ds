import type { ReactNode } from 'react';
import type { TokenKey, Tokens } from '../shared/model.js';
import { DSProvider } from './DesignSystem.js';
import { labelOf } from './tokenMeta.js';

// Bibliothèque : le Design System en lecture seule, comme une doc.
// Fondations en spécimens, composants avec rendu, usage, tokens et écrans.

type Value = string | number | undefined;
const val = (t: Tokens, k: TokenKey): Value =>
  (t as Record<string, { $value: string | number }>)[k]?.$value;

function Specimen({ k, v }: { k: TokenKey; v: Value }) {
  if (k.startsWith('color.'))
    return <span className="lib-swatch" style={{ background: String(v) }} />;
  if (k === 'font.family')
    return (
      <span className="lib-type" style={{ fontFamily: String(v) }}>
        Aa
      </span>
    );
  if (k.startsWith('font.') || k.startsWith('size.'))
    return (
      <span className="lib-type" style={{ fontSize: Math.min(Number(v), 40) }}>
        Aa
      </span>
    );
  if (k.startsWith('radius.'))
    return <span className="lib-radius" style={{ borderRadius: Number(v) }} />;
  return (
    <span className="lib-space">
      <span style={{ width: Math.min(Number(v), 120) }} />
    </span>
  );
}

const unit = (k: TokenKey, v: Value) =>
  typeof v === 'number' ? `${v} px` : String(v ?? '–');

export function LibraryTokens({
  keys,
  tokens,
}: {
  keys: TokenKey[];
  tokens: Tokens;
}) {
  if (!keys.length)
    return <p className="lib-empty">Aucun token dans cette fondation.</p>;
  return (
    <ul className="lib-grid" aria-label="Tokens">
      {keys.map((k) => (
        <li key={k} className="lib-card">
          <Specimen k={k} v={val(tokens, k)} />
          <strong>{labelOf(k)}</strong>
          <code>{k}</code>
          <span>{unit(k, val(tokens, k))}</span>
        </li>
      ))}
    </ul>
  );
}

export function LibraryComponent({
  render,
  tokens,
  keys,
  usage,
  usedIn,
  figma,
  measures,
  onScreen,
}: {
  render: ReactNode;
  tokens: Tokens;
  keys: TokenKey[];
  usage?: { do: string[]; dont: string[] };
  usedIn: { id: string; label: string }[];
  /** null : Figma pas encore lu. */
  figma: 'relié' | 'hors' | 'seulement' | null;
  measures?: string;
  onScreen: (id: string) => void;
}) {
  return (
    <div className="lib-component">
      <div className="lib-render">
        <DSProvider tokens={tokens}>{render}</DSProvider>
      </div>
      {measures && <p className="lib-measures">{measures}</p>}
      <div className="lib-sections">
        {usage && (
          <section>
            <h4>Bonnes pratiques</h4>
            <ul className="lib-do">
              {usage.do.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <ul className="lib-dont">
              {usage.dont.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h4>Tokens utilisés</h4>
          <ul className="lib-token-list">
            {keys.map((k) => (
              <li key={k}>
                {k.startsWith('color.') && (
                  <span
                    className="lib-dot"
                    style={{ background: String(val(tokens, k)) }}
                  />
                )}
                <code>{k}</code>
                <span>{unit(k, val(tokens, k))}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4>Utilisé dans</h4>
          {usedIn.length ? (
            <div className="lib-chips">
              {usedIn.map((s) => (
                <button key={s.id} onClick={() => onScreen(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="lib-empty">Aucun écran de l’app pour l’instant.</p>
          )}
          <h4>Figma</h4>
          <p className="lib-figma">
            {figma === null
              ? 'Pas encore lu : Figma › Lire Figma maintenant.'
              : figma === 'relié'
                ? 'Relié au composant Figma du même nom.'
                : figma === 'seulement'
                  ? 'Dans Figma seulement : à coder.'
                  : 'Absent de ton fichier Figma.'}
          </p>
        </section>
      </div>
    </div>
  );
}
