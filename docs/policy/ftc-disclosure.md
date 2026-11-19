# FTC disclosure policy

Status: approved for launch · Owner: commercial lead · Last reviewed 2026-11-19

## Current state

Parkday Guide has **no affiliate programs approved and no affiliate links
live**. The build reads `site/config.json` → `affiliatePrograms`, which is an
empty array. No monetised link renders until a program is added there and the
disclosure below is updated in the same commit.

Official links to NPS.gov and Recreation.gov are never affiliate links, are
never wrapped in a redirect, and are never monetised.

## The rule

If a link can earn the guide money, the reader is told before they click, in
plain language, on the same page and near the link. Disclosure is not buried in
a footer, a terms page, or a hover state.

## Approved disclosure wording

Above the first monetised link on any page:

> Some links on this page are affiliate links. If you book through them,
> Parkday Guide may earn a commission at no extra cost to you. We only link to
> services we would name anyway, and the commission never changes what we
> recommend.

In the site footer, once any program is live:

> Some links may earn a commission. Official NPS and Recreation.gov links are
> never affiliated.

## What must never happen

- A monetised link presented as an official park service link.
- A commission influencing a ranking, a "best" claim or a day plan.
- A paid placement disguised as editorial.
- Sponsored content without a label above the headline.
- A disclosure that only appears after the click.
- Affiliate links inside the chatbot's answers. The chatbot has no commercial
  layer and answers from park data only.

## Sponsored content

Not offered at launch. If it is ever offered:

- The label "Paid partnership" sits above the headline, not below the article.
- The sponsor approves only factual accuracy, never the editorial conclusion.
- The page keeps the same fact-check standard as any other page.
- Sponsored pages are excluded from the chatbot index.

## Review

The commercial lead reviews every affiliate program before approval: commission
structure, cookie window, brand safety, and whether the service is one the
guide would recommend unpaid. Approval is recorded in
`docs/policy/affiliate-matrix.md`. Removing a program removes its links in the
same commit.
