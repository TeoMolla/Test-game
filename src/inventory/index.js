/**
 * inventory/index.js — Shared player resources: currency, shards, gear items.
 *
 * Every system that grants or spends resources goes through here so there is
 * exactly one place that touches the numbers (and one place to add analytics,
 * animations or anti-cheat later).
 */

import { getState, persist } from '../save/index.js';
import { isProtagonist } from '../hero/heroes.js';
import {
  createGearInstance, getGearDef, dismantleYield, slotUpgradeCost,
} from '../gear/index.js';
import { GEAR_SLOTS } from '../gear/gear.js';

/* ---------------- currency ---------------- */

export function zeni() {
  return getState().zeni;
}

export function addZeni(amount) {
  getState().zeni += amount;
  persist();
}

export function spendZeni(amount) {
  const s = getState();
  if (s.zeni < amount) return false;
  s.zeni -= amount;
  persist();
  return true;
}

/* ---------------- senzu beans ---------------- */

export function senzu() {
  return getState().senzu;
}

export function addSenzu(amount) {
  getState().senzu += amount;
  persist();
}

export function spendSenzu(amount) {
  const s = getState();
  if (s.senzu < amount) return false;
  s.senzu -= amount;
  persist();
  return true;
}

/* ---------------- iron ---------------- */

export function iron() {
  return getState().iron || 0;
}

export function addIron(amount) {
  const s = getState();
  s.iron = (s.iron || 0) + amount;
  persist();
}

export function spendIron(amount) {
  const s = getState();
  if ((s.iron || 0) < amount) return false;
  s.iron -= amount;
  persist();
  return true;
}

/* ---------------- shards ---------------- */

export function shards(heroId) {
  return getState().shards[heroId] || 0;
}

export function addShards(heroId, amount) {
  const s = getState();
  s.shards[heroId] = (s.shards[heroId] || 0) + amount;
  persist();
}

export function spendShards(heroId, amount) {
  const s = getState();
  if ((s.shards[heroId] || 0) < amount) return false;
  s.shards[heroId] -= amount;
  persist();
  return true;
}

/* ---------------- gear ---------------- */

export function allGear() {
  return getState().gear;
}

export function gearByUid(uid) {
  return getState().gear.find((g) => g.uid === uid) || null;
}

export function addGear(defId, level = 1) {
  const inst = createGearInstance(defId, level);
  if (!inst) return null;
  getState().gear.push(inst);
  persist();
  return inst;
}

/** Unequipped gear for a slot, for the equip picker. */
export function availableGearForSlot(slot) {
  return getState().gear.filter((g) => {
    const def = getGearDef(g.defId);
    return def && def.slot === slot && !g.equippedBy;
  });
}

/**
 * Equip an item onto a hero. Handles swapping out whatever occupied the slot
 * and stealing the item off another hero if it was equipped elsewhere.
 */
/**
 * Gear belongs to the protagonist alone. Allies have no equipment slots, which
 * keeps the hierarchy clear and keeps the bag from becoming six parallel
 * inventories to manage on a phone screen.
 */
export function equipGear(heroId, uid) {
  const s = getState();
  if (!isProtagonist(heroId)) return false;
  const inst = gearByUid(uid);
  const hero = s.heroes[heroId];
  if (!inst || !hero) return false;
  const def = getGearDef(inst.defId);
  if (!def) return false;

  if (inst.equippedBy && inst.equippedBy !== heroId) {
    const prev = s.heroes[inst.equippedBy];
    if (prev && prev.equipped[def.slot] === uid) prev.equipped[def.slot] = null;
  }

  const displaced = hero.equipped[def.slot];
  if (displaced) {
    const old = gearByUid(displaced);
    if (old) old.equippedBy = null;
  }

  hero.equipped[def.slot] = uid;
  inst.equippedBy = heroId;
  persist();
  return true;
}

export function unequipGear(heroId, slot) {
  const s = getState();
  const hero = s.heroes[heroId];
  if (!hero || !GEAR_SLOTS.includes(slot)) return false;
  const uid = hero.equipped[slot];
  if (!uid) return false;
  const inst = gearByUid(uid);
  if (inst) inst.equippedBy = null;
  hero.equipped[slot] = null;
  persist();
  return true;
}

/**
 * Scrap a piece for iron. Equipped gear is refused rather than silently
 * unequipped — dismantling is destructive and should never be something that
 * happens to the item you are currently wearing by accident.
 * Returns the iron gained, or 0 if nothing happened.
 */
export function dismantleGear(uid) {
  const s = getState();
  const idx = s.gear.findIndex((g) => g.uid === uid);
  if (idx < 0) return 0;
  const inst = s.gear[idx];
  if (inst.equippedBy) return 0;
  const def = getGearDef(inst.defId);
  if (!def) return 0;

  const gained = dismantleYield(def, inst.level);
  s.gear.splice(idx, 1);
  s.iron = (s.iron || 0) + gained;
  persist();
  return gained;
}

/** What one slot upgrade costs and whether it is affordable right now. */
export function slotUpgradeInfo(slot) {
  if (!GEAR_SLOTS.includes(slot)) return null;
  const level = getState().gearSlotLevels?.[slot] ?? 0;
  const cost = slotUpgradeCost(level);
  return { slot, level, cost, haveIron: iron(), canUpgrade: iron() >= cost };
}

/** Spend iron to raise one gear slot a level. */
export function upgradeGearSlot(slot) {
  const info = slotUpgradeInfo(slot);
  if (!info || !info.canUpgrade) return false;
  if (!spendIron(info.cost)) return false;
  getState().gearSlotLevels[slot] = info.level + 1;
  persist();
  return true;
}

/** Grant a batch of rewards from a stage clear. Returns a display summary. */
export function grantRewards({ zeni: z = 0, senzu: sz = 0, shards: sh = {}, gear: gearDrops = [] } = {}) {
  const summary = { zeni: z, senzu: sz, shards: [], gear: [] };
  if (z) addZeni(z);
  if (sz) addSenzu(sz);
  for (const [heroId, amount] of Object.entries(sh)) {
    if (!amount) continue;
    addShards(heroId, amount);
    summary.shards.push({ heroId, amount });
  }
  // Gear arrives as { defId, level } — the level is rolled by whichever
  // source granted it and is fixed from here on.
  for (const drop of gearDrops) {
    const { defId, level = 1 } = typeof drop === 'string' ? { defId: drop } : drop;
    const inst = addGear(defId, level);
    if (inst) summary.gear.push({ ...getGearDef(defId), level: inst.level, uid: inst.uid });
  }
  return summary;
}
