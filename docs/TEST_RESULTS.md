# Test results

Run on 2026-10-07 with Node v22.23.3 and TypeScript 5.6.3, on Linux. These are the exact command outcomes. Nothing in this file is edited or summarised from memory.

## Unit and edge-case tests: `npm test`

```text
 ✓ src/engine/edge-cases.test.ts > edge cases > a perfect forecast concludes at zero baseline cost
 ✓ src/engine/edge-cases.test.ts > edge cases > blank actual is a coverage gap, not zero demand
 ✓ src/engine/edge-cases.test.ts > edge cases > explicit 0.000 actual is a real reading and concludes
 ✓ src/engine/edge-cases.test.ts > edge cases > absent row blocks
 ✓ src/engine/edge-cases.test.ts > edge cases > identical resend is deduplicated without review
 ✓ src/engine/edge-cases.test.ts > edge cases > conflicting resend needs review; excluding it blocks
 ✓ src/engine/edge-cases.test.ts > edge cases > rejects malformed values without zero-filling
 ✓ src/engine/edge-cases.test.ts > edge cases > rejects negative, bad SP, bad asset type and duplicate ids
 ✓ src/engine/edge-cases.test.ts > edge cases > missing columns is fatal and every scenario blocks
 ✓ src/engine/edge-cases.test.ts > edge cases > empty file is fatal
 ✓ src/engine/edge-cases.test.ts > edge cases > mixed settlement dates are flagged, excluded and block conclusions
 ✓ src/engine/edge-cases.test.ts > edge cases > unparseable issue time counts as stale and needs review
 ✓ src/engine/edge-cases.test.ts > edge cases > stale threshold is an assumption
 ✓ src/engine/edge-cases.test.ts > edge cases > model version change splits error stats and needs acknowledgement
 ✓ src/engine/edge-cases.test.ts > edge cases > outage on an unknown asset blocks only the outage scenario
 ✓ src/engine/edge-cases.test.ts > edge cases > spring clock-change day expects 46 periods
 ✓ src/engine/edge-cases.test.ts > edge cases > a 48-period file on a 50-period day blocks the missing periods
 ✓ src/engine/edge-cases.test.ts > edge cases > quoted CSV fields and CRLF line endings parse
 ✓ src/engine/edge-cases.test.ts > edge cases > an asset whose rows are all malformed is reported, not silently dropped, and blocks every scenario
 ✓ src/engine/edge-cases.test.ts > edge cases > a single rejected row blocks every scenario even when its slot is otherwise covered
 ✓ src/engine/edge-cases.test.ts > edge cases > a row with the wrong number of fields is rejected
 ✓ src/engine/edge-cases.test.ts > edge cases > an unterminated quote is fatal instead of swallowing the rest of the file
 ✓ src/engine/edge-cases.test.ts > edge cases > stray or trailing quote characters are fatal
 ✓ src/engine/edge-cases.test.ts > edge cases > binary or wrongly encoded files are unreadable and fatal
 ✓ src/engine/edge-cases.test.ts > edge cases > exports refuse unreadable or empty inputs instead of writing zero rows
 ✓ src/engine/edge-cases.test.ts > edge cases > a valid but blocked day still exports, with blocked totals withheld
 ✓ src/engine/edge-cases.test.ts > edge cases > a stale approval does not carry over when a lower threshold makes more rows stale
 ✓ src/engine/edge-cases.test.ts > edge cases > an approval does not carry over to a resend with different conflicting rows
 ✓ src/engine/edge-cases.test.ts > edge cases > huge or non-finite numbers are rejected instead of producing Infinity
 ✓ src/engine/edge-cases.test.ts > edge cases > out-of-range or inconsistent assumptions block every scenario
 ✓ src/engine/edge-cases.test.ts > edge cases > forecasts issued at or after the period starts are blocked, not Ready
 ✓ src/engine/edge-cases.test.ts > edge cases > blank lines do not shift physical line numbers or raw provenance
 ✓ src/engine/engine.test.ts > sample fixtures > clean day concludes all three scenarios
 ✓ src/engine/engine.test.ts > sample fixtures > missing meter batch blocks instead of zero-filling
 ✓ src/engine/engine.test.ts > sample fixtures > resend + model change needs review, then concludes after resolution
 ✓ src/engine/engine.test.ts > sample fixtures > chosen conflict row changes the result and is traced
 ✓ src/engine/engine.test.ts > sample fixtures > clock change day has 50 periods with local labels
 ✓ src/engine/engine.test.ts > sample fixtures > every period traces to one row per asset
 ✓ src/engine/engine.test.ts > formulas > short and long costs follow documented formula
 ✓ src/engine/engine.test.ts > formulas > outage cost rises monotonically with detection lag
 ✓ src/engine/engine.test.ts > formulas > 0% spike equals baseline
 ✓ src/engine/engine.test.ts > formulas > settlement period counts across clock changes
 ✓ src/engine/engine.test.ts > exports > csv and memo carry provenance and withhold blocked totals
 ✓ src/engine/engine.test.ts > exports > memo for ready data includes trade-offs
 ✓ src/engine/engine.test.ts > exports > scenario csv carries file, fingerprint, assumptions and review decisions on every row
 Test Files  2 passed (2)
      Tests  45 passed (45)
exit=0
```

`npm run evals` runs the 26 edge-case tests on their own.

## Typecheck and production build: `npm run build`

