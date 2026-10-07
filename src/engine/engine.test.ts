import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runChecks } from './checks';
import { decisionMemo, scenarioCsv } from './exports';
import { expectedPeriods, periodLabel } from './periods';
import { DEFAULT_ASSUMPTIONS as A, imbalanceCost, lagSensitivity, runAll } from './scenarios';
import { parseDataset } from './validate';

const rid = (c: { review: { id: string }[] }, prefix: string) => c.review.find((r) => r.id.startsWith(prefix + '#'))!.id;
const ctx = (c: Parameters<typeof scenarioCsv>[2]['checks'], resolutions = {}) => ({ assumptions: A, checks: c, resolutions });
const load = (f: string) => parseDataset(f, readFileSync(`public/samples/${f}`, 'utf8'));

describe('sample fixtures', () => {
  it('clean day concludes all three scenarios', () => {
    const ds = load('clean-day.csv');
    const c = runChecks(ds, {}, A.staleHours);
    expect(ds.rows).toHaveLength(192);
    expect(c.coverage).toMatchObject({ expected: 192, covered: 192 });
    expect(c.review).toHaveLength(0);
    const r = runAll(ds, c, A);
    expect(r.map((x) => x.status)).toEqual(['ready', 'ready', 'ready']);
    const [base, spike, outage] = r.map((x) => x.totals!);
    expect(spike.costGbp).toBeGreaterThan(base.costGbp);
    expect(outage.costGbp).toBeGreaterThan(base.costGbp);
    expect(spike.shortMwh).toBeGreaterThan(base.shortMwh);
  });

  it('missing meter batch blocks instead of zero-filling', () => {
    const ds = load('missing-meter-batch.csv');
    const c = runChecks(ds, {}, A.staleHours);
    expect(c.coverage.gaps.map((g) => `${g.assetId}:${g.sp}`)).toEqual(['D-02:34', 'D-02:35', 'D-02:36', 'D-02:37', 'D-02:38', 'D-02:39', 'G-02:12']);
    const r = runAll(ds, c, A);
    for (const s of r) {
      expect(s.status).toBe('blocked');
      expect(s.totals).toBeNull();
      const p = s.periods.find((x) => x.sp === 35)!;
      expect(p.status).toBe('blocked');
      expect(p.imbalanceMwh).toBeNull();
      expect(p.costGbp).toBeNull();
    }
  });

  it('resend + model change needs review, then concludes after resolution', () => {
    const ds = load('resend-and-model-change.csv');
    const c = runChecks(ds, {}, A.staleHours);
    expect(c.review.map((r) => r.id.split('#')[0]).sort()).toEqual(['conflict:D-01:20', 'model:D-01', 'stale:G-02']);
    const [cf, md, st] = [rid(c, 'conflict:D-01:20'), rid(c, 'model:D-01'), rid(c, 'stale:G-02')];
    expect(runAll(ds, c, A).every((s) => s.status === 'review')).toBe(true);
    const models = c.errorStats.filter((s) => s.assetType === 'demand').map((s) => s.model).sort();
    expect(models).toEqual(['dmd-v2.3', 'dmd-v2.4']);
    const res = { [cf]: 'use:RSD-0020', [md]: 'ack', [st]: 'accept' };
    const c2 = runChecks(ds, res, A.staleHours);
    expect(c2.openReview).toHaveLength(0);
    expect(runAll(ds, c2, A).every((s) => s.status === 'ready')).toBe(true);
    const c3 = runChecks(ds, { ...res, [st]: 'exclude' }, A.staleHours);
    expect(runAll(ds, c3, A).every((s) => s.status === 'blocked')).toBe(true);
  });

  it('chosen conflict row changes the result and is traced', () => {
    const ds = load('resend-and-model-change.csv');
    const c0 = runChecks(ds, {}, A.staleHours);
    const base = { [rid(c0, 'model:D-01')]: 'ack', [rid(c0, 'stale:G-02')]: 'accept' };
    const cf = rid(c0, 'conflict:D-01:20');
    const a = runAll(ds, runChecks(ds, { ...base, [cf]: 'use:RSD-0020' }, A.staleHours), A)[0];
    const b = runAll(ds, runChecks(ds, { ...base, [cf]: 'use:RSD-0193' }, A.staleHours), A)[0];
    const pa = a.periods.find((p) => p.sp === 20)!, pb = b.periods.find((p) => p.sp === 20)!;
    expect(pa.sourceRowIds).toContain('RSD-0020');
    expect(pb.sourceRowIds).toContain('RSD-0193');
    expect(pb.imbalanceMwh!).toBeLessThan(pa.imbalanceMwh!);
  });

  it('clock change day has 50 periods with local labels', () => {
    const ds = load('clock-change-day.csv');
    expect(ds.expectedSps).toBe(50);
    const r = runAll(ds, runChecks(ds, {}, A.staleHours), A);
    expect(r[0].periods).toHaveLength(50);
    expect(r[0].status).toBe('ready');
  });

  it('every period traces to one row per asset', () => {
    const ds = load('clean-day.csv');
    const r = runAll(ds, runChecks(ds, {}, A.staleHours), A);
    const ids = new Set(ds.rows.map((x) => x.rowId));
    for (const s of r) for (const p of s.periods) {
      expect(p.sourceRowIds).toHaveLength(4);
      for (const id of p.sourceRowIds) expect(ids.has(id)).toBe(true);
    }
  });
});

