# Parkday Guide

A from-scratch guide to all 64 scoped US national parks and the gateway towns
that make them reachable. Plan the park day, the days around it, and what to do
after you leave.

Live build: https://hanumabathini.github.io/parkday-guide-opencode/
Production target: parkdayguide.com (domain not yet purchased)

## What is here

- **64 park pages.** Entrance fees, passes, operating hours, contacts,
  activities and the official park link, retrieved from the National Park
  Service API and stamped with a retrieval date. Editorial sits in its own
  layer and is labelled as editorial.
- **119 gateway town pages.** Where to base yourself for each park, with honest
  notes on what to confirm before arriving. No invented drive times, prices or
  business recommendations.
- **10 planning guides.** Season, first trip, budget, reservations, camping,
  access, quiet months, driving, packing, and after the park.
- **About, methodology, accessibility, RV guide, privacy, blog and a free
  64 Parks Planning Checklist.**
- **Ask the guide.** A browser-side retrieval chatbot that answers only from the
  released park data, cites the park page, and refuses facts it does not have.
  No model call, no server, no question logging.

## Build

Requires Node 20 or newer. No dependencies.

```bash
node scripts/sync_nps_data.mjs <nps-parks-dump.json>   # refresh the fact layer
node scripts/validate_content.mjs                      # content gates
node site/build.mjs                                    # writes dist/
node scripts/validate_content.mjs --dist               # link + output gates
```

Or:

```bash
npm run build
npm run check
```

Local preview:

```bash
npx serve dist
```

### Deploying

```bash
# GitHub Pages project site
node site/build.mjs --base=/parkday-guide-opencode/ --url=https://hanumabathini.github.io/parkday-guide-opencode

# Production domain
node site/build.mjs --base=/ --url=https://parkdayguide.com
```

`dist/` is a complete static site. Publish it to any static host.

## Data

- `data/parks.json` — canonical fact layer, 64 records, NPS source and retrieval
  date on each.
- `data/nps-snapshot.json` — raw NPS API payload used for the last sync, so any
  fee or hour can be traced back.
- `content/towns/registry.json` — 119 towns mapped to the parks they serve.
- `content/editorial/*.json` — park and town editorial.
- `content/guides/`, `content/pages/` — markdown with frontmatter.

The sync refuses a scope that is not 64 parks. Sequoia and Kings Canyon are one
NPS unit (SEKI) presented as two scoped park pages.

## Rules this repo enforces

- Facts come from NPS.gov or Recreation.gov only, never from a competitor or a
  model's memory.
- No invented prices, fees, hours, dates, phone numbers, mileages or policies.
- No copied text. Editorial is written from scratch and checked against the
  official page.
- No hype words, no unprovable superlatives, no em dashes.
- Images render only when their rights status is cleared. 28 third-party images
  in the NPS payload are held back.
- No affiliate link renders until a program is approved in `site/config.json`.

## Governance

Six launch gates and their current state: `docs/policy/launch-gates.md`.
Editorial standards: `docs/policy/editorial-standards.md`.
Fact-check protocol: `docs/policy/fact-check-protocol.md`.
FTC and affiliate rules: `docs/policy/ftc-disclosure.md`,
`docs/policy/affiliate-matrix.md`.
Photo licensing: `docs/policy/photo-licensing.md`.
Chatbot scope: `docs/policy/chatbot-scope.md`.

The original board and AI-team documents remain at the repo root
(`index.html`, `ai-dashboard.html`, `how-the-ai-team-works.md`,
`parkday-scope-day1.md`, `parkday-uniqueness-brief.md`). The board is
coordination history; it is not the product site and is not deployed.
