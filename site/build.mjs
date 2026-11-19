#!/usr/bin/env node
/**
 * Parkday Guide — static site builder.
 *
 * Zero dependencies. Reads the official NPS fact layer (data/parks.json), the
 * editorial layer (content/), and writes a complete static site to dist/.
 *
 * Design rules encoded here:
 *   - Facts render from data/parks.json only, with the NPS retrieval date.
 *   - Editorial prose renders from content/ and is labelled separately.
 *   - No affiliate link renders until a program is approved (config driven).
 *   - Every internal link is base-path aware, so the build works at a domain
 *     root and at a GitHub Pages project path.
 *
 * Usage:
 *   node site/build.mjs            # build
 *   node site/build.mjs --strict   # fail if editorial content is missing
 *
 * Env:
 *   SITE_BASE   "/" or "/repo-name/"      (default "/")
 *   SITE_URL    canonical origin           (default https://parkdayguide.com)
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const STRICT = process.argv.includes("--strict");
const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : "";
};
const BASE = (arg("base") || process.env.SITE_BASE || "/").replace(/\/?$/, "/");
const SITE_URL = (arg("url") || process.env.SITE_URL || "https://parkdayguide.com")
  .replace(/\/$/, "")
  .replace(/^(https?:\/\/)([^/]+)/i, (_, scheme, host) => `${scheme}${host.toLowerCase()}`);
const BUILD_DATE = new Date().toISOString().slice(0, 10);
const NPS_RETRIEVED = "2026-11-19";

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const url = (p = "") => `${BASE}${String(p).replace(/^\//, "")}`;

const readJson = (file, fallback = null) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
};

const readDirJson = (dir) => {
  if (!fs.existsSync(dir)) return {};
  const merged = {};
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const data = readJson(path.join(dir, name), {});
    Object.assign(merged, data);
  }
  return merged;
};

const money = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "Varies";
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
};

// A zero in the NPS fee feed usually marks a waiver category, not free entry.
const feeCost = (n) => (n === 0 ? "No charge listed" : money(n));

// The NPS fee feed uses internal labels such as "Timed Entry Reservation - Location".
// Show a plain description instead of the raw export title.
const feeTitle = (title) => {
  const t = String(title || "").replace(/\s*-\s*(Location|Park & Location)\s*$/i, "").trim();
  if (/^timed entry reservation$/i.test(t)) return "Timed entry reservation";
  return t;
};

const firstSentence = (text, max = 150) => {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  const m = clean.match(/^(.{20,}?[.!?])(\s|$)/);
  const s = m ? m[1] : clean;
  return s.length > max ? `${s.slice(0, max - 1).replace(/[,;:\s]\S*$/, "")}…` : s;
};

const formatPhone = (raw) => {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw ? String(raw) : "";
};

const write = (rel, contents) => {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
};

const copy = (from, to) => {
  fs.mkdirSync(path.dirname(path.join(DIST, to)), { recursive: true });
  fs.copyFileSync(from, path.join(DIST, to));
};

/* -------------------------------------------------------------------------- */
/* Markdown                                                                   */
/* -------------------------------------------------------------------------- */

function parseFrontmatter(raw) {
  const text = raw.replace(/^\uFEFF/, "");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body: m[2] };
}

function inline(text) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label, href) => {
      const external = /^https?:\/\//i.test(href);
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${href}"${attrs}>${label}</a>`;
    },
  );
  return out;
}

