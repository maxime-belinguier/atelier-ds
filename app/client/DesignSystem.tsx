import { useState, type CSSProperties, type ReactNode } from 'react';
import { tokenCss, type TokenKey, type Tokens } from '../shared/model.js';

// Composants Gutt (prototype PFE, données fictives). Mêmes sources dans le
// catalogue et l'iframe : un changement de token se propage partout.

export function DSProvider({
  tokens,
  children,
}: {
  tokens: Tokens;
  children: ReactNode;
}) {
  return (
    <div className="ds" style={tokenCss(tokens) as CSSProperties}>
      {children}
    </div>
  );
}
export function Button({
  variant = 'primary',
  children,
  disabled = false,
  onClick,
  state,
}: {
  variant?: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  /** Planche du composant : état affiché sans souris ni clavier. */
  state?: 'hover' | 'focus';
}) {
  return (
    <button
      className={`ds-button ${variant}${state ? ` is-${state}` : ''}`}
      data-ds="buttons"
      disabled={disabled}
      onClick={onClick}
      tabIndex={state ? -1 : undefined}
    >
      {children}
    </button>
  );
}

// Fiche d'un logement comparé par l'utilisateur.
export function LogementCard({ kept: initial = false }: { kept?: boolean }) {
  const [kept, setKept] = useState(initial);
  return (
    <article className="ds-card" data-ds="logement">
      <div className="card-kicker">T2 · 38 M² · CHARTRONS</div>
      <h3>Appartement lumineux, 2e étage</h3>
      <p>720 € charges comprises · disponible le 1er décembre.</p>
      <div className="card-meta">
        <span className="ds-badge danger">
          {/* Icône en plus du rouge : l'alerte se comprend sans la couleur (WCAG 1.4.1). */}
          <svg
            aria-hidden="true"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
          3 points à vérifier
        </span>
        <span>18,9 €/m²</span>
      </div>
      <Button onClick={() => setKept(!kept)}>
        {kept ? 'Logement gardé ✓' : 'Garder ce logement'}
      </Button>
      <span role="status" className="ds-feedback">
        {kept ? 'Démonstration locale, aucune donnée envoyée.' : ''}
      </span>
    </article>
  );
}

const points = [
  'Pas de traces d’humidité',
  'Chauffage testé',
  'Charges détaillées par écrit',
  'Diagnostic énergie lu',
  'État des lieux prévu',
];

// Liste des points à vérifier avant de signer. Seul élément ludique :
// la progression.
export function VerificationCard({ checked = 2 }: { checked?: number }) {
  const [done, setDone] = useState<boolean[]>(
    points.map((_, i) => i < checked),
  );
  const count = done.filter(Boolean).length;
  return (
    <article className="ds-card" data-ds="verification">
      <div className="card-kicker">AVANT DE SIGNER</div>
      <h3>Points à vérifier</h3>
      <div
        className="ds-progress"
        role="progressbar"
        aria-label="Points vérifiés"
        aria-valuemin={0}
        aria-valuemax={points.length}
        aria-valuenow={count}
      >
        <span style={{ width: `${(count / points.length) * 100}%` }} />
      </div>
      <p>
        {count} / {points.length} vérifiés
      </p>
      <ul className="ds-checklist">
        {points.map((label, i) => (
          <li key={label}>
            <label className="ds-check">
              <input
                type="checkbox"
                checked={done[i]}
                onChange={() => setDone(done.map((d, j) => (j === i ? !d : d)))}
              />{' '}
              {label}
            </label>
          </li>
        ))}
      </ul>
      <span role="status" className="ds-feedback">
        {count === points.length
          ? 'Tout est vérifié. Tu peux signer l’esprit tranquille.'
          : ''}
      </span>
    </article>
  );
}

