/**
 * Baixa o texto das leis do planalto.gov.br e grava snapshots limpos em data/laws/.
 * Roda raramente (quando a lei muda); a ingestão normal só lê os .txt versionados.
 *
 *   pnpm --filter api fetch-laws
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { LAWS_CATALOG } from '../src/modules/ingestion/laws.catalog';

const OUTPUT_DIR = join(__dirname, '..', '..', '..', 'data', 'laws');

// O planalto derruba a conexão (ECONNRESET) de clientes sem User-Agent de navegador.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

const BR_MARK = '\u2028';

export function htmlToLawText(html: string): string {
  const $ = cheerio.load(html);
  // Texto riscado é a redação revogada que o planalto mantém visível.
  $('strike, s, del').remove();
  // Quebras de linha do HTML-fonte são só formatação; a quebra real é o <br>.
  $('br').replaceWith(BR_MARK);
  const lines: string[] = [];
  $('p, h1, h2, h3, h4, h5, h6, li').each((_, element) => {
    for (const raw of $(element).text().split(BR_MARK)) {
      const line = raw.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
      if (line) lines.push(line);
    }
  });
  return lines.join('\n');
}

function detectCharset(bytes: ArrayBuffer): string {
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 2048));
  const match = head.match(/charset=["']?([\w-]+)/i);
  const charset = match?.[1]?.toLowerCase() ?? 'windows-1252';
  return charset === 'iso-8859-1' ? 'windows-1252' : charset;
}

async function main(): Promise<void> {
  for (const law of LAWS_CATALOG) {
    const response = await fetch(law.sourceUrl, { headers: { 'user-agent': USER_AGENT } });
    if (!response.ok) throw new Error(`${law.slug}: HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    const html = new TextDecoder(detectCharset(bytes)).decode(bytes);
    const text = htmlToLawText(html);
    await writeFile(join(OUTPUT_DIR, law.file), `${text}\n`, 'utf8');
    console.log(`${law.slug}: ${text.split('\n').length} linhas → data/laws/${law.file}`);
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
