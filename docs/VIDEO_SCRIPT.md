# Walkthrough script

Recorded from the real, running app (production build). There are no staged screens. Narration is a synthetic text-to-speech voice, not a clone of any real person. Captions are burned in, and an `.srt` file is published alongside the MP4.

| # | On screen (real interaction) | Voiceover |
|---|---|---|
| 1 | Top of the app, clean day loaded | This is the Rosso Scenario Desk, an independent concept I built for the tem Senior Product Manager role. |
| 2 | Hold on the "Simulated" note | Everything is synthetic. Fictional assets, fictional prices, and no trades. |
| 3 | Click "Clean day" | I load one settlement day of half-hourly demand, generation and forecast data. |
| 4 | Scroll to Checks | Checks come first. Coverage asks whether every reading is actually there. |
| 5 | Forecast error table | Forecast error is reported separately, and split by model version. |
| 6 | Scenario cards, click Demand spike | The clean day concludes. An unforecast demand spike adds about nine hundred and seventy pounds. |
| 7 | Click Generator outage | An outage costs more, because the forecast is only corrected after a detection lag. |
| 8 | Click a peak bar, trace panel | Every bar traces back to the raw CSV lines behind it, and to the scenario change applied. |
| 9 | Change detection lag to 1, trade-offs table | Assumptions are editable. Cutting detection lag to one period cuts the outage cost sharply. |
| 10 | Click "Missing meter batch" | Now a day with a missing meter batch. |
| 11 | Blocked cards and hatched bars | Missing readings are not zero. So every total is withheld, and the gaps are hatched. |
| 12 | Click a hatched bar | The trace shows the blank reading that caused the block. |
| 13 | Click "Resend + model change", resolve 3 reviews | Stale or conflicting inputs go to a person. Each decision is recorded, then the results conclude. |
| 14 | Scroll to Export, type reviewer, download memo and CSV | Finally, I export a decision memo and a scenario CSV, with every source row ID. |
| 15 | Memo preview, decision section | The decision itself stays with an accountable person, not the tool. |

The exact timings are in `media/walkthrough.srt`.
