import {
  type ConversationDetail,
  type ConversationSummary,
  conversationDetailSchema,
  conversationSummarySchema,
  errorResponseSchema,
  type Health,
  healthSchema,
  type Law,
  lawSchema,
} from '@cdc/contracts';
import { type ZodType, z } from 'zod';

export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Resolve contra a origem da página: funciona no browser (proxy do Vite/nginx) e nos testes. */
export function apiUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

export async function toApiError(response: Response): Promise<ApiError> {
  const body = errorResponseSchema.safeParse(await response.json().catch(() => null));
  return body.success
    ? new ApiError(response.status, body.data.code, body.data.message)
    : new ApiError(response.status, 'HTTP_ERROR', `A API respondeu ${response.status}.`);
}

async function request<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
  if (!response.ok) throw await toApiError(response);
  return schema.parse(await response.json());
}

export const api = {
  laws: (): Promise<Law[]> => request('/api/laws', z.array(lawSchema)),
  conversations: (): Promise<ConversationSummary[]> =>
    request('/api/conversations', z.array(conversationSummarySchema)),
  conversation: (id: string): Promise<ConversationDetail> =>
    request(`/api/conversations/${id}`, conversationDetailSchema),
  async deleteConversation(id: string): Promise<void> {
    const response = await fetch(apiUrl(`/api/conversations/${id}`), { method: 'DELETE' });
    if (!response.ok) throw await toApiError(response);
  },
  health: (): Promise<Health> => request('/api/health', healthSchema),
};
