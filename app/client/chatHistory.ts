// Historique du chat, gardé dans ce navigateur (sur le Mac de l'étudiant).
// Relire une conversation ne coûte aucun token : seuls les 10 derniers
// messages de la conversation ouverte sont renvoyés à l'assistant.
export interface SavedChat<E> {
  id: string;
  agent: string;
  title: string;
  updated: number;
  entries: E[];
  /** Projet de l'atelier ; absent = conversations d'avant le multi-projets (Gutt). */
  project?: string;
}

const key = 'ds-studio-chats';
const maxChats = 30; // par projet
// Dernier projet ouvert dans ce navigateur, connu avant la réponse du serveur.
export const projectKey = 'ds-studio-project';
export function currentProject() {
  try {
    return localStorage.getItem(projectKey) || 'gutt';
  } catch {
    return 'gutt';
  }
}
const inProject = (c: { project?: string }, project: string) =>
  (c.project ?? 'gutt') === project;
const maxEntries = 300;

function readAll<E>(): SavedChat<E>[] {
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

export function readChats<E>(project = currentProject()): SavedChat<E>[] {
  return readAll<E>().filter((c) => inProject(c, project));
}

// Écrit les conversations du projet sans toucher à celles des autres projets.
export function writeChats<E>(
  list: SavedChat<E>[],
  project = currentProject(),
) {
  const trimmed = [...list]
    .sort((a, b) => b.updated - a.updated)
    .slice(0, maxChats)
    .map((c) => ({ ...c, project, entries: c.entries.slice(-maxEntries) }));
  try {
    const others = readAll<E>().filter((c) => !inProject(c, project));
    localStorage.setItem(key, JSON.stringify([...others, ...trimmed]));
  } catch {
    /* stockage plein ou indisponible : l'historique reste pour la session */
  }
  return trimmed;
}

export const chatTitle = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 60 ? `${t.slice(0, 57)}…` : t || 'Conversation';
};

// Projet supprimé : ses conversations partent avec lui.
export function dropChats(project: string) {
  try {
    const others = readAll().filter((c) => !inProject(c, project));
    localStorage.setItem(key, JSON.stringify(others));
  } catch {
    /* rien à effacer */
  }
}
