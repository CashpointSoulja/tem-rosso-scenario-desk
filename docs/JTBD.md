# Jobs to be done

Independent concept. These are hypotheses based on the public Rosso job description. They don't come from user research at tem.

## Core job

> When a day on the portfolio goes wrong, or might, I want to see what it would cost under assumptions I can defend, and whether the data even supports an answer, so I can decide what to fix first without being misled by a confident number.

## Job map

| Stage | Job | What gets in the way today (hypothesis) | What the desk does |
|---|---|---|---|
| Gather | Get one day's forecast and actuals in one place | Partial meter batches and resends | Validates on load and lists every rejected line with its reason |
| Check | Know whether the data is complete before reading any number | Blanks treated as zero, so an imbalance appears that doesn't exist | Shows coverage as its own number and blocks gaps |
| Separate | Tell model error apart from missing data | Pooled error stats hide a model-version change | Shows MAE and bias for each model version, with "used / expected" counts |
| Decide on inputs | Resolve conflicting resends and stale forecasts | Silent last-write-wins | Review queue with explicit choices. Each choice is recorded in the memo |
| Stress | See the cost of plausible failure | Assumptions buried in a spreadsheet | Editable assumptions, published formulas, three scenarios side by side |
| Prioritise | Choose between faster detection, better peak forecasting and fixing coverage | Arguments without numbers | Lag sensitivity table and ranked signals in money terms |
| Communicate | Hand a decision to an accountable person | Screenshots lose context | Memo and CSV include source row ids, fingerprint, assumptions, decisions and blockers |

## Related jobs

- **ML engineer.** "When we ship a new model version mid-day, judge it only on the periods it forecast."
- **Commercial lead.** "Show me roughly what one more half-hour of outage-detection lag costs, so I can weigh it against engineering time."
