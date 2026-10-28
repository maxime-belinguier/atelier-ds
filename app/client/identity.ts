// Identité de l'atelier : nom et logo de l'en-tête et de l'onglet du
// navigateur. Préférence locale (ce navigateur), comme l'apparence.
export const identityKey = 'ds-studio-identity';
export const defaultName = 'DS-Studio';
// Image du logo : 200 Ko maximum, gardée en data URL dans ce navigateur.
export const maxLogoBytes = 200_000;

export interface Identity {
  name: string;
  logo: 'text' | 'initials' | 'image';
  text: string;
  /** Couleur du carré ; vide = couleur d'accent de l'atelier. */
  color: string;
  image: string;
}
export const defaultIdentity: Identity = {
  name: defaultName,
  logo: 'text',
  text: 'ds.',
  color: '',
  image: '',
};

const hex6 = /^#[0-9a-fA-F]{6}$/;
const dataImage = /^data:image\/(png|jpeg|webp|svg\+xml);base64,/;
export function readIdentity(): Identity {
  try {
    const t = JSON.parse(localStorage.getItem(identityKey) || '{}');
    return {
      name:
        typeof t.name === 'string' && t.name.trim()
          ? t.name.slice(0, 30)
          : defaultName,
      logo: ['text', 'initials', 'image'].includes(t.logo) ? t.logo : 'text',
      text: typeof t.text === 'string' ? t.text.slice(0, 3) : 'ds.',
      color: hex6.test(t.color) ? t.color : '',
      image:
        typeof t.image === 'string' && dataImage.test(t.image) ? t.image : '',
    };
  } catch {
    return defaultIdentity;
  }
}
export function saveIdentity(i: Identity) {
  try {
    localStorage.setItem(identityKey, JSON.stringify(i));
  } catch {
    /* stockage plein : l'identité vaut pour cette session */
  }
}
export const initialsOf = (name: string) =>
  name
    .split(/[\s\-_.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || 'DS';
// Ce qui s'affiche dans le carré : image, initiales ou texte court.
export const logoText = (i: Identity) =>
  i.logo === 'initials' ? initialsOf(i.name) : i.text.trim() || 'ds.';
