# Photo licensing policy

Status: approved for launch · Owner: photo lead · Last reviewed 2026-11-19

## Current state

The fact layer holds 254 images from the NPS API. 226 carry an NPS credit and
are cleared for use. 28 carry a third-party credit and are marked
`rightsStatus: "needs-review"`. The site generator renders **only cleared
images**. A `needs-review` image stays in `data/parks.json` and never reaches a
page, a social card, or the chatbot.

## The rule

No image ships without a recorded licence basis and a credit. "It was on the
park's website" is not a licence. "It was in the API" is not a licence either;
the API carries images with third-party credits, and those need their own check.

## Classes

| Class | Basis | Credit line | May render |
|---|---|---|---|
| `nps-credit` | NPS photograph, public domain | "NPS Photo" plus the photographer when the API names one | Yes |
| `needs-review` | Third-party photograph supplied through the API | Unknown until checked | No |
| `licensed` | Written licence on file in `docs/photo-licences/` | As the licence requires | Yes |
| `commissioned` | Contract with the photographer | Photographer's name | Yes, per contract |
| `own` | Photographed for Parkday Guide | "Parkday Guide" | Yes |

## What counts as acceptable

- NPS photographs with an NPS credit, including volunteer and partner
  photographs the NPS itself publishes as public domain.
- Written permission from the photographer, stored as a file, covering web use,
  social cards and resizing.
- Commissioned work with a contract that grants those rights.

## What does not

- A photo found on a search engine, a social platform, a review site or a
  competitor. Even with a credit line. Even if the park is public land.
- A third-party image from the NPS API without a documented licence.
- An AI-generated image presented as a photograph of a real place. If generated
  imagery is ever used, it is labelled as illustration, and it never stands in
  for a real park photograph on a park page.

## Credits

- Every rendered image carries its credit in the page markup or a visible
  caption.
- Alt text describes what is in the frame. It is not a caption and not a credit.
- Changing an image does not remove the previous credit from the record.
- The 28 `needs-review` images are listed in `data/parks.json`; a reviewed image
  changes status only with a licence note added to `docs/photo-licences/`.

## Review

The photo lead reviews every new image before the build that would first render
it. The validator refuses a park page with no cleared image only as a warning,
because a page with facts and no photograph is better than a page with an
uncleared one.
