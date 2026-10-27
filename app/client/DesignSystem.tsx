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
}: {
  variant?: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`ds-button ${variant}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// Fiche d'un logement comparé par l'utilisateur.
export function LogementCard() {
  const [kept, setKept] = useState(false);
  return (
    <article className="ds-card">
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
export function VerificationCard() {
  const [done, setDone] = useState<boolean[]>([
    true,
    true,
    false,
    false,
    false,
  ]);
  const count = done.filter(Boolean).length;
  return (
    <article className="ds-card">
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
      <button className="ds-button primary" type="submit">
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
    <nav aria-label="Navigation du scénario" className="ds-nav">
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
export const components: {
  id: string;
  label: string;
  description: string;
  tokens: TokenKey[];
  render: () => ReactNode;
}[] = [
  {
    id: 'buttons',
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
  },
  {
    id: 'logement',
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
  },
  {
    id: 'verification',
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
  },
  {
    id: 'form',
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
  },
  {
    id: 'nav',
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
}: {
  tokens: Tokens;
  scenario: string;
}) {
  return (
    <DSProvider tokens={tokens}>
      <div className="scenario">
        <header className="scenario-head">
          <strong>gutt</strong>
          <span className="ds-badge">Bordeaux</span>
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
        <footer>Gutt · prototype PFE, données fictives</footer>
      </div>
    </DSProvider>
  );
}
