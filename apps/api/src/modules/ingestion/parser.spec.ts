import { describe, expect, it } from 'vitest';
import { type ParsedArticle, parseLaw } from './parser';

const FIXTURE = `LEI Nº 8.078, DE 11 DE SETEMBRO DE 1990.
O PRESIDENTE DA REPÚBLICA, faço saber que o Congresso Nacional decreta:
TÍTULO I
Dos Direitos do Consumidor
CAPÍTULO III
Dos Direitos Básicos do Consumidor
Art. 6º São direitos básicos do consumidor:
I - a proteção da vida;
II - a educação sobre o consumo:
a) por iniciativa direta;
b) por incentivos;
III - a informação adequada;
CAPÍTULO VI
Da Proteção Contratual
SEÇÃO II
Das Cláusulas Abusivas
Art. 49. O consumidor pode desistir do contrato, no prazo de 7 dias.
§ 2º (Vetado).
Parágrafo único. Se o consumidor exercitar o direito de arrependimento, os valores serão devolvidos.
CAPÍTULO VI-A
DA PREVENÇÃO E DO TRATAMENTO DO SUPERENDIVIDAMENTO
Art. 54-A. Este Capítulo dispõe sobre a prevenção do superendividamento.
§ 1º Entende-se por superendividamento a impossibilidade manifesta
de pagar, texto de continuação.
Art. 82. (Vetado).`;

const parsed = parseLaw(FIXTURE);
const byArticle = (article: string): ParsedArticle => {
  const found = parsed.find((a) => a.article === article);
  if (!found) throw new Error(`article ${article} not parsed`);
  return found;
};

describe('parseLaw', () => {
  it('ignores text before the first article', () => {
    expect(parsed[0]?.article).toBe('6');
    expect(parsed[0]?.head).toBe('São direitos básicos do consumidor:');
  });

  it('builds breadcrumbs with names', () => {
    expect(byArticle('49').breadcrumb).toBe(
      'Título I — Dos Direitos do Consumidor > Capítulo VI — Da Proteção Contratual > Seção II — Das Cláusulas Abusivas',
    );
  });

  it('resets lower heading levels when a higher one appears', () => {
    expect(byArticle('54-A').breadcrumb).toBe(
      'Título I — Dos Direitos do Consumidor > Capítulo VI-A — DA PREVENÇÃO E DO TRATAMENTO DO SUPERENDIVIDAMENTO',
    );
  });

  it('parses ordinal and suffixed article numbers', () => {
    expect(parsed.map((a) => a.article)).toEqual(['6', '49', '54-A']);
  });

  it('drops vetoed articles and vetoed paragraphs', () => {
    expect(byArticle('49').paragraphs.map((p) => p.label)).toEqual(['Parágrafo único']);
  });

  it('attaches incisos and alíneas to the right owner', () => {
    expect(byArticle('6').incisos.map((i) => i.label)).toEqual(['I', 'II', 'III']);
    expect(byArticle('6').incisos[1]?.text).toBe(
      'a educação sobre o consumo:\na) por iniciativa direta;\nb) por incentivos;',
    );
  });

  it('appends continuation lines to the previous unit', () => {
    expect(byArticle('54-A').paragraphs[0]).toEqual({
      label: '§ 1º',
      text: 'Entende-se por superendividamento a impossibilidade manifesta de pagar, texto de continuação.',
      incisos: [],
    });
  });

  it('numbers positions in document order', () => {
    expect(parsed.map((a) => a.position)).toEqual([0, 1, 2]);
  });
});
