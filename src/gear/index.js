/**
 * gear/index.js — Public interface of the gear system.
 *
 * A gear *definition* lives in gear.js; a gear *instance* is what the player
 * owns: { uid, defId, equippedBy }. Instances live in the inventory so that
 * unequipping never loses an item.
 */

import {
  GEAR, GEAR_SLOTS, GEAR_SLOT_META, getGearDef, GEAR_IDS,
  GEAR_LEVEL_STEP, gearLevelMult, statsAtLevel,
  GEAR_SLOT_LEVEL_STEP, gearSlotMult, slotUpgradeCost, dismantleYield,
} from './gear.js';
import { RARITY_ORDER, rarityOf } from '../config.js';

export {
  GEAR, GEAR_SLOTS, GEAR_SLOT_META, getGearDef, GEAR_IDS,
  GEAR_LEVEL_STEP, gearLevelMult, statsAtLevel,
  GEAR_SLOT_LEVEL_STEP, gearSlotMult, slotUpgradeCost, dismantleYield,
};

let uidCounter = 0;

/** Create an owned instance of a gear definition at a given level. */
export function createGearInstance(defId, level = 1, seedUid) {
  if (!GEAR[defId]) return null;
  const uid = seedUid || `g_${Date.now().toString(36)}_${(uidCounter++).toString(36)}`;
  return { uid, defId, level: Math.max(1, Math.round(level)), equippedBy: null };
}

/**
 * Sum the bonuses of an equipped map ({ weapon: uid, ... }) into
 * { flat, pct } totals. Unknown / missing uids are ignored, so a save that
 * references deleted gear degrades gracefully.
 */
export function bonusesFor(equipped, gearInstances, slotLevels = {}) {
  const flat = { atk: 0, hp: 0, def: 0, speed: 0 };
  const pct = { atk: 0, hp: 0, def: 0, speed: 0 };
  if (!equipped) return { flat, pct };

  for (const slot of GEAR_SLOTS) {
    const uid = equipped[slot];
    if (!uid) continue;
    const inst = gearInstances.find((g) => g.uid === uid);
    const def = inst && getGearDef(inst.defId);
    if (!def) continue;
    // The instance's level is what makes two copies of the same item differ;
    // the SLOT's level then multiplies whatever is sitting in it, which is why
    // an empty slot's level is worth nothing.
    const at = statsAtLevel(def, inst.level);
    const sm = gearSlotMult(slotLevels[slot]);
    for (const k of Object.keys(flat)) {
      if (at.flat[k]) flat[k] += at.flat[k] * sm;
      if (at.pct[k]) pct[k] += at.pct[k] * sm;
    }
  }
  return { flat, pct };
}

/** Short "+12 ATK, +5% ATK" style summary for list rows, at a given level. */
export function describeGear(def, level = 1) {
  if (!def) return '';
  const at = statsAtLevel(def, level);
  const parts = [];
  for (const [k, v] of Object.entries(at.flat)) parts.push(`+${Math.round(v)} ${k.toUpperCase()}`);
  for (const [k, v] of Object.entries(at.pct)) parts.push(`+${Math.round(v * 100)}% ${k.toUpperCase()}`);
  return parts.join(' · ');
}

/**
 * One number for "how good is this piece", used to rank the bag and the equip
 * picker so the best option is always the first thing you see. Weights match
 * computePower()'s intent closely enough for ordering; it is not a power value
 * and is never shown.
 */
export function gearScore(inst) {
  const def = getGearDef(inst?.defId);
  if (!def) return 0;
  const at = statsAtLevel(def, inst.level);
  const W = { atk: 2.4, hp: 0.22, def: 1.8, speed: 60 };
  let score = 0;
  for (const [k, v] of Object.entries(at.flat)) score += v * (W[k] || 1);
  // Percentages are worth more than their face value; scale them against a
  // rough mid-game stat line so the two halves are comparable.
  const REF = { atk: 200, hp: 4000, def: 100, speed: 1 };
  for (const [k, v] of Object.entries(at.pct)) score += v * (REF[k] || 1) * (W[k] || 1);
  return score;
}

/** Best first. Ties break on rarity, then level, so the order is stable. */
export function sortGear(list) {
  return [...list].sort((a, b) => {
    const d = gearScore(b) - gearScore(a);
    if (Math.abs(d) > 0.01) return d;
    const ra = rarityOf(getGearDef(a.defId)?.rarity).order;
    const rb = rarityOf(getGearDef(b.defId)?.rarity).order;
    return rb - ra || (b.level || 1) - (a.level || 1);
  });
}

/**
 * Roll a drop from a stage's drop table. Named items, each with its own
 * chance, at a level rolled from the stage's band.
 * PLACEHOLDER: no pity timer.
 * table: [{ defId, chance }]
 */
export function rollGearDrops(table, levelBand) {
  const drops = [];
  for (const entry of table || []) {
    if (Math.random() < (entry.chance ?? 0.35)) {
      drops.push({ defId: entry.defId, level: rollLevel(levelBand) });
    }
  }
  return drops;
}

/**
 * A level from an inclusive [lo, hi] band. This is the only thing limiting
 * gear level in the game: every drop source declares its band, so how good a
 * piece you can hold is set by how deep you have got, not by a cap constant
 * and not by your hero's level.
 */
export function rollLevel(band) {
  if (!band) return 1;
  const [lo, hi] = Array.isArray(band) ? band : [band, band];
  return lo + Math.floor(Math.random() * (hi - lo + 1));
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
 * spec: { rolls, weights: { common: 80, uncommon: 20, ... }, level: [lo, hi] }
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
    if (id) drops.push({ defId: id, level: rollLevel(spec.level) });
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
