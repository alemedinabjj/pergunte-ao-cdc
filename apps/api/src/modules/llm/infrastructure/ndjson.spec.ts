import { describe, expect, it } from 'vitest';
import { streamOf, toArray } from '../../../../test/support/streams';
import { parseNdjson } from './ndjson';

describe('parseNdjson', () => {
  it('parses lines split across chunks', async () => {
    const body = streamOf(['{"a":1}\n{"a"', ':2}\n', '{"a":3}']);
    expect(await toArray(parseNdjson(body))).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  it('ignores blank lines', async () => {
    expect(await toArray(parseNdjson(streamOf(['{"a":1}\n\n\n'])))).toEqual([{ a: 1 }]);
  });
});