describe('formulas', () => {
  it('short and long costs follow documented formula', () => {
    expect(imbalanceCost(-2, 100, A)).toBeCloseTo(240);
    expect(imbalanceCost(2, 100, A)).toBeCloseTo(80);
    expect(imbalanceCost(0, 100, A)).toBe(0);
  });

  it('outage cost rises monotonically with detection lag', () => {
    const ds = load('clean-day.csv');
    const pts = lagSensitivity(ds, runChecks(ds, {}, A.staleHours), A);
    for (let i = 1; i < pts.length; i++) expect(pts[i].costGbp!).toBeGreaterThanOrEqual(pts[i - 1].costGbp!);
    expect(pts[pts.length - 1].costGbp!).toBeGreaterThan(pts[0].costGbp!);
  });

  it('0% spike equals baseline', () => {
    const ds = load('clean-day.csv');
    const c = runChecks(ds, {}, A.staleHours);
    const [b, s] = runAll(ds, c, { ...A, spikePct: 0 });
    expect(s.totals).toEqual(b.totals);
  });

  it('settlement period counts across clock changes', () => {
    expect(expectedPeriods('2026-03-29')).toBe(46);
    expect(expectedPeriods('2026-10-25')).toBe(50);
    expect(expectedPeriods('2026-10-05')).toBe(48);
    expect(periodLabel('2026-10-25', 3)).toBe('SP 3 · 01:00 BST');
    expect(periodLabel('2026-10-25', 5)).toBe('SP 5 · 01:00 GMT');
    expect(periodLabel('2026-03-29', 3)).toBe('SP 3 · 02:00 BST');
  });
});

describe('exports', () => {
  it('csv and memo carry provenance and withhold blocked totals', () => {
    const ds = load('missing-meter-batch.csv');
    const c = runChecks(ds, {}, A.staleHours);
    const r = runAll(ds, c, A);
    const csv = scenarioCsv(ds, r, ctx(c));
    expect(csv.split('\n')[0]).toContain('source_row_ids');
    expect(csv.trim().split('\n')).toHaveLength(1 + 3 * 48);
    const memo = decisionMemo({ ds, checks: c, results: r, assumptions: A, resolutions: {}, lag: [], reviewer: 'Test', note: '', generatedAt: 'T' });
    expect(memo).toContain('NOT CONCLUDED');
    expect(memo).toContain('withheld');
    expect(memo).toContain('not treated as zero');
    expect(memo).toContain('does not place, recommend or automate any trade');
  });

  it('memo for ready data includes trade-offs', () => {
    const ds = load('clean-day.csv');
    const c = runChecks(ds, {}, A.staleHours);
    const r = runAll(ds, c, A);
    const memo = decisionMemo({ ds, checks: c, results: r, assumptions: A, resolutions: {}, lag: lagSensitivity(ds, c, A), reviewer: '', note: '', generatedAt: 'T' });
    expect(memo).toContain('READY');
    expect(memo).toContain('Each extra SP of detection lag');
  });

  it('scenario csv carries file, fingerprint, assumptions and review decisions on every row', () => {
    const ds = load('resend-and-model-change.csv');
    const c = runChecks(ds, {}, A.staleHours);
    const st = rid(c, 'stale:G-02');
    const c2 = runChecks(ds, { [st]: 'accept' }, A.staleHours);
    const csv = scenarioCsv(ds, runAll(ds, c2, A), ctx(c2, { [st]: 'accept' }));
    const [head, first] = csv.split('\n');
    expect(head.split(',').slice(-4)).toEqual(['source_file', 'dataset_fingerprint', 'assumptions_fictional', 'review_decisions']);
    expect(first).toContain(ds.fingerprint);
    expect(first).toContain('resend-and-model-change.csv');
    expect(first).toContain('peakPrice=180');
    expect(first).toContain(`${st}=accept`);
    expect(first).toMatch(/model:D-01#[0-9a-f]{8}=OPEN/);
  });
});
