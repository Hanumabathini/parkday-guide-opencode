#!/usr/bin/env node
/**
 * Parkday Guide — official NPS data sync.
 *
 * Reads National Park Service API v1 `/parks` dumps (retrieved 2026-11-19) and
 * writes the canonical fact layer for the 64 scoped parks:
 *
 *   data/parks.json              one fact record per park page (64)
 *   data/nps-snapshot.json       compact, commit-safe snapshot of the source
 *
 * Rules encoded here:
 *   - Facts come only from the official NPS API. No invented numbers.
 *   - Sequoia & Kings Canyon are one NPS unit (SEKI) but two scoped parks.
 *   - Every record carries source + retrieval date + verification status.
 *   - Nothing in this file is editorial copy. Prose lives in content/.
 *
 * Usage:
 *   node scripts/sync_nps_data.mjs <nps-parks.json> [nps-missing.json]
 */

import fs from "node:fs";
import path from "node:path";

const SURFACE = "2026-11-19";
const ROOT = path.resolve(import.meta.dirname, "..");

/** The 64 scoped park units. SEKI expands to two park pages. */
const SCOPE = [
  "ACAD", "ARCH", "BADL", "BIBE", "BISC", "BLCA", "BRCA", "CANY", "CARE",
  "CAVE", "CHIR", "CHIS", "CONG", "CRLA", "CUVA", "DEVA", "DENA", "DRTO",
  "EVER", "GAAR", "GLAC", "GLBA", "GRCA", "GRTE", "GRBA", "GRSA", "GRSM",
  "GUMO", "HALE", "HAVO", "HOSP", "INDU", "ISRO", "JEFF", "JOTR", "KATM",
  "KEFJ", "KOVA", "LACL", "LAVO", "MACA", "MEVE", "MORA", "NERI", "NOCA",
  "NPSA", "OLYM", "PEFO", "PINN", "REDW", "ROMO", "SAGU", "SEKI", "SHEN",
  "THRO", "VIIS", "VOYA", "WHSA", "WICA", "WRST", "YELL", "YOSE", "ZION",
];

/** SEKI is one NPS unit presented as two scoped parks. */
const SPLIT = {
  SEKI: [
    {
      id: "sequoia",
      name: "Sequoia",
      fullName: "Sequoia National Park",
      note: "Managed with Kings Canyon as one NPS unit (SEKI).",
    },
    {
      id: "kings-canyon",
      name: "Kings Canyon",
      fullName: "Kings Canyon National Park",
      note: "Managed with Sequoia as one NPS unit (SEKI).",
    },
  ],
};

/**
 * Display-name and slug overrides for units whose official name contains
 * characters or spacing that would otherwise produce unstable URLs.
 */
const NAMES = {
  GAAR: {
    id: "gates-of-the-arctic",
    name: "Gates of the Arctic",
    // Official name, normalised for title case; the API returns "Gates Of The…".
    fullName: "Gates of the Arctic National Park & Preserve",
  },
  HALE: { id: "haleakala", name: "Haleakalā" },
  HAVO: { id: "hawaii-volcanoes", name: "Hawaiʻi Volcanoes" },
  WRST: {
    id: "wrangell-st-elias",
    name: "Wrangell–St. Elias",
    // Official name, with the en dash the NPS style guide uses.
    fullName: "Wrangell–St. Elias National Park & Preserve",
  },
  NPSA: { id: "national-park-of-american-samoa", name: "National Park of American Samoa" },
};

const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
  AS: "American Samoa", VI: "U.S. Virgin Islands", GU: "Guam", PR: "Puerto Rico",
  MP: "Northern Mariana Islands",
};

