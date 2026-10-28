import type { FigmaConnector } from '../../app/server/figma.js';
import type { FigmaVariable } from '../../connectors/figma/scripts.js';

// Connecteur Figma simulé en mémoire : tests et parcours navigateur, jamais
// de CLI, de réseau ni de quota. Il applique le même contrôle des valeurs
// attendues que le script réel.
export function fakeFigmaConnector(initial: FigmaVariable[] = []) {
  const variables = new Map(initial.map((v) => [v.name, { ...v }]));
  let exists = initial.length > 0;
  const calls: string[] = [];
  const connector: FigmaConnector = {
    async status() {
      return { state: 'connected', detail: 'Figma simulé (tests).' };
    },
    async read(fileKey) {
      calls.push(`read:${fileKey}`);
      return {
        collection: exists ? 'DS-Studio' : null,
        variables: [...variables.values()].map((v) => ({ ...v })),
      };
    },
    async write(fileKey, plan) {
      calls.push(`write:${fileKey}`);
      for (const item of plan.items) {
        const now = variables.get(item.name)?.value ?? null;
        if (now !== plan.expected[item.name])
          throw new Error(
            'Figma a changé depuis l’aperçu. Rien n’a été écrit.',
          );
      }
      let created = 0;
      for (const item of plan.items) {
        if (!variables.has(item.name)) created++;
        variables.set(item.name, {
          name: item.name,
          type: item.type,
          value: item.value,
        });
      }
      exists = true;
      return {
        written: plan.items.length,
        created,
        verified: true,
        mismatches: [],
      };
    },
  };
  return { connector, variables, calls };
}
