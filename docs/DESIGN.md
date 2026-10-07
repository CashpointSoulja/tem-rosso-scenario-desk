# DESIGN.md: tem Rosso Scenario Desk

Independent concept by Ayo Ahmed. Not affiliated with tem.

This file was written **before any application code**. It records what I saw on tem's live public site and how the prototype mirrors it. Sources were checked on 2026-10-07 (see `docs/SOURCES.md`).

## 1. What was inspected

| Source | What I took from it |
|---|---|
| https://tem.energy/ (desktop 1366px and mobile 390px renders) | Logo, nav treatment, colour, type scale, hero, card style |
| https://tem.energy/generators | Product UI photo ("Insights" screen: white canvas, serif page title, Buy/Sell tabs, line chart, mono numeric cards) |
| Page HTML/CSS (Framer build) | Exact font families, colour tokens, inline logo SVG |
| https://jobs.ashbyhq.com/tem/6be75144-8335-475b-a7c3-2e9ca68ae48f | Rosso scope: forecasting, pricing optimisation, portfolio balancing, imbalance |

Reference renders are in `docs/brand/ref-*.jpg` (captured from the public site for design reference only).

Rosso has no public product page or docs. Its scope comes only from the JD. So the prototype copies tem's **public brand and RED™ product UI language**. It does not claim to show what Rosso looks like inside.

## 2. Logo

- The **literal official mark** is the inline SVG from the tem.energy nav (`viewBox="0 0 91 24"`): a four-point star plus the lowercase wordmark "tem", in a single path.
- Saved unmodified except for one change: its CSS-variable fill is resolved to the token value `#FF3F10`. Files: `public/tem-logo.svg`, `docs/brand/tem-logo.svg`.
- Placement: top-left of the pill nav, about 24px tall, as on tem.energy. It is never recoloured except white-on-orange, which the site itself uses for the hero star.
- Beside it, always visible: **"Independent concept by Ayo Ahmed. Not affiliated with tem."**

## 3. Colour tokens (from the site's CSS)

| Token | Hex | Use on tem.energy | Use here |
|---|---|---|---|
| `--tem-orange` | `#FF3F10` | Hero background, logo, primary pill CTA, headline text on white | Primary buttons, logo, active tab, scenario series |
| `--tem-orange-deep` | `#EC2E00` | Hover / gradient edge | Button hover, blocked-state accent |
| `--ink` | `#222222` | Body text (most frequent colour) | Body text, baseline series |
| `--ink-2` | `#404040` | Nav link text | Secondary text |
| `--muted` | `#737373` | Captions | Captions, axis labels |
| `--black` | `#000000` | Full-bleed black statement band | Footer band |
| `--cream` | `#F7F4F1` | Warm off-white surfaces | App background |
| `--cream-2` | `#FAF8F7` / `#F1F0EE` | Card / divider tints | Table zebra, dividers |
| `--peach` | `#FFF3EA` / `#FCC492` | Soft orange tint | "Needs review" chips |
| `--stone` | `#9D9287` | Warm grey accent | Borders on cream |
| `--white` | `#FFFFFF` | Nav pill, cards | Cards, nav pill |

Status colours are not tem tokens. I added them for clarity and kept them warm and muted: ok `#1F7A4D`, review `#B25E00` on peach, blocked `#EC2E00` on `#FFF1EC`. Status is never shown by colour alone. Every status also has a text label.

## 4. Typography

| Site font | Role on site | Licence | Fallback used here |
|---|---|---|---|
| **PP Neue Montreal** (Medium 500, Regular 400), letter-spacing -0.01em, line-height ~1.0-1.2 for headings | Nav, section headlines, body | Proprietary (Pangram Pangram) | **Inter Tight** (variable, OFL) at the same weights and tracking |
| **Victor Serif Smooth** | Big hero statements ("Power, as it should be"), the product's serif page title ("Insights") | Proprietary | **Instrument Serif** (OFL) |
| **Fragment Mono** | Numeric/technical labels | OFL (Google Fonts) | **Fragment Mono**, the same font, self-hosted |

Scale (desktop): page title serif 44/1.0; section heading sans 500 24/1.1; body 15/1.5; numeric mono 13-14. Mobile: title 34, body 15 (never below 13 for data).

## 5. UI treatment to mirror

- **Floating pill nav**: white, fully rounded (radius 999), inset 16px from the viewport edge, with the logo on the left, links in the centre and an orange pill CTA on the right. On mobile it collapses into a compact pill.
- **Primary CTA**: an orange `#FF3F10` pill with white sans 500 text and a trailing arrow (→).
- **Secondary**: a text link in orange, as with "Log in".
- **Cards**: white, radius ~20px, no heavy shadows, a thin warm border on cream backgrounds.
- **Product screen language** (from the RED™ Insights photo): a white canvas, a serif page title, small underline tabs (Buy / Sell), a pill filter row, a line chart with dotted markers, and mono numeric stat cards.
- **Motion**: restrained. Short fades, with no parallax inside the tool.
- **Voice**: plain, confident, short sentences ("Bills with nothing to hide"). In the tool, every number states its unit and where it came from.

## 6. How the scenario desk applies it

- Layout: the pill nav, then a serif page title "Scenario desk", then underline tabs per step (**Data → Checks → Scenarios → Trace → Memo**).
- A cream app background with white cards. Charts use ink for the baseline, orange for the selected scenario, and dashed stone for the forecast. Each half-hour point is clickable and opens its source CSV row.
- Blocked states use a full-width white card with an orange-deep left rule and the words "Conclusion blocked", plus the reason and the affected settlement periods.
- Accessibility: WCAG AA contrast (orange `#FF3F10` on white is used for large text and buttons only; small orange text uses `#C72E00` at 4.9:1). Visible 2px focus rings in ink. All controls are native buttons, inputs and selects with labels.
- Responsive breakpoints: ≥1100 two-column (controls | results); 700-1099 stacked with a sticky step tabs bar; <700 single column, with tables turning into labelled row cards and charts scrolling horizontally inside their own card only (no page overflow).

## 7. What this is not

- It is not an official tem or Rosso product, and it is not tem's internal model.
- It uses no live prices and no real trades. All data is fictional.
- It does not judge tem's systems.
