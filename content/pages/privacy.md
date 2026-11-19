---
title: "Privacy"
description: "What Parkday Guide collects, what it does not collect, and how to ask a question about your data."
slug: "privacy"
updated: "2026-11-19"
kind: "page"
---

# Privacy

Parkday Guide is a reading site. It does not require an account, and it does not
ask you to log in to read any park page, town page or guide.

## What this site collects

At the time of this build:

- **No analytics.** The site is built with analytics disabled. No Google
  Analytics tag, no pixel, no session recorder is loaded.
- **No advertising.** No ad network is present and no advertising cookie is set.
- **No email collection.** The checklist can be read on the site without giving
  an address. The email delivery form is not connected in this build, and the
  page says so rather than pretending to accept your address.
- **No server logs from us.** The pages are static files served by GitHub Pages.
  GitHub may keep standard request logs under its own privacy statement; we do
  not receive or store them.

## The forecast check on park pages

Each park page has a forecast button. Nothing is requested until you
press it. When you do, your browser asks the National Weather Service
(api.weather.gov, a US government service) for the forecast at the park's
official map point. That request goes from your browser straight to the
National Weather Service, which sees your IP address as any website would. We
do not receive the request, your location or the result. The park's location is
sent, never yours.

## The chatbot

"Ask the guide" runs entirely in your browser. Your question is matched against
a search index that is downloaded with the site. The question is not sent to a
server, not stored, and not used to train anything. Closing the tab discards it.

If analytics are enabled in a future build, the chatbot may record a truncated
question string as an event. That change would appear on this page before it
takes effect.

## Cookies and local storage

The site sets no cookies of its own. It does not write to local storage. Your
browser may cache the page and its assets, which is ordinary browser behaviour
and not something we can read.

## Links to other sites

Park pages link to NPS.gov, Recreation.gov and the park's official page. Those
sites have their own privacy policies. When you follow a link, you leave this
site and this policy stops applying.

## Email, if you choose to write to us

If you send an email to the contact address, we receive your address and
whatever you write. We use it to answer you. We do not add you to a list, sell
it, or share it. Ask us to delete the thread and we will.

## Children

The site is written for adults planning trips and is not directed at children.
It does not knowingly collect personal information from anyone, including
children.

## Your rights

Depending on where you live, you may have the right to ask what personal data an
organisation holds about you, to correct it, or to have it deleted. Because this
site collects almost nothing, the honest answer is usually that we hold only the
email you chose to send. Ask, and we will confirm or delete it.

## Changes

If the site starts collecting something new, this page is updated in the same
release, and the date at the top changes. The previous wording stays in the
repository history rather than disappearing.

## Contact

Questions about this policy, or a request about your data:
hello@parkdayguide.com.