```text
> tem-rosso-scenario-desk@0.1.0 build
> tsc -b && vite build
vite v5.4.21 building for production...
transforming...
✓ 48 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                                     0.64 kB │ gzip:  0.39 kB
dist/assets/fragment-mono-latin-ext-400-normal-CT4YFKeK.woff        9.55 kB
dist/assets/instrument-serif-latin-ext-400-normal-CFCUzsTy.woff     9.86 kB
dist/assets/inter-tight-vietnamese-wght-normal-TKKdAiBA.woff2      10.48 kB
dist/assets/instrument-serif-latin-ext-400-normal-C2je3j2s.woff2   11.60 kB
dist/assets/inter-tight-greek-ext-wght-normal-DQgQPNk4.woff2       11.70 kB
dist/assets/fragment-mono-latin-ext-400-normal-BbKYyvR9.woff2      14.11 kB
dist/assets/inter-tight-cyrillic-wght-normal-BS41q_Tv.woff2        17.00 kB
dist/assets/instrument-serif-latin-400-normal-BVbkICAY.woff        18.34 kB
dist/assets/fragment-mono-latin-400-normal-BYwT3kSJ.woff           19.52 kB
dist/assets/instrument-serif-latin-400-normal-DnYpCC2O.woff2       21.03 kB
dist/assets/inter-tight-greek-wght-normal-sS1B39LI.woff2           22.19 kB
dist/assets/fragment-mono-latin-400-normal-yxdJ5AmL.woff2          25.22 kB
dist/assets/inter-tight-cyrillic-ext-wght-normal-okcGN4Nq.woff2    26.66 kB
dist/assets/inter-tight-latin-wght-normal-DX-nOvPD.woff2           44.87 kB
dist/assets/inter-tight-latin-ext-wght-normal-B4u9PlvR.woff2       89.80 kB
dist/assets/index-BTKSJNa6.css                                     20.39 kB │ gzip:  8.58 kB
dist/assets/index-ot4e9Y9e.js                                     249.79 kB │ gzip: 71.17 kB
✓ built in 8.30s
exit=0
```

## Interaction check: `npm run preview` then `npm run flow`

Playwright 1.48.2 on Chromium. The flow covers: load clean day, click a peak bar and press ArrowRight to trace SP 36, switch to Demand spike, load the missing-meter day and trace a hatched bar, load resend + model change and resolve 3 reviews, set detection lag to 1, download memo and CSV, upload three invalid files (an asset whose rows all have a misspelt asset_type, an unterminated quote, unreadable bytes) and check that every scenario is Blocked and that export is disabled for the two unreadable files, then reset.

```text
PASS desk {"traced":"SP 36 · 17:30 BST\nReady\nDemand spike","statuses":["Ready","Ready","Ready"],"outageCost":"£493","files":["decision-memo-2026-10-07-a0a41402.md","scenarios-2026-10-07-a0a41402.csv"],"failClosed":{"bad-asset.csv":{"statuses":"Blocked,Blocked,Blocked","exportDisabled":false},"bad-quote.csv":{"statuses":"Blocked,Blocked,Blocked","exportDisabled":true},"bad-bytes.csv":{"statuses":"Blocked,Blocked,Blocked","exportDisabled":true}},"negPeak":"Blocked,Blocked,Blocked","restored":"Ready,Ready,Ready","after":"Clean day","overflowPx":0,"errs":[]}
PASS tab {"traced":"SP 36 · 17:30 BST\nReady\nDemand spike","statuses":["Ready","Ready","Ready"],"outageCost":"£493","files":["decision-memo-2026-10-07-a0a41402.md","scenarios-2026-10-07-a0a41402.csv"],"failClosed":{"bad-asset.csv":{"statuses":"Blocked,Blocked,Blocked","exportDisabled":false},"bad-quote.csv":{"statuses":"Blocked,Blocked,Blocked","exportDisabled":true},"bad-bytes.csv":{"statuses":"Blocked,Blocked,Blocked","exportDisabled":true}},"negPeak":"Blocked,Blocked,Blocked","restored":"Ready,Ready,Ready","after":"Clean day","overflowPx":0,"errs":[]}
PASS mob {"traced":"SP 36 · 17:30 BST\nReady\nDemand spike","statuses":["Ready","Ready","Ready"],"outageCost":"£493","files":["decision-memo-2026-10-07-a0a41402.md","scenarios-2026-10-07-a0a41402.csv"],"failClosed":{"bad-asset.csv":{"statuses":"Blocked,Blocked,Blocked","exportDisabled":false},"bad-quote.csv":{"statuses":"Blocked,Blocked,Blocked","exportDisabled":true},"bad-bytes.csv":{"statuses":"Blocked,Blocked,Blocked","exportDisabled":true}},"negPeak":"Blocked,Blocked,Blocked","restored":"Ready,Ready,Ready","after":"Clean day","overflowPx":0,"errs":[]}
flow=0
```

`desk` = 1366×768, `tab` = 820×1180, `mob` = 390×844. `overflowPx` is the horizontal page overflow. The chart scrolls inside its own card on narrow screens. The exported memo for the resolved resend day reads "Overall status: READY", and its review section lists all three decisions. The exported CSV has 145 lines: a header plus 3 scenarios × 48 periods.

## Visual inspection

Screenshots of each flow step at all three widths were inspected by eye. Three issues were found and fixed:

| Issue | Fix |
|---|---|
| On a phone, the review headings wrapped awkwardly around the chip | Legend changed to block layout |
| The sticky header covered content on a phone | Header made static below 700 px, and scroll margins added to sections |
| Resolved review items showed "Covered", which is ambiguous | The chip now reads "Decided" |

## Known gaps

See [TEST_PLAN.md](TEST_PLAN.md#not-covered).
