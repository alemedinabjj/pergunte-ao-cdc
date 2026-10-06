import type { LawSlug } from '@cdc/contracts';

export interface LawMeta {
  slug: LawSlug;
  title: string;
  shortName: string;
  reference: string;
  sourceUrl: string;
  /** Nome do arquivo em LAWS_DIR. */
  file: string;
}

export const LAWS_CATALOG: readonly LawMeta[] = [
  {
    slug: 'cdc',
    title: 'Código de Defesa do Consumidor',
    shortName: 'CDC',
    reference: 'Lei nº 8.078/1990',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
    file: 'cdc.txt',
  },
  {
    slug: 'decreto-7962',
    title: 'Decreto do Comércio Eletrônico',
    shortName: 'Decreto 7.962/2013',
    reference: 'Decreto nº 7.962/2013',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm',
    file: 'decreto-7962.txt',
  },
  {
    slug: 'decreto-11034',
    title: 'Lei do SAC',
    shortName: 'Decreto 11.034/2022',
    reference: 'Decreto nº 11.034/2022',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/d11034.htm',
    file: 'decreto-11034.txt',
  },
];

export function findLaw(slug: LawSlug): LawMeta {
  const law = LAWS_CATALOG.find((item) => item.slug === slug);
  if (!law) throw new Error(`Lei desconhecida: ${slug}`);
  return law;
}