function markdown(src) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let list = null;

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      closeList();
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      i++;
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const level = Math.min(h[1].length + 1, 6); // page owns h1
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      closeList();
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      closeList();
      out.push("<hr />");
      i++;
      continue;
    }

    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
      i++;
      continue;
    }

    closeList();
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|[-*]\s|\d+\.\s|>|```|-{3,})/.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    out.push(`<p>${para.map(inline).join(" ")}</p>`);
  }
  closeList();
  return out.join("\n");
}

/* -------------------------------------------------------------------------- */
/* Data                                                                       */
/* -------------------------------------------------------------------------- */

const parks = readJson(path.join(ROOT, "data", "parks.json"), []);
if (parks.length !== 64) {
  console.error(`Expected 64 parks in data/parks.json, found ${parks.length}. Run scripts/sync_nps_data.mjs.`);
  process.exit(1);
}

const parkEditorial = readDirJson(path.join(ROOT, "content", "editorial"));
const towns = readJson(path.join(ROOT, "content", "towns", "registry.json"), []);
const townEditorial = parkEditorial; // same merged store: editorial files hold parks + towns

const byId = new Map(parks.map((p) => [p.id, p]));
// Official facts the NPS parks API omits (e.g. the Smokies parking tag), sourced per entry.
const officialNotes = readJson(path.join(ROOT, "data", "official-notes.json"), {});
const townsByPark = new Map();
for (const t of towns) {
  for (const pid of t.parks) {
    if (!townsByPark.has(pid)) townsByPark.set(pid, []);
    townsByPark.get(pid).push(t);
  }
}

const regions = [...new Set(parks.map((p) => p.region))].sort();
const regionCount = Object.fromEntries(regions.map((r) => [r, parks.filter((p) => p.region === r).length]));
const states = [...new Set(parks.flatMap((p) => p.stateNames))].sort();

/* Guides & pages ---------------------------------------------------------- */

const GUIDE_ORDER = [
  "best-time-to-visit-national-parks",
  "planning-your-first-national-park-trip",
  "national-park-budget-guide",
  "reservations-and-timed-entry",
  "camping-in-national-parks",
  "accessible-national-parks",
  "quiet-parks-and-shoulder-season",
  "scenic-drives-and-road-trips",
  "hiking-and-packing-checklist",
  "after-the-park",
];

function loadMarkdownDir(dir, filter = () => true) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && filter(f))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const { data, body } = parseFrontmatter(raw);
      const slug = data.slug || f.replace(/\.md$/, "");
      return {
        file: f,
        slug,
        title: data.title || slug,
        description: data.description || "",
        updated: data.updated || "",
        readingTime: data.readingTime || "",
        kind: data.kind || "page",
        body,
        html: markdown(body),
        wordCount: body.split(/\s+/).filter(Boolean).length,
      };
    });
}

const guides = loadMarkdownDir(path.join(ROOT, "content", "guides")).sort((a, b) => {
  const ai = GUIDE_ORDER.indexOf(a.slug);
  const bi = GUIDE_ORDER.indexOf(b.slug);
  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
});

const allPages = loadMarkdownDir(path.join(ROOT, "content", "pages"));
const posts = allPages.filter((p) => p.kind === "post" || p.slug.startsWith("blog-"));
const staticPages = allPages.filter((p) => !posts.includes(p));
const pageBySlug = new Map(staticPages.map((p) => [p.slug, p]));
const postBySlug = new Map(posts.map((p) => [p.slug, p]));

/* Config ------------------------------------------------------------------ */

const config = readJson(path.join(ROOT, "site", "config.json"), {});
const ga4Id = config.ga4Id || "";
const checklistEndpoint = config.checklistEndpoint || "";

/* -------------------------------------------------------------------------- */
/* Editorial access                                                           */
/* -------------------------------------------------------------------------- */

const FALLBACK_EDITORIAL = (p) => ({
  summary: `${p.fullName} is in ${p.stateNames.join(" and ")}. The facts on this page come from the National Park Service and were retrieved on ${NPS_RETRIEVED}.`,
  whyGo: "Official park facts, gateway towns and planning links for this park.",
  highlights: [],
  dayPlan: null,
  bestFor: [],
  seasonNote: "",
  tip: "",
  pending: true,
});

const editorialFor = (p) => {
  const e = parkEditorial[p.id];
  if (!e || !e.summary) return { ...FALLBACK_EDITORIAL(p), pending: true };
  return { highlights: [], bestFor: [], ...e, pending: false };
};

const missingEditorial = parks.filter((p) => !parkEditorial[p.id]?.summary);
const missingTownEditorial = towns.filter((t) => !townEditorial[t.id]?.intro);

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

const NAV = [
  ["Parks", "parks/"],
  ["Towns", "towns/"],
  ["Guides", "guides/"],
  ["Blog", "blog/"],
  ["About", "about/"],
];

function nav(active) {
  return `
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="nav">
    <div class="wrap nav-inner">
      <a class="brand" href="${url()}">Parkday<span>Guide</span></a>
      <ul class="nav-links" id="nav-links">
        ${NAV.map(
          ([label, href]) =>
            `<li><a href="${url(href)}"${active === label ? ' aria-current="page"' : ""}>${label}</a></li>`,
        ).join("")}
      </ul>
      <div class="nav-tools">
        <button class="btn btn--ghost btn--sm" type="button" data-chat-open>Ask the guide</button>
        <a class="btn btn--sm" href="${url("checklist/")}">Free checklist</a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="Open menu"><span></span></button>
      </div>
    </div>
  </header>`;
}

function footer() {
  const year = new Date().getFullYear();
  return `
  <footer class="footer">
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <a class="brand" href="${url()}">Parkday<span>Guide</span></a>
          <p style="max-width:34ch;margin-top:12px;color:var(--ink-soft);font-size:14.5px;">
            A from-scratch guide to all 64 US national parks and the towns
            that make them reachable. Plan, visit, and know what to do after.
          </p>
        </div>
        <div>
          <h4>Explore</h4>
          <ul>
            <li><a href="${url("parks/")}">All 64 parks</a></li>
            <li><a href="${url("towns/")}">Gateway towns</a></li>
            <li><a href="${url("guides/")}">Travel guides</a></li>
            <li><a href="${url("blog/")}">Blog</a></li>
          </ul>
        </div>
        <div>
          <h4>About</h4>
          <ul>
            <li><a href="${url("about/")}">About the guide</a></li>
            <li><a href="${url("methodology/")}">How facts are verified</a></li>
            <li><a href="${url("accessibility/")}">Accessibility</a></li>
            <li><a href="${url("rv-guide/")}">RV guide</a></li>
          </ul>
        </div>
        <div>
          <h4>Trust</h4>
          <ul>
            <li><a href="${url("privacy/")}">Privacy policy</a></li>
            <li><a href="https://www.nps.gov" target="_blank" rel="noopener noreferrer">NPS.gov</a></li>
            <li><a href="https://www.recreation.gov" target="_blank" rel="noopener noreferrer">Recreation.gov</a></li>
            <li><a href="${url("checklist/")}">64 Parks Checklist</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${year} Parkday Guide. Facts retrieved from the National Park Service on ${NPS_RETRIEVED}.</span>
        <span>Some links may earn a commission once affiliate programs are approved. Official NPS and Recreation.gov links are never affiliated.</span>
      </div>
    </div>
  </footer>`;
}

function chatDialog() {
  return `
  <dialog class="chat-dialog" id="chat-dialog" aria-labelledby="chat-title">
    <div class="chat-head">
      <strong id="chat-title">Ask the guide</strong>
      <button class="chat-close" type="button" data-chat-close aria-label="Close chat">×</button>
    </div>
    <div class="chat-body" id="chat-body" aria-live="polite">
      <div class="chat-msg chat-msg--bot">
        <p>I answer from this guide's official park data: fees NPS lists, hours, gateway towns, and park pages. I will say so when I do not have the fact.</p>
      </div>
    </div>
    <div class="chat-suggestions" id="chat-suggestions">
      <button type="button" data-ask="What does Acadia cost?">What does Acadia cost?</button>
      <button type="button" data-ask="Towns near Zion">Towns near Zion</button>
      <button type="button" data-ask="Which parks list no entrance fee?">Parks with no entrance fee</button>
      <button type="button" data-ask="Best time to visit Yellowstone">Best time for Yellowstone</button>
    </div>
    <form class="chat-form" id="chat-form">
      <input type="text" name="q" id="chat-input" placeholder="Ask about a park, fee, town or season" autocomplete="off" aria-label="Your question" />
      <button class="btn btn--sm" type="submit">Ask</button>
    </form>
  </dialog>`;
}

function layout({ title, description, body, active = "", canonical = "", ogImage = "", noindex = false }) {
  const fullTitle = title ? `${title} · Parkday Guide` : "Parkday Guide: all 64 national parks, planned properly";
  const desc = clip(description) || "A from-scratch guide to all 64 US national parks, their gateway towns, and what to do after the park.";
  const canonicalUrl = canonical === null ? "" : canonical ? `${SITE_URL}${canonical}` : `${SITE_URL}/`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(desc)}" />
  ${noindex ? '<meta name="robots" content="noindex" />' : ""}
  ${canonicalUrl ? `<link rel="canonical" href="${esc(canonicalUrl)}" />` : ""}
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(fullTitle)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${esc(canonicalUrl)}" />
  ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}" />` : ""}
  <meta name="theme-color" content="#f7f3ea" />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2316211c'/%3E%3Cpath d='M6 24l7-12 5 8 3-5 5 9z' fill='%23f7f3ea'/%3E%3Ccircle cx='23' cy='9' r='2.4' fill='%23b9482a'/%3E%3C/svg%3E" />
  <link rel="stylesheet" href="${url("assets/styles.css")}" />
  <script>window.PARKDAY_BASE = ${JSON.stringify(BASE)};</script>
  ${ga4Id ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(ga4Id)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(ga4Id)}');window.PARKDAY_GA4='${esc(ga4Id)}';</script>` : ""}
