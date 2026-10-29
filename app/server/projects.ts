import path from 'node:path';
import { promises as fs } from 'node:fs';
import { z } from 'zod';
import { atomicWrite, readPrivate } from './files.js';
import { StudioError } from './store.js';
import { tokensSchema, type Tokens } from '../shared/model.js';

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
// « Partir de zéro » : gris neutres, sans la couleur ni l'arrondi de Gutt.
// Contrastes AA vérifiés par le test projects.
const neutralValues: Record<string, string | number> = {
  'color.brand': '#3A3A3A',
  'color.brandHover': '#1F1F1F',
  'color.onBrand': '#FFFFFF',
  'color.surface': '#FFFFFF',
  'color.canvas': '#F5F5F5',
  'color.text': '#1A1A1A',
  'color.muted': '#5C5C5C',
  'color.border': '#8A8A8A',
  'color.danger': '#B42318',
  'color.success': '#1E7A46',
  'color.focus': '#2563EB',
  'radius.control': 8,
};
export function neutralTokens(seed: Tokens): Tokens {
  const next = structuredClone(seed) as Record<string, { $value: unknown }>;
  for (const [k, v] of Object.entries(neutralValues))
    if (next[k]) next[k].$value = v;
  return tokensSchema.parse(next);
}

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
  rename(id: string, name: string) {
    return this.update((r) => {
      const entry = r.projects.find((p) => p.id === id);
      if (!entry) throw new StudioError('Projet introuvable.', 404);
      entry.name = name.trim();
      return r;
    });
  }
  // Retire le projet de la liste et range son dossier dans
  // <données>/projets-supprimes/ : rien n'est effacé du disque.
  // Gutt (dossier d'origine) ne peut pas être retiré ; le serveur rouvre Gutt
  // avant de retirer le projet ouvert.
  async remove(id: string) {
    idSchema.parse(id);
    const r = await this.read();
    if (id === defaultProjectId)
      throw new StudioError('Le projet Gutt ne peut pas être supprimé.', 400);
    if (id === r.current)
      throw new StudioError(
        'Ouvre un autre projet avant de supprimer celui-ci.',
        409,
      );
    if (!r.projects.some((p) => p.id === id))
      throw new StudioError('Projet introuvable.', 404);
    const trash = path.join(this.dataDir, 'projets-supprimes');
    await fs.mkdir(trash, { recursive: true, mode: 0o700 });
    const target = path.join(trash, `${id}-${Date.now()}`);
    try {
      await fs.rename(this.dirFor(id), target);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    await this.update((cur) => ({
      ...cur,
      projects: cur.projects.filter((p) => p.id !== id),
    }));
    return target;
  }
}
