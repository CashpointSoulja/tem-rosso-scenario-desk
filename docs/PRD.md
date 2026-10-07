# PRD: Rosso Scenario Desk (independent concept)

Independent concept by Ayo Ahmed. Not affiliated with tem. Synthetic data and fictional prices only. This document doesn't describe how Rosso works inside tem. It sets out a small, testable product idea based on the public job description.

## Problem

When a portfolio relies on ML forecasts, the important product questions usually come up on bad days: a demand spike the model missed, a generator dropping out, a meter batch that never arrived. Three things tend to get mixed together:

1. **Forecast error.** The model was wrong about readings we do have.
2. **Data coverage.** We don't have the readings at all.
3. **Scenario economics.** What a plausible failure would cost, under assumptions someone can see and challenge.

If missing data is quietly treated as zero, a coverage problem looks like a forecasting problem, and a cost estimate can look precise when it shouldn't exist. If the assumptions are hidden, nobody can tell whether a number moved because the world changed or because a parameter did.

## Hypothesis

Product decisions on an ML-led energy portfolio get better, and get made faster, when every scenario number shows its assumptions, traces to its source rows, and refuses to conclude on incomplete or unreviewed data.

## Users

- **Portfolio/trading PM.** Decides what to build next: faster outage detection, better peak forecasting, or fixing data coverage.
- **Portfolio analyst.** Reviews a day, resolves conflicting or stale inputs, and writes the memo.
- **ML/forecasting engineer.** Needs model-version error kept separate from data gaps, so a model change is judged on the periods it actually forecast.

## Scope (v1, shipped)

| # | Requirement | Where |
|---|---|---|
| R1 | Load a half-hourly CSV of demand, generation and forecast values, from a seeded example or an upload | Step 1 |
| R2 | Validate columns, dates, settlement periods (46/48/50 for clock changes), numbers, asset types and duplicate ids. Rejected rows become missing data, never zero | `src/engine/validate.ts` |
| R3 | Report coverage (slots with a reading) separately from forecast error (MAE and bias for each model version) | Step 2 |
| R4 | Send conflicting resends, stale forecasts and mid-day model-version changes to manual review. Results don't conclude until a person decides | Step 2 |
| R5 | Baseline, demand spike and generator outage scenarios, using documented formulas and editable fictional assumptions | Steps 3-4 |
| R6 | Missing or excluded readings block the period and the scenario total. A covered-only subtotal is shown for context and labelled as not a conclusion | Step 3 |
| R7 | Every chart bar traces to the raw CSV line(s) behind it and to the scenario transforms applied | Step 3 trace |
| R8 | Quantify trade-offs: outage cost by detection lag, spike cost compared with baseline, and periods that can't be valued | Step 5 |
| R9 | Export a decision memo (Markdown) and a scenario CSV that carry provenance, assumptions, review decisions and blockers | Step 6 |
| R10 | Reset everything, or only the assumptions | Nav and Step 4 |

## Out of scope

Live prices, market connections, real trades, automated or recommended trades, real customers or meters, accounts and saving server-side. The tool informs a human decision, and the memo ends with "To be made by an accountable person".

## Formulas

See [DATA.md](DATA.md#formulas). In short:

- `imbalance = actual net − forecast net`, where `net = generation − demand`. Negative means short.
- Short cost = `|imbalance| × price × (1 + short premium)`. Long cost = `imbalance × price × long spill loss`.
- Totals are shown only when every period is covered and reviewed.

## Acceptance criteria

- The clean day concludes all three scenarios, and spike and outage both cost more than baseline.
- The missing-meter day blocks all scenarios and lists exactly the 7 missing slots.
- The resend day needs 3 reviews. Accepting all three concludes it, and excluding stale rows blocks it.
- A 0.000 reading is used as a value, while a blank reading blocks.
- The clock-change day has 50 periods with correct local labels.
- Every concluded period traces to one row per asset.
- At 390px wide, the page has no horizontal page overflow, and the chart scrolls inside its own card.

All of the above are automated in `src/engine/*.test.ts` or `scripts/flow-check.mjs`. Results are in [TEST_RESULTS.md](TEST_RESULTS.md).
