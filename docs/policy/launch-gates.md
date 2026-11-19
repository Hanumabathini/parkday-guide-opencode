# Launch gates

Status: pre-launch · Owner: chief editor · Last reviewed 2026-11-19

Six gates. A gate is either **PASS**, **CONCERNS** or **FAIL**. Nothing is
published to the production domain while any gate is FAIL. A gate may pass with
concerns only if the concern is written down here with an owner and a date.

| # | Gate | Owner | State |
|---|---|---|---|
| 1 | Fact-check | fact-check lead | PASS with concerns |
| 2 | FTC and commercial disclosure | commercial lead | PASS |
| 3 | Privacy and data | product lead | PASS with concerns |
| 4 | Links and redirects | technical lead | PASS |
| 5 | Photo licensing | photo lead | PASS with concerns |
| 6 | CEO approval | chief editor | PENDING |

## 1. Fact-check

- 64/64 park records synced from the NPS API with a retrieval date.
- 64/64 park pages and 119/119 gateway town pages carry editorial.
- Fee fields classified into entrance, reservation and other.
- The sync refuses a scope that is not 64.
- Editorial is reviewed against the park's official page before release.
- `node scripts/validate_content.mjs` passes with no errors or warnings.

Concerns: the NPS API is the source of record, and a fee can change between the
retrieval date and the reader's visit. The page states the retrieval date and
asks the reader to confirm. Monthly re-sync is scheduled, not yet automated.

## 2. FTC and commercial disclosure

- No affiliate program is approved; `affiliatePrograms` is empty.
- Official NPS and Recreation.gov links are never monetised.
- Approved disclosure wording is written and ready to render above the first
  monetised link.
- The chatbot contains no commercial layer.

## 3. Privacy and data

- No account, no login, no server-side storage of reader input.
- Chat questions are processed in the browser and not transmitted.
- Analytics is not configured at launch. If GA4 is enabled, the privacy page is
  updated in the same commit.
- The checklist email endpoint is not connected; the form says so and does not
  fake a success state.

Concerns: the contact address and any future email delivery need a processor
agreement before the checklist form is enabled.

## 4. Links and redirects

- Every internal link resolves in the built site; the validator fails on a
  broken one, including when the site is built under a GitHub Pages project path.
- External links are limited to NPS.gov, Recreation.gov, and the official park
  URL from the fact layer.
- No redirect wrapper, no link shortener, no tracking parameter on an official
  link.
- 208 pages built, 0 broken internal links, 207 sitemap URLs.

## 5. Photo licensing

- 226 of 254 images carry an NPS credit and render.
- 28 `needs-review` images are excluded by the generator, not by a manual step.
- Credits render with the image; alt text describes the frame.

Concerns: the 28 images need a licence decision before they can be used. They
are not blocking launch because they are not rendered.

## 6. CEO approval

- Requires a full read of the home page, one park page per region, the
  methodology page and the privacy page.
- Requires a signed statement that the guide does not copy competitor text.
- PENDING. The founder review has not been recorded; the deployed review build
  is linked below so that read can happen against the real output.

## Build and deployment evidence

- Repository: `https://github.com/Hanumabathini/parkday-guide-opencode`
- Review build: `https://hanumabathini.github.io/parkday-guide-opencode/`
- Build: 208 pages (`parks` 64, `towns` 119, `guides` 10, `posts` 3, `pages` 5,
  plus directory, 404 and index pages).
- Content gates: `node scripts/validate_content.mjs` passes with 0 errors and
  0 warnings.
- Output gates: `node scripts/validate_content.mjs --dist` passes with the
  expected single warning that the 404 page has no canonical.
- Deployment: GitHub Actions workflow "Build and deploy the guide", run
  `44596679774`, completed success on commit `56b0be5`.
- Live checks: home, park directory, one park page per region, a town page, the
  guide index, the methodology page, `search-index.json`, `app.js`,
  `styles.css`, `sitemap.xml` and `robots.txt` all returned HTTP 200.

## Domain

`parkdayguide.com` is not purchased. Until it is, the site is reviewed on the
GitHub Pages project URL and every canonical, sitemap entry and social URL is
built from that origin, so the build does not claim a domain the guide does not
control. When the domain is purchased, rebuild with
`--url=https://parkdayguide.com --base=/` and redeploy.
