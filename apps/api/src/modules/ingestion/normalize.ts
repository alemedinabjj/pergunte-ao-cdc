/** Anotações editoriais do planalto: dizem de onde veio a redação, não fazem parte do texto. */
const ANNOTATION =
  /\s*\((?:Redação dada|Incluíd[oa]|Acrescentad[oa]|Acrescid[oa]|Vide|Vigência|Renumerad[oa])[^)]*\)/gi;
const REVOKED_BY = /\(Revogad[oa] pel[oa][^)]*\)/gi;
const SIGNATURE = /^Brasília,\s*\d+/;

export function normalizeLawText(raw: string): string {
  const lines: string[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    if (SIGNATURE.test(rawLine.trim())) break;
    const line = rawLine
      .replace(/°/g, 'º')
      .replace(ANNOTATION, '')
      .replace(REVOKED_BY, '(Revogado)')
      .replace(/\s+/g, ' ')
      .trim();
    if (line) lines.push(line);
  }
  return lines.join('\n');
}
