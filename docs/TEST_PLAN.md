# Test plan

| Layer | What | How | Command |
|---|---|---|---|
| Engine: fixtures | Each seeded day produces its documented outcome (ready / blocked / review / 50-period) | Vitest | `npm test` |
| Engine: formulas | Short and long cost formulas, 0% spike = baseline, outage cost rising with detection lag | Vitest | `npm test` |
| Engine: provenance | Every concluded period traces to exactly one source row per asset, and every id exists in the file | Vitest | `npm test` |
| Engine: edge cases | Blank vs 0.000, absent rows, identical vs conflicting resends, malformed numbers, negatives, bad SP, bad asset type, duplicate ids, missing columns, empty file, mixed dates, unparseable issue time, stale threshold as an assumption, model-version split, unknown outage asset, 46- and 50-period days, 48 rows on a 50-period day, quoted CSV and CRLF. Fail closed: any rejected row blocks every scenario, an asset with no accepted rows is reported (not dropped), wrong field counts are rejected, unterminated or stray quotes are fatal, binary or non-UTF-8 files are fatal. Final audit: a stale approval at 30 h does not carry over to 24 h, nor to a resend with different rows; 400-digit, exponent and >10,000 MWh values are rejected without `Infinity`; out-of-range or inverted assumptions (e.g. peak price -180) block every scenario; forecasts issued after delivery (2099) block; blank lines and CRLF keep exact physical line numbers and raw text | Vitest | `npm run evals` |
| Exports | CSV has a header with `source_row_ids` and 1 + 3 × N rows. The memo withholds blocked totals and states there's no automated trading. Both exports refuse an unreadable or empty file instead of writing zero rows; a valid blocked day still exports with totals withheld. Every CSV row carries `source_file`, `dataset_fingerprint`, `assumptions_fictional` and `review_decisions` | Vitest | `npm test` |
| Types and build | Strict TypeScript and the Vite production build | tsc + vite | `npm run build` |
| UI flow | At 1366, 820 and 390 px: load, trace a bar by click and by keyboard (ArrowRight), switch scenario, load the blocked day, trace a blocked bar, resolve 3 reviews and check that all scenarios become Ready, change an assumption, download memo and CSV, upload three invalid files and check all scenarios Block and export is disabled for unreadable files, reset, set peak price to -180 and check all scenarios Block with the error shown, reset assumptions and check Ready again. Fails on page errors or horizontal page overflow | Playwright | `npm run preview` then `npm run flow` |
| Visual | Screenshots at desktop, tablet and phone sizes, inspected by eye for overflow, clipping and readability | Manual review of `test-results/flow-*.png` | |

## Not covered

- Assistive technology runs with a real screen reader. The markup uses native controls, labels, fieldsets and aria-live regions, but hasn't been verified with NVDA or VoiceOver.
- Browsers other than Chromium.
- Uploaded files above 2 MB, which are refused by design.
