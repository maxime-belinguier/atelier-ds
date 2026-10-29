import { z } from 'zod';

// Ce sous-ensemble explicite utilise les noms $type/$value, pas toute la norme DTCG.
const color = z
  .object({
    $type: z.literal('color'),
    $value: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur attendue : #RRGGBB'),
  })
  .strict();
const dimension = z
  .object({
    $type: z.literal('dimension'),
    $value: z.number().finite().min(0).max(128),
  })
  .strict();
const font = z
  .object({
    $type: z.literal('fontFamily'),
    $value: z.enum(['system-ui', 'Arial', 'Georgia', 'Verdana']),
  })
  .strict();
const coreShape = {
  'color.brand': color,
  'color.brandHover': color,
  'color.onBrand': color,
  'color.surface': color,
  'color.canvas': color,
  'color.text': color,
  'color.muted': color,
  'color.border': color,
  'color.danger': color,
  'color.success': color,
  'color.focus': color,
  'font.family': font,
  'font.body': dimension,
  'font.heading': dimension,
  'space.sm': dimension,
  'space.md': dimension,
  'space.lg': dimension,
  'radius.control': dimension,
};
// Les 18 tokens de base restent obligatoires : les composants s'appuient dessus.
// Des tokens ajoutés (par Claude, Figma ou à la main) peuvent compléter le DS,
// avec un préfixe connu qui fixe leur type. Ajout compatible avec la version 1 :
// un ancien fichier reste valide tel quel.
export const customKeyPattern =
  /^(color|space|radius|size|font)\.[a-z][a-zA-Z0-9]{0,31}$/;
export const maxCustomTokens = 60;
export type CoreKey = keyof typeof coreShape;
export const coreKeys = Object.keys(coreShape) as CoreKey[];
export const isCoreKey = (key: string): key is CoreKey =>
  Object.hasOwn(coreShape, key);
export const isCustomKey = (key: string) =>
  !isCoreKey(key) && customKeyPattern.test(key);
export const customType = (key: string): 'color' | 'dimension' =>
  key.startsWith('color.') ? 'color' : 'dimension';
const anyToken = z.union([color, dimension, font]);
// Base facultative : un projet libre (« Partir de zéro ») commence sans token.
export const tokensSchema = z
  .object(coreShape)
  .partial()
  .catchall(anyToken)
  .superRefine((tokens, ctx) => {
    const extra = Object.keys(tokens).filter((k) => !isCoreKey(k));
    if (extra.length > maxCustomTokens)
      ctx.addIssue({
        code: 'custom',
        message: `Au plus ${maxCustomTokens} tokens ajoutés.`,
      });
    for (const k of extra) {
      if (!customKeyPattern.test(k))
        ctx.addIssue({
          code: 'custom',
          path: [k],
          message:
            'Nom de token refusé : color., space., radius., size. ou font. puis un nom en camelCase.',
        });
      else if (tokens[k].$type !== customType(k))
        ctx.addIssue({
          code: 'custom',
          path: [k],
          message: `Type attendu pour ${k} : ${customType(k)}.`,
        });
    }
  });
export type AnyToken = z.infer<typeof anyToken>;
export type Tokens = z.infer<typeof tokensSchema>;
// Clé d'un token : un des 18 de base ou un token ajouté.
export type TokenKey = string;
// Compatibilité : la liste fixe des tokens de base.
export const tokenKeys = coreKeys;
// Tous les tokens présents : base dans l'ordre du schéma, puis ajoutés triés.
export function allKeys(tokens: Tokens): string[] {
  return [
    ...coreKeys.filter((k) => tokens[k]),
    ...Object.keys(tokens)
      .filter((k) => !isCoreKey(k))
      .sort(),
  ];
}
export type TokenValue = string | number;
const keySchema = z
  .string()
  .max(40)
  .refine((k) => isCoreKey(k) || customKeyPattern.test(k), {
    message:
      'Nom de token inconnu. Un nouveau token commence par color., space., radius., size. ou font.',
  });
