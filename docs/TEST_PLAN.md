# Test plan

| Layer | What | How | Command |
|---|---|---|---|
| Engine: fixtures | Each seeded day produces its documented outcome (ready / blocked / review / 50-period) | Vitest | `npm test` |
| Engine: formulas | Short and long cost formulas, 0% spike = baseline, outage cost rising with detection lag | Vitest | `npm test` |
| Engine: provenance | Every concluded period traces to exactly one source row per asset, and every id exists in the file | Vitest | `npm test` |
| Engine: edge cases | Blank vs 0.000, absent rows, identical vs conflicting resends, malformed numbers, negatives, bad SP, bad asset type, duplicate ids, missing columns, empty file, mixed dates, unparseable issue time, stale threshold as an assumption, model-version split, unknown outage asset, 46- and 50-period days, 48 rows on a 50-period day, quoted CSV and CRLF | Vitest | `npm run evals` |
| Exports | CSV has a header with `source_row_ids` and 1 + 3 × N rows. The memo withholds blocked totals and states there's no automated trading | Vitest | `npm test` |
| Types and build | Strict TypeScript and the Vite production build | tsc + vite | `npm run build` |
| UI flow | At 1366, 820 and 390 px: load, trace a bar by click and by keyboard (ArrowRight), switch scenario, load the blocked day, trace a blocked bar, resolve 3 reviews and check that all scenarios become Ready, change an assumption, download memo and CSV, reset. Fails on page errors or horizontal page overflow | Playwright | `npm run preview` then `npm run flow` |
| Visual | Screenshots at desktop, tablet and phone sizes, inspected by eye for overflow, clipping and readability | Manual review of `test-results/flow-*.png` | |

## Not covered

- Assistive technology runs with a real screen reader. The markup uses native controls, labels, fieldsets and aria-live regions, but hasn't been verified with NVDA or VoiceOver.
- Browsers other than Chromium.
- Uploaded files above 2 MB, which are refused by design.
