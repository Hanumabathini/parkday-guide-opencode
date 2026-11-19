# Parkday Guide — OpenCode build: model discussions

- Build repo: `parkday-guide-opencode` (clone of `Hanumabathini/parkday-guide-board`, origin re-pointed to `Hanumabathini/parkday-guide-opencode`)
- Session date: 2026-11-19
- Working model: opencode/tidepool-alpha-free

## Models consulted

| Model | Outcome |
|---|---|
| openai/gpt-6.2-astra | Completed — deep suggestions + discussion points (§2) |
| anthropic/claude-opus-5-5 | Failed: "Your credit balance is too low to access the Anthropic API." |
| google/gemini-4-neon | Failed: quota exceeded, retry in ~13h24m |
| deepseek/deepseek-v4-pro | Failed: "Insufficient Balance" |
| opencode/iceman-free | Relaunched — see §5 additions |
| opencode/hy4-flash-free | Relaunched — see §5 additions |
| opencode/flint-40b-free | Relaunched — see §5 additions |

## 1. Deep suggestions from openai/gpt-6.2-astra

**The clone is the place to prove what a visitor will see and why it is safe to publish — not a prototype of fewer than 64 parks.**

- `index.html` at the root is the board (Supabase client, shared board backend). Board smoke tests (`scripts/validate_command_board.mjs`) say nothing about park content. Do not deploy the root to parkdayguide.com or use the live board backend for previews.
- The approved scope is at the root; locally `docs/` has only `reports/`. Style guide, FTC text, affiliate matrix exist only in the Claude artifact/handoff page. Do not treat the clone as the complete input set.
- Nov 21 is a launch decision, not a deploy trigger. The Nov 15 report calls the domain blocked; verify ownership, DNS access, staging access, deployment owner now while content proceeds.
- Canonical product: one repo. Confirm destination, integrator and promotion process. Two teams editing two authoritative `parks.json` files is a bigger risk than the web-framework choice.

### Proposed structure

| Path | Contents |
|---|---|
| `site/` | Original visitor templates, components, styles, routes. Deploy generated output only. |
| `content/parks/<park-id>/` | One park's claim records + original editorial copy. Stable IDs, teams edit different parks without touching shared arrays. |
| `content/towns/<town-id>/` | One record per town. Model park-entrance/exit-town relationships separately with evidence. |
| `content/guides/`, `content/checklist/` | Signed guides and the checklist referencing the same reviewed facts. Track author + editor sign-off separately from model approval. |
| `schemas/`, `scripts/` | Content contracts, validators, generator for the approved `parks.json` interface, link and media checks. |
| `docs/policy/`, `docs/decisions/`, `releases/` | Canonical scope, style guide, sourcing and affiliate rules, short decision records, release manifests. |

### Claim-level verification

- Park-level `verified_by`/`verified_on` stays, but sign-off derives from the claims underneath.
- Reservation claims record: what requires a reservation, dates, exact official source + section, when checked, who checked, review due. Distinguish verified/unknown/conflicting/expired/not-applicable; even "not required" needs support.
- One reviewed public dataset: page, chatbot, checklist, directory share the same release. Reverse lookup from claim to outputs. Checklists get an edition date + official recheck link.
- Time is part of correctness: review intervals by volatility; suppress expired optional claims; on the live site a failed required launch fact fails the park's readiness.

### Priority order

| P0 | Authority and inventory: confirm repo roles, remote visibility, domain and staging ownership. Mark every inherited input adopt/reverify/recreate/missing. |
| P1 | Roster and contract: map 64 slots to dated official NPS identities (Chiricahua included); coverage matrix scope-slot -> official evidence -> required claims -> named owner -> readiness. |
| P2 | Prove one visitor journey on private staging: directory -> park -> reservation decision -> exit/town -> official next step; chatbot answers the same question from the same evidence; phone + keyboard checks; deliberately expire a reservation claim and confirm neither surface repeats it as current. |
| P3 | Scale by reviewed batches: a contrasting second park first, then distributed nonoverlapping batches. Produce the ten guides, seven site pages, checklist, conversion flows, launch channels against the matrix. |
| P4 | Rehearse and release: one immutable candidate; signup/checklist delivery, affiliate approval, GA4 events, bot abstention, links, photo credits; rehearse a correction and rollback; Hanuma records GO/NO-GO. |

