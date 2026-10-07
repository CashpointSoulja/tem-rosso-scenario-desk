# 5 Whys

Problem statement (hypothetical, synthetic): *"The outage post-mortem said imbalance cost was £X, but the number changed twice during review and nobody trusted the final one."*

1. **Why did the number change?** The first run treated a missing meter batch as zero demand. That made the portfolio look long, and later re-runs filled the gap.
2. **Why was missing data treated as zero?** The pipeline summed whatever rows existed. A blank cell and a real 0.000 MWh reading looked the same downstream.
3. **Why couldn't reviewers see that?** The output was a single total. It had no per-period coverage, no link back to source rows and no flag for gaps.
4. **Why was there only a total?** The tool was built to answer "how much?" and not "can we answer how much yet?". Coverage and forecast error were never separate concepts in the product.
5. **Why weren't they separate?** Nobody owned the success criteria for when a scenario result is *allowed* to exist. The question was treated as an engineering detail when it's really a product decision.

**Root cause:** there was no explicit, product-owned rule for when a cost conclusion is allowed.

**What this concept does about it:** it makes "blocked" a first-class outcome. Totals are withheld until every period is covered and every stale or conflicting input has been reviewed by a person, and every value traces to a source line.
