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
 ✓ src/engine/edge-cases.test.ts > edge cases > mixed settlement dates are flagged and excluded
 ✓ src/engine/edge-cases.test.ts > edge cases > unparseable issue time counts as stale and needs review
 ✓ src/engine/edge-cases.test.ts > edge cases > stale threshold is an assumption
 ✓ src/engine/edge-cases.test.ts > edge cases > model version change splits error stats and needs acknowledgement
 ✓ src/engine/edge-cases.test.ts > edge cases > outage on an unknown asset blocks only the outage scenario
 ✓ src/engine/edge-cases.test.ts > edge cases > spring clock-change day expects 46 periods
 ✓ src/engine/edge-cases.test.ts > edge cases > a 48-period file on a 50-period day blocks the missing periods
 ✓ src/engine/edge-cases.test.ts > edge cases > quoted CSV fields and CRLF line endings parse
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
 Test Files  2 passed (2)
      Tests  30 passed (30)
```

`npm run evals` runs the 18 edge-case tests on their own.

## Typecheck and production build: `npm run build`

```text
> tsc -b && vite build
✓ built in 8.07s
exit=0
```

## Interaction check: `npm run preview` then `npm run flow`

Playwright 1.48.2 on Chromium. The flow covers: load clean day, click a peak bar and press ArrowRight to trace SP 36, switch to Demand spike, load the missing-meter day and trace a hatched bar, load resend + model change and resolve 3 reviews, set detection lag to 1, download memo and CSV, reset.

```text
PASS desk {"traced":"SP 36 · 17:30 BST\nReady\nDemand spike","statuses":["Ready","Ready","Ready"],"outageCost":"£493","files":["decision-memo-2026-10-07-a0a41402.md","scenarios-2026-10-07-a0a41402.csv"],"after":"Clean day","overflowPx":0,"errs":[]}
PASS tab {"traced":"SP 36 · 17:30 BST\nReady\nDemand spike","statuses":["Ready","Ready","Ready"],"outageCost":"£493","files":["decision-memo-2026-10-07-a0a41402.md","scenarios-2026-10-07-a0a41402.csv"],"after":"Clean day","overflowPx":0,"errs":[]}
PASS mob {"traced":"SP 36 · 17:30 BST\nReady\nDemand spike","statuses":["Ready","Ready","Ready"],"outageCost":"£493","files":["decision-memo-2026-10-07-a0a41402.md","scenarios-2026-10-07-a0a41402.csv"],"after":"Clean day","overflowPx":0,"errs":[]}
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
