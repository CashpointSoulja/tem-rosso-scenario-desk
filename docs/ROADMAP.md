# Roadmap

## Now (shipped in this concept)

- Load from CSV, validate, check coverage, report forecast error for each model version.
- Review queue for conflicts, stale forecasts and model changes.
- Baseline, spike and outage scenarios with editable fictional assumptions.
- Trace from each bar to its source rows. Blocked periods and scenarios.
- Detection-lag trade-off table. Memo and CSV export.

## Next (v2, if validated)

1. **Real contracted position input.** Separate the traded position from the forecast, so imbalance is measured against what was actually contracted.
2. **Multi-day runs.** Track coverage and error trends over time, and catch regressions after a model change.
3. **Partial outages and ramps.** Outage as a % of capacity with a recovery profile.
4. **Saved review log.** Server-side audit of who resolved what and when, kept alongside the memo.
5. **Per-asset spike shapes** using historical percentiles instead of a flat uplift.
6. **Threshold alerts.** "Coverage below X% on the latest batch" as a notification, not a dashboard tile.

## Future

- Scenario library shared across the team, with named assumption sets.
- Comparing two model versions on the same day (shadow mode).
- Proper price scenarios from an owned price model. Not live prices in this tool.

## Drop

- Automated trade suggestions. These are out of scope on purpose: the tool frames decisions, it doesn't make them.
- Generic KPI dashboard tiles that don't link to a decision.