export function AjoutLogementForm() {
  const [rent, setRent] = useState('');
  const [area, setArea] = useState('');
  const [sent, setSent] = useState(false);
  const perM2 =
    Number(rent) > 0 && Number(area) > 0
      ? (Number(rent) / Number(area)).toFixed(1).replace('.', ',')
      : '';
  return (
    <form
      data-ds="form"
      className="ds-form"
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
    >
      <label>
        Adresse ou quartier
        <input
          placeholder="Chartrons, Bordeaux"
          required
          onChange={() => setSent(false)}
        />
      </label>
      <label>
        Loyer charges comprises (€)
        <input
          type="number"
          min="1"
          placeholder="720"
          required
          value={rent}
          onChange={(e) => {
            setRent(e.target.value);
            setSent(false);
          }}
        />
      </label>
      <label>
        Surface (m²)
        <input
          type="number"
          min="1"
          placeholder="38"
          required
          value={area}
          onChange={(e) => {
            setArea(e.target.value);
            setSent(false);
          }}
        />
      </label>
      <label>
        Diagnostic énergie
        <input placeholder="Bientôt disponible" disabled />
      </label>
      <label className="ds-check">
        <input type="checkbox" required /> J’ai visité ce logement
      </label>
      <button className="ds-button primary" type="submit" data-ds="buttons">
        Analyser ce logement
      </button>
      <p role="status">
        {sent
          ? `Analyse de démonstration : ${perM2} €/m². Aucune donnée envoyée.`
          : ''}
      </p>
    </form>
  );
}

export function Navigation() {
  const [tab, setTab] = useState('Mes biens');
  return (
    <nav aria-label="Navigation du scénario" className="ds-nav" data-ds="nav">
      {['Mes biens', 'À vérifier', 'Profil'].map((t) => (
        <button
          key={t}
          aria-current={tab === t ? 'page' : undefined}
          onClick={() => setTab(t)}
        >
          {t}
        </button>
      ))}
      <p className="nav-context" aria-live="polite">
        {tab === 'À vérifier'
          ? 'Les points à vérifier avant de signer.'
          : tab === 'Profil'
            ? 'Compte facultatif : sans compte, tout reste sur cet appareil.'
            : 'Les logements que tu compares.'}
      </p>
    </nav>
  );
}

// Registre des composants affichés dans l'atelier. « tokens » liste les
// variables réellement lues par leurs règles CSS (styles.css, section .ds),
// de la plus visible à la moins visible. À tenir à jour avec le CSS.
const buttonVariants = [
  ['primary', 'Principal', 'Garder'],
  ['secondary', 'Secondaire', 'Annuler'],
  ['danger', 'Suppression', 'Supprimer'],
] as const;
const buttonStates = [
  ['default', 'Normal'],
  ['hover', 'Survol'],
  ['focus', 'Focus'],
  ['disabled', 'Désactivé'],
] as const;

