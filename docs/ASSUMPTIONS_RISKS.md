# Assumptions and risks

## Modelling assumptions (deliberately simple)

| Assumption | Why it's acceptable for a concept | What a real version needs |
|---|---|---|
| A single fictional reference price per period (peak or off-peak) | Keeps the cost formula readable and editable | Proper imbalance price data and dual-cash-out logic, owned by the trading team |
| The short premium and long spill loss are flat percentages | Makes the asymmetry between short and long visible | Price-dependent asymmetry |
| A demand spike is a uniform % uplift on all demand assets, not in the forecast | It's the simplest unforecast shock | Spike shapes for each asset and site |
| An outage sets the asset to 0 MWh. The forecast is corrected after N settlement periods of detection lag | It isolates the value of detection speed | Partial outages, ramping, and re-trading in intraday markets |
| Imbalance = actual net − forecast net, with the forecast treated as the contracted position | Easy to explain | Real contracted positions, which differ from the forecast |
| Forecasts older than the stale threshold (default 48 h) need review | A clear, adjustable rule | Freshness rules for each model and market |

None of these assumptions claim to describe Rosso's internal model.

## Product risks

| Risk | Likelihood | Impact | Mitigation in v1 |
|---|---|---|---|
| A number is read as a recommendation to trade | Medium | High | No recommend or trade actions. The memo leaves the decision blank. "Simulated" is labelled everywhere |
| The covered-only subtotal is quoted as the answer | Medium | Medium | It's labelled "for context and not a conclusion" and shown only next to the blocker text |
| Reviewers accept stale or conflicting data just to unblock | Medium | Medium | Every decision is written into the memo. Excluding is always an option |
| Over-simplification undermines trust with experts | High | Medium | Formulas and limits are published. The tool is positioned as a way to frame a decision, not as a pricing engine |
| Brand confusion (looks official) | Low | High | A non-affiliation label in the nav, footer, README and memo. Logo used only to show brand fit |
| Uploaded files containing real data | Low | Medium | Parsing happens in the browser. Nothing is uploaded or stored. The README asks people not to upload real data |

## Delivery risks

- The prototype is entirely in the browser with no backend, so it has no audit log beyond the exported memo.
- The UI has only been tested against one schema (`row_id, settlement_date, sp, asset_id, asset_type, forecast_mwh, actual_mwh, forecast_model, forecast_issued_at`).
