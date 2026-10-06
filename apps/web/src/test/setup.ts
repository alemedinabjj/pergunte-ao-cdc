import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './msw';

// As rotas são carregadas sob demanda (code splitting); a primeira leva mais de 1 s no jsdom.
configure({ asyncUtilTimeout: 5000 });

// jsdom não implementa scrollIntoView; os browsers implementam.
Element.prototype.scrollIntoView = vi.fn();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
