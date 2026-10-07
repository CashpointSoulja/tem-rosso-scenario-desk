# Metrics and success criteria

These are proposed metrics for a real version of the tool. The prototype only proves the mechanics on synthetic data. None of these numbers have been measured with real users.

## North star

**Share of scenario decisions made on fully covered, reviewed data,** measured over decisions where a memo was exported. Target for a pilot: 100% of *concluded* memos. Blocked memos are allowed and expected.

## Input metrics

| Metric | Definition | Pilot target (hypothesis) |
|---|---|---|
| Silent zero-fill rate | Periods where a blank or missing reading contributed 0 to a total | **0**, enforced in code and tested |
| Time from load to memo | Median minutes from file load to memo export, on days that need review | Under 10 minutes |
| Review resolution time | Median minutes from an item opening to a person's decision | Under 5 minutes per item |
| Trace usage | Share of exported memos where at least one bar was traced | Over 50%, as a signal that provenance is valued |
| Model-version split coverage | Share of mid-day model changes where error is reported per version | 100% |

## Guardrails

- No scenario total is shown while any period is blocked or under review. Automated test: `missing meter batch blocks instead of zero-filling`.
- No output that looks like an instruction to trade. The memo's decision section is always left for a person to complete.
- Fixtures and prices are labelled as synthetic on every screen and in every export.

## Operational trade-off metrics (demo values, synthetic clean day, default assumptions)

These come from `npm test` fixtures and the live UI. They're illustrative, not forecasts:

- Baseline illustrative imbalance cost: about £454.
- Demand spike (+25%, SP 33-38): about £1,426, which is about £972 more than baseline.
- Generator outage (G-02, SP 30-41, 4 SP detection lag): about £1,708, which is about £1,254 more than baseline.
- Outage cost by detection lag: 0 SP about £369, 1 SP £597, 2 SP £849, 4 SP £1,708, 6 SP £2,935, 8 SP £4,253. That's roughly £486 for each extra settlement period of lag.

How a PM would read this, on this fictional portfolio: detection lag drives cost the hardest, and the effect isn't linear. Peak demand forecasting comes next. On the missing-meter day, fixing coverage comes before either, because 7 of 48 periods can't be valued at all.
