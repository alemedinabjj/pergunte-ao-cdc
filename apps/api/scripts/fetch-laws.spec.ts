import { describe, expect, it } from 'vitest';
import { htmlToLawText } from './fetch-laws';

describe('htmlToLawText', () => {
  it('drops struck-through text and keeps one paragraph per line', () => {
    const html =
      '<p>Art. 1º Texto vigente.</p><p><strike>Art. 2º Texto revogado.</strike></p><p>Art. 3º Outro.</p>';
    expect(htmlToLawText(html)).toBe('Art. 1º Texto vigente.\nArt. 3º Outro.');
  });

  it('collapses whitespace and non-breaking spaces', () => {
    expect(htmlToLawText('<p>Art.&nbsp;4º   A  B</p>')).toBe('Art. 4º A B');
  });

  it('removes struck text inside a paragraph but keeps the rest', () => {
    expect(htmlToLawText('<p>I - <strike>antigo</strike> novo texto;</p>')).toBe('I - novo texto;');
  });

  it('joins source-wrapped lines inside a paragraph and splits only on <br>', () => {
    expect(
      htmlToLawText('<p>Art. 49. O consumidor pode desistir\n  do contrato<br>I - item</p>'),
    ).toBe('Art. 49. O consumidor pode desistir do contrato\nI - item');
  });
});
