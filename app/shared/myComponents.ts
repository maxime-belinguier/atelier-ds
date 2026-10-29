import { z } from 'zod';

// Composants créés dans l'atelier, sans Claude : un modèle (bouton, carte,
// étiquette) habillé avec les tokens du projet. Ils suivent les tokens et ne
// partent pas vers Figma.
const colorKey = z.string().regex(/^color\.[A-Za-z][A-Za-z0-9]{0,39}$/);
export const myComponentSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,48}$/),
    name: z.string().trim().min(1, 'Nom du composant requis.').max(40),
    kind: z.enum(['button', 'card', 'tag']),
    text: z.string().trim().min(1, 'Texte requis.').max(80),
    sub: z.string().trim().max(160).default(''),
    bg: colorKey,
    fg: colorKey,
    border: z.union([z.literal(''), colorKey]).default(''),
    shape: z.enum(['control', 'pill', 'square']).default('control'),
  })
  .strict();
export type MyComponent = z.infer<typeof myComponentSchema>;
export const myComponentsSchema = z
  .array(myComponentSchema)
  .max(40, '40 composants maximum.');

export const kindLabels: Record<MyComponent['kind'], string> = {
  button: 'Bouton',
  card: 'Carte',
  tag: 'Étiquette',
};
