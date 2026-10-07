import { periodLabel } from './periods';
import type { Assumptions, CheckResult, Dataset, PeriodResult, PeriodStatus, ScenarioId, ScenarioResult, ScenarioTotals } from './types';

export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  baseline: 'Baseline',
  spike: 'Demand spike',
  outage: 'Generator outage',
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  spikePct: 25,
  spikeStart: 33,
  spikeEnd: 38,
  outageAsset: 'G-02',
  outageStart: 30,
  outageEnd: 41,
  detectionLagSps: 4,
  peakStart: 33,
  peakEnd: 38,
  peakPrice: 180,
  offPeakPrice: 75,
  shortPremiumPct: 20,
  longDiscountPct: 40,
  staleHours: 48,
};

export const round = (x: number, dp = 3) => Math.round(x * 10 ** dp) / 10 ** dp;
const inRange = (sp: number, a: number, b: number) => sp >= Math.min(a, b) && sp <= Math.max(a, b);

export function refPrice(sp: number, a: Assumptions): number {
  return inRange(sp, a.peakStart, a.peakEnd) ? a.peakPrice : a.offPeakPrice;
}

/**
 * Illustrative cost of one period's imbalance, GBP.
 * Short (imbalance < 0): |imbalance| x refPrice x (1 + shortPremium).
 * Long  (imbalance > 0): imbalance x refPrice x longDiscount (value lost spilling surplus).
 */
export function imbalanceCost(imbalanceMwh: number, price: number, a: Assumptions): number {
  if (imbalanceMwh < 0) return -imbalanceMwh * price * (1 + a.shortPremiumPct / 100);
  return imbalanceMwh * price * (a.longDiscountPct / 100);
}

function totals(periods: PeriodResult[]): ScenarioTotals {
  let shortMwh = 0, longMwh = 0, costGbp = 0, worstSp: number | null = null, worstCostGbp = 0;
  for (const p of periods) {
    if (p.status !== 'ok' || p.imbalanceMwh === null || p.costGbp === null) continue;
    if (p.imbalanceMwh < 0) shortMwh += -p.imbalanceMwh; else longMwh += p.imbalanceMwh;
    costGbp += p.costGbp;
    if (p.costGbp > worstCostGbp) { worstCostGbp = p.costGbp; worstSp = p.sp; }
  }
  return { shortMwh: round(shortMwh), longMwh: round(longMwh), netMwh: round(longMwh - shortMwh), costGbp: round(costGbp, 2), worstSp, worstCostGbp: round(worstCostGbp, 2) };
}

/** Allowed ranges. Out-of-range or non-integer values block every scenario rather than being clamped silently. */
export function assumptionErrors(a: Assumptions, expectedSps: number): string[] {
  const out: string[] = [];
  const check = (k: keyof Assumptions, label: string, min: number, max: number, int = false) => {
    const v = a[k] as number;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v)))
      out.push(`${label} must be ${int ? 'a whole number ' : ''}between ${min} and ${max} (got ${v}).`);
  };
  check('spikePct', 'Demand uplift %', -50, 200);
  check('spikeStart', 'Spike from SP', 1, expectedSps, true);
  check('spikeEnd', 'Spike to SP', 1, expectedSps, true);
  check('outageStart', 'Outage from SP', 1, expectedSps, true);
  check('outageEnd', 'Outage to SP', 1, expectedSps, true);
  check('detectionLagSps', 'Detection lag', 0, 48, true);
  check('peakPrice', 'Peak price £/MWh', 0, 10_000);
  check('offPeakPrice', 'Off-peak price £/MWh', 0, 10_000);
  check('peakStart', 'Peak from SP', 1, expectedSps, true);
  check('peakEnd', 'Peak to SP', 1, expectedSps, true);
  check('shortPremiumPct', 'Short premium %', 0, 500);
  check('longDiscountPct', 'Long spill loss %', 0, 100);
  check('staleHours', 'Stale threshold h', 1, 720);
  for (const [s, e, label] of [[a.spikeStart, a.spikeEnd, 'Spike'], [a.outageStart, a.outageEnd, 'Outage'], [a.peakStart, a.peakEnd, 'Peak']] as const)
    if (s > e) out.push(`${label} window starts after it ends (SP ${s} > SP ${e}).`);
  return out;
}

