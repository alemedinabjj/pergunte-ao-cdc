import type { SseEvent } from '@cdc/contracts';
import { describe, expect, it, vi } from 'vitest';
import { streamOf } from '../../../test/fixtures';
import { readSseStream } from './read-sse-stream';

describe('readSseStream', () => {
  it('parses events split across chunks', async () => {
    const events: SseEvent[] = [];
    await readSseStream(
      streamOf(['event: token\ndata: {"type":"tok', 'en","text":"a"}\n\n']),
      (e) => events.push(e),
    );
    expect(events).toEqual([{ type: 'token', text: 'a' }]);
  });

  it('skips events that fail the contract', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const events: SseEvent[] = [];
    await readSseStream(streamOf(['data: {"type":"ping"}\n\n']), (e) => events.push(e));
    expect(events).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('readSseStream with an abort signal', () => {
  it('stops delivering events after abort', async () => {
    const controller = new AbortController();
    const events: SseEvent[] = [];
    await readSseStream(
      streamOf(
        ['data: {"type":"token","text":"a"}\n\n', 'data: {"type":"token","text":"b"}\n\n'],
        30,
      ),
      (e) => {
        events.push(e);
        controller.abort();
      },
      controller.signal,
    );
    expect(events).toEqual([{ type: 'token', text: 'a' }]);
  });
});