// value null : suppression d'un token ajouté (jamais d'un token de base).
export const changeSchema = z
  .object({
    key: keySchema,
    value: z.union([z.string().max(100), z.number().finite(), z.null()]),
  })
  .strict();
export type Change = z.infer<typeof changeSchema>;
export const proposeSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    changes: z.array(changeSchema).min(1).max(50),
  })
  .strict();
export interface Patch {
  key: TokenKey;
  // null : le token n'existait pas (avant) ou est supprimé (après).
  before: TokenValue | null;
  after: TokenValue | null;
}
export type Source =
  'manual' | 'codex' | 'claude' | 'import' | 'undo' | 'figma';
export const sources = [
  'manual',
  'codex',
  'claude',
  'import',
  'undo',
  'figma',
] as const;
export interface Revision {
  id: string;
  revision: number;
  date: string;
  source: Source;
  patches: Patch[];
}
export interface State {
  version: 1;
  revision: number;
  tokens: Tokens;
  history: Revision[];
}
export interface Proposal {
  id: string;
  revision: number;
  source: Revision['source'];
  patches: Patch[];
}
export const patchSchema = z
  .object({
    key: keySchema,
    before: z.union([z.string(), z.number(), z.null()]),
    after: z.union([z.string(), z.number(), z.null()]),
  })
  .strict();
export const stateSchema = z
  .object({
    version: z.literal(1),
    revision: z.number().int().nonnegative(),
    tokens: tokensSchema,
    history: z.array(
      z
        .object({
          id: z.string().uuid(),
          revision: z.number().int().positive(),
          date: z.string().datetime(),
          source: z.enum(sources),
          patches: z.array(patchSchema).min(1),
        })
        .strict(),
    ),
  })
  .strict();
export const agentReplySchema = z
  .object({
    message: z.string().max(12000),
    changes: z.array(changeSchema).max(20),
  })
  .strict();
export type AgentReply = z.infer<typeof agentReplySchema>;
export function applyChanges(
  tokens: Tokens,
  changes: { key: TokenKey; value: TokenValue | null }[],
): Tokens {
  const next = structuredClone(tokens) as Record<string, AnyToken>;
  if (new Set(changes.map((c) => c.key)).size !== changes.length)
    throw new Error('Un token ne peut apparaître deux fois.');
  for (const change of changes) {
    const { key, value } = change;
    if (value === null) {
      if (isCoreKey(key))
        throw new Error(`Le token de base ${key} ne peut pas être supprimé.`);
      delete next[key];
    } else if (Object.hasOwn(next, key)) next[key].$value = value as never;
    // Token de base absent (projet libre) ou token ajouté : création.
    else if (isCustomKey(key) || isCoreKey(key))
      next[key] = { $type: customType(key), $value: value } as AnyToken;
    else throw new Error(`Token inconnu : ${key}`);
  }
  return tokensSchema.parse(next);
}
const valueOf = (tokens: Tokens, key: string): TokenValue | null =>
  (tokens as Record<string, AnyToken>)[key]?.$value ?? null;
export function diff(before: Tokens, after: Tokens): Patch[] {
  const keys = [...new Set([...allKeys(before), ...allKeys(after)])];
  return keys
    .filter((key) => valueOf(before, key) !== valueOf(after, key))
    .map((key) => ({
      key,
      before: valueOf(before, key),
      after: valueOf(after, key),
    }));
}
export function tokenCss(tokens: Tokens): Record<string, string> {
  return Object.fromEntries(
    allKeys(tokens).map((key) => [
      `--${key.replaceAll('.', '-')}`,
      `${tokens[key].$value}${tokens[key].$type === 'dimension' ? 'px' : ''}`,
    ]),
  );
}
export function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const rgb = hex
      .slice(1)
      .match(/../g)!
      .map((x) => parseInt(x, 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
