import { type SseEvent, sseEventSchema } from '@cdc/contracts';
import { createParser } from 'eventsource-parser';

/** Lê o corpo de uma resposta SSE (POST via fetch) e entrega cada evento já validado. */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const parser = createParser({
    onEvent(message) {
      if (signal?.aborted) return;
      const parsed = sseEventSchema.safeParse(JSON.parse(message.data));
      if (parsed.success) onEvent(parsed.data);
      else console.warn('Evento SSE fora do contrato ignorado', message.data);
    },
  });
  const decoder = new TextDecoder();
  const reader = body.getReader();
  // Nem todo ambiente rejeita o read() quando o fetch é abortado; cancelar garante o fim do loop.
  signal?.addEventListener('abort', () => void reader.cancel(), { once: true });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }
}
