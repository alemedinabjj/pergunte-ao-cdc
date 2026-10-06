import { describe, expect, it } from 'vitest';
import { normalizeLawText } from './normalize';

describe('normalizeLawText', () => {
  it('removes editorial annotations', () => {
    expect(
      normalizeLawText('Art. 6º São direitos (Redação dada pela Lei nº 14.181, de 2021)'),
    ).toBe('Art. 6º São direitos');
    expect(normalizeLawText('XI - a garantia (Incluído pela Lei nº 14.181, de 2021);')).toBe(
      'XI - a garantia;',
    );
  });

  it('drops lines that only contained annotations', () => {
    expect(normalizeLawText('Art. 1º A\n(Vide Decreto nº 2.181, de 1997)\nArt. 2º B')).toBe(
      'Art. 1º A\nArt. 2º B',
    );
  });

  it('cuts the signature block at the end', () => {
    expect(
      normalizeLawText(
        'Art. 119. Revogam-se...\nBrasília, 11 de setembro de 1990; 169º da Independência.\nFERNANDO COLLOR',
      ),
    ).toBe('Art. 119. Revogam-se...');
  });

  it('normalizes "(Revogado pela ...)" to "(Revogado)"', () => {
    expect(normalizeLawText('§ 3º (Revogado pela Lei nº 9.870, de 1999)')).toBe('§ 3º (Revogado)');
  });

  it('turns the degree sign into the ordinal indicator', () => {
    expect(normalizeLawText('Art. 1° O presente código\n§ 2° Texto')).toBe(
      'Art. 1º O presente código\n§ 2º Texto',
    );
  });
});