</head>
<body>
${nav(active)}
<main id="main">
${body}
</main>
${footer()}
${chatDialog()}
<script src="${url("assets/app.js")}" defer></script>
</body>
</html>
`;
}

/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

function parkImage(p, index = 0) {
  // Photography gate: render only images whose rights status is cleared.
  // `needs-review` images stay in the data layer and never reach a page.
  const cleared = p.images.filter((i) => i.url && i.rightsStatus === "nps-credit");
  return cleared[index] || cleared[0] || null;
}

function heroMedia(p) {
  const img = parkImage(p);
  if (!img) return "";
  return `<div class="hero-media"><img src="${esc(img.url)}" alt="${esc(img.alt || `${p.fullName} landscape`)}" fetchpriority="high" /></div>`;
}

// Cut text at a word boundary so meta descriptions never end mid-word.
function clip(text, max = 158) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const atSentence = cut.lastIndexOf(". ");
  if (atSentence > max * 0.6) return cut.slice(0, atSentence + 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "") + "…";
}

// Great-circle distance between two parks' NPS coordinates, used only to order
// the "closest parks" list. The number itself is never printed.
function distanceKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bestDaySection(p) {
  const c = p.coordinates;
  if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return "";
  const lat = c.lat.toFixed(4);
  const lng = c.lng.toFixed(4);
  const fallback = `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lng}`;
  return `
  <section class="section section--tight bestday-section" id="best-day">
    <div class="wrap">
      <div class="bestday" data-bestday data-park="${esc(p.id)}" data-lat="${lat}" data-lng="${lng}" data-fallback="${esc(fallback)}">
        <div class="bestday-head">
          <div>
            <p class="eyebrow">Start here</p>
            <h2>Which day this week is best for ${esc(p.name)}?</h2>
            <p class="lede">Rank the next seven days by rain chance, temperature, wind, storms and weekend crowds, using the live National Weather Service forecast for the park.</p>
          </div>
          <button class="btn" type="button" data-bestday-run>Find the best day</button>
        </div>
        <p class="sr-only" role="status" aria-live="polite" data-bestday-status></p>
        <div class="bestday-out" data-bestday-out></div>
        <noscript><p><a href="${esc(fallback)}">Open the National Weather Service forecast for this park ↗</a></p></noscript>
      </div>
    </div>
  </section>`;
}

function officialNotesSection(p) {
  const n = officialNotes[p.id];
  if (!n || !n.title) return "";
  return `
  <section class="section section--tight">
    <div class="wrap">
      <div class="callout official-note">
        <strong>${esc(n.title)}</strong>
        <p>${esc(n.summary)}</p>
        ${n.items?.length ? `<ul>${n.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
        <p class="mono" style="margin-top:12px">Source: <a href="${esc(n.source.url)}" target="_blank" rel="noopener noreferrer">${esc(n.source.title)} ↗</a>, retrieved ${esc(n.source.retrieved)}</p>
      </div>
    </div>
  </section>`;
}

function feeSummary(p) {
  if (officialNotes[p.id]?.feeBadge) return officialNotes[p.id].feeBadge;
  const entrance = p.fees?.entrance || [];
  const vehicle = entrance.find((f) => /private vehicle/i.test(f.title) && f.costUsd != null);
  if (vehicle) return `${money(vehicle.costUsd)} per vehicle`;
  const person = entrance.find((f) => /per person/i.test(f.title) && f.costUsd != null);
  if (person) return `${money(person.costUsd)} per person`;
  const any = entrance.find((f) => f.costUsd != null && f.costUsd > 0);
  if (any) return `${money(any.costUsd)} ${any.title.replace(/^Entrance\s*[-–]\s*/i, "").toLowerCase()}`;
  if (entrance.length) return "See official fee table";
  return "No entrance fee listed";
}

function hoursSummary(p) {
  if (!p.hours?.description) return "Check official hours";
  return firstSentence(p.hours.description, 110);
}

function parkCard(p, opts = {}) {
  const e = editorialFor(p);
  const img = parkImage(p);
  return `
  <article class="card park-card" data-park-card data-region="${esc(p.region)}" data-state="${esc(p.stateNames.join("|"))}" data-name="${esc(p.name.toLowerCase())}">
    <a class="park-card-media" href="${url(`parks/${p.id}/`)}" aria-hidden="true" tabindex="-1">
      ${img ? `<img src="${esc(img.url)}" alt="" loading="lazy" />` : ""}
    </a>
    <div class="park-card-body">
      <span class="park-card-meta">${esc(p.stateNames.join(" · "))}</span>
      <h3><a href="${url(`parks/${p.id}/`)}">${esc(p.name)}</a></h3>
      <p>${esc(e.summary.split(/(?<=\.)\s/)[0])}</p>
      <div class="tag-row" style="margin-top:10px;">
        <span class="badge">${esc(feeSummary(p))}</span>
        ${opts.showRegion ? `<span class="badge">${esc(p.region)}</span>` : ""}
      </div>
    </div>
  </article>`;
}

function checklistPanel() {
  const disabled = !checklistEndpoint;
  return `
  <section class="section" id="checklist">
    <div class="wrap">
      <div class="checklist-panel">
        <div>
          <p class="eyebrow" style="color:rgba(247,243,234,.6);margin-bottom:10px;">The free planner</p>
          <h2 style="margin-bottom:10px;">The 64 Parks Planning Checklist</h2>
          <p style="max-width:56ch;">One page per decision: which park, which season, which entrance, what to book, what to confirm the week before, and what to do with the trip once you are home. Read it here, or have it emailed when delivery is connected.</p>
        </div>
        <form class="checklist-form" data-checklist-form ${disabled ? "" : `action="${esc(checklistEndpoint)}" method="post"`}>
          <label class="sr-only" for="checklist-email">Email address</label>
          <input type="email" id="checklist-email" name="email" placeholder="you@example.com" ${disabled ? "disabled" : "required"} autocomplete="email" />
          <button class="btn" type="submit" ${disabled ? "disabled" : ""}>Email me the checklist</button>
        </form>
        <p class="form-note">${disabled ? "Email delivery is not connected in this build. The checklist is free to read, no signup needed." : "One email, the checklist, and a way to unsubscribe. No resale of your address."}</p>
        <p class="form-status" data-form-status role="status"></p>
        <div><a class="btn btn--ghost" style="border-color:rgba(247,243,234,.4);color:var(--paper)" href="${url("checklist/")}">Read the checklist</a></div>
      </div>
    </div>
  </section>`;
}

/* -------------------------------------------------------------------------- */
/* Pages                                                                      */
/* -------------------------------------------------------------------------- */