export function runScenario(id: ScenarioId, ds: Dataset, checks: CheckResult, a: Assumptions): ScenarioResult {
  const periods: PeriodResult[] = [];
  const date = ds.date ?? '';
  const outageKnown = ds.assets.some((x) => x.id === a.outageAsset && x.type === 'generation');
  for (let sp = 1; sp <= ds.expectedSps; sp++) {
    const slots = checks.slots.filter((s) => s.sp === sp);
    const reasons: string[] = [];
    let status: PeriodStatus = 'ok';
    for (const s of slots) {
      if (s.status === 'gap' || s.status === 'excluded') { status = 'blocked'; reasons.push(`${s.assetId}: ${s.reason}`); }
      else if (s.status === 'review' && status !== 'blocked') { status = 'review'; reasons.push(`${s.assetId}: ${s.reason}`); }
      else if (s.status === 'review') reasons.push(`${s.assetId}: ${s.reason}`);
    }
    const transforms: string[] = [];
    let dA = 0, gA = 0, dF = 0, gF = 0;
    for (const s of slots) {
      if (!s.row || s.row.actualMwh === null || s.row.forecastMwh === null) continue;
      let act = s.row.actualMwh;
      let fc = s.row.forecastMwh;
      if (id === 'spike' && s.assetType === 'demand' && inRange(sp, a.spikeStart, a.spikeEnd)) {
        act = act * (1 + a.spikePct / 100);
        transforms.push(`${s.assetId} actual x ${(1 + a.spikePct / 100).toFixed(2)} (spike, not in forecast)`);
      }
      if (id === 'outage' && s.assetId === a.outageAsset && inRange(sp, a.outageStart, a.outageEnd)) {
        act = 0;
        const reforecast = sp >= Math.min(a.outageStart, a.outageEnd) + a.detectionLagSps;
        if (reforecast) fc = 0;
        transforms.push(`${s.assetId} actual -> 0 (outage)${reforecast ? '; forecast -> 0 (re-forecast after detection lag)' : '; forecast unchanged (within detection lag)'}`);
      }
      if (s.assetType === 'demand') { dA += act; dF += fc; } else { gA += act; gF += fc; }
    }
    const ok = status === 'ok';
    const reviewable = status !== 'blocked';
    const imb = reviewable ? round(gA - dA - (gF - dF)) : null;
    const price = refPrice(sp, a);
    periods.push({
      sp, label: periodLabel(date, sp), status, reasons,
      demandActual: reviewable ? round(dA) : null,
      genActual: reviewable ? round(gA) : null,
      demandFcst: reviewable ? round(dF) : null,
      genFcst: reviewable ? round(gF) : null,
      imbalanceMwh: imb,
      refPrice: price,
      costGbp: imb === null ? null : round(imbalanceCost(imb, price, a), 2),
      sourceRowIds: slots.flatMap((s) => (s.row ? [s.row.rowId] : s.candidates.map((c) => c.rowId))),
      transforms: ok || reviewable ? transforms : [],
    });
  }
  const blocked = periods.filter((p) => p.status === 'blocked');
  const inReview = periods.filter((p) => p.status === 'review');
  const reasons: string[] = [];
  const invalid = ds.issues.filter((i) => i.severity === 'error').length;
  const badAssumptions = assumptionErrors(a, ds.expectedSps);
  for (const e of badAssumptions) reasons.push(`Invalid assumption: ${e}`);
  if (ds.fatal) reasons.push('Dataset could not be read.');
  else if (invalid) reasons.push(`${invalid} validation error(s) in the file. Rejected rows cannot be valued or ignored, so no conclusion is drawn until the file is fixed and reloaded.`);
  if (blocked.length) reasons.push(`${blocked.length} of ${periods.length} periods have missing or excluded readings. Missing data is not zero, so no conclusion is drawn.`);
  if (inReview.length) reasons.push(`${inReview.length} period(s) are waiting for manual review.`);
  const otherOpen = checks.openReview.filter((r) => r.kind === 'model-change');
  for (const r of otherOpen) reasons.push(`Open review: ${r.title}.`);
  if (id === 'outage' && !outageKnown) reasons.push(`Outage asset ${a.outageAsset} is not a generator in this file.`);
  const status = ds.fatal || invalid || badAssumptions.length || blocked.length || (id === 'outage' && !outageKnown) ? 'blocked' : inReview.length || otherOpen.length ? 'review' : 'ready';
  return {
    id, label: SCENARIO_LABELS[id], status, reasons, periods,
    totals: status === 'ready' ? totals(periods) : null,
    coveredSubtotal: totals(periods),
    okPeriods: periods.filter((p) => p.status === 'ok').length,
  };
}

export function runAll(ds: Dataset, checks: CheckResult, a: Assumptions): ScenarioResult[] {
  return (['baseline', 'spike', 'outage'] as ScenarioId[]).map((id) => runScenario(id, ds, checks, a));
}

export interface LagPoint { lag: number; costGbp: number | null; deltaVsBaseline: number | null }

/** Outage cost as a function of detection lag: quantifies the value of faster detection. */
export function lagSensitivity(ds: Dataset, checks: CheckResult, a: Assumptions, lags = [0, 1, 2, 4, 6, 8]): LagPoint[] {
  const base = runScenario('baseline', ds, checks, a).totals;
  return lags.map((lag) => {
    const t = runScenario('outage', ds, checks, { ...a, detectionLagSps: lag }).totals;
    return { lag, costGbp: t ? t.costGbp : null, deltaVsBaseline: t && base ? round(t.costGbp - base.costGbp, 2) : null };
  });
}
