import { toCsv } from './csv';
import { round } from './scenarios';
import type { Assumptions, CheckResult, Dataset, Resolutions, ScenarioResult } from './types';
import type { LagPoint } from './scenarios';

export function scenarioCsv(ds: Dataset, results: ScenarioResult[]): string {
  const rows: (string | number | null)[][] = [[
    'scenario', 'scenario_status', 'settlement_date', 'sp', 'period_label', 'period_status',
    'demand_actual_mwh', 'generation_actual_mwh', 'demand_forecast_mwh', 'generation_forecast_mwh',
    'imbalance_mwh', 'ref_price_gbp_per_mwh_fictional', 'illustrative_cost_gbp', 'source_row_ids', 'transforms', 'block_or_review_reason',
  ]];
  for (const r of results) {
    for (const p of r.periods) {
      rows.push([
        r.id, r.status, ds.date, p.sp, p.label, p.status,
        p.demandActual, p.genActual, p.demandFcst, p.genFcst,
        p.imbalanceMwh, p.refPrice, p.costGbp, p.sourceRowIds.join(' '), p.transforms.join(' | '), p.reasons.join(' | '),
      ]);
    }
  }
  return toCsv(rows);
}

const gbp = (x: number | null) => (x === null ? 'n/a' : `£${x.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const mwh = (x: number | null) => (x === null ? 'n/a' : `${round(x).toFixed(3)} MWh`);

export interface MemoInput {
  ds: Dataset;
  checks: CheckResult;
  results: ScenarioResult[];
  assumptions: Assumptions;
  resolutions: Resolutions;
  lag: LagPoint[];
  reviewer: string;
  note: string;
  generatedAt: string;
}

export function decisionMemo(m: MemoInput): string {
  const { ds, checks, results, assumptions: a } = m;
  const L: string[] = [];
  const allReady = results.every((r) => r.status === 'ready');
  L.push('# Scenario decision memo (synthetic)', '');
  L.push('> Independent concept by Ayo Ahmed. Not affiliated with tem. Fictional data and fictional prices. This simplified simulation does not reflect any internal tem or Rosso model. It informs a human decision and does not place, recommend or automate any trade.', '');
  L.push(`- Generated: ${m.generatedAt}`);
  L.push(`- Dataset: ${ds.name} (fingerprint ${ds.fingerprint}, ${ds.rows.length} rows accepted, settlement date ${ds.date ?? 'unknown'}, ${ds.expectedSps} periods expected)`);
  L.push(`- Reviewer: ${m.reviewer.trim() || 'not recorded'}`);
  L.push(`- Overall status: ${allReady ? 'READY: all scenarios concluded' : 'NOT CONCLUDED: see blockers below'}`, '');

  L.push('## Data coverage (separate from forecast error)', '');
  L.push(`- Slots covered: ${checks.coverage.covered} of ${checks.coverage.expected} (${checks.coverage.expected ? ((100 * checks.coverage.covered) / checks.coverage.expected).toFixed(1) : '0.0'}%)`);
  if (checks.coverage.gaps.length) {
    L.push(`- Missing readings (${checks.coverage.gaps.length}): ${checks.coverage.gaps.map((g) => `${g.assetId} SP ${g.sp}`).join(', ')}`);
    L.push('- Missing readings are not treated as zero. Affected periods are blocked.');
  } else L.push('- No missing readings.');
  const rejected = ds.issues.filter((i) => i.severity === 'error');
  if (rejected.length) L.push(`- Validation errors: ${rejected.length} (${[...new Set(rejected.map((i) => i.code))].join(', ')})`);
  L.push('');

  L.push('## Forecast error by model version (covered, reviewed periods only)', '');
  L.push('| Asset type | Model | Periods used / expected | MAE | Bias (forecast - actual) |', '|---|---|---|---|---|');
  for (const s of checks.errorStats) L.push(`| ${s.assetType} | ${s.model} | ${s.n} / ${s.expected} | ${mwh(s.maeMwh)} | ${mwh(s.biasMwh)} |`);
  L.push('');

  L.push('## Manual review', '');
  if (!checks.review.length) L.push('- Nothing required review.');
  for (const r of checks.review) {
    const choice = m.resolutions[r.id];
    const opt = r.options.find((o) => o.value === choice);
    L.push(`- ${r.title}: ${opt ? `**${opt.label}**. ${opt.effect}` : '**OPEN**, blocks conclusion'}`);
  }
  L.push('');

  L.push('## Assumptions (all fictional)', '');
  L.push(`- Demand spike: +${a.spikePct}% on all demand assets, SP ${a.spikeStart}-${a.spikeEnd}, not present in the forecast`);
  L.push(`- Generator outage: ${a.outageAsset} at 0 MWh, SP ${a.outageStart}-${a.outageEnd}; forecast corrected after ${a.detectionLagSps} SP detection lag`);
  L.push(`- Reference price: £${a.peakPrice}/MWh SP ${a.peakStart}-${a.peakEnd}, £${a.offPeakPrice}/MWh otherwise`);
  L.push(`- Short premium +${a.shortPremiumPct}%; long spill value lost ${a.longDiscountPct}%`);
  L.push(`- Stale forecast threshold: ${a.staleHours} h before period start`, '');

  L.push('## Formulas', '');
  L.push('- net position = generation - demand (per period, all assets)');
  L.push('- imbalance = actual net - forecast net. Negative = short, positive = long');
  L.push('- short cost = |imbalance| x reference price x (1 + short premium)');
  L.push('- long cost = imbalance x reference price x long spill loss');
  L.push('- scenario total = sum over periods; only reported when every period is covered and reviewed', '');

  L.push('## Results', '');
  L.push('| Scenario | Status | Short | Long | Illustrative cost | Worst period |', '|---|---|---|---|---|---|');
  for (const r of results) {
    const t = r.totals;
    L.push(`| ${r.label} | ${r.status.toUpperCase()} | ${t ? mwh(t.shortMwh) : 'withheld'} | ${t ? mwh(t.longMwh) : 'withheld'} | ${t ? gbp(t.costGbp) : 'withheld'} | ${t && t.worstSp ? `SP ${t.worstSp} (${gbp(t.worstCostGbp)})` : 'n/a'} |`);
  }
  L.push('');
  for (const r of results.filter((x) => x.status !== 'ready')) {
    L.push(`**${r.label} not concluded:** ${r.reasons.join(' ')}`);
    L.push(`Covered-only subtotal for context (not a conclusion): ${gbp(r.coveredSubtotal.costGbp)} over ${r.okPeriods} of ${r.periods.length} periods.`, '');
  }
  const base = results.find((r) => r.id === 'baseline')?.totals;
  if (allReady && base) {
    L.push('## Operational trade-offs', '');
    for (const r of results.filter((x) => x.id !== 'baseline')) L.push(`- ${r.label} adds ${gbp(round(r.totals!.costGbp - base.costGbp, 2))} vs baseline.`);
    const pts = m.lag.filter((p) => p.costGbp !== null);
    if (pts.length > 1) {
      L.push(`- Outage detection lag sensitivity: ${pts.map((p) => `${p.lag} SP → ${gbp(p.costGbp)}`).join('; ')}.`);
      const first = pts[0], last = pts[pts.length - 1];
      if (last.lag > first.lag) L.push(`- Each extra SP of detection lag costs about ${gbp(round((last.costGbp! - first.costGbp!) / (last.lag - first.lag), 2))} in this fictional setup.`);
    }
    L.push('');
  }
  L.push('## Reviewer note', '', m.note.trim() || '_None recorded._', '');
  L.push('## Decision', '', '_To be made by an accountable person. This tool does not make or recommend a trade._', '');
  return L.join('\n');
}
