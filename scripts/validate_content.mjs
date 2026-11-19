#!/usr/bin/env node
/**
 * Parkday Guide — content validator.
 *
 * Fails loudly on the things that would embarrass the guide in public:
 *   - park or town coverage gaps
 *   - editorial that quotes the official description
 *   - invented prices, hours or phone numbers in prose
 *   - hype words that need proof
 *   - em dashes in new writing
 *   - broken internal links in the built site
 *   - missing frontmatter or guides
 *
 * Usage:
 *   node scripts/validate_content.mjs
 *   node scripts/validate_content.mjs --dist
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHECK_DIST = process.argv.includes("--dist");

const stripBom = (s) => s.replace(/^\uFEFF/, "");
const readJson = (p, fallback) => {
  try {
    return JSON.parse(stripBom(fs.readFileSync(p, "utf8")));
  } catch {
    return fallback;
  }
};

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const parks = readJson(path.join(ROOT, "data", "parks.json"), []);
const towns = readJson(path.join(ROOT, "content", "towns", "registry.json"), []);
const parkById = new Map(parks.map((p) => [p.id, p]));

/* -------------------------------------------------------------------------- */
/* Editorial merge                                                            */
/* -------------------------------------------------------------------------- */

const editorialDir = path.join(ROOT, "content", "editorial");
const editorial = {};
if (fs.existsSync(editorialDir)) {
  for (const file of fs.readdirSync(editorialDir).filter((f) => f.endsWith(".json"))) {
    const data = readJson(path.join(editorialDir, file), {});
    if (!data || typeof data !== "object") {
      fail(`${file}: not a JSON object`);
      continue;
    }
    for (const [key, value] of Object.entries(data)) {
      if (editorial[key]) warn(`${key}: defined in more than one editorial file`);
      editorial[key] = value;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Prose rules                                                                */
/* -------------------------------------------------------------------------- */

const HYPE = [
  "unforgettable", "bucket list", "hidden gem", "must-see", "must see",
  "world-famous", "world famous", "breathtaking", "jaw-dropping", "magical",
  "once-in-a-lifetime", "once in a lifetime", "iconic", "epic", "stunning",
  "picture-perfect", "postcard-perfect",
];

const INVENTED = [
  { re: /\$\s?\d/, why: "a dollar amount" },
  { re: /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i, why: "a clock time" },
  { re: /\(\d{3}\)\s?\d{3}-\d{4}/, why: "a phone number" },
  { re: /\b\d+(\.\d+)?\s?(miles?|mi|km)\b/i, why: "a distance" },
  { re: /\b\d+\s?(minutes?|mins?|hours?)\s+(drive|away|from)\b/i, why: "a drive time" },
  { re: /\b(open|opens|closed|closes)\s+(at|from)\s+\d/i, why: "an opening time" },
];

function checkProse(where, text) {
  if (!text || typeof text !== "string") return;
  const low = text.toLowerCase();

  for (const word of HYPE) {
    if (low.includes(word)) fail(`${where}: hype word "${word}"`);
  }

  for (const rule of INVENTED) {
    if (rule.re.test(text)) fail(`${where}: looks like ${rule.why}: "${text.match(rule.re)[0]}"`);
  }

  if (text.includes("—")) fail(`${where}: em dash found (use a comma or full stop)`);

  if (/\b(the best|the closest|the only|the most)\b/i.test(text)) {
    warn(`${where}: comparative claim needs proof: "${text.match(/\b(the best|the closest|the only|the most)[^.]*/i)[0]}"`);
  }
}

/* -------------------------------------------------------------------------- */
/* Park coverage                                                              */
/* -------------------------------------------------------------------------- */

const REQUIRED_PARK_FIELDS = ["summary", "whyGo", "highlights", "bestFor", "seasonNote", "tip"];

let coveredParks = 0;
for (const park of parks) {
  const e = editorial[park.id];
  if (!e) {
    fail(`park ${park.id}: no editorial entry`);
    continue;
  }
  coveredParks++;

  for (const field of REQUIRED_PARK_FIELDS) {
    if (!e[field] || (Array.isArray(e[field]) && e[field].length === 0)) {
      fail(`park ${park.id}: missing "${field}"`);
    }
  }

  if (e.summary) {
    const words = e.summary.split(/\s+/).filter(Boolean).length;
    if (words < 30 || words > 80) warn(`park ${park.id}: summary is ${words} words (target 40-65)`);
    // Anti-copy: no long verbatim overlap with the NPS description.
    const official = String(park.description || "").toLowerCase();
    if (official) {
      const sentences = e.summary.toLowerCase().split(/[.!?]/).map((s) => s.trim()).filter((s) => s.length > 40);
      for (const s of sentences) {
        if (official.includes(s)) fail(`park ${park.id}: summary sentence copies NPS text verbatim`);
      }
    }
  }

  checkProse(`park ${park.id} summary`, e.summary);
  checkProse(`park ${park.id} whyGo`, e.whyGo);
  checkProse(`park ${park.id} seasonNote`, e.seasonNote);
  checkProse(`park ${park.id} tip`, e.tip);

  if (e.highlights && e.highlights.length !== 4) {
    warn(`park ${park.id}: ${e.highlights.length} highlights (expected 4)`);
  }
  if (e.bestFor && e.bestFor.length !== 3) {
    warn(`park ${park.id}: ${e.bestFor.length} bestFor items (expected 3)`);
  }
  if (!e.dayPlan) {
    fail(`park ${park.id}: missing dayPlan`);
  } else {
    for (const part of ["morning", "afternoon", "evening"]) {
      if (!e.dayPlan[part]) fail(`park ${park.id}: dayPlan.${part} missing`);
      else checkProse(`park ${park.id} dayPlan.${part}`, e.dayPlan[part]);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Town coverage                                                              */
/* -------------------------------------------------------------------------- */

let coveredTowns = 0;
for (const town of towns) {
  const e = editorial[town.id];
  if (!e) {
    fail(`town ${town.id}: no editorial entry`);
    continue;
  }
  coveredTowns++;
  if (!e.intro) fail(`town ${town.id}: missing intro`);
  if (!Array.isArray(e.whyStop) || e.whyStop.length < 3) warn(`town ${town.id}: fewer than 3 whyStop items`);
  if (!e.note) warn(`town ${town.id}: missing note`);
  checkProse(`town ${town.id} intro`, e.intro);
  checkProse(`town ${town.id} note`, e.note);
  if (e.intro && !town.parks.every((id) => parkById.has(id))) {
    fail(`town ${town.id}: references unknown park id`);
  }
}

/* -------------------------------------------------------------------------- */
/* Markdown                                                                   */
/* -------------------------------------------------------------------------- */

const REQUIRED_GUIDES = [
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

const REQUIRED_PAGES = ["about", "methodology", "accessibility", "rv-guide"];

function checkMarkdownDir(dir, required) {
  const found = new Map();
  if (!fs.existsSync(dir)) {
    fail(`${path.relative(ROOT, dir)}: directory missing`);
    return found;
  }
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const raw = stripBom(fs.readFileSync(path.join(dir, file), "utf8"));
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) {
      fail(`${file}: missing frontmatter`);
      continue;
    }
    const meta = {};
    for (const line of m[1].split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    }
    const body = m[2];
    const slug = meta.slug || file.replace(/\.md$/, "");
    found.set(slug, { file, meta, body });

    for (const key of ["title", "description", "slug"]) {
      if (!meta[key]) fail(`${file}: frontmatter missing ${key}`);
    }
    const words = body.split(/\s+/).filter(Boolean).length;
    if (words < 250) fail(`${file}: only ${words} words`);
    checkProse(file, body);
    if (body.includes("—")) fail(`${file}: em dash found`);
    if (!/nps\.gov/i.test(body)) warn(`${file}: no nps.gov link in the body`);
  }
  for (const slug of required) {
    if (!found.has(slug)) fail(`${path.relative(ROOT, dir)}: missing required "${slug}"`);
  }
  return found;
}

const guides = checkMarkdownDir(path.join(ROOT, "content", "guides"), REQUIRED_GUIDES);
checkMarkdownDir(path.join(ROOT, "content", "pages"), REQUIRED_PAGES);

/* -------------------------------------------------------------------------- */
/* Built site                                                                 */
/* -------------------------------------------------------------------------- */

if (CHECK_DIST) {
  const dist = path.join(ROOT, "dist");
  if (!fs.existsSync(dist)) {
    fail("dist/: not built. Run node site/build.mjs");
  } else {
    const htmlFiles = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".html")) htmlFiles.push(full);
      }
    };
    walk(dist);

    if (htmlFiles.length < 64 + 119 + 10) {
      fail(`dist/: only ${htmlFiles.length} HTML files (expected the full site)`);
    }

    const seen = new Set();
    for (const file of htmlFiles) {
      const html = fs.readFileSync(file, "utf8");

      // Internal links must resolve to a file we actually wrote.
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      for (const href of hrefs) {
        if (/^(https?:|mailto:|tel:|#|data:)/.test(href)) continue;
        const clean = href.split("#")[0].split("?")[0];
        if (!clean) continue;
        const resolved = path.join(dist, clean.replace(/^\//, ""));
        const target = clean.endsWith("/") || clean === "" ? path.join(resolved, "index.html") : resolved;
        if (!fs.existsSync(target)) fail(`${path.relative(dist, file)}: broken internal link "${href}"`);
      }

      for (const word of HYPE) {
        if (html.toLowerCase().includes(word)) fail(`${path.relative(dist, file)}: hype word "${word}" in output`);
      }

      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
      if (!canonical) warn(`${path.relative(dist, file)}: no canonical`);
      else if (seen.has(canonical[1])) fail(`${path.relative(dist, file)}: duplicate canonical ${canonical[1]}`);
      else seen.add(canonical[1]);
    }

    // The page the whole product promises.
    for (const p of parks) {
      if (!fs.existsSync(path.join(dist, "parks", p.id, "index.html"))) {
        fail(`dist/: missing park page for ${p.id}`);
      }
    }
    for (const t of towns) {
      if (!fs.existsSync(path.join(dist, "towns", t.id, "index.html"))) {
        fail(`dist/: missing town page for ${t.id}`);
      }
    }
    for (const g of guides.keys()) {
      if (!fs.existsSync(path.join(dist, "guides", g, "index.html"))) {
        fail(`dist/: missing guide page for ${g}`);
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Report                                                                     */
/* -------------------------------------------------------------------------- */

console.log(`Parks:  ${coveredParks}/${parks.length} with editorial`);
console.log(`Towns:  ${coveredTowns}/${towns.length} with editorial`);
console.log(`Guides: ${guides.size}/10`);
console.log(`Pages:  ${fs.existsSync(path.join(ROOT, "content", "pages")) ? fs.readdirSync(path.join(ROOT, "content", "pages")).filter((f) => f.endsWith(".md")).length : 0} markdown files`);

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 30)) console.log(`  · ${w}`);
  if (warnings.length > 30) console.log(`  … and ${warnings.length - 30} more`);
}

if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors.slice(0, 60)) console.error(`  ✗ ${e}`);
  if (errors.length > 60) console.error(`  … and ${errors.length - 60} more`);
  process.exit(1);
}

console.log("\nContent validation passed.");
