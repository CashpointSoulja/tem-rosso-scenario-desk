// Deterministic synthetic fixtures. Every value is fictional.
import { writeFileSync, mkdirSync } from 'node:fs';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ASSETS = [
  { id: 'D-01', type: 'demand', model: 'dmd-v2.3' },
  { id: 'D-02', type: 'demand', model: 'dmd-v2.3' },
  { id: 'G-01', type: 'generation', model: 'gen-v1.8' },
  { id: 'G-02', type: 'generation', model: 'gen-v1.8' },
];

function profile(assetId, hour, r) {
  const n = (r() - 0.5) * 2;
  switch (assetId) {
    case 'D-01': return (1.1 + 1.9 * Math.max(0, Math.sin((Math.PI * (hour - 6)) / 13))) * (1 + 0.03 * n);
    case 'D-02': return (2.1 + 0.3 * Math.sin((2 * Math.PI * hour) / 24)) * (1 + 0.03 * n);
    case 'G-01': return hour < 7 || hour > 18 ? 0 : 3.6 * Math.max(0, Math.sin((Math.PI * (hour - 7)) / 11)) * (1 + 0.04 * n);
    default: return (2.4 + 0.8 * Math.sin((2 * Math.PI * (hour + 3)) / 17)) * (1 + 0.05 * n);
  }
}

const r3 = (x) => (Math.round(x * 1000) / 1000).toFixed(3);

function build({ prefix, date, periods, seed, issuedAt, mutate = () => {} }) {
  const r = rng(seed);
  const rows = [];
  let n = 0;
  for (const a of ASSETS) {
    for (let sp = 1; sp <= periods; sp++) {
      const hour = ((sp - 1) / 2) * (24 / (periods / 2));
      const actual = profile(a.id, hour, r);
      const err = (r() - 0.5) * 2 * 0.07;
      const forecast = actual === 0 ? 0 : actual * (1 + err);
      n += 1;
      rows.push({
        row_id: `${prefix}-${String(n).padStart(4, '0')}`,
        settlement_date: date,
        sp,
        asset_id: a.id,
        asset_type: a.type,
        forecast_mwh: r3(forecast),
        actual_mwh: r3(actual),
        forecast_model: a.model,
        forecast_issued_at: issuedAt,
      });
    }
  }
  mutate(rows, () => `${prefix}-${String(++n).padStart(4, '0')}`);
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map((row) => cols.map((c) => row[c]).join(','))].join('\n') + '\n';
}

const out = {
  'clean-day.csv': build({ prefix: 'CLN', date: '2026-10-05', periods: 48, seed: 11, issuedAt: '2026-10-04T09:30:00Z' }),
  'missing-meter-batch.csv': build({
    prefix: 'MIS', date: '2026-10-06', periods: 48, seed: 23, issuedAt: '2026-10-05T09:30:00Z',
    mutate(rows) {
      for (const row of rows) if (row.asset_id === 'D-02' && row.sp >= 34 && row.sp <= 39) row.actual_mwh = '';
      const i = rows.findIndex((row) => row.asset_id === 'G-02' && row.sp === 12);
      rows.splice(i, 1);
    },
  }),
  'resend-and-model-change.csv': build({
    prefix: 'RSD', date: '2026-10-07', periods: 48, seed: 37, issuedAt: '2026-10-06T09:30:00Z',
    mutate(rows, nextId) {
      for (const row of rows) {
        if (row.asset_id === 'D-01' && row.sp >= 25) row.forecast_model = 'dmd-v2.4';
        if (row.asset_id === 'G-02') row.forecast_issued_at = '2026-10-04T06:00:00Z';
      }
      const orig = rows.find((row) => row.asset_id === 'D-01' && row.sp === 20);
      const resend = { ...orig, row_id: nextId(), actual_mwh: r3(Number(orig.actual_mwh) * 1.42) };
      const at = rows.indexOf(orig);
      rows.splice(at + 1, 0, resend);
    },
  }),
  'clock-change-day.csv': build({ prefix: 'CLK', date: '2026-10-25', periods: 50, seed: 41, issuedAt: '2026-10-24T09:30:00Z' }),
};

mkdirSync('public/samples', { recursive: true });
mkdirSync('src/fixtures', { recursive: true });
for (const [name, text] of Object.entries(out)) {
  writeFileSync(`public/samples/${name}`, text);
  writeFileSync(`src/fixtures/${name}`, text);
  console.log(name, text.split('\n').length - 2, 'rows');
}
