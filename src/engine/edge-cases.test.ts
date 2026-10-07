import { describe, expect, it } from 'vitest';
import { runChecks } from './checks';
import { DEFAULT_ASSUMPTIONS as A, assumptionErrors, runAll } from './scenarios';
import { parseDataset } from './validate';
import { decisionMemo, exportBlockReason, ExportBlockedError, scenarioCsv } from './exports';

const H = 'row_id,settlement_date,sp,asset_id,asset_type,forecast_mwh,actual_mwh,forecast_model,forecast_issued_at';
function day(over: (sp: number, asset: string) => string | null = () => null, date = '2026-10-05', n = 48) {
  const lines = [H];
  const issued = new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000).toISOString().replace('.000', '');
  let id = 0;
  for (const [asset, type] of [['D-01', 'demand'], ['G-01', 'generation']]) {
    for (let sp = 1; sp <= n; sp++) {
      const o = over(sp, asset);
      if (o === 'skip') continue;
      lines.push(o ?? `R${++id},${date},${sp},${asset},${type},1.000,1.000,m1,${issued}`);
    }
  }
  return lines.join('\n');
}
const run = (text: string, res = {}) => {
  const ds = parseDataset('t.csv', text);
  const c = runChecks(ds, res, A.staleHours);
  return { ds, c, r: runAll(ds, c, { ...A, outageAsset: 'G-01' }) };
};

