import { CsvError, fingerprint, parseCsvRecords, type CsvRecord } from './csv';
import { expectedPeriods, isValidDate } from './periods';
import type { Asset, AssetType, Dataset, Issue, SourceRow } from './types';

export const REQUIRED_COLUMNS = [
  'row_id',
  'settlement_date',
  'sp',
  'asset_id',
  'asset_type',
  'forecast_mwh',
  'actual_mwh',
  'forecast_model',
  'forecast_issued_at',
] as const;

const NUM = /^-?\d{1,9}(\.\d{1,9})?$/;
/** Upper bound for one asset in one half-hour. Anything larger is a data error, not a reading. */
export const MAX_MWH = 10_000;

function num(v: string): number | null | 'bad' | 'range' {
  const s = v.trim();
  if (s === '') return null;
  if (!NUM.test(s)) return 'bad';
  const n = Number(s);
  if (!Number.isFinite(n)) return 'bad';
  if (n > MAX_MWH) return 'range';
  return n;
}

/** Any of these in a file means the bytes are not readable text (binary, wrong encoding). */
const UNREADABLE = /[\u0000-\u0008\u000E-\u001F\uFFFD]/;

export function parseDataset(name: string, text: string, readError?: string): Dataset {
  const issues: Issue[] = [];
  let k = 0;
  const add = (i: Omit<Issue, 'id'>) => issues.push({ id: `v${++k}`, ...i });
  const base: Dataset = {
    name, text, fingerprint: fingerprint(text), date: null, expectedSps: 48, rows: [], assets: [], issues, fatal: false,
  };
  const fatal = (code: string, message: string, line?: number) => {
    add({ severity: 'error', code, message, line });
    return { ...base, fatal: true };
  };
  if (readError) return fatal('unreadable', `The file could not be read: ${readError}`);
  if (UNREADABLE.test(text)) return fatal('unreadable', 'The file is not readable UTF-8 CSV text (binary or wrong encoding).');
  let parsed: CsvRecord[];
  try {
    parsed = parseCsvRecords(text);
  } catch (e) {
    if (e instanceof CsvError) return fatal('bad-csv', `Malformed CSV. ${e.message} Nothing in the file is used.`, e.line);
    throw e;
  }
  const table = parsed.filter((r) => !(r.cells.length === 1 && r.cells[0].trim() === ''));
  if (table.length === 0) {
    add({ severity: 'error', code: 'empty-file', message: 'The file is empty.' });
    return { ...base, fatal: true };
  }
  const header = table[0].cells.map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    add({ severity: 'error', code: 'missing-columns', message: `Missing required column(s): ${missing.join(', ')}.` });
    return { ...base, fatal: true };
  }
  const col = Object.fromEntries(REQUIRED_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<(typeof REQUIRED_COLUMNS)[number], number>;

  const rows: SourceRow[] = [];
  const seenIds = new Set<string>();
  const dates = new Map<string, number>();
  const assetTypes = new Map<string, AssetType>();
  const rejectedAssets = new Set<string>();

  table.slice(1).forEach(({ cells, line, raw }) => {
    const get = (c: (typeof REQUIRED_COLUMNS)[number]) => (cells[col[c]] ?? '').trim();
    const rowId = get('row_id');
    const reject = (code: string, message: string) => {
      if (get('asset_id')) rejectedAssets.add(get('asset_id'));
      add({ severity: 'error', code, message: `Line ${line}: ${message} Row rejected; its slot counts as missing, not zero.`, line, rowId: rowId || undefined });
    };

    if (cells.length !== header.length) return reject('bad-field-count', `${cells.length} fields, expected ${header.length}.`);

    if (!rowId) return reject('missing-row-id', 'row_id is blank.');
    if (seenIds.has(rowId)) return reject('duplicate-row-id', `row_id ${rowId} already used.`);
    const date = get('settlement_date');
    if (!isValidDate(date)) return reject('bad-date', `settlement_date "${date}" is not a valid YYYY-MM-DD date.`);
    const spRaw = get('sp');
    const sp = Number(spRaw);
    if (!/^\d+$/.test(spRaw) || sp < 1 || sp > expectedPeriods(date))
      return reject('bad-sp', `sp "${spRaw}" is outside 1-${expectedPeriods(date)} for ${date}.`);
    const assetId = get('asset_id');
    if (!assetId) return reject('missing-asset', 'asset_id is blank.');
    const t = get('asset_type').toLowerCase();
    if (t !== 'demand' && t !== 'generation') return reject('bad-asset-type', `asset_type "${t}" must be demand or generation.`);
    const known = assetTypes.get(assetId);
    if (known && known !== t) return reject('asset-type-conflict', `${assetId} was ${known} earlier in the file, now ${t}.`);
    const f = num(get('forecast_mwh'));
    const a = num(get('actual_mwh'));
    if (f === 'bad') return reject('bad-number', `forecast_mwh "${get('forecast_mwh')}" is not a number.`);
    if (f === 'range') return reject('out-of-range', `forecast_mwh "${get('forecast_mwh')}" is above ${MAX_MWH} MWh for one half-hour.`);
    if (a === 'bad') return reject('bad-number', `actual_mwh "${get('actual_mwh')}" is not a number.`);
    if (a === 'range') return reject('out-of-range', `actual_mwh "${get('actual_mwh')}" is above ${MAX_MWH} MWh for one half-hour.`);
    if ((f !== null && f < 0) || (a !== null && a < 0)) return reject('negative', 'Negative MWh; this file records demand and generation as separate positive volumes.');

    seenIds.add(rowId);
    assetTypes.set(assetId, t);
    dates.set(date, (dates.get(date) ?? 0) + 1);
    rows.push({
      rowId, line, date, sp, assetId, assetType: t, forecastMwh: f, actualMwh: a,
      model: get('forecast_model') || 'unknown', issuedAt: get('forecast_issued_at'), raw,
    });
  });

  let date: string | null = null;
  if (dates.size > 1) {
    const sorted = [...dates.entries()].sort((x, y) => y[1] - x[1]);
    date = sorted[0][0];
    for (const [d] of sorted.slice(1)) {
      add({ severity: 'error', code: 'mixed-dates', message: `Rows for ${d} are outside the main settlement date ${date}; one settlement day per file. Those rows are excluded.` });
    }
  } else if (dates.size === 1) date = [...dates.keys()][0];
  const kept = date ? rows.filter((r) => r.date === date) : rows;
  const assets: Asset[] = [...assetTypes.entries()]
    .filter(([id]) => kept.some((r) => r.assetId === id))
    .map(([id, type]) => ({ id, type }))
    .sort((x, y) => x.id.localeCompare(y.id));
  for (const id of [...rejectedAssets].sort()) {
    if (!assets.some((x) => x.id === id))
      add({ severity: 'error', code: 'asset-dropped', message: `${id} has no accepted rows. It is still part of the portfolio, so it cannot be silently left out.`, assetId: id });
  }
  if (!kept.length) add({ severity: 'error', code: 'no-rows', message: 'No usable rows.' });
  return { ...base, date, expectedSps: date ? expectedPeriods(date) : 48, rows: kept, assets, fatal: kept.length === 0 };
}
