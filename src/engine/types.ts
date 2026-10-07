export type AssetType = 'demand' | 'generation';

export interface SourceRow {
  rowId: string;
  /** 1-based line number in the source CSV (header is line 1). */
  line: number;
  date: string;
  sp: number;
  assetId: string;
  assetType: AssetType;
  /** null = blank in the file. Blank is never treated as zero. */
  forecastMwh: number | null;
  actualMwh: number | null;
  model: string;
  issuedAt: string;
  raw: string;
}

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  id: string;
  severity: Severity;
  code: string;
  message: string;
  line?: number;
  rowId?: string;
  assetId?: string;
  sp?: number;
}

export interface Asset {
  id: string;
  type: AssetType;
}

export interface Dataset {
  name: string;
  text: string;
  fingerprint: string;
  date: string | null;
  expectedSps: number;
  rows: SourceRow[];
  assets: Asset[];
  issues: Issue[];
  /** Header problems that make the whole file unusable. */
  fatal: boolean;
}

export type SlotStatus = 'ok' | 'gap' | 'review' | 'excluded';

export interface Slot {
  assetId: string;
  assetType: AssetType;
  sp: number;
  status: SlotStatus;
  row: SourceRow | null;
  candidates: SourceRow[];
  reason: string | null;
}

export type ReviewKind = 'conflict' | 'stale-forecast' | 'model-change';

export interface ReviewOption {
  value: string;
  label: string;
  effect: string;
}

export interface ReviewItem {
  id: string;
  kind: ReviewKind;
  assetId: string;
  sp?: number;
  title: string;
  detail: string;
  rowIds: string[];
  options: ReviewOption[];
}

export type Resolutions = Record<string, string>;

export interface ForecastErrorStat {
  assetType: AssetType;
  model: string;
  n: number;
  expected: number;
  maeMwh: number | null;
  biasMwh: number | null;
}

export interface CheckResult {
  slots: Slot[];
  review: ReviewItem[];
  openReview: ReviewItem[];
  coverage: { expected: number; covered: number; gaps: Slot[] };
  errorStats: ForecastErrorStat[];
  issues: Issue[];
}

export interface Assumptions {
  spikePct: number;
  spikeStart: number;
  spikeEnd: number;
  outageAsset: string;
  outageStart: number;
  outageEnd: number;
  /** Settlement periods between outage start and the assumed manual re-forecast. */
  detectionLagSps: number;
  peakStart: number;
  peakEnd: number;
  peakPrice: number;
  offPeakPrice: number;
  shortPremiumPct: number;
  longDiscountPct: number;
  staleHours: number;
}

export type ScenarioId = 'baseline' | 'spike' | 'outage';
export type PeriodStatus = 'ok' | 'review' | 'blocked';

export interface PeriodResult {
  sp: number;
  label: string;
  status: PeriodStatus;
  reasons: string[];
  demandActual: number | null;
  genActual: number | null;
  demandFcst: number | null;
  genFcst: number | null;
  /** actual net minus forecast net, MWh. Positive = long, negative = short. */
  imbalanceMwh: number | null;
  refPrice: number;
  costGbp: number | null;
  sourceRowIds: string[];
  transforms: string[];
}

export type ScenarioStatus = 'ready' | 'review' | 'blocked';

export interface ScenarioTotals {
  shortMwh: number;
  longMwh: number;
  netMwh: number;
  costGbp: number;
  worstSp: number | null;
  worstCostGbp: number;
}

export interface ScenarioResult {
  id: ScenarioId;
  label: string;
  status: ScenarioStatus;
  reasons: string[];
  periods: PeriodResult[];
  /** Only present when status is ready. */
  totals: ScenarioTotals | null;
  /** Sum over ok periods only. Never a conclusion. */
  coveredSubtotal: ScenarioTotals;
  okPeriods: number;
}
