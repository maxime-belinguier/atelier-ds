import path from 'node:path';
import { promises as fs } from 'node:fs';
import { z } from 'zod';
import { atomicWrite, readPrivate } from './files.js';
import { StudioError } from './store.js';

// Liste des projets de l'atelier. Le projet historique (Gutt) garde le
// dossier de données d'origine : aucune migration, rien n'est déplacé.
// Les nouveaux projets vivent dans <données>/projets/<id>/.
export const defaultProjectId = 'gutt';
const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const entrySchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(60),
    opened: z.number().int().nonnegative(),
  })
  .strict();
const registrySchema = z
  .object({ current: idSchema, projects: z.array(entrySchema).max(100) })
  .strict();
export type ProjectEntry = z.infer<typeof entrySchema>;
export type Registry = z.infer<typeof registrySchema>;
export const newProjectSchema = z
  .object({
    name: z.string().trim().min(1, 'Nom du projet requis.').max(60),
    from: z.enum(['neutre', 'copie']),
  })
  .strict();

export function slug(name: string) {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'projet'
  );
}

export class Projects {
  readonly file: string;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly dataDir: string) {
    this.file = path.join(dataDir, 'projets.json');
  }
  dirFor(id: string) {
    idSchema.parse(id);
    return id === defaultProjectId
      ? this.dataDir
      : path.join(this.dataDir, 'projets', id);
  }
  async read(): Promise<Registry> {
    try {
      return registrySchema.parse(JSON.parse(await readPrivate(this.file)));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new StudioError(
          'projets.json invalide ou inaccessible : original préservé.',
          500,
        );
      return {
        current: defaultProjectId,
        projects: [{ id: defaultProjectId, name: 'Gutt (PFE)', opened: 0 }],
      };
    }
  }
  private update(work: (r: Registry) => Promise<Registry> | Registry) {
    const run = this.queue.then(async () => {
      const next = registrySchema.parse(await work(await this.read()));
      await atomicWrite(this.file, JSON.stringify(next, null, 2) + '\n');
      return next;
    });
    this.queue = run.catch(() => {});
    return run;
  }
  open(id: string) {
    return this.update((r) => {
      const entry = r.projects.find((p) => p.id === id);
      if (!entry) throw new StudioError('Projet introuvable.', 404);
      // Date de dernière utilisation : le projet qu'on quitte et celui qu'on ouvre.
      const now = Date.now();
      const leaving = r.projects.find((p) => p.id === r.current);
      if (leaving) leaving.opened = now;
      entry.opened = now;
      return { ...r, current: id };
    });
  }
  // Crée le dossier du projet et l'ajoute à la liste, sans l'ouvrir.
  async create(name: string) {
    const r = await this.read();
    if (r.projects.length >= 100)
      throw new StudioError('100 projets maximum.', 400);
    const base = slug(name);
    let id = base;
    for (
      let n = 2;
      r.projects.some((p) => p.id === id) || id === defaultProjectId;
      n++
    )
      id = `${base}-${n}`;
    const dir = this.dirFor(id);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    if ((await fs.lstat(dir)).isSymbolicLink())
      throw new StudioError('Dossier de projet symbolique refusé.', 500);
    await this.update((cur) => ({
      ...cur,
      projects: [...cur.projects, { id, name: name.trim(), opened: 0 }],
    }));
    return id;
  }
}
