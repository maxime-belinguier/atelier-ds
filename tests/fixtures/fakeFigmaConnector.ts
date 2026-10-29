import type { FigmaConnector } from '../../app/server/figma.js';
import type { FigmaVariable } from '../../connectors/figma/scripts.js';
import type { FigmaComponent } from '../../app/shared/figmaComponents.js';

// Un composant d'exemple, lié aux variables comme dans un vrai fichier.
export const sampleComponent: FigmaComponent = {
  id: '40:50',
  name: 'Tag',
  page: 'Components',
  desc: 'Étiquette de statut.',
  variants: [
    {
      id: '40:49',
      name: 'Type=Alerte',
      root: {
        t: 'COMPONENT',
        n: 'Type=Alerte',
        w: 80,
        h: 27,
        f: { c: '#B4233E', v: 'color/danger' },
        l: 'H',
        p: [5, 10, 5, 10],
        ai: 'CENTER',
        aj: 'CENTER',
        sh: 'H',
        sv: 'H',
        r: 20,
        k: [
          {
            t: 'TEXT',
            n: 'Libellé',
            f: { c: '#FFFFFF', v: 'color/onBrand' },
            sh: 'H',
            sv: 'H',
            tx: 'Red flag',
            fs: 12,
          },
        ],
      },
    },
  ],
};

// Connecteur Figma simulé en mémoire : tests et parcours navigateur, jamais
// de CLI, de réseau ni de quota. Il applique le même contrôle des valeurs
// attendues que le script réel.
export function fakeFigmaConnector(
  initial: FigmaVariable[] = [],
  components: FigmaComponent[] = [],
) {
  const variables = new Map(initial.map((v) => [v.name, { ...v }]));
  let exists = initial.length > 0;
  const calls: string[] = [];
  const connector: FigmaConnector = {
    async status() {
      return { state: 'connected', detail: 'Figma simulé (tests).' };
    },
    async read(fileKey, _signal, withComponents) {
      calls.push(`read:${fileKey}`);
      return {
        collection: exists ? 'DS-Studio' : null,
        variables: [...variables.values()].map((v) => ({ ...v })),
        ...(withComponents ? { components: structuredClone(components) } : {}),
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
  return { connector, variables, components, calls };
}
