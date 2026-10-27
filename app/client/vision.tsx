// Simulation des déficiences de la vision des couleurs dans l'aperçu.
// Matrices de Machado, Oliveira et Fernandes (2009), sévérité maximale,
// appliquées en RGB linéaire (valeur par défaut de feColorMatrix).
// Simple loupe de vérification : rien n'est enregistré.

export const visions = [
  { id: 'none', label: 'Normale', hint: 'Vision des couleurs habituelle.' },
  {
    id: 'deuteranopia',
    label: 'Deutéranopie',
    hint: 'Rouge et vert confondus. La plus fréquente, environ 5 % des hommes.',
  },
  {
    id: 'protanopia',
    label: 'Protanopie',
    hint: 'Rouge et vert confondus, rouges plus sombres.',
  },
  {
    id: 'tritanopia',
    label: 'Tritanopie',
    hint: 'Bleu et jaune confondus. Rare.',
  },
  {
    id: 'achromatopsia',
    label: 'Sans couleur',
    hint: 'Niveaux de gris : seuls les contrastes de luminosité restent.',
  },
] as const;
export type Vision = (typeof visions)[number]['id'];

const matrices: Record<string, string> = {
  protanopia:
    '0.152286 1.052583 -0.204868 0 0 0.114503 0.786281 0.099216 0 0 -0.003882 -0.048116 1.051998 0 0 0 0 0 1 0',
  deuteranopia:
    '0.367322 0.860646 -0.227968 0 0 0.280085 0.672501 0.047413 0 0 -0.011820 0.042940 0.968881 0 0 0 0 0 1 0',
  tritanopia:
    '1.255528 -0.076749 -0.178779 0 0 -0.078411 0.930809 0.147602 0 0 0.004733 0.691367 0.303900 0 0 0 0 0 1 0',
};

export function visionFilter(v: Vision) {
  if (v === 'none') return undefined;
  if (v === 'achromatopsia') return 'grayscale(1)';
  return `url(#cvd-${v})`;
}

export function VisionFilters() {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: 'absolute' }}
    >
      {Object.entries(matrices).map(([id, values]) => (
        <filter key={id} id={`cvd-${id}`}>
          <feColorMatrix type="matrix" values={values} />
        </filter>
      ))}
    </svg>
  );
}
