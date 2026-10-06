const ARTICLE_REF = /\bart(?:igo)?\.?\s*(\d+)(?:\s*[º°o])?(?:-([a-z]))?\b/i;

/** "o que diz o art. 54-a?" → "54-A". Retorna null quando a pergunta não cita artigo. */
export function extractArticleRef(text: string): string | null {
  const match = ARTICLE_REF.exec(text);
  if (!match) return null;
  return match[2] ? `${match[1]}-${match[2].toUpperCase()}` : (match[1] ?? null);
}