function pageHome() {
  const heroPark = byId.get("glacier") || parks[0];
  // Index 0 is the Glacier ridge-and-valley landscape; index 1 was a ranger portrait.
  const hero = parkImage(heroPark, 0);
  const featured = ["yellowstone", "acadia", "zion", "glacier", "yosemite", "great-smoky-mountains"]
    .map((id) => byId.get(id))
    .filter(Boolean);
  const guidesPreview = guides.slice(0, 3);
  const feeCount = parks.filter((p) => (p.fees?.entrance || []).length > 0).length;

  const body = `
  <section class="hero">
    ${hero ? `<div class="hero-media"><img src="${esc(hero.url)}" alt="${esc(hero.alt || "National park landscape")}" fetchpriority="high" /></div>` : ""}
    <div class="wrap">
      <div class="hero-inner">
        <p class="eyebrow">All 64 parks · one plan</p>
        <h1>Plan the park day properly, then the days around it.</h1>
        <p class="lede">Parkday Guide covers every US national park, the gateway towns that make each one reachable, and the part most guides skip: what to do after you leave.</p>
        <div class="hero-actions">
          <a class="btn" href="${url("parks/")}">Browse all 64 parks</a>
          <a class="btn btn--ghost" href="${url("checklist/")}">Get the planning checklist</a>
        </div>
      </div>
    </div>
    <div class="wrap">
      <div class="hero-stats">
        <div><strong>64</strong><span>National park pages</span></div>
        <div><strong>${towns.length}</strong><span>Gateway towns</span></div>
        <div><strong>${guides.length}</strong><span>Signed guides</span></div>
        <div><strong>${feeCount}</strong><span>Parks with NPS-listed fees</span></div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="split">
        <div>
          <p class="eyebrow">How this guide is built</p>
          <h2>Facts from the park service. Words written from scratch.</h2>
          <p class="lede">Every fee, hour and phone number on a park page is pulled from the National Park Service and stamped with the date it was retrieved. The writing around those facts is original, and the two are labelled separately so you can see which is which.</p>
        </div>
        <div class="stack">
          <div class="card">
            <h3>Official facts, dated</h3>
            <p>Entrance fees, passes, hours, contacts and activities come from the NPS API. The retrieval date sits on every park page.</p>
          </div>
          <div class="card">
            <h3>Gateway towns, named honestly</h3>
            <p>We say which towns work as a base. We do not invent distances, prices or business recommendations to fill a page.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <p class="eyebrow">One trip, three parts</p>
      <h2>The part most guides skip</h2>
      <p class="lede" style="margin-bottom:26px">A park trip starts before the entrance gate and does not end at the exit sign. This guide is built around all three parts, in that order.</p>
      <div class="grid grid--3">
        <article class="card">
          <span class="mono">01 · Before</span>
          <h3 style="margin-top:8px;">Decide, then book</h3>
          <p>Choose the season you can actually travel, the entrance that fits it, and the town you will sleep in. Check the fee and the reservation rule before you pay for anything else.</p>
          <p style="margin-top:12px;"><a href="${url("guides/planning-your-first-national-park-trip/")}">Plan a first trip</a></p>
        </article>
        <article class="card">
          <span class="mono">02 · During</span>
          <h3 style="margin-top:8px;">One anchor a day</h3>
          <p>Pick one committed activity, then let the rest of the day flex around weather and energy. Every park page carries a morning, afternoon and evening plan you can shorten.</p>
          <p style="margin-top:12px;"><a href="${url("parks/")}">Open a park page</a></p>
        </article>
        <article class="card">
          <span class="mono">03 · After</span>
          <h3 style="margin-top:8px;">Keep the trip useful</h3>
          <p>Sort the photographs, write down what you would change, and decide what the next park is. The after guide covers the small habits that make a trip last longer than the drive home.</p>
          <p style="margin-top:12px;"><a href="${url("guides/after-the-park/")}">Read the after guide</a></p>
        </article>
      </div>
    </div>
  </section>

  <section class="section section--paper">
    <div class="wrap">
      <p class="eyebrow">Start with a region</p>
      <h2>Nine regions, 64 parks</h2>
      <div class="grid grid--3 mt-2">
        ${regions
          .map(
            (r) => `
          <a class="region-card" href="${url("parks/")}?region=${encodeURIComponent(r)}">
            <strong>${esc(r)}</strong>
            <span>${regionCount[r]} ${regionCount[r] === 1 ? "park" : "parks"}</span>
          </a>`,
          )
          .join("")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="cluster" style="justify-content:space-between;align-items:end;margin-bottom:26px;">
        <div>
          <p class="eyebrow">Worth the planning</p>
          <h2 class="mb-0">Six parks to start with</h2>
        </div>
        <a class="btn btn--ghost" href="${url("parks/")}">See the full directory</a>
      </div>
      <div class="grid grid--3">
        ${featured.map((p) => parkCard(p)).join("")}
      </div>
    </div>
  </section>

  <section class="section section--paper">
    <div class="wrap">
      <div class="cluster" style="justify-content:space-between;align-items:end;margin-bottom:26px;">
        <div>
          <p class="eyebrow">Before you book</p>
          <h2 class="mb-0">Guides that answer the booking questions</h2>
        </div>
        <a class="btn btn--ghost" href="${url("guides/")}">All guides</a>
      </div>
      <div class="grid grid--3">
        ${guidesPreview
          .map(
            (g) => `
          <article class="card">
            <span class="mono">${esc(g.readingTime || `${Math.max(4, Math.round(g.wordCount / 220))} min read`)}</span>
            <h3 style="margin-top:8px;"><a href="${url(`guides/${g.slug}/`)}">${esc(g.title)}</a></h3>
            <p>${esc(g.description)}</p>
          </article>`,
          )
          .join("")}
      </div>
    </div>
  </section>

  ${checklistPanel()}

  <section class="section section--tight">
    <div class="wrap">
      <div class="callout">
        <strong>What "verified" means here</strong>
        Facts marked official were retrieved from the National Park Service on ${NPS_RETRIEVED}. Prices, hours and seasons change; confirm on <a href="https://www.nps.gov" target="_blank" rel="noopener noreferrer">NPS.gov</a> before you travel. Read the full <a href="${url("methodology/")}">methodology</a>.
      </div>
    </div>
  </section>`;

  return layout({ body, active: "", canonical: "/" });
}

function pageParksIndex() {
  const body = `
  <section class="hero hero--plain">
    <div class="wrap">
      <div class="hero-inner" style="padding:clamp(48px,8vw,88px) 0 clamp(28px,4vw,44px);">
        <p class="eyebrow">Directory</p>
        <h1>All 64 parks</h1>
        <p class="lede">Every national park, with the fees and hours the Park Service lists, the towns that work as a base, and a plan for the day.</p>
      </div>
    </div>
  </section>

  <section class="section section--tight">
    <div class="wrap">
      <div class="filter-bar">
        <label class="sr-only" for="park-search">Search parks</label>
        <input type="search" id="park-search" placeholder="Search by park, state or region" data-park-search />
        <label class="sr-only" for="region-filter">Filter by region</label>
        <select id="region-filter" data-park-region>
          <option value="">All regions</option>
          ${regions.map((r) => `<option value="${esc(r)}">${esc(r)} (${regionCount[r]})</option>`).join("")}
        </select>
        <label class="sr-only" for="state-filter">Filter by state</label>
        <select id="state-filter" data-park-state>
          <option value="">All states</option>
          ${states.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}
        </select>
        <span class="dir-count" data-park-count>${parks.length} parks</span>
      </div>
      <div class="dir-grid" data-park-grid>
        ${parks.map((p) => parkCard(p, { showRegion: true })).join("")}
      </div>
      <p class="dir-empty" data-park-empty hidden>No parks match that filter. Try a state name or clear the region.</p>
    </div>
  </section>`;

  return layout({
    title: "All 64 national parks",
    description: "Directory of all 64 US national parks with official NPS fees, hours, gateway towns and day plans.",
    body,
    active: "Parks",
    canonical: "/parks/",
  });
}

