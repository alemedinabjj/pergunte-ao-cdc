import type { Law } from '@cdc/contracts';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test/msw';
import { api } from './api-client';

const law: Law = {
  slug: 'cdc',
  title: 'Código de Defesa do Consumidor',
  shortName: 'CDC',
  reference: 'Lei nº 8.078/1990',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
};

describe('api client', () => {
  it('parses laws from the api', async () => {
    server.use(http.get('/api/laws', () => HttpResponse.json([law])));
    expect(await api.laws()).toEqual([law]);
  });

  it('throws ApiError with code and message from error bodies', async () => {
    server.use(
      http.get('/api/conversations/x', () =>
        HttpResponse.json({ code: 'CONVERSATION_NOT_FOUND', message: 'm' }, { status: 404 }),
      ),
    );
    await expect(api.conversation('x')).rejects.toMatchObject({
      status: 404,
      code: 'CONVERSATION_NOT_FOUND',
      message: 'm',
    });
  });

  it('rejects responses that do not match the contract', async () => {
    server.use(http.get('/api/laws', () => HttpResponse.json([{ slug: 'clt' }])));
    await expect(api.laws()).rejects.toThrow();
  });

  it('deleteConversation resolves on 204', async () => {
    server.use(http.delete('/api/conversations/x', () => new HttpResponse(null, { status: 204 })));
    await expect(api.deleteConversation('x')).resolves.toBeUndefined();
  });
});
