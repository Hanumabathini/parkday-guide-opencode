# Affiliate matrix

Status: empty at launch · Owner: commercial lead · Last reviewed 2026-11-19

No affiliate program is approved. `site/config.json` → `affiliatePrograms` is an
empty array, and the build renders no monetised links.

## Decision table

| Program | Category | Status | Why | Approved on | Removed on |
|---|---|---|---|---|---|
| — | — | — | No program reviewed | — | — |

## Criteria for approving a program

A program is approved only if all of these are true:

1. The service is one the guide would name in an unpaid draft.
2. The commission does not change placement, ranking or wording.
3. The program's tracking does not require a privacy-policy change beyond the
   existing analytics disclosure.
4. The destination is not an official NPS or Recreation.gov page.
5. The disclosure wording in `ftc-disclosure.md` can be rendered on the same
   page, above the link.

## Categories deliberately excluded at launch

- Official park passes and permits. These are government products and are never
  monetised.
- Park entry reservations. Same reason.
- Anything that requires the reader to accept a pre-checked box or a hidden
  subscription to complete the booking.
- Any program that prohibits the disclosure wording above.

## Implementation rule

The site generator reads the config, not the markup. Adding a program means:

1. Adding an entry to `affiliatePrograms` with the program name, the disclosure
   version and the approved URL patterns.
2. Updating this matrix in the same commit.
3. Rebuilding and confirming the disclosure renders above the first monetised
   link on every affected page.
4. Confirming the chatbot index contains no affiliate URL.