function pagePark(p) {
  const e = editorialFor(p);
  const img = parkImage(p);
  const parkTowns = townsByPark.get(p.id) || [];
  const entrance = p.fees?.entrance || [];
  const reservations = p.fees?.reservation || [];
  const other = p.fees?.other || [];
  const passes = p.entrancePasses || [];
  const nearby = p.coordinates
    ? parks
        .filter((x) => x.id !== p.id && x.coordinates)
        .map((x) => ({ x, d: distanceKm(p.coordinates, x.coordinates) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map((o) => o.x)
    : parks.filter((x) => x.region === p.region && x.id !== p.id).slice(0, 3);
  const hasFeeTable = entrance.length || reservations.length || other.length || passes.length;
  const ogImage = img?.url || "";

  const body = `
  <section class="park-hero">
    ${heroMedia(p)}
    <div class="wrap">
      <div class="hero-inner">
        <nav class="breadcrumbs" aria-label="Breadcrumb" style="color:rgba(247,243,234,.65)">
          <a href="${url("parks/")}" style="color:rgba(247,243,234,.8)">Parks</a><span>/</span><span>${esc(p.name)}</span>
        </nav>
        <p class="eyebrow" style="color:rgba(247,243,234,.7)">${esc(p.region)} · ${esc(p.stateNames.join(" · "))}</p>
        <h1>${esc(p.fullName)}</h1>
        <p class="lede" style="max-width:60ch">${esc(e.whyGo)}</p>
        <div class="park-hero-meta">
          <span class="badge ${e.pending ? "badge--pending" : "badge--verified"}" style="background:rgba(247,243,234,.12);color:var(--paper);border-color:rgba(247,243,234,.4)">
            ${e.pending ? "Editorial pending" : "Facts: NPS · " + NPS_RETRIEVED}
          </span>
          <span>${esc(feeSummary(p))}</span>
          <a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Official park page ↗</a>
        </div>
      </div>
    </div>
  </section>

  ${bestDaySection(p)}

  ${officialNotesSection(p)}

  <section class="section section--tight">
    <div class="wrap">
      <div class="split">
        <div>
          <p class="eyebrow">The park</p>
          <p class="lede" style="color:var(--ink)">${esc(e.summary)}</p>
          ${e.seasonNote ? `<p style="margin-top:1.4em"><strong>Seasons.</strong> ${esc(e.seasonNote)}</p>` : ""}
          ${e.tip ? `<div class="callout" style="margin-top:1.6em"><strong>One practical thing</strong>${esc(e.tip)}</div>` : ""}
        </div>
        <div>
          <dl class="facts">
            <div class="fact"><dt>Entrance fee</dt><dd><strong>${esc(feeSummary(p))}</strong></dd></div>
            <div class="fact"><dt>Hours</dt><dd>${esc(hoursSummary(p))}</dd></div>
            <div class="fact"><dt>States</dt><dd>${esc(p.stateNames.join(", "))}</dd></div>
            <div class="fact"><dt>Region</dt><dd>${esc(p.region)}</dd></div>
            ${p.phone ? `<div class="fact"><dt>Contact</dt><dd><a href="tel:${esc(String(p.phone).replace(/\D/g, ""))}">${esc(formatPhone(p.phone))}</a></dd></div>` : ""}
            <div class="fact"><dt>Official source</dt><dd><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">NPS.gov ↗</a></dd></div>
          </dl>
        </div>
      </div>
    </div>
  </section>

  ${
    e.dayPlan
      ? `<section class="section section--paper">
    <div class="wrap">
      <p class="eyebrow">The day</p>
      <h2>How to spend one day</h2>
      <div class="dayplan mt-2">
        <div class="daypart"><h4>Morning</h4><p>${esc(e.dayPlan.morning)}</p></div>
        <div class="daypart"><h4>Afternoon</h4><p>${esc(e.dayPlan.afternoon)}</p></div>
        <div class="daypart"><h4>Evening</h4><p>${esc(e.dayPlan.evening)}</p></div>
      </div>
    </div>
  </section>`
      : ""
  }

  ${
    e.highlights?.length
      ? `<section class="section">
    <div class="wrap">
      <div class="split">
        <div>
          <p class="eyebrow">What to see</p>
          <h2>Highlights</h2>
          <ol style="list-style:none;padding:0;margin:0;display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden">
            ${e.highlights
              .map(
                (h, i) => `<li style="background:var(--white);padding:16px 20px;display:flex;gap:16px;align-items:baseline">
                  <span class="mono" style="color:var(--clay)">${String(i + 1).padStart(2, "0")}</span>
                  <span>${esc(h)}</span>
                </li>`,
              )
              .join("")}
          </ol>
        </div>
        <div>
          <p class="eyebrow">Best for</p>
          <ul class="chips">
            ${(e.bestFor || []).map((b) => `<li class="chip">${esc(b)}</li>`).join("")}
          </ul>
          ${
            p.activities.length
              ? `<p class="eyebrow" style="margin-top:26px">Activities the park lists</p>
                 <ul class="chips">${p.activities.slice(0, 10).map((a) => `<li class="chip">${esc(a)}</li>`).join("")}</ul>`
              : ""
          }
        </div>
      </div>
    </div>
  </section>`
      : ""
  }

  <section class="section section--paper">
    <div class="wrap">
      <div class="split">
        <div>
          <p class="eyebrow">Cost</p>
          <h2>Fees the Park Service lists</h2>
          ${
            reservations.length
              ? `<div class="callout" style="margin-bottom:22px"><strong>Reservation or timed entry fee listed</strong>
                 ${reservations.map((r) => `${esc(feeTitle(r.title))}: ${esc(r.costUsd != null ? feeCost(r.costUsd) : "varies")}.`).join(" ")}
                 Check the official page for when it applies.</div>`
              : ""
          }
          ${
            hasFeeTable
              ? `<div class="table-wrap"><table class="fee-table">
                  <thead><tr><th>Fee</th><th>Cost</th><th>What it covers</th></tr></thead>
                  <tbody>
                  ${entrance
                    .map(
                      (f) => `<tr><td>${esc(f.title)}</td><td class="num">${f.costUsd != null ? esc(feeCost(f.costUsd)) : "Varies"}</td><td>${esc(firstSentence(f.description, 180))}</td></tr>`,
                    )
                    .join("")}
                  ${other
                    .map(
                      (f) => `<tr><td>${esc(f.title)}</td><td class="num">${f.costUsd != null ? esc(feeCost(f.costUsd)) : "Varies"}</td><td>${esc(firstSentence(f.description, 180))}</td></tr>`,
                    )
                    .join("")}
                  </tbody>
                </table></div>`
              : `<p class="lede">The Park Service lists no entrance fee for this park. That does not mean every activity is free: permits, tours, camping and parking can carry separate charges, so check the official page.</p>`
          }
          ${
            passes.length
              ? `<details class="disclosure" style="margin-top:20px"><summary>Passes listed for this park (${passes.length})</summary>
                 <ul class="source-list">${passes.map((x) => `<li>${esc(x.title)}${x.costUsd != null ? `, ${esc(money(x.costUsd))}` : ""}</li>`).join("")}</ul></details>`
              : ""
          }
        </div>
        <div>
          <p class="eyebrow">Hours</p>
          <h3>Opening information</h3>
          <p style="font-size:15px;color:var(--ink-soft)">${esc(p.hours?.description || "The Park Service does not list standard hours for this park. Check the official page before you travel.")}</p>
          ${
            p.hours?.exceptions
              ? `<p class="mono" style="margin-top:12px">${p.hours.exceptions} seasonal exception${p.hours.exceptions === 1 ? "" : "s"} listed by NPS</p>`
              : ""
          }
          <div class="callout callout--pine" style="margin-top:20px"><strong>Confirm before you go</strong>Hours, closures and access change with weather and season. The official page is the current source.</div>
        </div>
      </div>
    </div>
  </section>

  ${
    parkTowns.length
      ? `<section class="section">
    <div class="wrap">
      <p class="eyebrow">Where to base yourself</p>
      <h2>Gateway towns</h2>
      <p class="lede" style="margin-bottom:26px">Towns that work as a base for ${esc(p.name)}. We name the relationship, not invented drive times or prices.</p>
      <div class="grid grid--3">
        ${parkTowns
          .map((t) => {
            const te = townEditorial[t.id];
            return `<article class="card">
              <span class="mono">${esc(t.stateCode)}</span>
              <h3 style="margin-top:6px"><a href="${url(`towns/${t.id}/`)}">${esc(t.name)}</a></h3>
              <p>${esc(te?.intro || "Gateway town for this park. Editorial pending.")}</p>
            </article>`;
          })
          .join("")}
      </div>
    </div>
  </section>`
      : ""
  }

  <section class="section section--paper">
    <div class="wrap">
      <div class="split">
        <div>
          <p class="eyebrow">Sources</p>
          <h2>What this page is based on</h2>
          <ul class="source-list">
            <li><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.fullName)} on NPS.gov</a>: official fees, hours and contact information, retrieved ${NPS_RETRIEVED}.</li>
            ${officialNotes[p.id]?.source ? `<li><a href="${esc(officialNotes[p.id].source.url)}" target="_blank" rel="noopener noreferrer">${esc(officialNotes[p.id].source.title)}</a>: ${esc(officialNotes[p.id].title.toLowerCase())}, retrieved ${esc(officialNotes[p.id].source.retrieved)}.</li>` : ""}
            <li><a href="https://www.nps.gov/subjects/planyourvisit/fees.htm" target="_blank" rel="noopener noreferrer">NPS fees and passes</a>: national fee policy context.</li>
            <li><a href="https://www.recreation.gov" target="_blank" rel="noopener noreferrer">Recreation.gov</a>: federal reservations, permits and camping.</li>
          </ul>
          <p style="margin-top:18px;font-size:13.5px;color:var(--ink-faint)">Editorial on this page is original Parkday Guide writing. It is not a substitute for current official information.</p>
        </div>
        <div>
          <p class="eyebrow">Keep going</p>
          <h3>Closest national parks</h3>
          <div class="stack">
            ${nearby
              .map(
                (n) => `<a class="region-card" href="${url(`parks/${n.id}/`)}"><strong>${esc(n.name)}</strong><span>${esc(n.stateNames.join(" · "))}</span></a>`,
              )
              .join("")}
          </div>
        </div>
      </div>
    </div>
  </section>`;

  return layout({
    title: p.fullName,
    description: clip(`${p.fullName} in ${p.stateNames.join(", ")}: find the best day this week, official NPS fees and hours, gateway towns, and a one-day plan.`),
    body,
    active: "Parks",
    canonical: `/parks/${p.id}/`,
    ogImage,
  });
}

function pageTownsIndex() {
  const body = `
  <section class="hero hero--plain">
    <div class="wrap">
      <div class="hero-inner" style="padding:clamp(48px,8vw,88px) 0 clamp(28px,4vw,44px);">
        <p class="eyebrow">Gateway towns</p>
        <h1>${towns.length} towns that make a park trip work</h1>
        <p class="lede">Where to base yourself for each park, and what to confirm before you arrive. We name the relationship; we do not invent drive times or prices.</p>
      </div>
    </div>
  </section>
  <section class="section section--tight">
    <div class="wrap">
      <div class="filter-bar">
        <label class="sr-only" for="town-search">Search towns</label>
        <input type="search" id="town-search" placeholder="Search towns or park" data-town-search />
        <label class="sr-only" for="town-park">Filter by park</label>
        <select id="town-park" data-town-park>
          <option value="">All parks</option>
          ${parks.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}
        </select>
        <span class="dir-count" data-town-count>${towns.length} towns</span>
      </div>
      <div class="dir-grid" data-town-grid>
        ${towns
          .map((t) => {
            const te = townEditorial[t.id];
            const served = t.parks.map((id) => byId.get(id)?.name).filter(Boolean);
            return `<article class="card" data-town-card data-parks="${esc(t.parks.join("|"))}" data-name="${esc((t.name + " " + t.stateCode + " " + served.join(" ")).toLowerCase())}">
              <span class="mono">${esc(t.stateCode)}</span>
              <h3 style="margin-top:6px"><a href="${url(`towns/${t.id}/`)}">${esc(t.name)}</a></h3>
              <p>${esc(te?.intro || "Gateway town. Editorial pending.")}</p>
              <p class="park-card-meta" style="margin-top:10px">Gateway to ${esc(served.join(", "))}</p>
            </article>`;
          })
          .join("")}
      </div>
      <p class="dir-empty" data-town-empty hidden>No towns match that filter.</p>
    </div>
  </section>`;
  return layout({
    title: "Gateway towns",
    description: `All ${towns.length} gateway towns for the 64 national parks, with honest notes on what to confirm before arriving.`,
    body,
    active: "Towns",
    canonical: "/towns/",
  });
}

function pageTown(t) {
  const te = townEditorial[t.id];
  const served = t.parks.map((id) => byId.get(id)).filter(Boolean);
  const body = `
  <section class="hero hero--plain">
    <div class="wrap">
      <div class="hero-inner" style="padding:clamp(44px,7vw,76px) 0 clamp(26px,4vw,40px);">
        <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="${url("towns/")}">Towns</a><span>/</span><span>${esc(t.name)}</span></nav>
        <p class="eyebrow">${esc(t.stateCode)} · Gateway town</p>
        <h1>${esc(t.name)}</h1>
        <p class="lede">${esc(te?.intro || "Gateway town for " + served.map((p) => p.name).join(" and ") + ". Editorial pending.")}</p>
      </div>
    </div>
  </section>
  <section class="section section--tight">
    <div class="wrap">
      <div class="split">
        <div>
          <p class="eyebrow">Why base here</p>
          <h2>What ${esc(t.name)} gives you</h2>
          <ul class="chips" style="margin-top:14px">
            ${(te?.whyStop || ["Gateway location", "Trip supplies", "Park access"]).map((w) => `<li class="chip">${esc(w)}</li>`).join("")}
          </ul>
          ${te?.note ? `<div class="callout" style="margin-top:24px"><strong>Confirm before you arrive</strong>${esc(te.note)}</div>` : ""}
        </div>
        <div>
          <p class="eyebrow">Parks served</p>
          <div class="stack">
            ${served
              .map(
                (p) => `<a class="region-card" href="${url(`parks/${p.id}/`)}"><strong>${esc(p.name)}</strong><span>${esc(p.stateNames.join(" · "))}</span></a>`,
              )
              .join("")}
          </div>
          <p class="mono" style="margin-top:20px">Gateway relationships are editorial, not NPS designations.</p>
        </div>
      </div>
    </div>
  </section>
  ${checklistPanel()}`;
  return layout({
    title: `${t.name}, ${t.stateCode}`,
    description: `${t.name}, ${t.stateCode} as a gateway town for ${served.map((p) => p.fullName).join(" and ")}.`,
    body,
    active: "Towns",
    canonical: `/towns/${t.id}/`,
  });
}

function pageGuidesIndex() {
  const body = `
  <section class="hero hero--plain">
    <div class="wrap">
      <div class="hero-inner" style="padding:clamp(48px,8vw,88px) 0 clamp(28px,4vw,44px);">
        <p class="eyebrow">Guides</p>
        <h1>Ten guides, written for the decisions you actually make</h1>
        <p class="lede">Season, booking, budget, camping, access, quiet months, driving, packing, and the part after the park. Each guide points back to the official source for anything that changes.</p>
      </div>
    </div>
  </section>
  <section class="section section--tight">
    <div class="wrap">
      <div class="grid grid--2">
        ${guides
          .map(
            (g, i) => `
          <article class="card">
            <span class="mono">${String(i + 1).padStart(2, "0")} · ${esc(g.readingTime || `${Math.max(4, Math.round(g.wordCount / 220))} min read`)}</span>
            <h3 style="margin-top:8px"><a href="${url(`guides/${g.slug}/`)}">${esc(g.title)}</a></h3>
            <p>${esc(g.description)}</p>
          </article>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
  return layout({
    title: "Guides",
    description: "Ten original national park planning guides: season, booking, budget, camping, access, quiet months, driving, packing and after the park.",
    body,
    active: "Guides",
    canonical: "/guides/",
  });
}

function pageArticle(item, opts = {}) {
  const body = `
  <section class="hero hero--plain">
    <div class="wrap">
      <div class="hero-inner" style="padding:clamp(44px,7vw,80px) 0 clamp(24px,3vw,36px);">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          <a href="${url(opts.sectionHref)}">${esc(opts.sectionLabel)}</a><span>/</span><span>${esc(item.title)}</span>
        </nav>
        <p class="eyebrow">${esc(opts.kicker)}</p>
        <h1>${esc(item.title)}</h1>
        <p class="lede">${esc(item.description)}</p>
        <p class="mono" style="margin-top:22px">Updated ${esc(item.updated || BUILD_DATE)}${item.readingTime ? ` · ${esc(item.readingTime)}` : ""}</p>
      </div>
    </div>
  </section>
  <section class="section section--tight">
    <div class="wrap">
      <article class="prose">
        ${item.html}
        <hr />
        <p style="font-size:13.5px;color:var(--ink-faint)">Parkday Guide writes original guidance. Fees, hours and policies change, so confirm anything time-sensitive on <a href="https://www.nps.gov" target="_blank" rel="noopener noreferrer">NPS.gov</a> or <a href="https://www.recreation.gov" target="_blank" rel="noopener noreferrer">Recreation.gov</a>.</p>
      </article>
    </div>
  </section>`;
  return layout({
    title: item.title,
    description: item.description,
    body,
    active: opts.active || "",
    canonical: `${opts.sectionHref}${item.slug}/`,
  });
}

function pageChecklist() {
  const checklist = pageBySlug.get("64-parks-planning-checklist");
  const items = [
    ["Choose the park", "Match the park to the season you can travel, not the other way round."],
    ["Choose the entrance", "A park can have several entrances. The right one changes the town you sleep in."],
    ["Check the fee and the pass", "Compare the per-vehicle fee with an annual pass before you pay at the gate."],
    ["Check reservations", "Some parks and campgrounds use timed entry or advance reservations. Confirm on the official page."],
    ["Book the base", "Pick a gateway town, then confirm the services you need are open in your season."],
    ["Plan one anchor a day", "One committed activity, then optional stops. Over-scheduling is the usual mistake."],
    ["Pack for the weather you will get", "Layers, water, sun protection, and a plan for altitude or heat."],
    ["Download before you leave", "Maps and official pages, because coverage is unreliable in many parks."],
    ["Confirm the week before", "Recheck hours, closures and road access on the official source."],
    ["Plan the after", "Decide what you will do with the trip once you are home: photos, notes, the next park."],
  ];
  const body = `
  <section class="hero hero--plain">
    <div class="wrap">
      <div class="hero-inner" style="padding:clamp(48px,8vw,88px) 0 clamp(28px,4vw,44px);">
        <p class="eyebrow">Free planner</p>
        <h1>The 64 Parks Planning Checklist</h1>
        <p class="lede">Ten decisions that cover the whole trip, from choosing the park to what you do with it afterwards. Read it here, no signup required.</p>
      </div>
    </div>
  </section>
  <section class="section section--tight">
    <div class="wrap">
      <ol style="list-style:none;padding:0;margin:0;display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden">
        ${items
          .map(
            ([t, d], i) => `<li style="background:var(--white);padding:20px 22px;display:grid;grid-template-columns:52px 1fr;gap:16px">
              <span class="mono" style="color:var(--clay);font-size:13px">${String(i + 1).padStart(2, "0")}</span>
              <div><strong style="font-family:var(--serif);font-size:1.12rem;font-weight:500">${esc(t)}</strong><p style="margin:4px 0 0;color:var(--ink-soft);font-size:15px">${esc(d)}</p></div>
            </li>`,
          )
          .join("")}
      </ol>
      <div class="mt-3" style="max-width:70ch">
        ${checklist ? `<article class="prose">${checklist.html}</article>` : ""}
      </div>
    </div>
  </section>
  ${checklistPanel()}`;
  return layout({
    title: "64 Parks Planning Checklist",
    description: "A free ten-step planning checklist for any US national park trip, from choosing the park to planning the days after.",
    body,
    active: "",
    canonical: "/checklist/",
  });
}

function pageBlogIndex() {
  const body = `
  <section class="hero hero--plain">
    <div class="wrap">
      <div class="hero-inner" style="padding:clamp(48px,8vw,88px) 0 clamp(28px,4vw,44px);">
        <p class="eyebrow">Blog</p>
        <h1>Notes on building a guide you can check</h1>
        <p class="lede">How the facts are sourced, why the guide exists, and how to use the planning checklist.</p>
      </div>
    </div>
  </section>
  <section class="section section--tight">
    <div class="wrap">
      <div class="grid grid--2">
        ${
          posts.length
            ? posts
                .map(
                  (p) => `<article class="card">
                    <span class="mono">${esc(p.updated || BUILD_DATE)}</span>
                    <h3 style="margin-top:8px"><a href="${url(`blog/${p.slug}/`)}">${esc(p.title)}</a></h3>
                    <p>${esc(p.description)}</p>
                  </article>`,
                )
                .join("")
            : `<p class="lede">Posts are being written.</p>`
        }
      </div>
    </div>
  </section>`;
  return layout({
    title: "Blog",
    description: "Notes on building Parkday Guide: sourcing, verification, and how to use the planning checklist.",
    body,
    active: "Blog",
    canonical: "/blog/",
  });
}

function pageStatic(item) {
  const slug = item.slug;
  return layout({
    title: item.title,
    description: item.description,
    body: `
  <section class="hero hero--plain">
    <div class="wrap">
      <div class="hero-inner" style="padding:clamp(44px,7vw,80px) 0 clamp(24px,3vw,36px);">
        <p class="eyebrow">Parkday Guide</p>
        <h1>${esc(item.title)}</h1>
        <p class="lede">${esc(item.description)}</p>
      </div>
    </div>
  </section>
  <section class="section section--tight">
    <div class="wrap"><article class="prose">${item.html}</article></div>
  </section>`,
    active: slug === "about" ? "About" : "",
    canonical: `/${slug}/`,
  });
}

function page404() {
  return layout({
    title: "Page not found",
    description: "That page does not exist. Browse all 64 parks instead.",
    noindex: true,
    canonical: null,
    body: `
  <section class="hero hero--plain">
    <div class="wrap"><div class="hero-inner" style="padding:clamp(60px,10vw,120px) 0;">
      <p class="eyebrow">404</p>
      <h1>That trail is not on the map.</h1>
      <p class="lede">The page you asked for does not exist. Start from the directory of all 64 parks.</p>
      <div class="hero-actions"><a class="btn" href="${url("parks/")}">Browse parks</a><a class="btn btn--ghost" href="${url()}">Go home</a></div>
    </div></div>
  </section>`,
  });
}

/* -------------------------------------------------------------------------- */
/* Search index for the guide chatbot                                          */
/* -------------------------------------------------------------------------- */

function buildSearchIndex() {
  const docs = [];

  for (const p of parks) {
    const e = editorialFor(p);
    const townsFor = (townsByPark.get(p.id) || []).map((t) => t.name).join(", ");
    const feeLines = (p.fees?.entrance || [])
      .filter((f) => f.costUsd != null)
      .map((f) => `${f.title}: ${feeCost(f.costUsd)}`)
      .join("; ");
    const resLines = (p.fees?.reservation || [])
      .map((f) => `${feeTitle(f.title)}: ${f.costUsd != null ? feeCost(f.costUsd) : "varies"}`)
      .join("; ");
    docs.push({
      id: `park:${p.id}`,
      type: "park",
      title: p.fullName,
      url: `parks/${p.id}/`,
      text: [
        `${p.fullName} is in ${p.stateNames.join(", ")} (${p.region}).`,
        e.summary,
        feeLines ? `Entrance fees listed by NPS: ${feeLines}.` : "NPS lists no entrance fee for this park.",
        resLines ? `Reservation or timed entry fee: ${resLines}.` : "",
        p.hours?.description ? `Hours: ${firstSentence(p.hours.description, 220)}` : "",
        townsFor ? `Gateway towns: ${townsFor}.` : "",
        p.activities.length ? `Activities: ${p.activities.slice(0, 8).join(", ")}.` : "",
        `Official page: ${p.url}`,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  for (const t of towns) {
    const te = townEditorial[t.id];
    const served = t.parks.map((id) => byId.get(id)?.fullName).filter(Boolean);
    docs.push({
      id: `town:${t.id}`,
      type: "town",
      title: `${t.name}, ${t.stateCode}`,
      url: `towns/${t.id}/`,
      text: `${t.name}, ${t.stateCode} is a gateway town for ${served.join(" and ")}. ${te?.intro || ""} ${te?.note || ""}`.trim(),
    });
  }

  for (const g of guides) {
    docs.push({
      id: `guide:${g.slug}`,
      type: "guide",
      title: g.title,
      url: `guides/${g.slug}/`,
      text: `${g.description} ${g.body.replace(/[#>*`_[\]()]|^- /gm, " ").slice(0, 900)}`,
    });
  }

  for (const p of staticPages) {
    docs.push({
      id: `page:${p.slug}`,
      type: "page",
      title: p.title,
      url: `${p.slug}/`,
      text: `${p.description} ${p.body.replace(/[#>*`_[\]()]|^- /gm, " ").slice(0, 500)}`,
    });
  }

  // A few computed answers that the retrieval alone would answer badly.
  const noFee = parks
    .filter((p) => !(p.fees?.entrance || []).length)
    .map((p) => (officialNotes[p.id]?.title ? `${p.name} (${officialNotes[p.id].title.toLowerCase()})` : p.name));
  docs.push({
    id: "faq:no-fee",
    type: "faq",
    title: "Parks where NPS lists no entrance fee",
    url: "parks/",
    text: `The Park Service lists no entrance fee for these parks: ${noFee.join(", ")}. Separate permits, tours or camping can still cost money.`,
  });

  const withRes = parks
    .filter((p) => (p.fees?.reservation || []).length)
    .map((p) => p.name);
  docs.push({
    id: "faq:reservations",
    type: "faq",
    title: "Parks with a reservation or timed-entry fee listed",
    url: "guides/reservations-and-timed-entry/",
    text: `NPS lists a reservation or timed-entry fee for: ${withRes.join(", ")}. Rules and seasons change, so confirm on the park's official page.`,
  });

  return docs;
}

/* -------------------------------------------------------------------------- */
/* Build                                                                      */
/* -------------------------------------------------------------------------- */

function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // Home
  write("index.html", pageHome());

  // Parks
  write("parks/index.html", pageParksIndex());
  for (const p of parks) write(`parks/${p.id}/index.html`, pagePark(p));

  // Towns
  write("towns/index.html", pageTownsIndex());
  for (const t of towns) write(`towns/${t.id}/index.html`, pageTown(t));

  // Guides
  write("guides/index.html", pageGuidesIndex());
  for (const g of guides) {
    write(
      `guides/${g.slug}/index.html`,
      pageArticle(g, {
        sectionHref: "guides/",
        sectionLabel: "Guides",
        kicker: "Guide",
        active: "Guides",
      }),
    );
  }

  // Blog
  write("blog/index.html", pageBlogIndex());
  for (const p of posts) {
    write(
      `blog/${p.slug}/index.html`,
      pageArticle(p, {
        sectionHref: "blog/",
        sectionLabel: "Blog",
        kicker: "Blog",
        active: "Blog",
      }),
    );
  }

  // Static pages
  for (const p of staticPages) write(`${p.slug}/index.html`, pageStatic(p));
  write("checklist/index.html", pageChecklist());
  write("404.html", page404());

  // Assets
  fs.mkdirSync(path.join(DIST, "assets"), { recursive: true });
  copy(path.join(ROOT, "site", "assets", "styles.css"), "assets/styles.css");
  copy(path.join(ROOT, "site", "assets", "app.js"), "assets/app.js");

  // Data for the chatbot + open data
  fs.mkdirSync(path.join(DIST, "data"), { recursive: true });
  fs.writeFileSync(
    path.join(DIST, "data", "search-index.json"),
    JSON.stringify(buildSearchIndex()),
  );
  fs.writeFileSync(
    path.join(DIST, "data", "parks.json"),
    JSON.stringify(
      parks.map((p) => ({
        id: p.id,
        name: p.fullName,
        states: p.stateNames,
        region: p.region,
        url: p.url,
        fees: p.fees,
        hours: p.hours,
        source: p.source,
      })),
      null,
      2,
    ),
  );

  // robots + sitemap
  write(
    "robots.txt",
    `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`,
  );

  const urls = [
    "",
    "parks/",
    "towns/",
    "guides/",
    "blog/",
    "checklist/",
    ...staticPages.map((p) => `${p.slug}/`),
    ...parks.map((p) => `parks/${p.id}/`),
    ...towns.map((t) => `towns/${t.id}/`),
    ...guides.map((g) => `guides/${g.slug}/`),
    ...posts.map((p) => `blog/${p.slug}/`),
  ];
  write(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map(
        (u) =>
          `  <url><loc>${SITE_URL}/${u}</loc><lastmod>${BUILD_DATE}</lastmod></url>`,
      )
      .join("\n")}\n</urlset>\n`,
  );

  // Report
  const pages = 1 + 1 + parks.length + 1 + towns.length + 1 + guides.length + 1 + posts.length + staticPages.length + 1 + 1;
  console.log(`Built ${pages} pages → dist/`);
  console.log(`  parks: ${parks.length} · towns: ${towns.length} · guides: ${guides.length} · posts: ${posts.length} · pages: ${staticPages.length}`);
  if (missingEditorial.length) {
    console.log(`  ! editorial missing for ${missingEditorial.length} parks: ${missingEditorial.map((p) => p.id).join(", ")}`);
  }
  if (missingTownEditorial.length) {
    console.log(`  ! editorial missing for ${missingTownEditorial.length} towns`);
  }
  console.log(`  base: ${BASE} · canonical: ${SITE_URL}`);

  if (STRICT && (missingEditorial.length || missingTownEditorial.length || guides.length < 10)) {
    console.error("Strict build failed: editorial content incomplete.");
    process.exit(1);
  }
}

build();
