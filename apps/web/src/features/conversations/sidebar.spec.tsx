import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { CONVERSATION_ID } from '../../test/fixtures';
import { server } from '../../test/msw';
import { renderApp } from '../../test/render-app';

const OTHER_ID = '9a9b9c9d-0e0f-4a1b-8c2d-3e4f5a6b7c8d';
const summaries = [
  { id: CONVERSATION_ID, title: 'Prazo de arrependimento', createdAt: '2026-10-05T12:00:00.000Z' },
  { id: OTHER_ID, title: 'Cobrança indevida', createdAt: '2026-10-04T12:00:00.000Z' },
];

function baseHandlers() {
  server.use(
    http.get('/api/laws', () => HttpResponse.json([])),
    http.get('/api/conversations', () => HttpResponse.json(summaries)),
    http.get('/api/conversations/:id', ({ params }) =>
      HttpResponse.json({
        id: params.id,
        title: 'Prazo de arrependimento',
        createdAt: '2026-10-05T12:00:00.000Z',
        messages: [],
      }),
    ),
  );
}

describe('Sidebar', () => {
  it('lists conversations in the order the API returns (newest first)', async () => {
    baseHandlers();
    renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Conversas' });
    await waitFor(() =>
      expect(
        within(nav)
          .getAllByRole('link')
          .map((a) => a.textContent),
      ).toEqual(['Prazo de arrependimento', 'Cobrança indevida']),
    );
  });

  it('deletes after confirmation and navigates home when active', async () => {
    baseHandlers();
    let deleted: string | undefined;
    server.use(
      http.delete('/api/conversations/:id', ({ params }) => {
        deleted = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = renderApp(`/c/${CONVERSATION_ID}`);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Excluir conversa: Prazo de arrependimento' }),
    );
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
    );
    await waitFor(() => expect(deleted).toBe(CONVERSATION_ID));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('cancel keeps the conversation', async () => {
    baseHandlers();
    renderApp(`/c/${CONVERSATION_ID}`);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Excluir conversa: Prazo de arrependimento' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
