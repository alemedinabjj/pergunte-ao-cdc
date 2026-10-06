import type { ChatMessage, LlmRequest } from '../../llm/domain/llm-client.port';

const SYSTEM =
  'Reescreva a última pergunta do usuário como uma pergunta completa e independente, que possa ser entendida sem o histórico da conversa. Mantenha o sentido original e os termos jurídicos usados. Responda apenas com a pergunta reescrita, sem explicações.';

const ASSISTANT_MAX = 500;
const QUESTION_MAX = 1000;

function render(message: ChatMessage): string {
  if (message.role === 'user') return `Usuário: ${message.content}`;
  const content =
    message.content.length > ASSISTANT_MAX
      ? `${message.content.slice(0, ASSISTANT_MAX)}…`
      : message.content;
  return `Assistente: ${content}`;
}

/** "e se for online?" vira uma pergunta que a busca entende sozinha. */
export function buildRewritePrompt(history: ChatMessage[], question: string): LlmRequest {
  return {
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Histórico:\n${history.map(render).join('\n')}\n\nÚltima pergunta: ${question}`,
      },
    ],
    temperature: 0,
    maxTokens: 120,
  };
}

export function sanitizeRewrite(output: string, original: string): string {
  const cleaned = output
    .trim()
    .replace(/^["“'](.*)["”']$/s, '$1')
    .trim();
  return cleaned && cleaned.length <= QUESTION_MAX ? cleaned : original;
}
