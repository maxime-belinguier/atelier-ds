import { useState, type FormEvent } from 'react';
import { customKeyPattern, isCoreKey, type Tokens } from '../shared/model.js';

// Ajout d'un token à la main. Rien n'est écrit ici : le formulaire prépare
// une proposition, le diff habituel s'ouvre et c'est toi qui valides.
export default function AddToken({
  prefixes,
  tokens,
  onPropose,
}: {
  prefixes: string[];
  tokens: Tokens;
  onPropose: (key: string, value: string | number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [prefix, setPrefix] = useState(prefixes[0]);
  const [name, setName] = useState('');
  const [value, setValue] = useState(prefix === 'color' ? '#' : '');
  const [error, setError] = useState('');
  const isColor = prefix === 'color';

  function submit(e: FormEvent) {
    e.preventDefault();
    const key = `${prefix}.${name.trim()}`;
    if (!customKeyPattern.test(key))
      return setError(
        'Nom en camelCase, sans espace ni accent : warning, cardHover…',
      );
    if (isCoreKey(key) || Object.hasOwn(tokens, key))
      return setError('Ce token existe déjà.');
    let v: string | number;
    if (isColor) {
      if (!/^#[0-9a-fA-F]{6}$/.test(value.trim()))
        return setError('Couleur attendue : #RRGGBB');
      v = value.trim().toUpperCase();
    } else {
      const n = Number(value);
      if (value.trim() === '' || !Number.isFinite(n) || n < 0 || n > 128)
        return setError('Nombre de 0 à 128');
      v = n;
    }
    setError('');
    void onPropose(key, v).then(() => {
      setOpen(false);
      setName('');
      setValue(isColor ? '#' : '');
    });
  }

  if (!open)
    return (
      <button
        type="button"
        className="add-token-open"
        onClick={() => setOpen(true)}
      >
        + Ajouter un token
      </button>
    );
  return (
    <form className="add-token" onSubmit={submit} aria-label="Nouveau token">
      <div className="add-token-fields">
        {prefixes.length > 1 ? (
          <select
            aria-label="Famille"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
          >
            {prefixes.map((p) => (
              <option key={p} value={p}>
                {p}.
              </option>
            ))}
          </select>
        ) : (
          <code className="add-token-prefix">{prefix}.</code>
        )}
        <input
          aria-label="Nom du token"
          placeholder={isColor ? 'warning' : 'xl'}
          value={name}
          maxLength={32}
          spellCheck={false}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <input
          aria-label="Valeur"
          className={isColor ? 'hex-input' : 'number-input'}
          placeholder={isColor ? '#RRGGBB' : 'px'}
          value={value}
          maxLength={isColor ? 7 : 6}
          inputMode={isColor ? 'text' : 'decimal'}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      {error && (
        <p className="row-error" role="alert">
          {error}
        </p>
      )}
      <div className="add-token-actions">
        <button type="button" onClick={() => setOpen(false)}>
          Annuler
        </button>
        <button type="submit" className="studio-primary">
          Voir le diff
        </button>
      </div>
    </form>
  );
}
