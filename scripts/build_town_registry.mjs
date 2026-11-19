#!/usr/bin/env node
/**
 * Parkday Guide — gateway town registry.
 *
 * Single source of truth for which towns are presented as gateways to which
 * scoped parks. Town pages are editorial; this file records only the
 * relationship the guide is willing to publish, and validates that every
 * referenced park exists in data/parks.json.
 *
 * Gateway relationships are editorial recommendations about where to base a
 * visit. They are not NPS designations, and this file asserts no distance,
 * drive time, price, or business claim.
 *
 * Usage: node scripts/build_town_registry.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** [name, stateCode, parkIds] */
const TOWNS = [
  ["Bar Harbor", "ME", ["acadia"]],
  ["Ellsworth", "ME", ["acadia"]],
  ["Southwest Harbor", "ME", ["acadia"]],
  ["Moab", "UT", ["arches", "canyonlands"]],
  ["Wall", "SD", ["badlands"]],
  ["Interior", "SD", ["badlands"]],
  ["Terlingua", "TX", ["big-bend"]],
  ["Marathon", "TX", ["big-bend"]],
  ["Homestead", "FL", ["biscayne", "everglades"]],
  ["Florida City", "FL", ["biscayne", "everglades"]],
  ["Montrose", "CO", ["black-canyon-of-the-gunnison"]],
  ["Gunnison", "CO", ["black-canyon-of-the-gunnison"]],
  ["Bryce Canyon City", "UT", ["bryce-canyon"]],
  ["Tropic", "UT", ["bryce-canyon"]],
  ["Monticello", "UT", ["canyonlands"]],
  ["Torrey", "UT", ["capitol-reef"]],
  ["Hanksville", "UT", ["capitol-reef"]],
  ["Carlsbad", "NM", ["carlsbad-caverns", "guadalupe-mountains"]],
  ["Whites City", "NM", ["carlsbad-caverns", "guadalupe-mountains"]],
  ["Ventura", "CA", ["channel-islands"]],
  ["Oxnard", "CA", ["channel-islands"]],
  ["Willcox", "AZ", ["chiricahua"]],
  ["Benson", "AZ", ["chiricahua"]],
  ["Columbia", "SC", ["congaree"]],
  ["Hopkins", "SC", ["congaree"]],
  ["Prospect", "OR", ["crater-lake"]],
  ["Fort Klamath", "OR", ["crater-lake"]],
  ["Peninsula", "OH", ["cuyahoga-valley"]],
  ["Akron", "OH", ["cuyahoga-valley"]],
  ["Furnace Creek", "CA", ["death-valley"]],
  ["Lone Pine", "CA", ["death-valley"]],
  ["Beatty", "NV", ["death-valley"]],
  ["Healy", "AK", ["denali"]],
  ["Cantwell", "AK", ["denali"]],
  ["Key West", "FL", ["dry-tortugas"]],
  ["Coldfoot", "AK", ["gates-of-the-arctic"]],
  ["Bettles", "AK", ["gates-of-the-arctic"]],
  ["St. Louis", "MO", ["gateway-arch"]],
  ["West Glacier", "MT", ["glacier"]],
  ["Whitefish", "MT", ["glacier"]],
  ["St. Mary", "MT", ["glacier"]],
  ["Gustavus", "AK", ["glacier-bay"]],
  ["Juneau", "AK", ["glacier-bay"]],
  ["Tusayan", "AZ", ["grand-canyon"]],
  ["Williams", "AZ", ["grand-canyon"]],
  ["Jackson", "WY", ["grand-teton", "yellowstone"]],
  ["Baker", "NV", ["great-basin"]],
  ["Ely", "NV", ["great-basin"]],
  ["Alamosa", "CO", ["great-sand-dunes"]],
  ["Mosca", "CO", ["great-sand-dunes"]],
  ["Gatlinburg", "TN", ["great-smoky-mountains"]],
  ["Pigeon Forge", "TN", ["great-smoky-mountains"]],
  ["Cherokee", "NC", ["great-smoky-mountains"]],
  ["Kula", "HI", ["haleakala"]],
  ["Kahului", "HI", ["haleakala"]],
  ["Volcano", "HI", ["hawaii-volcanoes"]],
  ["Hilo", "HI", ["hawaii-volcanoes"]],
  ["Hot Springs", "AR", ["hot-springs"]],
  ["Chesterton", "IN", ["indiana-dunes"]],
  ["Porter", "IN", ["indiana-dunes"]],
  ["Grand Portage", "MN", ["isle-royale"]],
  ["Houghton", "MI", ["isle-royale"]],
  ["Joshua Tree", "CA", ["joshua-tree"]],
  ["Twentynine Palms", "CA", ["joshua-tree"]],
  ["King Salmon", "AK", ["katmai"]],
  ["Seward", "AK", ["kenai-fjords"]],
  ["Fresno", "CA", ["kings-canyon"]],
  ["Three Rivers", "CA", ["sequoia", "kings-canyon"]],
  ["Kotzebue", "AK", ["kobuk-valley"]],
  ["Port Alsworth", "AK", ["lake-clark"]],
  ["Mineral", "CA", ["lassen-volcanic"]],
  ["Chester", "CA", ["lassen-volcanic"]],
  ["Cave City", "KY", ["mammoth-cave"]],
  ["Park City", "KY", ["mammoth-cave"]],
  ["Cortez", "CO", ["mesa-verde"]],
  ["Mancos", "CO", ["mesa-verde"]],
  ["Ashford", "WA", ["mount-rainier"]],
  ["Enumclaw", "WA", ["mount-rainier"]],
  ["Pago Pago", "AS", ["national-park-of-american-samoa"]],
  ["Fayetteville", "WV", ["new-river-gorge"]],
  ["Beckley", "WV", ["new-river-gorge"]],
  ["Marblemount", "WA", ["north-cascades"]],
  ["Winthrop", "WA", ["north-cascades"]],
  ["Port Angeles", "WA", ["olympic"]],
  ["Forks", "WA", ["olympic"]],
  ["Holbrook", "AZ", ["petrified-forest"]],
  ["Winslow", "AZ", ["petrified-forest"]],
  ["Hollister", "CA", ["pinnacles"]],
  ["Soledad", "CA", ["pinnacles"]],
  ["Crescent City", "CA", ["redwood"]],
  ["Klamath", "CA", ["redwood"]],
  ["Estes Park", "CO", ["rocky-mountain"]],
  ["Grand Lake", "CO", ["rocky-mountain"]],
  ["Tucson", "AZ", ["saguaro"]],
  ["Vail", "AZ", ["saguaro"]],
  ["Visalia", "CA", ["sequoia"]],
  ["Luray", "VA", ["shenandoah"]],
  ["Front Royal", "VA", ["shenandoah"]],
  ["Waynesboro", "VA", ["shenandoah"]],
  ["Medora", "ND", ["theodore-roosevelt"]],
  ["Dickinson", "ND", ["theodore-roosevelt"]],
  ["Cruz Bay", "VI", ["virgin-islands"]],
  ["Charlotte Amalie", "VI", ["virgin-islands"]],
  ["International Falls", "MN", ["voyageurs"]],
  ["Ely", "MN", ["voyageurs"]],
  ["Alamogordo", "NM", ["white-sands"]],
  ["Cloudcroft", "NM", ["white-sands"]],
  ["Hot Springs", "SD", ["wind-cave"]],
  ["Custer", "SD", ["wind-cave"]],
  ["McCarthy", "AK", ["wrangell-st-elias"]],
  ["Chitina", "AK", ["wrangell-st-elias"]],
  ["West Yellowstone", "MT", ["yellowstone"]],
  ["Gardiner", "MT", ["yellowstone"]],
  ["Cody", "WY", ["yellowstone"]],
  ["Mariposa", "CA", ["yosemite"]],
  ["Groveland", "CA", ["yosemite"]],
  ["Lee Vining", "CA", ["yosemite"]],
  ["Springdale", "UT", ["zion"]],
  ["Kanab", "UT", ["zion"]],
];

