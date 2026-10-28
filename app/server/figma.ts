import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicWrite, readPrivate } from './files.js';
import { Store, StudioError } from './store.js';
import { ProjectStore } from './project.js';
import {
  figmaToChanges,
  fileKeyFromUrl,
  planPush,
  type FigmaRead,
  type PushPlan,
} from '../../connectors/figma/scripts.js';
import type { FigmaStatus } from '../../connectors/figma/claudeFigma.js';

export interface FigmaConnector {
  status(): Promise<FigmaStatus>;
  read(fileKey: string, signal?: AbortSignal): Promise<FigmaRead>;
  write(
    fileKey: string,
    plan: PushPlan,
    signal?: AbortSignal,
  ): Promise<{
    written: number;
    created: number;
    verified: boolean;
    mismatches: string[];
  }>;
}

export interface FigmaSnapshot extends FigmaRead {
  fileKey: string;
  readAt: string;
}

interface Approval {
  id: string;
  revision: number;
  fileKey: string;
  plan: PushPlan;
  expires: number;
}

// Synchro Figma : lecture → diff à valider dans l'atelier ; écriture →
// aperçu, validation à usage unique liée à la révision et au fichier, relecture.
export class FigmaSync {
  private approvals = new Map<string, Approval>();
  private file: string;
  constructor(
    private store: Store,
    private project: ProjectStore,
    private connector: FigmaConnector,
    directory: string,
  ) {
    this.file = path.join(directory, 'figma.json');
  }

  async fileKey() {
    const url = (await this.project.read()).project.figmaUrl;
    return { url, key: url ? fileKeyFromUrl(url) : null };
  }

  private async requireKey() {
    const { key } = await this.fileKey();
    if (!key)
      throw new StudioError(
        'Figma : ajoute le lien de ton fichier Figma dans le Brief du projet.',
      );
    return key;
  }

  async snapshot(): Promise<FigmaSnapshot | null> {
    try {
      const raw = await readPrivate(this.file, 500_000);
      const value = JSON.parse(raw) as FigmaSnapshot;
      return Array.isArray(value.variables) ? value : null;
    } catch {
      return null;
    }
  }

  private async save(fileKey: string, read: FigmaRead) {
    const snap: FigmaSnapshot = {
      fileKey,
      readAt: new Date().toISOString(),
      ...read,
    };
    await atomicWrite(this.file, JSON.stringify(snap, null, 2) + '\n');
    return snap;
  }

  async status() {
    const [status, file, snap] = await Promise.all([
      this.connector.status(),
      this.fileKey(),
      this.snapshot(),
    ]);
    return {
      ...status,
      fileUrl: file.url,
      fileKey: file.key,
      snapshot: snap
        ? {
            readAt: snap.readAt,
            count: snap.variables.length,
            sameFile: snap.fileKey === file.key,
          }
        : null,
    };
  }

  // Figma → atelier : proposition ordinaire, validée dans le diff habituel.
  async pull(revision: number, signal?: AbortSignal) {
    const key = await this.requireKey();
    const read = await this.connector.read(key, signal);
    await this.save(key, read);
    const tokens = this.store.snapshot().tokens;
    const { changes, ignored } = figmaToChanges(read, tokens);
    const useful = changes.filter(
      (c) => (tokens[c.key]?.$value ?? null) !== c.value,
    );
    if (!read.collection)
      return {
        proposal: null,
        ignored,
        message:
          'Aucune collection « DS-Studio » dans ce fichier. Utilise « Envoyer vers Figma » pour la créer.',
      };
    if (!useful.length)
      return {
        proposal: null,
        ignored,
        message: `Figma et l’atelier sont alignés (${read.variables.length} variables lues).`,
      };
    return {
      proposal: this.store.proposeFigma(revision, useful),
      ignored,
      message: '',
    };
  }

  // Atelier → Figma, étape 1 : lecture fraîche et aperçu des écritures.
  async preview(revision: number, signal?: AbortSignal) {
    if (revision !== this.store.snapshot().revision)
      throw new StudioError(
        'Le Design System a changé. Rechargez puis recommencez.',
        409,
      );
    const key = await this.requireKey();
    const read = await this.connector.read(key, signal);
    await this.save(key, read);
    const plan = planPush(this.store.snapshot().tokens, read);
    if (!plan.items.length)
      return {
        approvalId: null,
        patches: [],
        message: 'Figma a déjà toutes les valeurs enregistrées de l’atelier.',
      };
    for (const [id, a] of this.approvals)
      if (a.expires < Date.now()) this.approvals.delete(id);
    const approval: Approval = {
      id: randomUUID(),
      revision,
      fileKey: key,
      plan,
      expires: Date.now() + 10 * 60_000,
    };
    this.approvals.set(approval.id, approval);
    return {
      approvalId: approval.id,
      patches: plan.patches,
      collection: read.collection,
      message: '',
    };
  }

  // Étape 2 : validation à usage unique, puis écriture contrôlée et relecture.
  async apply(approvalId: string, signal?: AbortSignal) {
    const approval = this.approvals.get(approvalId);
    this.approvals.delete(approvalId);
    if (!approval || approval.expires < Date.now())
      throw new StudioError(
        'Validation Figma inconnue, expirée ou déjà utilisée. Refais l’aperçu.',
        404,
      );
    if (approval.revision !== this.store.snapshot().revision)
      throw new StudioError(
        'Le Design System a changé depuis l’aperçu. Refais « Envoyer vers Figma ».',
        409,
      );
    if (approval.fileKey !== (await this.fileKey()).key)
      throw new StudioError(
        'Le fichier Figma du Brief a changé depuis l’aperçu. Refais l’aperçu.',
        409,
      );
    const result = await this.connector.write(
      approval.fileKey,
      approval.plan,
      signal,
    );
    // Instantané mis à jour avec les valeurs relues.
    const snap = await this.snapshot();
    if (snap && snap.fileKey === approval.fileKey) {
      const byName = new Map(snap.variables.map((v) => [v.name, v]));
      for (const item of approval.plan.items)
        byName.set(item.name, {
          name: item.name,
          type: item.type,
          value: item.value,
        });
      await this.save(approval.fileKey, {
        collection: snap.collection ?? 'DS-Studio',
        variables: [...byName.values()],
      });
    }
    return result;
  }
}
