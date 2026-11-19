# Editorial standards

Status: approved for launch · Owner: editorial lead · Last reviewed 2026-11-19

## What this guide is

Parkday Guide is written from scratch for people planning a visit to one of the
64 scoped US national parks. It covers three moments: planning before the trip,
the visit itself, and the days after. It does not republish park service text,
and it does not pad pages to match the length of competitor sites.

## The two layers

Every park page separates two kinds of content, and labels them:

1. **Official facts.** Entrance fees, passes, operating hours, contacts,
   activities and the park's official URL, retrieved from the National Park
   Service API and stamped with a retrieval date. These are reproduced
   faithfully, including awkward official names, because changing them would
   make them wrong.
2. **Editorial.** Summary, why go, highlights, a day plan, best-for notes,
   seasonal notes and one practical tip. Written by a person or an AI model
   under supervision, reviewed against the fact layer, and never presented as
   an official statement.

Nothing in the editorial layer may contradict the fact layer. If the two
disagree, the fact layer wins and the editorial is corrected that day.

## Voice

- Second person, plain sentences, British spelling.
- Concrete over atmospheric. Name the thing the traveller will see or do.
- Calm. No urgency, no scarcity, no "book now".
- No hype words. The validator rejects: unforgettable, bucket list, hidden gem,
  must-see, world-famous, breathtaking, jaw-dropping, magical, iconic, epic,
  stunning, picture-perfect, postcard-perfect.
- No superlatives that need proof: best, closest, only, most.
- No em dashes. Use a comma, a colon or a full stop.
- No exclamation marks.

## What editorial may not contain

- Prices, fees, hours, dates, phone numbers, mileages, drive times, visitor
  counts, reservation windows, or park-specific rules. These belong to the fact
  layer, which is dated, or to an official link.
- Named hotels, restaurants, tour operators or other businesses. Gateway town
  pages describe a town's role, not a directory of vendors.
- Claims about current conditions: road openings, closures, fire, snow, water
  levels, wildlife sightings.
- Advice that requires local knowledge we have not verified, such as "park at
  the second lot" or "the left fork is faster".

## Claims that need a source

If a sentence could be wrong in six months, it needs either a retrieval date and
an official source, or it does not ship. Seasonal statements are written as
patterns ("winter closes many high roads"), never as current fact ("the road is
closed").

## Corrections

Factual corrections take priority over new content. The correction route is
recorded in `docs/policy/fact-check-protocol.md`. Every correction updates the
retrieval or review date on the affected page.

## AI involvement

AI models may draft editorial. Every draft passes the validator, then a human
review against the park's official page. AI is never credited as an author, and
no page claims human authorship it does not have. See
`how-the-ai-team-works.md` for the governance model.