const REGIONS = {
  Northeast: ["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA", "DE", "MD", "DC"],
  Southeast: ["VA", "WV", "NC", "SC", "GA", "FL", "AL", "MS", "TN", "KY", "AR", "LA"],
  Midwest: ["OH", "IN", "IL", "MI", "WI", "MN", "IA", "MO", "ND", "SD", "NE", "KS"],
  "South Central": ["TX", "OK", "NM"],
  "Mountain West": ["CO", "UT", "WY", "MT", "ID", "NV", "AZ"],
  Pacific: ["CA", "OR", "WA"],
  Alaska: ["AK"],
  "Pacific Islands": ["HI", "AS", "GU", "MP"],
  Caribbean: ["VI", "PR"],
};

const stateName = (code) => STATE_NAMES[code] || code;
const regionFor = (stateCodes) => {
  for (const [region, codes] of Object.entries(REGIONS)) {
    if (stateCodes.some((c) => codes.includes(c))) return region;
  }
  return "Other";
};
const slugify = (s) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u02bb\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** NPS API dumps are UTF-8 with an optional BOM. */
function readDump(file) {
  const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw);
  return parsed.data || [];
}

function money(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function normalizeFees(fees = []) {
  return fees
    .map((f) => ({
      title: (f.title || "").trim(),
      costUsd: money(f.cost),
      description: (f.description || "").trim(),
    }))
    .filter((f) => f.title);
}

function classifyFees(fees = []) {
  const buckets = { entrance: [], reservation: [], other: [] };
  for (const fee of fees) {
    const title = (fee.title || "").trim();
    if (!title) continue;
    const entry = {
      title,
      costUsd: money(fee.cost),
      description: (fee.description || "").trim(),
    };
    if (/reservation|timed entry/i.test(title)) buckets.reservation.push(entry);
    else if (/^entrance|nonresident/i.test(title)) buckets.entrance.push(entry);
    else buckets.other.push(entry);
  }
  return buckets;
}

function normalizePasses(passes = []) {
  return passes
    .map((p) => ({
      title: (p.title || "").trim(),
      costUsd: money(p.cost),
      description: (p.description || "").trim(),
    }))
    .filter((p) => p.title);
}

function normalizeHours(operatingHours = []) {
  if (!operatingHours.length) return null;
  const first = operatingHours[0];
  const std = first.standardHours || {};
  return {
    description: (first.description || "").trim(),
    standard: {
      monday: std.monday || "", tuesday: std.tuesday || "", wednesday: std.wednesday || "",
      thursday: std.thursday || "", friday: std.friday || "", saturday: std.saturday || "",
      sunday: std.sunday || "",
    },
    exceptions: (first.exceptions || []).length,
  };
}

function normalizeImages(images = []) {
  return images.slice(0, 4).map((img) => {
    const credit = (img.credit || "").trim();
    const official = /nps|national park service|public domain/i.test(credit);
    return {
      url: img.url,
      alt: (img.altText || "").trim(),
      caption: (img.caption || "").trim(),
      credit,
      // Gate 5: only images with an NPS/public-domain credit are pre-cleared.
      rightsStatus: official ? "nps-credit" : "needs-review",
    };
  });
}

function normalizeActivities(items = []) {
  return items.map((a) => (a.title || "").trim()).filter(Boolean);
}

function buildRecord(unit, override) {
  const code = (unit.parkCode || "").toUpperCase();
  const named = NAMES[code] || {};
  const states = (unit.states || "").split(",").map((s) => s.trim()).filter(Boolean);
  // NPS API v1 returns `contacts` as an object, but tolerate an array shape too.
  const contactList = Array.isArray(unit.contacts)
    ? unit.contacts
    : unit.contacts
      ? [unit.contacts]
      : [];
  const phone =
    contactList.flatMap((c) => c.phoneNumbers || [])[0]?.phoneNumber || null;
  const images = normalizeImages(unit.images || []);
  const record = {
    id: override?.id || named.id || slugify(unit.name),
    parkCode: (unit.parkCode || "").toLowerCase(),
    name: override?.name || named.name || unit.name,
    // Keep the official NPS fullName (e.g. "… National Park & Preserve").
    // The short display name above is only for navigation and headings.
    fullName: override?.fullName || named.fullName || unit.fullName || named.name,
    npsDesignation: unit.designation || "",
    states,
    stateNames: states.map(stateName),
    region: regionFor(states),
    coordinates: {
      lat: unit.latitude ? Number(unit.latitude) : null,
      lng: unit.longitude ? Number(unit.longitude) : null,
    },
    url: unit.url || "",
    phone,
    entranceFees: normalizeFees(unit.entranceFees),
    fees: classifyFees(unit.entranceFees),
    entrancePasses: normalizePasses(unit.entrancePasses),
    hours: normalizeHours(unit.operatingHours),
    activities: normalizeActivities(unit.activities),
    topics: normalizeActivities(unit.topics),
    images,
    combinedUnitNote: override?.note || null,
    source: {
      agency: "National Park Service",
      endpoint: "developer.nps.gov/api/v1/parks",
      url: unit.url || "",
      retrieved: SURFACE,
    },
    verification: {
      status: "official-source",
      checkedOn: SURFACE,
      method: "NPS API v1 snapshot",
      editorial: "pending",
    },
  };
  return record;
}

function main() {
  const [dumpPath, extraPath] = process.argv.slice(2);
  if (!dumpPath) {
    console.error("usage: node scripts/sync_nps_data.mjs <nps-parks.json> [nps-missing.json]");
    process.exit(1);
  }
  const units = [...readDump(dumpPath), ...(extraPath ? readDump(extraPath) : [])];
  const byCode = new Map(units.map((u) => [(u.parkCode || "").toUpperCase(), u]));

  const missingCodes = SCOPE.filter((c) => !byCode.has(c));
  if (missingCodes.length) {
    console.error("Missing NPS units for scope codes:", missingCodes.join(", "));
    process.exit(1);
  }

  const parks = [];
  const snapshot = [];

  for (const code of SCOPE) {
    const unit = byCode.get(code);
    const overrides = SPLIT[code] || [null];
    for (const override of overrides) {
      const record = buildRecord(unit, override);
      parks.push(record);
      snapshot.push({
        parkCode: code,
        id: record.id,
        sourceUrl: record.source.url,
        retrieved: SURFACE,
      });
    }
  }

  // Alphabetical by name gives a stable, human-sensible order.
  parks.sort((a, b) => a.name.localeCompare(b.name));

  if (parks.length !== 64) {
    console.error(`Scope error: expected 64 park records, built ${parks.length}`);
    process.exit(1);
  }

  fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, "data", "parks.json"),
    JSON.stringify(parks, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(ROOT, "data", "nps-snapshot.json"),
    JSON.stringify(
      {
        source: "National Park Service API v1 /parks",
        retrieved: SURFACE,
        note: "Official source snapshot for the 64 scoped park pages. Facts only; no editorial copy.",
        parks: snapshot,
      },
      null,
      2,
    ) + "\n",
  );

  const withFees = parks.filter((p) => p.entranceFees.length > 0).length;
  const withPasses = parks.filter((p) => p.entrancePasses.length > 0).length;
  const images = parks.reduce((n, p) => n + p.images.length, 0);
  const review = parks.reduce(
    (n, p) => n + p.images.filter((i) => i.rightsStatus === "needs-review").length,
    0,
  );
  const byRegion = {};
  for (const p of parks) byRegion[p.region] = (byRegion[p.region] || 0) + 1;

  console.log(`Wrote data/parks.json — ${parks.length} parks`);
  console.log(`Entrance fees listed by NPS: ${withFees}/64 · annual/other passes: ${withPasses}/64`);
  console.log(`Images: ${images} total, ${review} awaiting rights review`);
  console.log("By region:", Object.entries(byRegion).map(([r, n]) => `${r}=${n}`).join(", "));
}

main();
