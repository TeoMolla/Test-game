/**
 * gear/index.js — Public interface of the gear system.
 *
 * A gear *definition* lives in gear.js; a gear *instance* is what the player
 * owns: { uid, defId, equippedBy }. Instances live in the inventory so that
 * unequipping never loses an item.
 */

import { GEAR, GEAR_SLOTS, GEAR_SLOT_META, getGearDef, GEAR_IDS } from './gear.js';
import { RARITY_ORDER } from '../config.js';

export { GEAR, GEAR_SLOTS, GEAR_SLOT_META, getGearDef, GEAR_IDS };

let uidCounter = 0;

/** Create an owned instance of a gear definition. */
export function createGearInstance(defId, seedUid) {
  if (!GEAR[defId]) return null;
  const uid = seedUid || `g_${Date.now().toString(36)}_${(uidCounter++).toString(36)}`;
  return { uid, defId, equippedBy: null };
}

/**
 * Sum the bonuses of an equipped map ({ weapon: uid, ... }) into
 * { flat, pct } totals. Unknown / missing uids are ignored, so a save that
 * references deleted gear degrades gracefully.
 */
export function bonusesFor(equipped, gearInstances) {
  const flat = { atk: 0, hp: 0, def: 0, speed: 0 };
  const pct = { atk: 0, hp: 0, def: 0, speed: 0 };
  if (!equipped) return { flat, pct };

  for (const slot of GEAR_SLOTS) {
    const uid = equipped[slot];
    if (!uid) continue;
    const inst = gearInstances.find((g) => g.uid === uid);
    const def = inst && getGearDef(inst.defId);
    if (!def) continue;
    for (const k of Object.keys(flat)) {
      if (def.flat && def.flat[k]) flat[k] += def.flat[k];
      if (def.pct && def.pct[k]) pct[k] += def.pct[k];
    }
  }
  return { flat, pct };
}

/** Short "+12 ATK, +5% ATK" style summary for list rows. */
export function describeGear(def) {
  if (!def) return '';
  const parts = [];
  for (const [k, v] of Object.entries(def.flat || {})) parts.push(`+${v} ${k.toUpperCase()}`);
  for (const [k, v] of Object.entries(def.pct || {})) parts.push(`+${Math.round(v * 100)}% ${k.toUpperCase()}`);
  return parts.join(' · ');
}

/**
 * Roll a drop from a stage's drop table.
 * PLACEHOLDER: flat weighted roll, no pity, no level scaling.
 * table: [{ defId, weight, chance }]
 */
export function rollGearDrops(table) {
  const drops = [];
  for (const entry of table || []) {
    if (Math.random() < (entry.chance ?? 0.35)) drops.push(entry.defId);
  }
  return drops;
}

/** Every gear id of a given rarity. */
export function gearIdsByRarity(rarity) {
  return GEAR_IDS.filter((id) => GEAR[id].rarity === rarity);
}

/**
 * Dungeon-style drop: roll a RARITY from weights, then a random item of that
 * rarity. This is the difference between the two systems — a campaign stage
 * drops specific named items tied to its story beat, a dungeon drops "gear of
 * roughly this quality", which is what makes difficulty tiers mean something.
 *
 * A rarity with no items defined yet (epic, ssr) walks back down the ladder
 * rather than dropping nothing, so adding higher-rarity gear later needs no
 * change to any dungeon's table.
 *
 * spec: { rolls, weights: { common: 80, uncommon: 20, ... } }
 */
export function rollGearTable(spec) {
  const weights = Object.entries(spec?.weights || {}).filter(([, w]) => w > 0);
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  if (!total) return [];

  const drops = [];
  for (let i = 0; i < (spec.rolls || 1); i += 1) {
    let roll = Math.random() * total;
    let rarity = weights[weights.length - 1][0];
    for (const [id, w] of weights) {
      roll -= w;
      if (roll <= 0) { rarity = id; break; }
    }
    const id = pickOfRarityOrBelow(rarity);
    if (id) drops.push(id);
  }
  return drops;
}

function pickOfRarityOrBelow(rarity) {
  let idx = RARITY_ORDER.indexOf(rarity);
  if (idx < 0) idx = 0;
  for (let i = idx; i >= 0; i -= 1) {
    const pool = gearIdsByRarity(RARITY_ORDER[i]);
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}
