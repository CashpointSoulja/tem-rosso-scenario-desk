# Viability memo: how this maps to the Rosso Senior PM role

Source: the public job description at https://jobs.ashbyhq.com/tem/6be75144-8335-475b-a7c3-2e9ca68ae48f (checked 2026-10-07). The quotes below are from that posting. Nothing here claims knowledge of tem's internal systems.

| JD says | What this concept demonstrates |
|---|---|
| "fulfilling and balancing a growing two-sided portfolio, managing imbalance, and finding the revenue and margin in every position we hold" | The desk's central quantity is imbalance on a two-sided (demand plus generation) portfolio. It's priced, split into short and long, and compared across failure scenarios |
| "Set clear success criteria for how well a model or forecast needs to perform for the product to work" | MAE and bias for each model version, with used/expected counts. Explicit rules for when a result is allowed to conclude |
| "design for the edge cases and operational reality of a system that carries live financial risk" | 18 edge-case tests: blank vs 0.000, conflicting resends, stale forecasts, model switch mid-day, 46/50-period clock-change days, mixed dates, malformed rows |
| "reason about model performance and error as business indicators" | Forecast error and data coverage are reported separately. Outage detection lag is converted into money for each settlement period |
| "Treat hedging, imbalance and trading decisions as product decisions" | Scenario results feed a prioritisation panel. The decision is left to an accountable person, not automated |
| "how to ensure Rosso reacts at scale to any event in the system" | The detection-lag sensitivity frames "react faster" as a measurable product bet |
| "Decide what to formalise, what stays a prototype and what to drop" | [ROADMAP.md](ROADMAP.md) keeps Now, Next and Future separate and lists what to drop |
| "Drive open product decisions to a close" | The review queue makes every open input decision explicit and records it in the memo |
| "A clear, structured communicator, especially in writing" | The exported decision memo is the main output |
| "AI-native, AI-literate and AI-critical" | No fake ML. The concept is built around the point that model output needs coverage checks and human review |

## Why this would be worth building for real (hypothesis)

- On the synthetic clean day, one extra settlement period of outage-detection lag costs about £486. Across a portfolio with thousands of sites, a framing like "cost per half-hour of lag" makes detection work easy to compare with forecasting work.
- Making "blocked" an explicit outcome stops gaps in the data from being reported as forecast error. That's a cheap control to add at the point where people make decisions.

## What I would need to validate first

1. Whether analysts currently treat gaps as zero, or have some other convention. Ask before building.
2. What the real contracted position is, as distinct from the forecast.
3. Which decisions actually come out of scenario review today.
