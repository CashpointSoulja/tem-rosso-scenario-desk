import { fingerprint, parseCsv } from './csv';
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

const NUM = /^-?\d+(\.\d+)?$/;

function num(v: string): number | null | 'bad' {
  const s = v.trim();
  if (s === '') return null;
  if (!NUM.test(s)) return 'bad';
  return Number(s);
}

export function parseDataset(name: string, text: string): Dataset {
  const issues: Issue[] = [];
  let k = 0;
  const add = (i: Omit<Issue, 'id'>) => issues.push({ id: `v${++k}`, ...i });
  const table = parseCsv(text).filter((r) => !(r.length === 1 && r[0].trim() === ''));
  const base: Dataset = {
    name, text, fingerprint: fingerprint(text), date: null, expectedSps: 48, rows: [], assets: [], issues, fatal: false,
  };
  if (table.length === 0) {
    add({ severity: 'error', code: 'empty-file', message: 'The file is empty.' });
    return { ...base, fatal: true };
  }
  const header = table[0].map((h) => h.trim().toLowerCase());
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
  const lines = text.split(/\r?\n/);

  table.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const get = (c: (typeof REQUIRED_COLUMNS)[number]) => (cells[col[c]] ?? '').trim();
    const rowId = get('row_id');
    const reject = (code: string, message: string) =>
      add({ severity: 'error', code, message: `Line ${line}: ${message} Row rejected; its slot counts as missing, not zero.`, line, rowId: rowId || undefined });

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
    if (a === 'bad') return reject('bad-number', `actual_mwh "${get('actual_mwh')}" is not a number.`);
    if ((f !== null && f < 0) || (a !== null && a < 0)) return reject('negative', 'Negative MWh; this file records demand and generation as separate positive volumes.');

    seenIds.add(rowId);
    assetTypes.set(assetId, t);
    dates.set(date, (dates.get(date) ?? 0) + 1);
    rows.push({
      rowId, line, date, sp, assetId, assetType: t, forecastMwh: f, actualMwh: a,
      model: get('forecast_model') || 'unknown', issuedAt: get('forecast_issued_at'), raw: lines[line - 1] ?? cells.join(','),
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
  if (!kept.length) add({ severity: 'error', code: 'no-rows', message: 'No usable rows.' });
  return { ...base, date, expectedSps: date ? expectedPeriods(date) : 48, rows: kept, assets, fatal: kept.length === 0 };
}
