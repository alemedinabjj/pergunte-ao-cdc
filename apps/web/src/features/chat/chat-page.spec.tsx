import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { CONVERSATION_ID, cit, MESSAGE_ID, sseBody, streamOf } from '../../test/fixtures';
import { server } from '../../test/msw';
import { renderApp } from '../../test/render-app';

const detail = (messages: unknown[]) => ({
  id: CONVERSATION_ID,
  title: 'Posso devolver?',
  createdAt: '2026-10-05T12:00:00.000Z',
  messages,
});
const userMessage = {
  id: 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  role: 'user',
  content: 'Posso devolver?',
  status: 'complete',
  citations: null,
  createdAt: '2026-10-05T12:00:01.000Z',
};
const assistantMessage = {
  id: MESSAGE_ID,
  role: 'assistant',
  content: 'Pode, em 7 dias [2].',
  status: 'complete',
  citations: [cit({ id: 2 })],
  createdAt: '2026-10-05T12:00:02.000Z',
};

function common() {
  server.use(
    http.get('/api/laws', () => HttpResponse.json([])),
    http.get('/api/conversations', () => HttpResponse.json([])),
  );
}

describe('ChatPage with history', () => {
  it('shows persisted messages with their citations for an existing conversation', async () => {
    common();
    server.use(
      http.get(`/api/conversations/${CONVERSATION_ID}`, () =>
        HttpResponse.json(detail([userMessage, assistantMessage])),
      ),
    );
    renderApp(`/c/${CONVERSATION_ID}`);
    expect(await screen.findByText('Posso devolver?', { selector: 'h2' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fonte 2: CDC, Art. 49' }));
    expect(screen.getAllByTestId('source-2')[0]?.querySelector('.marker')).toHaveAttribute(
      'data-selected',
      'true',
    );
  });

  it('marks interrupted answers', async () => {
    common();
    server.use(
      http.get(`/api/conversations/${CONVERSATION_ID}`, () =>
        HttpResponse.json(
          detail([userMessage, { ...assistantMessage, status: 'incomplete', citations: [] }]),
        ),
      ),
    );
    renderApp(`/c/${CONVERSATION_ID}`);
    expect(await screen.findByText('Resposta interrompida.')).toBeInTheDocument();
  });

  it('moves a new conversation to its URL and does not duplicate the last turn after done', async () => {
    common();
    let persisted = false;
    server.use(
      http.post('/api/chat', () => {
        persisted = true;
        return new HttpResponse(
          streamOf([
            sseBody([
              { type: 'meta', conversationId: CONVERSATION_ID, messageId: MESSAGE_ID },
              { type: 'citations', items: [cit({ id: 2 })] },
              { type: 'token', text: 'Pode, em 7 dias [2].' },
              { type: 'done', citedIds: [2], model: 'm', latencyMs: 3 },
            ]),
          ]),
          { headers: { 'content-type': 'text/event-stream' } },
        );
      }),
      http.get(`/api/conversations/${CONVERSATION_ID}`, () =>
        HttpResponse.json(detail(persisted ? [userMessage, assistantMessage] : [userMessage])),
      ),
    );
    const { router } = renderApp('/');
    await userEvent.type(await screen.findByLabelText('Sua pergunta'), 'Posso devolver?{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe(`/c/${CONVERSATION_ID}`));
    await waitFor(() =>
      expect(screen.getAllByText('Posso devolver?', { selector: 'h2' })).toHaveLength(1),
    );
    await waitFor(() => expect(screen.getAllByText(/Pode, em 7 dias/)).toHaveLength(1));
  });

  it('shows "Conversa não encontrada" on 404', async () => {
    common();
    server.use(
      http.get(`/api/conversations/${CONVERSATION_ID}`, () =>
        HttpResponse.json({ code: 'CONVERSATION_NOT_FOUND', message: 'x' }, { status: 404 }),
      ),
    );
    renderApp(`/c/${CONVERSATION_ID}`);
    expect(await screen.findByText('Conversa não encontrada.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Começar uma nova' })).toHaveAttribute('href', '/');
  });
});

describe('ChatPage on small screens', () => {
  it('offers "Nova conversa" in the header too, since the sidebar is hidden on mobile', async () => {
    common();
    server.use(
      http.get(`/api/conversations/${CONVERSATION_ID}`, () =>
        HttpResponse.json(detail([userMessage, assistantMessage])),
      ),
    );
    const { router } = renderApp(`/c/${CONVERSATION_ID}`);
    const header = await screen.findByRole('banner');
    await userEvent.click(await within(header).findByRole('button', { name: 'Nova conversa' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});
