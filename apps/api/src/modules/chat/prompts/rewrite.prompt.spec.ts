import { describe, expect, it } from 'vitest';
import { buildRewritePrompt, sanitizeRewrite } from './rewrite.prompt';

describe('buildRewritePrompt', () => {
  it('renders the history and truncates assistant messages to 500 chars', () => {
    const req = buildRewritePrompt(
      [
        { role: 'user', content: 'posso devolver?' },
        { role: 'assistant', content: 'a'.repeat(800) },
      ],
      'e se for online?',
    );
    const content = req.messages[0]?.content ?? '';
    expect(content).toContain('Usuário: posso devolver?');
    expect(content).toContain(`Assistente: ${'a'.repeat(500)}…`);
    expect(content).not.toContain('a'.repeat(501));
    expect(content.trimEnd().endsWith('Última pergunta: e se for online?')).toBe(true);
    expect(req).toMatchObject({ temperature: 0, maxTokens: 120 });
    expect(req.system).toContain('pergunta completa e independente');
  });
});

describe('sanitizeRewrite', () => {
  it.each([
    ['"Qual o prazo?"', 'Qual o prazo?'],
    ['  Qual o prazo?  ', 'Qual o prazo?'],
    ['“Qual o prazo?”', 'Qual o prazo?'],
    ['', 'original'],
    ['x'.repeat(1001), 'original'],
  ])('sanitizeRewrite(%s)', (out, expected) => {
    expect(sanitizeRewrite(out, 'original')).toBe(expected);
  });
});