// Planche des boutons : chaque variante dans chaque état, à taille réelle.
// Les états survol et focus sont forcés par classe (is-hover, is-focus).
export function ButtonSheet() {
  return (
    <table className="sheet-table">
      <caption className="sr-only">
        Boutons : variantes en lignes, états en colonnes
      </caption>
      <thead>
        <tr>
          <td />
          {buttonStates.map(([id, label]) => (
            <th key={id} scope="col">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {buttonVariants.map(([variant, label, text]) => (
          <tr key={variant}>
            <th scope="row">{label}</th>
            {buttonStates.map(([state]) => (
              <td key={state}>
                <Button
                  variant={variant}
                  disabled={state === 'disabled'}
                  state={
                    state === 'hover' || state === 'focus' ? state : undefined
                  }
                >
                  {text}
                </Button>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Planche à une ligne : chaque colonne montre le composant dans un état.
function StateRow({
  caption,
  cells,
  wide = false,
}: {
  caption: string;
  cells: [string, ReactNode][];
  /** Fiches : colonnes de largeur fixe pour comparer les états. */
  wide?: boolean;
}) {
  return (
    <table className="sheet-table">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {cells.map(([label]) => (
            <th key={label} scope="col">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {cells.map(([label, node]) => (
            <td key={label} className={wide ? 'sheet-card' : undefined}>
              {node}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

export function LogementSheet() {
  return (
    <StateRow
      caption="Fiche logement : états en colonnes"
      wide
      cells={[
        ['Normal', <LogementCard />],
        ['Gardé', <LogementCard kept />],
      ]}
    />
  );
}

export function VerificationSheet() {
  return (
    <StateRow
      caption="Points à vérifier : progression en colonnes"
      wide
      cells={[
        ['À commencer', <VerificationCard checked={0} />],
        ['En cours', <VerificationCard />],
        ['Terminé', <VerificationCard checked={points.length} />],
      ]}
    />
  );
}

const fieldStates = [
  ['default', 'Normal'],
  ['focus', 'Focus'],
  ['filled', 'Rempli'],
  ['invalid', 'Erreur'],
  ['disabled', 'Désactivé'],
] as const;

// Champ et case à cocher dans chaque état. Focus et erreur sont forcés par
// classe (is-focus, is-invalid) : sans saisie, le navigateur ne les montre pas.
export function FormSheet() {
  return (
    <div className="ds-form">
      <table className="sheet-table">
        <caption className="sr-only">
          Formulaire : états en lignes, champ et case en colonnes
        </caption>
        <thead>
          <tr>
            <td />
            <th scope="col">Champ</th>
            <th scope="col">Case</th>
          </tr>
        </thead>
        <tbody>
          {fieldStates.map(([state, label]) => (
            <tr key={state}>
              <th scope="row">{label}</th>
              <td className="sheet-field">
                <input
                  aria-label={`Loyer, ${label}`}
                  readOnly
                  tabIndex={-1}
                  placeholder="720"
                  defaultValue={
                    state === 'filled' ? '720' : state === 'invalid' ? '0' : ''
                  }
                  disabled={state === 'disabled'}
                  aria-invalid={state === 'invalid' || undefined}
                  className={
                    state === 'focus'
                      ? 'is-focus'
                      : state === 'invalid'
                        ? 'is-invalid'
                        : undefined
                  }
                />
              </td>
              <td>
                {state === 'invalid' ? null : (
                  <label className="ds-check">
                    <input
                      type="checkbox"
                      readOnly
                      tabIndex={-1}
                      checked={state === 'filled'}
                      disabled={state === 'disabled'}
                      className={state === 'focus' ? 'is-focus' : undefined}
                    />{' '}
                    Visité
                  </label>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Le DS n'a pas de survol pour les onglets : la planche ne l'invente pas.
export function NavSheet() {
  const tab = (state?: 'focus' | 'active') => (
    <nav className="ds-nav" aria-label={`Onglet ${state ?? 'normal'}`}>
      <button
        tabIndex={-1}
        className={state === 'focus' ? 'is-focus' : undefined}
        aria-current={state === 'active' ? 'page' : undefined}
      >
        À vérifier
      </button>
    </nav>
  );
  return (
    <StateRow
      caption="Navigation : états de l’onglet en colonnes"
      cells={[
        ['Normal', tab()],
        ['Focus', tab('focus')],
        ['Actif', tab('active')],
      ]}
    />
  );
}

export const components: {
  id: string;
  label: string;
  description: string;
  tokens: TokenKey[];
  render: () => ReactNode;
  /** Planche des états ; sinon le rendu simple. */
  sheet?: () => ReactNode;
  /** Mesures affichées sous la planche, calculées depuis les tokens. */
  measures?: (t: Tokens) => string;
  /** Écrans qui contiennent ce composant (l'Aperçu ouvre le premier). */
  usedIn: string[];
}[] = [
  {
    id: 'buttons',
    usedIn: ['cards', 'form'],
    label: 'Boutons',
    description:
      'Action principale, secondaire, suppression et état désactivé.',
    tokens: [
      'color.brand',
      'color.brandHover',
      'color.onBrand',
      'color.danger',
      'color.surface',
      'color.canvas',
      'color.focus',
      'radius.control',
      'space.sm',
      'space.md',
      'font.family',
      'font.body',
    ],
    render: () => (
      <div className="button-row">
        <Button>Action principale</Button>
        <Button variant="secondary">Secondaire</Button>
        <Button variant="danger">Supprimer</Button>
        <Button disabled>Indisponible</Button>
      </div>
    ),
    sheet: () => <ButtonSheet />,
    measures: (t) =>
      `hauteur min. 44 px · arrondi ${t['radius.control']?.$value} px · marges ${t['space.sm']?.$value} × ${t['space.md']?.$value} px · texte ${t['font.body']?.$value} px`,
  },
  {
    id: 'logement',
    usedIn: ['cards'],
    label: 'Fiche logement',
    description: 'Un logement comparé : loyer, prix au m², points à vérifier.',
    tokens: [
      'color.surface',
      'color.border',
      'color.brand',
      'color.onBrand',
      'color.text',
      'color.muted',
      'color.danger',
      'color.success',
      'radius.control',
      'space.lg',
      'space.md',
      'space.sm',
      'font.body',
    ],
    render: () => <LogementCard />,
    sheet: () => <LogementSheet />,
    measures: (t) =>
      `marge interne ${t['space.lg']?.$value} px · arrondi ${t['radius.control']?.$value} px · bordure 1 px · texte ${Math.round(Number(t['font.body']?.$value) * 0.875)} px`,
  },
  {
    id: 'verification',
    usedIn: ['cards'],
    label: 'Points à vérifier',
    description: 'Liste à cocher avant de signer, avec progression.',
    tokens: [
      'color.brand',
      'color.success',
      'color.surface',
      'color.canvas',
      'color.border',
      'color.text',
      'color.muted',
      'radius.control',
      'space.lg',
      'space.sm',
      'font.body',
    ],
    render: () => <VerificationCard />,
    sheet: () => <VerificationSheet />,
    measures: (t) =>
      `barre 8 px · ligne min. 44 px · case 18 px · écart ${t['space.sm']?.$value} px`,
  },
  {
    id: 'form',
    usedIn: ['form'],
    label: 'Formulaire',
    description: 'Champs, case à cocher, champ désactivé et erreur de saisie.',
    tokens: [
      'color.border',
      'color.surface',
      'color.text',
      'color.danger',
      'color.canvas',
      'color.brand',
      'color.onBrand',
      'color.focus',
      'radius.control',
      'space.md',
      'space.sm',
      'font.body',
    ],
    render: () => <AjoutLogementForm />,
    sheet: () => <FormSheet />,
    measures: (t) =>
      `champ min. 44 px · arrondi ${t['radius.control']?.$value} px · marges ${t['space.sm']?.$value} × ${t['space.md']?.$value} px · écart entre champs ${t['space.md']?.$value} px`,
  },
  {
    id: 'nav',
    usedIn: ['cards', 'form'],
    label: 'Navigation',
    description: 'Onglets de l’application, avec l’onglet actif.',
    tokens: [
      'color.brand',
      'color.onBrand',
      'color.muted',
      'color.focus',
      'radius.control',
      'space.sm',
      'font.body',
    ],
    render: () => <Navigation />,
    sheet: () => <NavSheet />,
    measures: (t) =>
      `onglet min. 44 px · arrondi ${t['radius.control']?.$value} px · marge ${t['space.sm']?.$value} px · texte ${Math.round(Number(t['font.body']?.$value) * 0.8)} px`,
  },
];

export const screens: {
  id: string;
  label: string;
  description: string;
  tokens: TokenKey[];
}[] = [
  {
    id: 'cards',
    label: 'Mes biens',
    description: 'Accueil : fiche logement et points à vérifier.',
    tokens: [
      'color.canvas',
      'color.surface',
      'color.brand',
      'color.onBrand',
      'color.text',
      'color.muted',
      'color.border',
      'color.danger',
      'color.success',
      'font.heading',
      'font.body',
      'font.family',
      'space.lg',
      'space.md',
      'radius.control',
    ],
  },
  {
    id: 'form',
    label: 'Ajouter un logement',
    description: 'Saisie d’un nouveau logement et analyse du prix au m².',
    tokens: [
      'color.canvas',
      'color.surface',
      'color.brand',
      'color.onBrand',
      'color.text',
      'color.border',
      'color.danger',
      'font.heading',
      'font.body',
      'font.family',
      'space.lg',
      'space.md',
      'radius.control',
    ],
  },
];

export function Scenario({
  tokens,
  scenario,
  brandName,
}: {
  tokens: Tokens;
  scenario: string;
  /** Nom du projet (autre que Gutt) affiché à la place de « gutt ». */
  brandName?: string;
}) {
  return (
    <DSProvider tokens={tokens}>
      <div className="scenario">
        <header className="scenario-head">
          <strong>{brandName ?? 'gutt'}</strong>
          {!brandName && <span className="ds-badge">Bordeaux</span>}
        </header>
        <Navigation />
        <main>
          <div className="section-label">AVANT DE SIGNER UN BAIL</div>
          <h1>
            Ne signe pas
            <br />à l’aveugle.
          </h1>
          <p>
            Compare tes logements et vérifie l’essentiel avant de t’engager.
          </p>
          {scenario === 'form' ? (
            <div className="ds-card">
              <h2>Ajouter un logement</h2>
              <AjoutLogementForm />
            </div>
          ) : (
            <div className="scenario-grid">
              <LogementCard />
              <VerificationCard />
            </div>
          )}
        </main>
        <footer>
          {brandName
            ? `${brandName} · écrans de test, données fictives`
            : 'Gutt · prototype PFE, données fictives'}
        </footer>
      </div>
    </DSProvider>
  );
}