### Team use of models

- Four execution groups, not a 40-way queue: each model owns slices; ChatGPT coordinates shared contracts, dependencies, integration.
- Perplexity challenges questionable source interpretations on high-risk claims (non-binding advice).
- The board should distinguish: AI Approved, included in candidate, production gate signed.

### Six gates -> release pack

- Fact-check: roster + required-field coverage + zero unresolved required claims + generated parks.json + Rakesh's signed checklist (or backup), routed to Hanuma.
- FTC: rendered disclosure checks top-of-page and beside recommendations; spot checks by Rohit; no monetized URL renders before program approval.
- Privacy: policy URL returns 200; footer links across templates; record of signup/analytics/affiliate/chat data.
- Links: Tier 1 defined before crawl; full dated report: zero broken Tier 1 + zero broken internal links.
- Photo licences: every rendered image matched to a credited, permission-cleared original; Mani reconciles.
- CEO approval: candidate ID, staging URL, gates 1-5 evidence, decision, date, Hanuma sign-off; reopens affected checks on content/asset/tracking changes.

## 2. Discussion points for the other models

| Issue | Argument | Alternative / likely disagreement |
|---|---|---|
| Source of truth | Git owns inputs and reproducible outputs; board owns assignments and gate records, linked by task/release IDs | Editing park data in the board may feel faster; Proponents must demonstrate exact-page reproducibility and one-change rollback. |
| Fill 64 now vs prove 2 first? | Start roster/source discovery for all 64 now; prove two contrasting records end to end before mass drafting | Parallel drafting maximizes visible progress; risk is discovering on park 40 that reservations need dates/activities/entrance on every prior record. Compare reviewed throughput, not words written. |
| Roster vs evidence disagreement | Scope controls what we owe; NPS evidence controls what we can state. Keep slot, record discrepancy, escalate. | A scope-first team may treat board as proof; source-first may quietly change the denominator. Who owns obtaining dated official evidence? |
| Town page richness | Minimum by the visitor decision it supports, not word count or business count. | Full local directories may need excluded sources; bring three candidate town claims + evidence; decide what is publishable before assigning dozens of pages. |
| Chatbot "built with the site" | Retrieval from released parks.json + constrained answer templates for fees, permits, reservations, gateway relationships; follow-ups + citations; abstain when facts conflict/expire/absent. | Open-ended itineraries sound better; compare on same questions including wrong-season and unsupported-price prompts; reject anything more confident than the page. |
| Affiliate sections | Build scoped sections + disclosures; approval controls monetization; no tracking link without partner approval. | Contributors want complete-looking cards on all 64; agree on pre-approval rendering and test the disabled state. |
| Nov 21 success | A valid NO-GO is a valid launch decision. Private working slice is progress, not a waiver. | A soft launch might be proposed; check if unresolved claims still reach visitors - if so the label changes nothing. |

**First decisions to ask the meeting for:** (1) canonical product repo, (2) owner of the 64-slot evidence matrix, (3) the park-and-gateway pair for the first staging slice.

## 3. Synthesis - taken by the OpenCode build (2026-11-19)

- Proposed canonical product repo: `parkday-guide-opencode` (already the origin re-pointed; will confirm as canonical, not a second repo).
- Owner of the 64-slot evidence matrix: the Parkday Guide OpenCode build.
- Proposed first park-and-gateway pair for the staging slice: ask the user/owner for one pair; a natural candidate is a park with a reservation-requiring entry and a supported gateway town (verify against NPS before assigning).
- Start-building actions (per GPT's P0-P1):
  1. Run the board smoke check in the new repo: `node scripts/validate_command_board.mjs` (verify the clone is healthy).
  2. Adopt the proposed structure for new content work (`site/`, `content/parks/<id>/`, `content/towns/<id>/`).
  3. Begin P0 inventory: confirm ownership, list inherited inputs and mark adopt/reverify/recreate/missing.
- Blocking note: Parkday Guide rules require facts verified against NPS.gov/Recreation.gov before anything publishes.
