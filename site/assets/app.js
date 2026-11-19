/* ==========================================================================
   Parkday Guide — client app
   Zero dependencies. Three jobs:
     1. Navigation and directory filters.
     2. The "Ask the guide" dialog, which answers only from the released
        park data index and says so when it does not have the fact.
     3. Checklist form handling, with no fake success states.
   ========================================================================== */

(function () {
  "use strict";

  var BASE = typeof window.PARKDAY_BASE === "string" ? window.PARKDAY_BASE : "/";
  var url = function (p) { return BASE + String(p || "").replace(/^\//, ""); };

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function track(name, params) {
    if (typeof window.gtag === "function" && window.PARKDAY_GA4) {
      window.gtag("event", name, params || {});
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Navigation                                                             */
  /* ---------------------------------------------------------------------- */

  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var links = document.getElementById("nav-links");
    if (!toggle || !links) return;

    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && links.classList.contains("is-open")) {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Directory filters                                                      */
  /* ---------------------------------------------------------------------- */

  function initDirectory(opts) {
    var search = document.querySelector(opts.search);
    var grid = document.querySelector(opts.grid);
    if (!search || !grid) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll(opts.card));
    var region = opts.region ? document.querySelector(opts.region) : null;
    var state = opts.state ? document.querySelector(opts.state) : null;
    var park = opts.park ? document.querySelector(opts.park) : null;
    var count = opts.count ? document.querySelector(opts.count) : null;
    var empty = opts.empty ? document.querySelector(opts.empty) : null;
    var noun = opts.noun || "results";

    function apply() {
      var q = search.value.trim().toLowerCase();
      var r = region ? region.value : "";
      var s = state ? state.value : "";
      var p = park ? park.value : "";
      var shown = 0;

      cards.forEach(function (card) {
        var name = card.getAttribute("data-name") || "";
        var cardRegion = card.getAttribute("data-region") || "";
        var states = (card.getAttribute("data-state") || "").split("|");
        var parks = (card.getAttribute("data-parks") || "").split("|");

        var matches =
          (!q || name.indexOf(q) !== -1) &&
          (!r || cardRegion === r) &&
          (!s || states.indexOf(s) !== -1) &&
          (!p || parks.indexOf(p) !== -1);

        card.hidden = !matches;
        if (matches) shown++;
      });

      if (count) count.textContent = shown + " " + (shown === 1 ? noun.replace(/s$/, "") : noun);
      if (empty) empty.hidden = shown !== 0;
    }

    search.addEventListener("input", apply);
    [region, state, park].forEach(function (el) {
      if (el) el.addEventListener("change", apply);
    });

    // Deep link from the home page: /parks/?region=Pacific
    if (region) {
      var params = new URLSearchParams(window.location.search);
      var preset = params.get("region");
      if (preset) {
        var match = Array.prototype.some.call(region.options, function (o) {
          return o.value === preset;
        });
        if (match) {
          region.value = preset;
        }
      }
    }

    apply();
  }

  /* ---------------------------------------------------------------------- */
  /* Chat                                                                   */
  /* ---------------------------------------------------------------------- */

  var STOP = ("a an and are as at be been but by can could did do does for from has have how i if in into is it its "
    + "me my of on or our should so than that the their them then there these they this to was we were what when "
    + "where which who why will with would you your about near best good top").split(/\s+/);

  var SYNONYMS = {
    cost: "fee", costs: "fee", price: "fee", prices: "fee", pricing: "fee", expensive: "fee", cheap: "fee",
    pay: "fee", payment: "fee", admission: "fee", ticket: "fee",
    open: "hours", opening: "hours", close: "hours", closing: "hours", closed: "hours", hours: "hours",
    stay: "town", sleep: "town", lodge: "town", lodging: "town", hotel: "town", base: "town",
    town: "town", towns: "town", city: "town", nearby: "town",
    season: "season", seasons: "season", weather: "season", month: "season", months: "season", winter: "season",
    summer: "season", spring: "season", autumn: "season", fall: "season", when: "season",
    free: "fee", reservation: "reservation", reservations: "reservation", permit: "reservation", permits: "reservation",
    timed: "reservation", entry: "reservation", book: "reservation", booking: "reservation",
    hike: "hiking", hikes: "hiking", trail: "hiking", trails: "hiking", walk: "hiking",
    kid: "family", kids: "family", children: "family", child: "family",
    rv: "rv", camper: "rv", camping: "camping", camp: "camping", campground: "camping",
    drive: "driving", driving: "driving", road: "driving", roads: "driving", car: "driving"
  };

  var tokenCache = null;

  function tokenize(text) {
    var out = [];
    var words = String(text || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/);
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (!w || w.length < 2 || STOP.indexOf(w) !== -1) continue;
      out.push(SYNONYMS[w] || w);
    }
    return out;
  }

  function buildIndex(docs) {
    var df = Object.create(null);
    var entries = docs.map(function (doc) {
      var titleTokens = tokenize(doc.title);
      var bodyTokens = tokenize(doc.text);
      var tf = Object.create(null);
      titleTokens.forEach(function (t) { tf[t] = (tf[t] || 0) + 4; });
      bodyTokens.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
      Object.keys(tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
      return { doc: doc, tf: tf, title: doc.title.toLowerCase() };
    });
    var total = entries.length || 1;
    entries.forEach(function (e) {
      e.idf = Object.create(null);
      Object.keys(e.tf).forEach(function (t) {
        e.idf[t] = Math.log(1 + total / (df[t] || 1));
      });
    });
    return entries;
  }

  function search(entries, query) {
    var tokens = tokenize(query);
    if (!tokens.length) return [];
    var unique = [];
    tokens.forEach(function (t) { if (unique.indexOf(t) === -1) unique.push(t); });

    var scored = entries.map(function (e) {
      var score = 0;
      var hits = 0;
      unique.forEach(function (t) {
        if (e.tf[t]) {
          score += (1 + Math.log(e.tf[t])) * e.idf[t];
          hits++;
        }
      });
      // Reward documents that match more of the question, and exact title hits.
      score *= 1 + (hits / unique.length) * 0.8;
      if (query.length > 3 && e.title.indexOf(query.toLowerCase()) !== -1) score *= 1.6;
      return { entry: e, score: score, hits: hits };
    });

    return scored
      .filter(function (s) { return s.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  function sentences(text) {
    return String(text || "")
      .split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  function pickSentences(doc, tokens, limit) {
    var parts = sentences(doc.text);
    var scored = parts.map(function (s, i) {
      var low = s.toLowerCase();
      var score = 0;
      tokens.forEach(function (t) {
        if (low.indexOf(t) !== -1) score += 1;
      });
      return { s: s, score: score, i: i };
    });
    scored.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
    var chosen = scored.filter(function (x) { return x.score > 0; }).slice(0, limit || 2);
    if (!chosen.length) chosen = scored.slice(0, limit || 2);
    return chosen.sort(function (a, b) { return a.i - b.i; }).map(function (x) { return x.s; });
  }

  function has(tokens, list) {
    return tokens.some(function (t) { return list.indexOf(t) !== -1; });
  }

  function linkFor(doc, label) {
    return '<p><a href="' + url(doc.url) + '">' + escapeHtml(label || doc.title) + "</a></p>";
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function composeAnswer(entries, query) {
    var tokens = tokenize(query);
    var ranked = search(entries, query);
    if (!ranked.length) {
      return {
        html: "<p>I do not have that in this guide's released park data, so I will not guess. "
          + "The official source for fees, hours and closures is "
          + '<a href="https://www.nps.gov" target="_blank" rel="noopener noreferrer">NPS.gov</a>, '
          + "and reservations sit on "
          + '<a href="https://www.recreation.gov" target="_blank" rel="noopener noreferrer">Recreation.gov</a>.</p>',
        meta: "No source in the guide index"
      };
    }

    var top = ranked[0].entry.doc;
    var wants = {
      fee: has(tokens, ["fee"]),
      towns: has(tokens, ["town"]),
      hours: has(tokens, ["hours"]),
      season: has(tokens, ["season", "time"]),
      reservation: has(tokens, ["reservation"]),
      camping: has(tokens, ["camping"]),
      hiking: has(tokens, ["hiking"]),
      driving: has(tokens, ["driving"]),
      family: has(tokens, ["family"]),
      rv: has(tokens, ["rv"])
    };

    // No-fee question across parks.
    if (wants.fee && (/\bfree\b/i.test(query) || /\bno (entrance )?fee\b/i.test(query))) {
      var faq = entries.filter(function (e) { return e.doc.id === "faq:no-fee"; })[0];
      if (faq) {
        return {
          html: '<p>' + escapeHtml(faq.doc.text.split(".").slice(0, 1).join(".") + ".") + "</p>"
            + "<p>Separate permits, tours, parking or camping can still carry a charge. "
            + "Confirm on the park's official page.</p>"
            + linkFor(faq.doc, "Open the park directory"),
          meta: "Source: NPS fee fields, retrieved 2026-11-19"
        };
      }
    }

    // Single-park factual answer.
    if (top.type === "park") {
      var feeLine = sentences(top.text).filter(function (s) {
        return /^Entrance fees listed by NPS:/i.test(s) || /^NPS lists no entrance fee/i.test(s);
      })[0];
      var townLine = sentences(top.text).filter(function (s) { return /^Gateway towns:/i.test(s); })[0];
      var hourLine = sentences(top.text).filter(function (s) { return /^Hours:/i.test(s); })[0];
      var resLine = sentences(top.text).filter(function (s) { return /^Reservation or timed entry fee:/i.test(s); })[0];

      if (wants.towns && townLine) {
        return {
          html: "<p>" + escapeHtml(townLine) + "</p>"
            + linkFor(top, "Gateway towns for " + top.title)
            + '<p class="chat-sources">Gateway relationships are editorial. Confirm services before you arrive.</p>',
          meta: "Source: Parkday town registry · park facts NPS 2026-11-19"
        };
      }

      if (wants.fee && (feeLine || resLine)) {
        var feeAnswer = "<p>" + escapeHtml(top.title) + ". " + escapeHtml(feeLine || "") + "</p>";
        if (resLine) {
          feeAnswer += "<p>" + escapeHtml(resLine) + " Reservation rules and seasons change, so check the official page.</p>";
        }
        return {
          html: feeAnswer + linkFor(top, "Full fee table for " + top.title),
          meta: "Source: NPS fee fields, retrieved 2026-11-19"
        };
      }

      if (wants.hours && hourLine) {
        return {
          html: "<p>" + escapeHtml(hourLine.replace(/^Hours:\s*/, top.title + " hours: ")) + "</p>"
            + '<p class="chat-sources">Hours change with season and weather. The official page is the current source.</p>'
            + linkFor(top, "Official page for " + top.title),
          meta: "Source: NPS operating hours, retrieved 2026-11-19"
        };
      }

      if (wants.reservation && resLine) {
        return {
          html: "<p>" + escapeHtml(resLine) + "</p>"
            + '<p class="chat-sources">Rules, dates and seasons change. Confirm before booking.</p>'
            + linkFor(top, "Park page for " + top.title),
          meta: "Source: NPS fee fields, retrieved 2026-11-19"
        };
      }

      if (wants.season) {
        return {
          html: "<p>Season guidance for " + escapeHtml(top.title) + " is written on the park page and in the seasonal guide. "
            + "I will not quote a month-specific rule from data that changes.</p>"
            + linkFor(top, "Season notes for " + top.title)
            + '<p><a href="' + url("guides/best-time-to-visit-national-parks/") + '">How to choose a season</a></p>',
          meta: "No fixed date facts quoted"
        };
      }

      var picked = pickSentences(top, tokens, 2);
      return {
        html: "<p>" + picked.map(escapeHtml).join(" ") + "</p>"
          + linkFor(top, "Open " + top.title),
        meta: "Source: NPS data retrieved 2026-11-19 · editorial"
      };
    }

    // Town answer.
    if (top.type === "town") {
      var tPicked = pickSentences(top, tokens, 2);
      return {
        html: "<p>" + tPicked.map(escapeHtml).join(" ") + "</p>"
          + linkFor(top, top.title)
          + '<p class="chat-sources">Confirm seasonal services and access before you arrive.</p>',
        meta: "Source: Parkday editorial · park facts NPS 2026-11-19"
      };
    }

    // Guides and pages: quote the description and the best matching passage.
    var gPicked = pickSentences(top, tokens, 2);
    return {
      html: "<p>" + gPicked.map(escapeHtml).join(" ") + "</p>"
        + linkFor(top, "Read " + top.title),
      meta: "Source: Parkday Guide"
    };
  }

  function initChat() {
    var dialog = document.getElementById("chat-dialog");
    var form = document.getElementById("chat-form");
    var input = document.getElementById("chat-input");
    var body = document.getElementById("chat-body");
    var suggestions = document.getElementById("chat-suggestions");
    if (!dialog || !form || !input || !body) return;

    var entries = null;
    var loading = false;
    var indexPromise = null;

    function loadIndex() {
      if (indexPromise) return indexPromise;
      indexPromise = fetch(url("data/search-index.json"))
        .then(function (r) {
          if (!r.ok) throw new Error("index " + r.status);
          return r.json();
        })
        .then(function (docs) {
          entries = buildIndex(docs);
          return entries;
        })
        .catch(function () {
          indexPromise = null;
          throw new Error("index unavailable");
        });
      return indexPromise;
    }

    function open() {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      track("chat_open");
      setTimeout(function () { input.focus(); }, 30);
      loadIndex().catch(function () {});
    }

    function close() {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }

    function bubble(html, who) {
      var div = document.createElement("div");
      div.className = "chat-msg chat-msg--" + who;
      div.innerHTML = html;
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
      return div;
    }

    function ask(question) {
      var q = String(question || "").trim();
      if (!q) return;
      bubble("<p>" + escapeHtml(q) + "</p>", "user");
      input.value = "";

      var thinking = bubble("<p>Checking the guide data…</p>", "bot");

      if (loading) return;

      loadIndex()
        .then(function () {
          var answer = composeAnswer(entries, q);
          thinking.innerHTML = answer.html
            + (answer.meta ? '<p class="chat-sources">' + escapeHtml(answer.meta) + "</p>" : "");
          body.scrollTop = body.scrollHeight;
          track("chat_question", { question: q.slice(0, 80) });
        })
        .catch(function () {
          thinking.innerHTML = "<p>The guide index did not load, so I cannot check a fact. "
            + '<a href="https://www.nps.gov" target="_blank" rel="noopener noreferrer">NPS.gov</a> is the official source.</p>';
        });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      ask(input.value);
    });

    if (suggestions) {
      suggestions.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-ask]");
        if (btn) ask(btn.getAttribute("data-ask"));
      });
    }

    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-chat-open]")) {
        e.preventDefault();
        open();
      }
      if (e.target.closest("[data-chat-close]")) {
        e.preventDefault();
        close();
      }
    });

    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) close();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && dialog.open) close();
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Checklist form                                                         */
  /* ---------------------------------------------------------------------- */

  function initChecklist() {
    var forms = document.querySelectorAll("[data-checklist-form]");
    Array.prototype.forEach.call(forms, function (form) {
      var status = form.parentElement.querySelector("[data-form-status]");
      var button = form.querySelector('button[type="submit"]');
      var endpoint = form.getAttribute("action");

      if (!endpoint) {
        // Delivery is not connected in this build. Say that plainly.
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          if (status) {
            status.dataset.state = "error";
            status.textContent = "Email delivery is not connected yet. Read the checklist on this site instead.";
          }
        });
        return;
      }

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!form.reportValidity()) return;
        if (button) { button.disabled = true; button.textContent = "Sending…"; }
        if (status) { status.dataset.state = ""; status.textContent = ""; }

        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            email: form.querySelector('input[type="email"]').value,
            source: window.location.pathname
          })
        })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            if (status) {
              status.textContent = "Sent. Check your inbox, and the spam folder if it is not there.";
            }
            form.reset();
            track("checklist_signup");
          })
          .catch(function () {
            if (status) {
              status.dataset.state = "error";
              status.textContent = "That did not send. Try again, or read the checklist on this site.";
            }
          })
          .finally(function () {
            if (button) { button.disabled = false; button.textContent = "Email me the checklist"; }
          });
      });
    });
  }

  /* ---------------------------------------------------------------------- */

  ready(function () {
    initNav();
    initDirectory({
      search: "[data-park-search]",
      grid: "[data-park-grid]",
      card: "[data-park-card]",
      region: "[data-park-region]",
      state: "[data-park-state]",
      count: "[data-park-count]",
      empty: "[data-park-empty]",
      noun: "parks"
    });
    initDirectory({
      search: "[data-town-search]",
      grid: "[data-town-grid]",
      card: "[data-town-card]",
      park: "[data-town-park]",
      count: "[data-town-count]",
      empty: "[data-town-empty]",
      noun: "towns"
    });
    initChat();
    initChecklist();
  });
})();