const slug = (s) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const parks = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "parks.json"), "utf8"),
);
const parkIds = new Set(parks.map((p) => p.id));

const seen = new Set();
const out = [];
const errors = [];

for (const [name, stateCode, parkRefs] of TOWNS) {
  const id = `${slug(name)}-${stateCode.toLowerCase()}`;
  if (seen.has(id)) {
    errors.push(`duplicate town id: ${id}`);
    continue;
  }
  seen.add(id);
  for (const parkId of parkRefs) {
    if (!parkIds.has(parkId)) errors.push(`${name}: unknown park "${parkId}"`);
  }
  out.push({ id, name, stateCode, parks: parkRefs });
}

// Every scoped park must have at least one gateway town.
const covered = new Set(out.flatMap((t) => t.parks));
const uncovered = [...parkIds].filter((id) => !covered.has(id));
for (const id of uncovered) errors.push(`park with no gateway town: ${id}`);

if (errors.length) {
  console.error("Town registry errors:");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}

out.sort((a, b) => a.name.localeCompare(b.name) || a.stateCode.localeCompare(b.stateCode));

fs.mkdirSync(path.join(ROOT, "content", "towns"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "content", "towns", "registry.json"),
  JSON.stringify(out, null, 2) + "\n",
);

const byPark = {};
for (const t of out) for (const p of t.parks) (byPark[p] ||= []).push(t.name);
console.log(`Wrote content/towns/registry.json — ${out.length} towns covering ${covered.size}/64 parks`);
console.log(`Average gateway towns per park: ${(out.reduce((n, t) => n + t.parks.length, 0) / 64).toFixed(1)}`);
