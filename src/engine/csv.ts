export class CsvError extends Error {
  constructor(message: string, readonly line: number) {
    super(message);
  }
}

/** Strict RFC 4180 parser: malformed quoting throws instead of silently merging rows. */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let wasQuoted = false;
  let line = 1;
  let quoteLine = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else { if (c === '\n') line++; field += c; }
    } else if (c === '"') {
      if (field !== '' || wasQuoted) throw new CsvError(`Line ${line}: stray quote inside an unquoted field.`, line);
      quoted = true; wasQuoted = true; quoteLine = line;
    } else if (c === ',') { row.push(field); field = ''; wasQuoted = false; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); out.push(row); row = []; field = ''; wasQuoted = false; line++;
    } else {
      if (wasQuoted) throw new CsvError(`Line ${line}: text after a closing quote.`, line);
      field += c;
    }
  }
  if (quoted) throw new CsvError(`Line ${quoteLine}: quoted field is never closed.`, quoteLine);
  if (field !== '' || row.length || wasQuoted) { row.push(field); out.push(row); }
  return out;
}

export function toCsv(rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\n') + '\n';
}

export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
