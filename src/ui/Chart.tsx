import type { KeyboardEvent } from 'react';
import type { PeriodResult } from '../engine/types';

const BAR = 16;
const GAP = 4;
const H = 240;
const PAD_L = 52;
const PAD_B = 34;

export function Chart({ periods, selected, onSelect }: { periods: PeriodResult[]; selected: number | null; onSelect: (sp: number) => void }) {
  const values = periods.map((p) => (p.costGbp === null ? 0 : p.costGbp));
  const max = Math.max(50, ...values);
  const scale = (H - PAD_B - 16) / max;
  const width = PAD_L + periods.length * (BAR + GAP) + 8;
  const ticks = [0, max / 2, max];
  const key = (e: KeyboardEvent, sp: number) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(sp); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = Math.min(periods.length, Math.max(1, sp + (e.key === 'ArrowRight' ? 1 : -1)));
      onSelect(next);
      (document.querySelector(`[data-sp="${next}"]`) as SVGGElement | null)?.focus();
    }
  };
  return (
    <div className="chart-scroll">
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="group" aria-label="Illustrative cost per settlement period. Each bar is focusable; press Enter to trace it.">
        {ticks.map((t) => {
          const y = H - PAD_B - t * scale;
          return (
            <g key={t} aria-hidden="true">
              <line x1={PAD_L - 4} x2={width} y1={y} y2={y} className="grid" />
              <text x={PAD_L - 8} y={y + 4} className="axis" textAnchor="end">£{Math.round(t)}</text>
            </g>
          );
        })}
        {periods.map((p, i) => {
          const x = PAD_L + i * (BAR + GAP);
          const cls = p.status === 'blocked' ? 'bar-blocked' : p.status === 'review' ? 'bar-review' : (p.imbalanceMwh ?? 0) < 0 ? 'bar-short' : 'bar-long';
          const h = p.status === 'blocked' ? H - PAD_B - 16 : Math.max(2, (p.costGbp ?? 0) * scale);
          const desc = p.status === 'blocked' ? 'blocked, no value' : `${p.status === 'review' ? 'needs review, ' : ''}${(p.imbalanceMwh ?? 0) < 0 ? 'short' : 'long'} ${p.imbalanceMwh?.toFixed(3)} MWh, £${p.costGbp?.toFixed(2)}`;
          return (
            <g
              key={p.sp}
              data-sp={p.sp}
              tabIndex={0}
              role="button"
              aria-pressed={selected === p.sp}
              aria-label={`${p.label}: ${desc}`}
              className={`bar ${cls} ${selected === p.sp ? 'sel' : ''}`}
              onClick={() => onSelect(p.sp)}
              onKeyDown={(e) => key(e, p.sp)}
            >
              <rect x={x - GAP / 2} y={0} width={BAR + GAP} height={H - PAD_B + 4} className="hit" />
              <rect x={x} y={H - PAD_B - h} width={BAR} height={h} rx={3} className="fill" />
              {(p.sp === 1 || p.sp % 6 === 0) && <text x={x + BAR / 2} y={H - PAD_B + 16} className="axis" textAnchor="middle" aria-hidden="true">{p.sp}</text>}
            </g>
          );
        })}
        <text x={PAD_L} y={H - 4} className="axis" aria-hidden="true">Settlement period</text>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#FFF1EC" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#EC2E00" strokeWidth="2" />
          </pattern>
        </defs>
      </svg>
    </div>
  );
}
