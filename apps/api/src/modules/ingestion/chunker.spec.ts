import { describe, expect, it } from 'vitest';
import { chunkLaw, estimateTokens } from './chunker';
import type { LawMeta } from './laws.catalog';
import type { ParsedArticle } from './parser';

const CDC: LawMeta = {
  slug: 'cdc',
  title: 'Código de Defesa do Consumidor',
  shortName: 'CDC',
  reference: 'Lei nº 8.078/1990',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
  file: 'cdc.txt',
};

const BREADCRUMB = 'Título I — Dos Direitos do Consumidor > Capítulo VI — Da Proteção Contratual';

const article = (over: Partial<ParsedArticle>): ParsedArticle => ({
  article: '1',
  breadcrumb: BREADCRUMB,
  position: 0,
  head: 'Texto.',
  incisos: [],
  paragraphs: [],
  ...over,
});

const pad = (prefix: string, length: number) => prefix.padEnd(length, '.');

const art49 = article({
  article: '49',
  head: 'O consumidor pode desistir do contrato, no prazo de 7 dias.',
  paragraphs: [{ label: 'Parágrafo único', text: 'Os valores serão devolvidos.', incisos: [] }],
});

// "Art. 39. " + head = 80 caracteres; cada inciso renderizado tem 95 → 4 incisos por grupo com 120 tokens.
const head39 = pad('É vedado ao fornecedor', 80 - 'Art. 39. '.length);
const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const longArt39 = article({
  article: '39',
  head: head39,
  incisos: roman.map((label) => ({ label, text: pad('condicionar', 95 - `${label} - `.length) })),
  paragraphs: [{ label: 'Parágrafo único', text: 'Equiparam-se às amostras grátis.', incisos: [] }],
});

describe('estimateTokens', () => {
  it('uses ~4 characters per token', () => {
    expect(estimateTokens('a'.repeat(9))).toBe(3);
  });
});

describe('chunkLaw', () => {
  it('keeps a short article as a single chunk', () => {
    const [c] = chunkLaw(CDC, [art49]);
    expect(c?.path).toBe('Art. 49');
    expect(c?.article).toBe('49');
    expect(c?.content).toMatch(/^Art\. 49\. O consumidor pode desistir/);
    expect(c?.content).toContain('\nParágrafo único. Os valores serão devolvidos.');
  });

  it('uses the ordinal form for articles 1 to 9', () => {
    const [c] = chunkLaw(CDC, [article({ article: '6', head: 'São direitos básicos:' })]);
    expect(c?.path).toBe('Art. 6º');
    expect(c?.content).toBe('Art. 6º São direitos básicos:');
  });

  it('splits a long article by inciso groups and paragraphs, repeating the head', () => {
    const chunks = chunkLaw(CDC, [longArt39], { maxTokens: 120 });
    expect(chunks.map((c) => c.path)).toEqual([
      'Art. 39, incisos I a IV',
      'Art. 39, incisos V a VIII',
      'Art. 39, parágrafo único',
    ]);
    for (const c of chunks)
      expect(c.content.startsWith('Art. 39. É vedado ao fornecedor')).toBe(true);
    expect(chunks.every((c) => c.article === '39')).toBe(true);
  });

  it('uses singular inciso label and "caput" when needed', () => {
    const longText = pad('texto longo', 300);
    const withInciso = article({
      article: '10',
      head: 'Caput do dez.',
      incisos: [{ label: 'I', text: longText }],
      paragraphs: [{ label: '§ 1º', text: longText, incisos: [] }],
    });
    const onlyParagraphs = article({
      article: '11',
      head: 'Caput do onze.',
      paragraphs: [
        { label: '§ 1º', text: longText, incisos: [] },
        { label: '§ 2º', text: longText, incisos: [] },
      ],
    });
    expect(
      chunkLaw(CDC, [withInciso, onlyParagraphs], { maxTokens: 120 }).map((c) => c.path),
    ).toEqual([
      'Art. 10, inciso I',
      'Art. 10, § 1º',
      'Art. 11, caput',
      'Art. 11, § 1º',
      'Art. 11, § 2º',
    ]);
  });

  it('renders paragraph incisos under their paragraph', () => {
    const [c] = chunkLaw(CDC, [
      article({
        article: '43',
        head: 'O consumidor terá acesso.',
        paragraphs: [
          {
            label: '§ 1º',
            text: 'Os cadastros devem ser:',
            incisos: [{ label: 'I', text: 'objetivos;' }],
          },
        ],
      }),
    ]);
    expect(c?.content).toBe(
      'Art. 43. O consumidor terá acesso.\n§ 1º Os cadastros devem ser:\nI - objetivos;',
    );
  });

  it('prefixes embedded text with law and breadcrumb', () => {
    expect(chunkLaw(CDC, [art49])[0]?.embeddedText.split('\n').slice(0, 2)).toEqual([
      `CDC — ${BREADCRUMB}`,
      'Art. 49',
    ]);
    expect(chunkLaw(CDC, [{ ...art49, breadcrumb: '' }])[0]?.embeddedText.split('\n')[0]).toBe(
      'CDC',
    );
  });

  it('produces stable hashes and sequential positions', () => {
    const arts = [art49, article({ article: '50' }), article({ article: '51' })];
    expect(chunkLaw(CDC, arts)[0]?.contentHash).toBe(chunkLaw(CDC, arts)[0]?.contentHash);
    expect(chunkLaw(CDC, arts)[0]?.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(chunkLaw(CDC, arts).map((c) => c.position)).toEqual([0, 1, 2]);
  });
});
