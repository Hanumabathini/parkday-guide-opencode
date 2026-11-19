# Chatbot scope and limits

Status: approved for launch · Owner: product lead · Last reviewed 2026-11-19

## What it is

"Ask the guide" is a client-side retrieval tool, not a general chatbot. It runs
in the reader's browser against `data/search-index.json`, which is generated
from the released park data and the published editorial. Nothing the reader
types leaves the browser. There is no model call, no account, no logging of
questions on a server.

## What it answers

- Entrance fees and passes, exactly as the NPS fee fields record them, with the
  retrieval date.
- Reservation or timed-entry fees where NPS lists one.
- Operating hours as the NPS operating-hours field records them.
- Gateway towns for a park, from the town registry.
- Which parks list no entrance fee.
- Which park a town serves, and the town's role.
- Links into the guides and the park pages.

## What it refuses

- A fact that is not in the index. It says it does not have it and points to
  NPS.gov and Recreation.gov.
- Current conditions: road openings, closures, fire, snow, water, wildlife.
- A price, date, phone number or rule that is not in the fact layer.
- Predictions, rankings, or "which park is best".
- Medical, legal or safety advice beyond pointing to the official page.
- Anything about a person, a business or a booking transaction.

The refusal is a sentence, not an apology loop: "I do not have that in this
guide's released park data, so I will not guess," followed by the official
source.

## Why no language model

A model would make the tool sound more fluent and less accountable. It would
also be able to state a fee that is not in the data. The product promise is that
every fact is dated and sourced, so the answering layer is retrieval plus
sentence selection, and it can only quote what the build put in the index.

## Commercial rules

- No affiliate link ever appears in a chatbot answer.
- No sponsored content enters the index.
- No upsell, no email capture inside the dialog, no "book now".

## Privacy

- Questions are processed in memory and discarded when the tab closes.
- No question text is sent to a server.
- If page analytics are enabled, a `chat_question` event may record a truncated
  question string. At launch analytics is not configured; see the privacy policy.
- The dialog stores no history between visits.

## Failure behaviour

If the index fails to load, the dialog says so and links to the official
sources. It never falls back to a model, a cached answer, or a guess.

## Review

Any change to the index content, the intent rules or the commercial layer
requires a re-read of this document and a rebuild. The scope is enforced in
`site/assets/app.js`; the index is built in `site/build.mjs`.
