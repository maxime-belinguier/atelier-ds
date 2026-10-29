import type { State, Proposal, Tokens } from '../shared/model.js';
export interface Bootstrap {
  csrf: string;
  project: string;
  figma: { label: string; connected: boolean };
  agents: { id: string; available: boolean; detail: string }[];
}
let csrf = '';
let projectId = '';
export async function request<T>(
  url: string,
  body?: unknown,
  signal?: AbortSignal,
  retrySession = true,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${url}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers:
        body === undefined
          ? {}
          : {
              'Content-Type': 'application/json',
              'X-DS-Studio': csrf,
              ...(projectId ? { 'X-DS-Project': projectId } : {}),
            },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(
      'Serveur local inaccessible. Relance DS-Studio depuis son panneau. Ta dernière validation reste sur disque.',
    );
  }
  const result = await response.json();
  if (
    response.status === 403 &&
    body !== undefined &&
    retrySession &&
    result.error?.startsWith('Validation de session manquante')
  ) {
    await bootstrap();
    return request<T>(url, body, signal, false);
  }
  if (!response.ok)
    throw new Error(result.error ?? 'Le serveur ne répond pas.');
  return result;
}
export async function bootstrap() {
  const b = await request<Bootstrap>('bootstrap');
  csrf = b.csrf;
  projectId = b.project;
  return b;
}
export interface ProjectEntry {
  id: string;
  name: string;
  opened: number;
  /** Couleur de marque du projet, pour le reconnaître dans le menu. */
  brand: string;
}
export interface Palette {
  colors: string[];
  radius: number;
}
export interface ProjectList {
  current: string;
  projects: ProjectEntry[];
  /** Aperçu des tokens de base (« Partir de zéro »). */
  base: Palette;
}
export const listProjects = () => request<ProjectList>('projects');
export const openProject = (id: string) =>
  request<ProjectList>('projects/open', { id });
export const createProject = (name: string, from: 'neutre' | 'copie') =>
  request<ProjectList>('projects/create', { name, from });
export const renameProject = (id: string, name: string) =>
  request<ProjectList>('projects/rename', { id, name });
export const deleteProject = (id: string) =>
  request<ProjectList>('projects/delete', { id });
// Signale aux autres vues (menu de projet) que la liste a changé.
export const projectsChanged = 'ds-studio-projects-changed';
export const getState = () => request<State>('state');
export const commit = (proposal: Proposal) =>
  request<State>('commit', { id: proposal.id });
export async function exportTokens() {
  const tokens = await request<Tokens>('export');
  downloadText(
    'design-system.tokens.json',
    JSON.stringify(tokens, null, 2) + '\n',
    'application/json',
  );
}
export function downloadText(
  name: string,
  text: string,
  type = 'text/markdown',
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