describe('edge cases', () => {
  it('a perfect forecast concludes at zero baseline cost', () => {
    const { r } = run(day());
    expect(r[0].status).toBe('ready');
    expect(r[0].totals!.costGbp).toBe(0);
  });

  it('blank actual is a coverage gap, not zero demand', () => {
    const { c, r } = run(day((sp, a) => (sp === 10 && a === 'D-01' ? 'X1,2026-10-05,10,D-01,demand,1.000,,m1,2026-10-04T12:00:00Z' : null)));
    expect(c.coverage.gaps).toHaveLength(1);
    expect(r[0].status).toBe('blocked');
    expect(r[0].periods[9].imbalanceMwh).toBeNull();
  });

  it('explicit 0.000 actual is a real reading and concludes', () => {
    const { r } = run(day((sp, a) => (sp === 10 && a === 'G-01' ? 'X1,2026-10-05,10,G-01,generation,1.000,0.000,m1,2026-10-04T12:00:00Z' : null)));
    expect(r[0].status).toBe('ready');
    expect(r[0].periods[9].imbalanceMwh).toBe(-1);
  });

  it('absent row blocks', () => {
    const { r } = run(day((sp, a) => (sp === 48 && a === 'G-01' ? 'skip' : null)));
    expect(r[0].status).toBe('blocked');
  });

  it('identical resend is deduplicated without review', () => {
    const text = day() + '\nR999,2026-10-05,5,D-01,demand,1.000,1.000,m1,2026-10-04T12:00:00Z';
    const { c, r } = run(text);
    expect(c.review).toHaveLength(0);
    expect(c.issues.some((i) => i.code === 'identical-resend')).toBe(true);
    expect(r[0].status).toBe('ready');
  });

  it('conflicting resend needs review; excluding it blocks', () => {
    const text = day() + '\nR999,2026-10-05,5,D-01,demand,1.000,1.500,m1,2026-10-04T12:00:00Z';
    expect(run(text).r[0].status).toBe('review');
    const cf = run(text).c.review.find((x) => x.id.startsWith('conflict:D-01:5#'))!.id;
    expect(run(text, { [cf]: 'exclude' }).r[0].status).toBe('blocked');
    expect(run(text, { [cf]: 'use:R999' }).r[0].status).toBe('ready');
  });

  it('rejects malformed values without zero-filling', () => {
    const { ds, r } = run(day((sp, a) => (sp === 2 && a === 'D-01' ? 'X1,2026-10-05,2,D-01,demand,1.000,abc,m1,2026-10-04T12:00:00Z' : null)));
    expect(ds.issues.some((i) => i.code === 'bad-number' && i.line === 3)).toBe(true);
    expect(r[0].status).toBe('blocked');
  });

  it('rejects negative, bad SP, bad asset type and duplicate ids', () => {
    const text = [day(), 'N1,2026-10-05,3,D-01,demand,-1,1,m1,x', 'N2,2026-10-05,49,D-01,demand,1,1,m1,x', 'N3,2026-10-05,3,D-01,battery,1,1,m1,x', 'R1,2026-10-05,3,D-01,demand,1,1,m1,x'].join('\n');
    const codes = parseDataset('t', text).issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['negative', 'bad-sp', 'bad-asset-type', 'duplicate-row-id']));
  });

  it('missing columns is fatal and every scenario blocks', () => {
    const { ds, r } = run('row_id,sp\n1,1');
    expect(ds.fatal).toBe(true);
    expect(r.every((s) => s.status === 'blocked')).toBe(true);
  });

  it('empty file is fatal', () => {
    expect(parseDataset('e', '').fatal).toBe(true);
  });

  it('mixed settlement dates are flagged, excluded and block conclusions', () => {
    const text = day() + '\nZ1,2026-10-06,1,D-01,demand,1,1,m1,2026-10-04T12:00:00Z';
    const { ds, r } = run(text);
    expect(ds.issues.some((i) => i.code === 'mixed-dates')).toBe(true);
    expect(ds.rows.every((x) => x.date === '2026-10-05')).toBe(true);
    expect(r.every((x) => x.status === 'blocked')).toBe(true);
  });

  it('unparseable issue time counts as stale and needs review', () => {
    const { c, r } = run(day((sp, a) => (sp === 1 && a === 'D-01' ? 'X1,2026-10-05,1,D-01,demand,1,1,m1,yesterday' : null)));
    expect(c.review.map((x) => x.id.split('#')[0])).toContain('stale:D-01');
    expect(r[0].status).toBe('review');
  });

  it('stale threshold is an assumption', () => {
    const text = day();
    const ds = parseDataset('t', text);
    expect(runChecks(ds, {}, 48).review).toHaveLength(0);
    expect(runChecks(ds, {}, 6).review.map((r) => r.kind)).toEqual(['stale-forecast', 'stale-forecast']);
  });

  it('model version change splits error stats and needs acknowledgement', () => {
    const { c, r } = run(day((sp, a) => (a === 'D-01' && sp > 24 ? `M${sp},2026-10-05,${sp},D-01,demand,1.200,1.000,m2,2026-10-04T12:00:00Z` : null)));
    const d = c.errorStats.filter((s) => s.assetType === 'demand');
    expect(d.map((s) => [s.model, s.n, s.maeMwh])).toEqual([['m1', 24, 0], ['m2', 24, expect.closeTo(0.2, 6)]]);
    expect(r[0].status).toBe('review');
    const md = c.review.find((x) => x.kind === 'model-change')!.id;
    expect(run(day((sp, a) => (a === 'D-01' && sp > 24 ? `M${sp},2026-10-05,${sp},D-01,demand,1.200,1.000,m2,2026-10-04T12:00:00Z` : null)), { [md]: 'ack' }).r[0].status).toBe('ready');
  });

  it('outage on an unknown asset blocks only the outage scenario', () => {
    const ds = parseDataset('t', day());
    const c = runChecks(ds, {}, 48);
    const r = runAll(ds, c, { ...A, outageAsset: 'G-99' });
    expect(r.map((s) => s.status)).toEqual(['ready', 'ready', 'blocked']);
  });

  it('spring clock-change day expects 46 periods', () => {
    const { ds, r } = run(day(() => null, '2026-03-29', 46));
    expect(ds.expectedSps).toBe(46);
    expect(r[0].status).toBe('ready');
  });

  it('a 48-period file on a 50-period day blocks the missing periods', () => {
    const { r } = run(day(() => null, '2026-10-25', 48));
    expect(r[0].status).toBe('blocked');
    expect(r[0].periods.filter((p) => p.status === 'blocked').map((p) => p.sp)).toEqual([49, 50]);
  });

  it('quoted CSV fields and CRLF line endings parse', () => {
    const text = day().replace(/\n/g, '\r\n').replace('R1,', '"R1",');
    expect(parseDataset('t', text).rows).toHaveLength(96);
  });

  it('an asset whose rows are all malformed is reported, not silently dropped, and blocks every scenario', () => {
    const { ds, r } = run(day((sp, a) => (a === 'G-01' ? `B${sp},2026-10-05,${sp},G-01,genration,1,1,m1,2026-10-04T12:00:00Z` : null)));
    expect(ds.assets.map((x) => x.id)).toEqual(['D-01']);
    expect(ds.issues.some((i) => i.code === 'asset-dropped' && i.assetId === 'G-01')).toBe(true);
    expect(r.map((x) => x.status)).toEqual(['blocked', 'blocked', 'blocked']);
    expect(r.every((x) => x.totals === null)).toBe(true);
  });

  it('a single rejected row blocks every scenario even when its slot is otherwise covered', () => {
    const { r } = run(day() + '\nX9,2026-10-05,7,D-01,demand,1,abc,m1,2026-10-04T12:00:00Z');
    expect(r.every((x) => x.status === 'blocked' && x.totals === null)).toBe(true);
    expect(r[0].reasons.join(' ')).toMatch(/validation error/);
  });

  it('a row with the wrong number of fields is rejected', () => {
    const { ds, r } = run(day((sp, a) => (sp === 4 && a === 'D-01' ? 'R4,2026-10-05,4,D-01,demand,1.000,1.000,m1' : null)));
    expect(ds.issues.some((i) => i.code === 'bad-field-count')).toBe(true);
    expect(r[0].status).toBe('blocked');
  });

  it('an unterminated quote is fatal instead of swallowing the rest of the file', () => {
    const { ds, r } = run(day().replace('R3,', '"R3,'));
    expect(ds.fatal).toBe(true);
    expect(ds.rows).toHaveLength(0);
    expect(ds.issues[0].code).toBe('bad-csv');
    expect(ds.issues[0].line).toBe(4);
    expect(r.every((x) => x.status === 'blocked')).toBe(true);
  });

  it('stray or trailing quote characters are fatal', () => {
    expect(parseDataset('t', day().replace('R3,', 'R"3,')).issues[0].code).toBe('bad-csv');
    expect(parseDataset('t', day().replace('R3,', '"R3"x,')).issues[0].code).toBe('bad-csv');
  });

  it('binary or wrongly encoded files are unreadable and fatal', () => {
    expect(parseDataset('b', 'PK\u0003\u0004\u0000\u0000garbage').issues[0].code).toBe('unreadable');
    expect(parseDataset('b', H + '\nR1,2026-10-05,1,D-\uFFFD1,demand,1,1,m1,x').issues[0].code).toBe('unreadable');
    expect(parseDataset('b', '', 'it is not valid UTF-8 text.').fatal).toBe(true);
  });

  it('exports refuse unreadable or empty inputs instead of writing zero rows', () => {
    for (const text of ['', 'row_id,sp\n1,1', 'PK\u0003\u0004\u0000', day().replace('R3,', '"R3,')]) {
      const { ds, c, r } = run(text);
      expect(exportBlockReason(ds)).toMatch(/^Export is blocked/);
      expect(() => scenarioCsv(ds, r, { assumptions: A, checks: c, resolutions: {} })).toThrow(ExportBlockedError);
      expect(() => decisionMemo({ ds, checks: c, results: r, assumptions: A, resolutions: {}, lag: [], reviewer: '', note: '', generatedAt: 'x' })).toThrow(ExportBlockedError);
    }
  });

  it('a valid but blocked day still exports, with blocked totals withheld', () => {
    const { ds, c, r } = run(day((sp, a) => (sp === 9 && a === 'G-01' ? 'skip' : null)));
    expect(exportBlockReason(ds)).toBeNull();
    expect(scenarioCsv(ds, r, { assumptions: A, checks: c, resolutions: {} })).toContain('blocked');
  });

  it('a stale approval does not carry over when a lower threshold makes more rows stale', () => {
    const ds = parseDataset('t', day());
    const c30 = runChecks(ds, {}, 30);
    const st = c30.review.find((x) => x.kind === 'stale-forecast')!;
    const res = Object.fromEntries(c30.review.map((x) => [x.id, 'accept']));
    expect(runAll(ds, runChecks(ds, res, 30), { ...A, staleHours: 30, outageAsset: 'G-01' })[0].status).toBe('ready');
    const c24 = runChecks(ds, res, 24);
    const st24 = c24.review.find((x) => x.kind === 'stale-forecast')!;
    expect(st24.rowIds.length).toBeGreaterThan(st.rowIds.length);
    expect(st24.id).not.toBe(st.id);
    expect(c24.openReview.map((x) => x.id)).toContain(st24.id);
    expect(runAll(ds, c24, { ...A, staleHours: 24, outageAsset: 'G-01' })[0].status).toBe('review');
  });

  it('an approval does not carry over to a resend with different conflicting rows', () => {
    const t1 = day() + '\nR999,2026-10-05,5,D-01,demand,1.000,1.500,m1,2026-10-04T12:00:00Z';
    const t2 = day() + '\nR998,2026-10-05,5,D-01,demand,1.000,1.700,m1,2026-10-04T12:00:00Z';
    const cf = run(t1).c.review[0].id;
    expect(run(t2, { [cf]: 'exclude' }).c.openReview).toHaveLength(1);
  });

  it('huge or non-finite numbers are rejected instead of producing Infinity', () => {
    const big = '9'.repeat(400);
    for (const v of [big, `${big}.0`, '1e400', '10000.001']) {
      const { ds, r } = run(day((sp, a) => (sp === 3 && a === 'D-01' ? `X3,2026-10-05,3,D-01,demand,${v},1.000,m1,2026-10-04T12:00:00Z` : null)));
      expect(ds.issues.some((i) => i.code === 'bad-number' || i.code === 'out-of-range')).toBe(true);
      expect(r.every((x) => x.status === 'blocked' && x.totals === null)).toBe(true);
      expect(JSON.stringify(r)).not.toContain('Infinity');
    }
  });

  it('out-of-range or inconsistent assumptions block every scenario', () => {
    const ds = parseDataset('t', day());
    const c = runChecks(ds, {}, A.staleHours);
    for (const over of [{ peakPrice: -180 }, { offPeakPrice: Number.NaN }, { longDiscountPct: 140 }, { detectionLagSps: 2.5 }, { spikeStart: 40, spikeEnd: 30 }, { outageEnd: 49 }, { staleHours: 0 }]) {
      const a = { ...A, outageAsset: 'G-01', ...over };
      expect(assumptionErrors(a, 48).length).toBeGreaterThan(0);
      const r = runAll(ds, c, a);
      expect(r.every((x) => x.status === 'blocked' && x.totals === null)).toBe(true);
      expect(r[0].reasons.join(' ')).toMatch(/Invalid assumption/);
    }
    expect(assumptionErrors({ ...A, outageAsset: 'G-01' }, 48)).toEqual([]);
  });

  it('forecasts issued at or after the period starts are blocked, not Ready', () => {
    const { c, r } = run(day((sp, a) => (sp === 10 && a === 'G-01' ? 'F10,2026-10-05,10,G-01,generation,1.000,1.000,m1,2099-01-01T00:00:00Z' : null)));
    expect(c.issues.some((i) => i.code === 'forecast-after-delivery')).toBe(true);
    expect(r[0].periods.find((p) => p.sp === 10)!.status).toBe('blocked');
    expect(r.every((x) => x.status === 'blocked')).toBe(true);
  });

  it('blank lines do not shift physical line numbers or raw provenance', () => {
    const text = day().replace('\nR1,', '\n\n\nR1,').replace('\nR5,', '\r\n\nR5,');
    const ds = parseDataset('t', text);
    const phys = text.split(/\r?\n/);
    for (const row of ds.rows) expect(phys[row.line - 1]).toBe(row.raw);
    expect(ds.rows.find((x) => x.rowId === 'R1')!.line).toBe(4);
    const bad = parseDataset('t', day().replace('\nR2,', '\n\nR2,').replace('R3,2026-10-05,3,D-01,demand,1.000', 'R3,2026-10-05,3,D-01,demand,abc'));
    expect(bad.issues.find((i) => i.code === 'bad-number')!.line).toBe(5);
  });
});
