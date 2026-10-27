import type { AgentReply, Tokens } from '../../app/shared/model.js';
export interface AgentContext {
  tokens: Tokens;
  brief: string;
  rules: string;
  history: { role: 'user' | 'assistant'; text: string }[];
}
// Choix proposés à l'utilisateur. Liste fermée : aucune valeur libre ne
// rejoint les arguments du CLI.
export const claudeModels = ['sonnet', 'opus', 'haiku'] as const;
export const claudeEfforts = ['low', 'medium', 'high', 'xhigh'] as const;
export interface AgentOptions {
  model?: (typeof claudeModels)[number];
  effort?: (typeof claudeEfforts)[number];
}
export interface AgentUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}
export interface AgentAdapter {
  id: string;
  status(): Promise<{ available: boolean; detail: string }>;
  reply(
    message: string,
    context: AgentContext,
    signal?: AbortSignal,
    options?: AgentOptions,
  ): Promise<AgentReply & { usage?: AgentUsage }>;
}
