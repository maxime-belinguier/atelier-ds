import path from 'node:path';
import {
  myComponentsSchema,
  type MyComponent,
} from '../shared/myComponents.js';
import { atomicWrite, readPrivate } from './files.js';
import { StudioError } from './store.js';

// Composants créés dans l'atelier : un fichier par projet, liste complète
// réécrite à chaque enregistrement (petite taille, 40 au plus).
export class MyComponentsStore {
  private queue: Promise<unknown> = Promise.resolve();
  private file: string;
  constructor(directory: string) {
    this.file = path.join(directory, 'components.json');
  }
  async read(): Promise<MyComponent[]> {
    try {
      return myComponentsSchema.parse(
        JSON.parse(await readPrivate(this.file, 64_000)),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new StudioError(
        'Composants créés illisibles. Fichier préservé ; le reste de l’atelier marche.',
        500,
      );
    }
  }
  save(components: MyComponent[]) {
    const work = this.queue.then(async () => {
      const ids = new Set(components.map((c) => c.id));
      if (ids.size !== components.length)
        throw new StudioError('Deux composants ont le même identifiant.', 400);
      const valid = myComponentsSchema.parse(components);
      await atomicWrite(this.file, JSON.stringify(valid, null, 2) + '\n');
      return this.read();
    });
    this.queue = work.catch(() => {});
    return work;
  }
}
