import { createHash } from 'node:crypto';
import type { LawMeta } from './laws.catalog';
import type { LawLine, LawParagraph, ParsedArticle } from './parser';

export interface ChunkDraft {
  path: string;
  article: string;
  breadcrumb: string;
  /** Texto limpo, exibido na citação. */
  content: string;
  /** O que vira vetor: lei + breadcrumb + path + conteúdo. */
  embeddedText: string;
  contentHash: string;
  position: number;
}

export const DEFAULT_MAX_TOKENS = 350;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Convenção legal: ordinal de 1 a 9 (Art. 6º), cardinal com ponto a partir de 10 (Art. 10.). */
function articleRef(article: string): { path: string; opener: string } {
  const ordinal = /^\d$/.test(article);
  return {
    path: ordinal ? `Art. ${article}º` : `Art. ${article}`,
    opener: ordinal ? `Art. ${article}º` : `Art. ${article}.`,
  };
}

const incisoLine = (inciso: LawLine) => `${inciso.label} - ${inciso.text}`;

function paragraphLines(paragraph: LawParagraph): string[] {
  const first =
    paragraph.label === 'Parágrafo único'
      ? `Parágrafo único. ${paragraph.text}`
      : `${paragraph.label} ${paragraph.text}`;
  return [first, ...paragraph.incisos.map(incisoLine)];
}

function paragraphPath(paragraph: LawParagraph): string {
  return paragraph.label === 'Parágrafo único' ? 'parágrafo único' : paragraph.label;
}

interface Group {
  suffix: string | null;
  lines: string[];
}

function splitArticle(headLine: string, article: ParsedArticle, maxTokens: number): Group[] {
  const groups: Group[] = [];
  let batch: LawLine[] = [];
  const flush = () => {
    if (batch.length === 0) return;
    const first = batch[0]?.label;
    const last = batch.at(-1)?.label;
    groups.push({
      suffix: batch.length === 1 ? `inciso ${first}` : `incisos ${first} a ${last}`,
      lines: batch.map(incisoLine),
    });
    batch = [];
  };
  for (const inciso of article.incisos) {
    const candidate = [headLine, ...[...batch, inciso].map(incisoLine)].join('\n');
    if (batch.length > 0 && estimateTokens(candidate) > maxTokens) flush();
    batch.push(inciso);
  }
  flush();

  if (article.incisos.length === 0 && article.paragraphs.length > 0) {
    groups.push({ suffix: 'caput', lines: [] });
  }
  for (const paragraph of article.paragraphs) {
    groups.push({ suffix: paragraphPath(paragraph), lines: paragraphLines(paragraph) });
  }
  return groups;
}

export function chunkLaw(
  law: LawMeta,
  articles: ParsedArticle[],
  opts: { maxTokens?: number } = {},
): ChunkDraft[] {
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const drafts: ChunkDraft[] = [];

  for (const article of articles) {
    const { path, opener } = articleRef(article.article);
    const headLine = `${opener} ${article.head}`;
    const fullLines = [
      headLine,
      ...article.incisos.map(incisoLine),
      ...article.paragraphs.flatMap(paragraphLines),
    ];
    const full = fullLines.join('\n');

    const groups: Group[] =
      estimateTokens(full) <= maxTokens
        ? [{ suffix: null, lines: fullLines.slice(1) }]
        : splitArticle(headLine, article, maxTokens);

    for (const group of groups) {
      const chunkPath = group.suffix ? `${path}, ${group.suffix}` : path;
      const content = [headLine, ...group.lines].join('\n');
      const prefix = article.breadcrumb
        ? `${law.shortName} — ${article.breadcrumb}`
        : law.shortName;
      const embeddedText = `${prefix}\n${chunkPath}\n${content}`;
      drafts.push({
        path: chunkPath,
        article: article.article,
        breadcrumb: article.breadcrumb,
        content,
        embeddedText,
        contentHash: createHash('sha256').update(embeddedText).digest('hex'),
        position: drafts.length,
      });
    }
  }
  return drafts;
}
