import type { Citation, SseEvent } from '@cdc/contracts';

export const CONVERSATION_ID = '3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607';
export const MESSAGE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

export const cit = (over: Partial<Citation> = {}): Citation => ({
  id: 1,
  chunkId: '0b0f2d3e-8a51-4e5e-9a3c-1f2d3e4a5b6c',
  lawSlug: 'cdc',
  law: 'CDC',
  path: 'Art. 49',
  content: 'Art. 49. O consumidor pode desistir do contrato, no prazo de 7 dias.',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
  ...over,
});

export function sseBody(events: SseEvent[]): string {
  return events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
}

export function streamOf(chunks: string[], delayMs = 0): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}
