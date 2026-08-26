/**
 * gear/index.js — Public interface of the gear system.
 *
 * A gear *definition* lives in gear.js; a gear *instance* is what the player
 * owns: { uid, defId, equippedBy }. Instances live in the inventory so that
 * unequipping never loses an item.
 */

import { GEAR, GEAR_SLOTS, GEAR_SLOT_META, getGearDef, GEAR_IDS } from './gear.js';

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
