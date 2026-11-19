# Parkday Guide — OpenCode build

Working repo for the Parkday Guide board, cloned from
`Hanumabathii/parkday-guide-board` on 2026-11-19. Origin re-pointed to
`Hanumabathii/parkday-guide-opencode` as the OpenCode build of the guide.

Published as a public repo on GitHub: `Hanumabathii/parkday-guide-opencode`
([github.com/Hanumabathii/parkday-guide-opencode](https://github.com/Hanumabathini/parkday-guide-opencode)).
Clone it from https://github.com/Hanumabathii/parkday-guide-opencode.

## What Parkday Guide is

From-scratch guide to all 64 US national parks and their gateway towns at
parkdayguide.com (launch scope approved Nov 15, 2026 — `parkday-scope-day1.md`).
One-stop planner + travel guide: park pages (all 64, Chiricahua included),
guides, site pages (homepage, park directory, blog, About, accessibility, RV
guide, privacy), email capture with the 64 Parks Planning Checklist, affiliate
sections, GA4 events, and a chatbot that answers from verified park data.

Rules (`parkday-uniqueness-brief.md`, `research-leads-*.md`):

- Unique one-stop: plan, travel, and come back after the park.
- Never copy competitor text; verify every fact against NPS.gov or
  Recreation.gov before it publishes.
- No unverified facts, invented prices, stale data, or copied text.

## Team (`how-the-ai-team-works.md`)

Four execution models — Muse, Claude, ChatGPT (coordination lead), Grok — 10
members each; Perplexity is the advisory research reviewer. Approvals are
"AI Approved" with evidence; human sign-off only at production gates.

## Repo map

- `index.html`, `ai-dashboard.html` — Project Command Board + AI Dashboard
  (72 tasks, 5-model council around Brain).
- `docs/` — scope, uniqueness brief, research leads, design/chatbot/schema
  plans, `docs/reports/muse-hourly-2026-11-15.md`.
- `scripts/validate_command_board.mjs` + `.github/workflows/validate-command-board.yml`
  — CI smoke tests for the board.
- `approval-sweep-report-day1.md` — Day 1 + Day 2 tally: 11 AI approved,
  13 in progress, 46 not started. Blockers: `parkdayguide.com` domain (D1-03),
  style guide / FTC text / affiliate matrix not yet filed as repo files.

## Build status

- [x] Cloned the Parkday Guide board into this repo (start building).
- [ ] Next steps: organize build work; pick the first build slice (per the
  Parkday Guide open-source discussions and launch-gate order: facts and
  style guide first, then parks.json fills, guides, site build, gates).

## Verification

- Board smoke: `node scripts/validate_command_board.mjs`
