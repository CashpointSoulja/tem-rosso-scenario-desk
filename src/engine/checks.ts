import { periodStartUtc } from './periods';
import type { CheckResult, Dataset, ForecastErrorStat, Issue, Resolutions, ReviewItem, Slot, SourceRow } from './types';

const same = (a: SourceRow, b: SourceRow) => a.forecastMwh === b.forecastMwh && a.actualMwh === b.actualMwh && a.model === b.model && a.issuedAt === b.issuedAt;

export function runChecks(ds: Dataset, resolutions: Resolutions, staleHours: number): CheckResult {
  const issues: Issue[] = [];
  const review: ReviewItem[] = [];
  const slots: Slot[] = [];
  let k = 0;
  const add = (i: Omit<Issue, 'id'>) => issues.push({ id: `c${++k}`, ...i });
  if (ds.fatal || !ds.date) {
    return { slots, review, openReview: [], coverage: { expected: 0, covered: 0, gaps: [] }, errorStats: [], issues };
  }
  const date = ds.date;

  // Stale forecasts and model-version changes are per asset.
  const staleByAsset = new Map<string, SourceRow[]>();
  for (const a of ds.assets) {
    const rows = ds.rows.filter((r) => r.assetId === a.id);
    const stale = rows.filter((r) => {
      const issued = Date.parse(r.issuedAt);
      if (Number.isNaN(issued)) return true;
      return (periodStartUtc(date, r.sp).getTime() - issued) / 3600_000 > staleHours;
    });
    if (stale.length) {
      staleByAsset.set(a.id, stale);
      review.push({
        id: `stale:${a.id}`, kind: 'stale-forecast', assetId: a.id,
        title: `${a.id}: ${stale.length} forecast row(s) older than ${staleHours} h or with no valid issue time`,
        detail: `Earliest issue time ${stale.map((r) => r.issuedAt || 'blank').sort()[0]}. A stale forecast can make imbalance look worse (or better) than the current model would.`,
        rowIds: stale.map((r) => r.rowId),
        options: [
          { value: 'accept', label: 'Accept for this analysis', effect: 'Rows are used and the memo records that a human accepted stale forecasts.' },
          { value: 'exclude', label: 'Exclude these rows', effect: 'Affected periods become blocked; no conclusion until a fresh forecast arrives.' },
        ],
      });
    }
    const models = [...new Set(rows.map((r) => r.model))];
    if (models.length > 1) {
      const firstSp = (m: string) => Math.min(...rows.filter((r) => r.model === m).map((r) => r.sp));
      models.sort((x, y) => firstSp(x) - firstSp(y));
      review.push({
        id: `model:${a.id}`, kind: 'model-change', assetId: a.id,
        title: `${a.id}: forecast model changed mid-day (${models.join(' → ')})`,
        detail: `Switch at SP ${firstSp(models[1])}. Error statistics are split by model version and never pooled; a reviewer must acknowledge before results are concluded.`,
        rowIds: rows.filter((r) => r.model !== models[0]).map((r) => r.rowId),
        options: [{ value: 'ack', label: 'Acknowledge split by version', effect: 'Results may conclude; memo lists both versions with separate error stats.' }],
      });
    }
  }

  for (const a of ds.assets) {
    for (let sp = 1; sp <= ds.expectedSps; sp++) {
      const candidates = ds.rows.filter((r) => r.assetId === a.id && r.sp === sp);
      const slot: Slot = { assetId: a.id, assetType: a.type, sp, status: 'ok', row: null, candidates, reason: null };
      if (candidates.length === 0) {
        slot.status = 'gap';
        slot.reason = 'No row for this period (missing reading)';
      } else {
        let row: SourceRow | null = candidates[0];
        if (candidates.length > 1) {
          const distinct = candidates.filter((c, i) => candidates.findIndex((d) => same(c, d)) === i);
          if (distinct.length === 1) {
            add({ severity: 'info', code: 'identical-resend', message: `${a.id} SP ${sp}: ${candidates.length} identical rows (${candidates.map((c) => c.rowId).join(', ')}); first one used.`, assetId: a.id, sp });
          } else {
            const id = `conflict:${a.id}:${sp}`;
            review.push({
              id, kind: 'conflict', assetId: a.id, sp,
              title: `${a.id} SP ${sp}: ${distinct.length} conflicting rows`,
              detail: distinct.map((c) => `${c.rowId} (line ${c.line}): actual ${c.actualMwh ?? 'blank'} MWh, forecast ${c.forecastMwh ?? 'blank'} MWh`).join('; '),
              rowIds: distinct.map((c) => c.rowId),
              options: [
                ...distinct.map((c) => ({ value: `use:${c.rowId}`, label: `Use ${c.rowId}`, effect: `Uses actual ${c.actualMwh ?? 'blank'} MWh from line ${c.line}.` })),
                { value: 'exclude', label: 'Exclude period', effect: 'Period becomes blocked.' },
              ],
            });
            const choice = resolutions[id];
            if (!choice) { row = null; slot.status = 'review'; slot.reason = 'Conflicting rows awaiting review'; }
            else if (choice === 'exclude') { row = null; slot.status = 'excluded'; slot.reason = 'Excluded by reviewer (conflict)'; }
            else row = distinct.find((c) => `use:${c.rowId}` === choice) ?? null;
          }
        }
        if (row) {
          const staleRows = staleByAsset.get(a.id);
          const isStale = staleRows?.some((r) => r.rowId === row!.rowId);
          const staleChoice = resolutions[`stale:${a.id}`];
          if (row.actualMwh === null) { slot.status = 'gap'; slot.reason = 'actual_mwh is blank (missing reading, not zero)'; }
          else if (row.forecastMwh === null) { slot.status = 'gap'; slot.reason = 'forecast_mwh is blank'; }
          else if (isStale && staleChoice === 'exclude') { slot.status = 'excluded'; slot.reason = 'Stale forecast excluded by reviewer'; }
          else if (isStale && staleChoice !== 'accept') { slot.status = 'review'; slot.reason = 'Stale forecast awaiting review'; }
          slot.row = row;
        }
      }
      slots.push(slot);
    }
  }

  const gaps = slots.filter((s) => s.status === 'gap');
  for (const g of gaps) add({ severity: 'error', code: 'coverage-gap', message: `${g.assetId} SP ${g.sp}: ${g.reason}.`, assetId: g.assetId, sp: g.sp });

  const groups = new Map<string, ForecastErrorStat & { abs: number; sum: number }>();
  for (const a of ds.assets) {
    for (const m of new Set(ds.rows.filter((r) => r.assetId === a.id).map((r) => r.model))) {
      const key = `${a.type}|${m}`;
      if (!groups.has(key)) groups.set(key, { assetType: a.type, model: m, n: 0, expected: 0, maeMwh: null, biasMwh: null, abs: 0, sum: 0 });
    }
  }
  for (const s of slots) {
    const model = s.row?.model ?? s.candidates[0]?.model;
    const key = model ? `${s.assetType}|${model}` : null;
    const g = key ? groups.get(key) : undefined;
    if (!g) continue;
    g.expected += 1;
    if (s.status === 'ok' && s.row && s.row.actualMwh !== null && s.row.forecastMwh !== null) {
      const e = s.row.forecastMwh - s.row.actualMwh;
      g.n += 1; g.abs += Math.abs(e); g.sum += e;
    }
  }
  const errorStats = [...groups.values()].map(({ abs, sum, ...g }) => ({
    ...g, maeMwh: g.n ? abs / g.n : null, biasMwh: g.n ? sum / g.n : null,
  }));
  const expected = ds.assets.length * ds.expectedSps;
  const covered = slots.filter((s) => s.status !== 'gap').length;
  const openReview = review.filter((r) => !resolutions[r.id]);
  return { slots, review, openReview, coverage: { expected, covered, gaps }, errorStats, issues };
}
