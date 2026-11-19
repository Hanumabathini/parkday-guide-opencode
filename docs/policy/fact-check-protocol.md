# Fact-check protocol

Status: approved for launch · Owner: fact-check lead · Last reviewed 2026-11-19

## Source hierarchy

1. **NPS.gov** and the official NPS API (`developer.nps.gov/api/v1`). Fees,
   passes, hours, contacts, activities, official park URL.
2. **Recreation.gov** for federal reservations, permits and campground booking.
3. **The park's official published page** for anything the API does not carry,
   such as a current alert or a seasonal road status.
4. **Nothing else.** Not Wikipedia, not a competitor, not a search snippet, not
   a model's memory.

If a fact cannot be confirmed at level 1, 2 or 3, it does not ship. It is not
softened, hedged into vagueness, or replaced with a plausible number.

## What is checked, and how often

| Fact type | Source | Checked | Recheck |
|---|---|---|---|
| Entrance fees, passes | NPS API `entranceFees`, `entrancePasses` | Every sync | Monthly, and before any fee-related page is promoted |
| Operating hours | NPS API `operatingHours` | Every sync | Monthly |
| Phone and official URL | NPS API `contacts`, `url` | Every sync | Monthly |
| Activities and topics | NPS API | Every sync | Quarterly |
| Images and credits | NPS API `images` | Every sync | On every new image |
| Editorial prose | Human review against the park page | On write | On any fact change |
| Seasonal advice | Pattern only, no current-condition claims | On write | Quarterly |

The retrieval date is stored on every park record (`source.retrieved`) and
printed on every park page and in the footer.

## Sync procedure

```
node scripts/sync_nps_data.mjs <nps-parks-dump.json>
node scripts/validate_content.mjs
node site/build.mjs
```

The sync is refused if the scoped park count is not 64. A fee that appears in
the API for the first time is treated as unverified until a human opens the
park's official fee page and confirms it. The sync records the raw snapshot in
`data/nps-snapshot.json` so any later dispute can be traced to the exact
payload that was used.

## Verification labels

- **Facts: NPS · date.** Rendered from the fact layer, retrieved on that date.
- **Editorial pending.** The page has official facts but no reviewed editorial
  yet. It is excluded from the sitemap promotion list and never presented as
  complete.
- **Editorial.** Written by Parkday Guide, not an official statement.

The site does not use a "verified" badge for editorial. Official facts are
dated; editorial is labelled as editorial. That distinction is the promise.

## Correction route

1. A reader writes to the contact address with the page URL and the claim.
2. The fact-check lead opens the official source on the same day.
3. If the claim is wrong, the page is corrected, the retrieval or review date is
   updated, and a correction note is added to `docs/corrections-log.md`.
4. If the official source has changed, the fact layer is re-synced before the
   editorial is touched.
5. If the claim is right, the reader is told what the official source says, with
   the date it was checked.

Corrections are never quietly deleted. The log keeps the page, the old claim,
the new claim, the source and the date.

## What the site will not do

- Publish a fee that is not in the NPS fee fields or confirmed on the park page.
- Guess a closure, a road status or a seasonal opening date.
- Present an AI-generated summary as an official park statement.
- Keep a page live after its only source disappears. It is marked pending and
  removed from promotion until re-sourced.
