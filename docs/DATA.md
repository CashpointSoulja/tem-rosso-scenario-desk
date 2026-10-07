# Data, formulas and fixtures

Everything here is synthetic. Fixtures come from `scripts/make-fixtures.mjs`, using a seeded random generator, so `npm run fixtures` always produces identical files.

## Schema

| Column | Meaning |
|---|---|
| `row_id` | Unique id for the line, used for tracing |
| `settlement_date` | Local settlement day `YYYY-MM-DD` |
| `sp` | Settlement period 1..N (N = 46, 48 or 50 depending on clock changes) |
| `asset_id` | Fictional asset (D-01, D-02 demand; G-01, G-02 generation) |
| `asset_type` | `demand` or `generation` |
| `forecast_mwh` | Forecast volume for the period, ≥ 0. Blank means missing |
| `actual_mwh` | Metered volume, ≥ 0. Blank means missing (**not zero**). `0.000` means a real zero |
| `forecast_model` | Model version label (e.g. `dmd-v2.3`) |
| `forecast_issued_at` | ISO timestamp when the forecast was issued |

## Formulas

For each settlement period `t`, summing across all assets:

```
net_actual(t)   = Σ gen_actual − Σ demand_actual
net_forecast(t) = Σ gen_forecast − Σ demand_forecast
imbalance(t)    = net_actual(t) − net_forecast(t)          (MWh; < 0 short, > 0 long)
price(t)        = peak price if peakStart ≤ t ≤ peakEnd else off-peak price   (fictional £/MWh)
cost(t)         = |imbalance| × price × (1 + shortPremium)   if short
                = imbalance  × price × longSpillLoss          if long
scenario total  = Σ cost(t), ONLY if every period is covered and reviewed
```

Scenarios:

- **Baseline:** the data as loaded.
- **Demand spike:** `demand_actual × (1 + uplift)` for SP in the spike window. The forecast is unchanged, because the spike wasn't forecast.
- **Generator outage:** the chosen generator's `actual = 0` across the outage window. Its forecast also drops to 0 once `detectionLag` periods have passed since the outage started, to represent a manual re-forecast.

## Rules that block or need review

| Condition | Result |
|---|---|
| Row missing for an asset or period, blank actual or forecast, or row rejected by validation | Period **blocked**. Scenario **blocked** |
| Two different rows for the same asset and period | Review: pick one or exclude |
| Identical duplicate rows | Deduplicated automatically, with an info note |
| Forecast issued more than the stale threshold before the period starts, or issue time unparseable | Review: accept or exclude (exclude means blocked) |
| Model version changes within the day for an asset | Review: acknowledge. Error stats are always split by version |
| Rows for more than one settlement date | Minority-date rows excluded with an error |
| Outage asset not a generator in the file | Outage scenario blocked |

## Seeded examples

| File | Outcome |
|---|---|
| `clean-day.csv` | 192/192 slots covered, all scenarios **ready** |
| `missing-meter-batch.csv` | D-02 actual blank SP 34-39, G-02 SP 12 row absent. All scenarios **blocked** |
| `resend-and-model-change.csv` | D-01 SP 20 resent with a different actual, G-02 forecast stale, D-01 model switches to `dmd-v2.4` at SP 25. **Needs review** |
| `clock-change-day.csv` | 25 Oct 2026, 50 periods. All **ready** |
