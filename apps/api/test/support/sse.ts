import { type SseEvent, sseEventSchema } from '@cdc/contracts';

/** Lê um corpo SSE completo ("event: x\ndata: {...}\n\n") e devolve os eventos validados. */
export function parseSseBody(text: string): SseEvent[] {
  return text
    .split('\n\n')
    .map((block) => block.split('\n').find((line) => line.startsWith('data: ')))
    .filter((line): line is string => line !== undefined)
    .map((line) => sseEventSchema.parse(JSON.parse(line.slice('data: '.length))));
}
