export interface LawLine {
  /** Numeral romano do inciso, ex.: 'I'. */
  label: string;
  /** Texto do inciso; alíneas vêm em linhas seguintes, separadas por '\n'. */
  text: string;
}

export interface LawParagraph {
  /** '§ 1º' ou 'Parágrafo único'. */
  label: string;
  text: string;
  incisos: LawLine[];
}

export interface ParsedArticle {
  /** '6', '49', '54-A'. */
  article: string;
  breadcrumb: string;
  position: number;
  /** Caput, sem o "Art. N". */
  head: string;
  incisos: LawLine[];
  paragraphs: LawParagraph[];
}

const ARTICLE = /^Art\.\s*(\d+)(?:\s*º|o\b)?(?:-([A-Z]))?\.?\s*(.*)$/;
const HEADING = /^(TÍTULO|CAPÍTULO|SEÇÃO)\s+([IVXLC]+(?:-[A-Z])?)\s*$/i;
const PARAGRAPH = /^(§\s*\d+º?|Parágrafo único)\.?\s*(.*)$/i;
const INCISO = /^([IVXLC]+)\s*[-–—]\s*(.*)$/;
const ALINEA = /^[a-z]\)\s*/;
const SUPPRESSED = /^\((Vetado|Revogado)\)[.;]?$/i;

const LEVELS = ['TÍTULO', 'CAPÍTULO', 'SEÇÃO'] as const;
const LEVEL_NAMES: Record<(typeof LEVELS)[number], string> = {
  TÍTULO: 'Título',
  CAPÍTULO: 'Capítulo',
  SEÇÃO: 'Seção',
};

/**
 * Máquina de estados linha a linha. Espera texto já normalizado (normalizeLawText).
 * Tudo antes do primeiro artigo é ignorado, exceto os cabeçalhos estruturais.
 */
export function parseLaw(text: string): ParsedArticle[] {
  const headings: (string | null)[] = [null, null, null];
  let pendingLevel: number | null = null;
  let pendingLabel = '';

  const articles: ParsedArticle[] = [];
  let current: ParsedArticle | null = null;
  let skipping = false;
  /** Para onde vai uma linha de continuação (texto que não abre unidade nova). */
  let appendTo: ((extra: string) => void) | null = null;
  let lastInciso: LawLine | null = null;

  const breadcrumb = () => headings.filter((h): h is string => h !== null).join(' > ');

  for (const line of text.split('\n')) {
    if (pendingLevel !== null) {
      headings[pendingLevel] = `${pendingLabel} — ${line}`;
      pendingLevel = null;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const word = (heading[1] ?? '').toUpperCase() as (typeof LEVELS)[number];
      const level = LEVELS.indexOf(word);
      for (let i = level; i < headings.length; i++) headings[i] = null;
      pendingLevel = level;
      pendingLabel = `${LEVEL_NAMES[word]} ${heading[2]}`;
      continue;
    }

    const article = ARTICLE.exec(line);
    if (article) {
      const head = article[3] ?? '';
      appendTo = null;
      lastInciso = null;
      if (SUPPRESSED.test(head)) {
        current = null;
        skipping = true;
        continue;
      }
      skipping = false;
      current = {
        article: article[2] ? `${article[1]}-${article[2]}` : (article[1] ?? ''),
        breadcrumb: breadcrumb(),
        position: articles.length,
        head,
        incisos: [],
        paragraphs: [],
      };
      articles.push(current);
      const created = current;
      appendTo = (extra) => {
        created.head = `${created.head} ${extra}`;
      };
      continue;
    }

    if (!current || skipping) continue;

    const paragraph = PARAGRAPH.exec(line);
    if (paragraph) {
      const body = paragraph[2] ?? '';
      lastInciso = null;
      if (SUPPRESSED.test(body)) {
        appendTo = null;
        continue;
      }
      const label = /^§/.test(paragraph[1] ?? '')
        ? (paragraph[1] ?? '').replace(/^§\s*/, '§ ')
        : 'Parágrafo único';
      const created: LawParagraph = { label, text: body, incisos: [] };
      current.paragraphs.push(created);
      appendTo = (extra) => {
        created.text = `${created.text} ${extra}`;
      };
      continue;
    }

    const inciso = INCISO.exec(line);
    if (inciso) {
      const body = inciso[2] ?? '';
      if (SUPPRESSED.test(body)) {
        appendTo = null;
        lastInciso = null;
        continue;
      }
      const created: LawLine = { label: inciso[1] ?? '', text: body };
      const owner = current.paragraphs.at(-1);
      (owner ? owner.incisos : current.incisos).push(created);
      appendTo = (extra) => {
        created.text = `${created.text} ${extra}`;
      };
      lastInciso = created;
      continue;
    }

    if (ALINEA.test(line) && lastInciso) {
      lastInciso.text = `${lastInciso.text}\n${line}`;
      continue;
    }

    appendTo?.(line);
  }

  return articles;
}
