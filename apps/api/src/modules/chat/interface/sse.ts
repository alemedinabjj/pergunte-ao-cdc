import type { SseEvent } from '@cdc/contracts';
import type { Response } from 'express';

export function openSseStream(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // nginx e outros proxies não devem segurar os tokens em buffer.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

export function writeSseEvent(res: Response, event: SseEvent): void {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}
