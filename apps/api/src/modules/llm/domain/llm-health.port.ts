export const LLM_HEALTH = Symbol('LLM_HEALTH');

/** Saúde dos provedores de IA em uso. `ping` nunca lança. */
export interface LlmHealth {
  ping(): Promise<boolean>;
  /** Mensagem acionável para quando `ping` falha. */
  readonly unavailableMessage: string;
}
