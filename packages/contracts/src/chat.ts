import { z } from 'zod';
import { lawSlugSchema } from './laws';

export const chatRequestSchema = z.object({
  conversationId: z.uuid().optional(),
  question: z.string().trim().min(3).max(1000),
  lawSlug: lawSlugSchema.optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** `id` é o número que o modelo usa para citar a fonte no texto, como em [1]. */
export const citationSchema = z.object({
  id: z.number().int().min(1),
  chunkId: z.uuid(),
  lawSlug: lawSlugSchema,
  law: z.string(),
  path: z.string(),
  content: z.string(),
  sourceUrl: z.url(),
});
export type Citation = z.infer<typeof citationSchema>;

export const sseErrorCodeSchema = z.enum(['LLM_UNAVAILABLE', 'LLM_FAILED', 'TIMEOUT', 'INTERNAL']);
export type SseErrorCode = z.infer<typeof sseErrorCodeSchema>;

export const sseEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('meta'), conversationId: z.uuid(), messageId: z.uuid() }),
  z.object({ type: z.literal('citations'), items: z.array(citationSchema) }),
  z.object({ type: z.literal('token'), text: z.string() }),
  z.object({
    type: z.literal('done'),
    citedIds: z.array(z.number().int()),
    model: z.string().nullable(),
    latencyMs: z.number().int().min(0),
  }),
  z.object({ type: z.literal('error'), code: sseErrorCodeSchema, message: z.string() }),
]);
export type SseEvent = z.infer<typeof sseEventSchema>;
export type SseEventType = SseEvent['type'];
