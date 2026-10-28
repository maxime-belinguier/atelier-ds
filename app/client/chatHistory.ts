// Historique du chat, gardé dans ce navigateur (sur le Mac de l'étudiant).
// Relire une conversation ne coûte aucun token : seuls les 10 derniers
// messages de la conversation ouverte sont renvoyés à l'assistant.
export interface SavedChat<E> {
  id: string;
  agent: string;
  title: string;
  updated: number;
  entries: E[];
}

const key = 'ds-studio-chats';
const maxChats = 30;
const maxEntries = 300;

export function readChats<E>(): SavedChat<E>[] {
  try {
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(list)
      ? list.filter(
          (c) =>
            c &&
            typeof c.id === 'string' &&
            typeof c.title === 'string' &&
            Array.isArray(c.entries),
        )
      : [];
  } catch {
    return [];
  }
}

export function writeChats<E>(list: SavedChat<E>[]) {
  const trimmed = [...list]
    .sort((a, b) => b.updated - a.updated)
    .slice(0, maxChats)
    .map((c) => ({ ...c, entries: c.entries.slice(-maxEntries) }));
  try {
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    /* stockage plein ou indisponible : l'historique reste pour la session */
  }
  return trimmed;
}

export const chatTitle = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 60 ? `${t.slice(0, 57)}…` : t || 'Conversation';
};
