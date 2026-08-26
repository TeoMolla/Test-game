/**
 * hero/index.js — Public interface of the hero system.
 *
 * Turns a hero *definition* (static, hero/heroes.js) plus the player's *hero
 * state* (owned / star / level / equipped, in the save) into the concrete
 * numbers the rest of the game uses.
 *
 * Nothing outside this module should multiply base stats by anything.
 */

import { HEROES, HERO_IDS, ALLY_IDS, PROTAGONIST_ID, getHeroDef, isProtagonist } from './heroes.js';
import {
  rarityOf, STAR_STAT_MULT, STAR_PROMOTE_SHARDS, MAX_STARS,
  MAX_LEVEL, LEVEL_STAT_STEP, computePower, HP_SCALE,
  xpForLevel, xpToReach, levelFromXp,
  slotTrainZeni, slotTrainSenzu, COMPANION_LEVEL_CAP_OFFSET,
  BOND_RARITY_MULT, BOND_STAR_MULT, BOND_EQUIPPED_SHARE, BOND_COLLECTED_SHARE,
} from '../config.js';
import { bonusesFor } from '../gear/index.js';
import { activeSkills, loadoutSlots } from '../skills/index.js';
import { getState, persist } from '../save/index.js';
import * as inventory from '../inventory/index.js';

export { HEROES, HERO_IDS, ALLY_IDS, PROTAGONIST_ID, getHeroDef, isProtagonist };

export function heroSave(heroId) {
  return getState().heroes[heroId] || null;
}

/**
 * The protagonist's level is derived from lifetime XP. Companions have no level
 * of their own — they all fight at the companion level below.
 */
export function levelOf(heroId) {
  const hs = heroSave(heroId);
  if (!hs) return 1;
  return isProtagonist(heroId) ? levelFromXp(hs.xp || 0) : companionLevel();
}

/** Companions can never pass the protagonist. */
export function companionLevelCap() {
  return Math.min(MAX_LEVEL, levelOf(PROTAGONIST_ID) + COMPANION_LEVEL_CAP_OFFSET);
}

/**
 * The level every companion fights at: the LOWEST slot, capped at the hero's
 * level. Running one slot ahead of the other buys nothing, which is what forces
 * the investment to be spread rather than dumped into a favourite.
 */
export function companionLevel() {
  const slots = getState().companionSlots || [];
  if (!slots.length) return 1;
  return Math.min(companionLevelCap(), ...slots.map((s) => s.level || 1));
}

/** Per-slot state for the training panel. */
export function slotInfo(index) {
  const slots = getState().companionSlots || [];
  const slot = slots[index];
  if (!slot) return null;
  const level = slot.level || 1;
  const lowest = Math.min(...slots.map((s) => s.level || 1));
  const cap = companionLevelCap();
  const atMax = level >= MAX_LEVEL;
  const atCap = level >= cap;
  const zeniCost = slotTrainZeni(level);
  const senzuCost = slotTrainSenzu(level);
  return {
    index, level, cap, atCap, atMax,
    // A slot above the lowest is not the level companions are fighting at, so
    // raising it further changes nothing until the other one catches up.
    binding: level === lowest,
    zeniCost, senzuCost,
    haveZeni: inventory.zeni(), haveSenzu: inventory.senzu(),
    canTrain: !atCap && !atMax
      && inventory.zeni() >= zeniCost && inventory.senzu() >= senzuCost,
  };
}

/** Spend beans and zeni to raise one companion slot. */
export function trainSlot(index) {
  const info = slotInfo(index);
  if (!info || !info.canTrain) return false;
  // Take the scarce resource first: if beans are short, nothing is spent.
  if (!inventory.spendSenzu(info.senzuCost)) return false;
  if (!inventory.spendZeni(info.zeniCost)) {
    inventory.addSenzu(info.senzuCost);
    return false;
  }
  getState().companionSlots[index].level = info.level + 1;
  persist();
  return true;
}

/* ---------------- bonds ---------------- */

/** Which companions are currently fielded. */
function equippedCompanions() {
  return new Set(
    getState().team.filter((s) => s?.heroId && !isProtagonist(s.heroId)).map((s) => s.heroId)
  );
}

/**
 * What one companion lends, at its current star rank and slot share. Null for
 * the protagonist and for anyone not yet recruited.
 */
export function bondOf(heroId) {
  const def = getHeroDef(heroId);
  const hs = heroSave(heroId);
  if (!def?.bond || !hs?.owned || isProtagonist(heroId)) return null;
  const mult = (BOND_RARITY_MULT[def.rarity] ?? 1)
    * (BOND_STAR_MULT[Math.min(hs.star, BOND_STAR_MULT.length - 1)] ?? 0);
  const share = equippedCompanions().has(heroId) ? BOND_EQUIPPED_SHARE : BOND_COLLECTED_SHARE;
  const scale = mult * share;
  const flat = {};
  const pct = {};
  for (const [k, v] of Object.entries(def.bond.flat || {})) flat[k] = v * scale;
  for (const [k, v] of Object.entries(def.bond.pct || {})) pct[k] = v * scale;
  return { label: def.bond.label, equipped: share === BOND_EQUIPPED_SHARE, flat, pct };
}

/** Everything the collection lends the protagonist, summed. */
export function bondTotals() {
  const flat = { atk: 0, hp: 0, def: 0, speed: 0 };
  const pct = { atk: 0, hp: 0, def: 0, speed: 0 };
  for (const id of ALLY_IDS) {
    const bond = bondOf(id);
    if (!bond) continue;
    for (const k of Object.keys(flat)) {
      flat[k] += bond.flat[k] || 0;
      pct[k] += bond.pct[k] || 0;
    }
  }
  return { flat, pct };
}

export function isOwned(heroId) {
  const hs = heroSave(heroId);
  return !!(hs && hs.owned);
}

/**
 * Stats before gear, at a given star + level.
 * PLACEHOLDER: `speed` deliberately does NOT scale with star or level — it
 * sets combat pacing, and letting it inflate makes battles unreadable. Only
 * gear moves it.
 */
export function baseStatsAt(def, star, level = 1) {
  const rarity = rarityOf(def.rarity);
  const starMult = STAR_STAT_MULT[Math.min(star, MAX_STARS)] ?? 1;
  const levelMult = 1 + LEVEL_STAT_STEP * (level - 1);
  const scale = rarity.statMult * starMult * levelMult;
  return {
    atk: Math.round(def.baseStats.atk * scale),
    hp: Math.round(def.baseStats.hp * scale * HP_SCALE),
    def: Math.round(def.baseStats.def * scale),
    speed: def.baseStats.speed,
  };
}

/** Final stats including equipped gear. */
export function statsFor(heroId, override = {}) {
  const def = getHeroDef(heroId);
  if (!def) return { atk: 0, hp: 0, def: 0, speed: 1 };
  const hs = heroSave(heroId) || { star: 0, level: 1, equipped: {} };
  const star = override.star ?? hs.star;
  const level = override.level ?? levelOf(heroId);
  const equipped = override.equipped ?? hs.equipped;

  const base = baseStatsAt(def, star, level);
  const { flat, pct } = bonusesFor(equipped, getState().gear, getState().gearSlotLevels);

  // Bonds land on the protagonist only — he is the one the collection lends to.
  if (isProtagonist(heroId) && override.bonds !== false) {
    const bonds = bondTotals();
    for (const k of Object.keys(flat)) {
      flat[k] += bonds.flat[k] || 0;
      pct[k] += bonds.pct[k] || 0;
    }
  }

  return {
    atk: Math.round((base.atk + flat.atk) * (1 + pct.atk)),
    hp: Math.round((base.hp + flat.hp) * (1 + pct.hp)),
    def: Math.round((base.def + flat.def) * (1 + pct.def)),
    speed: +((base.speed + flat.speed) * (1 + pct.speed)).toFixed(3),
  };
}

export function powerOf(heroId, override = {}) {
  const hs = heroSave(heroId) || { star: 0 };
  return computePower(statsFor(heroId, override), override.star ?? hs.star);
}

export function teamPower(team = getState().team) {
  return team.reduce((sum, slot) => sum + (slot?.heroId ? powerOf(slot.heroId) : 0), 0);
}

/** Skills usable right now, given the hero's star rank. */
export function skillsFor(heroId) {
  const def = getHeroDef(heroId);
  const hs = heroSave(heroId);
  if (!def || !hs) return { attack: null, technique: null, ultimate: null, passive: null };
  return activeSkills(def.loadout, def.rarity, hs.star);
}

/** Every slot with lock state — drives the Stars tab. */
export function slotsFor(heroId) {
  const def = getHeroDef(heroId);
  const hs = heroSave(heroId) || { star: 0 };
  if (!def) return [];
  return loadoutSlots(def.loadout, def.rarity, hs.star);
}

/* ---------------- unlocking ---------------- */

export function unlockInfo(heroId) {
  const def = getHeroDef(heroId);
  const rarity = rarityOf(def.rarity);
  const have = inventory.shards(heroId);
  const need = rarity.shardsToUnlock;
  return { have, need, canUnlock: !isOwned(heroId) && have >= need };
}

export function unlockHero(heroId) {
  const info = unlockInfo(heroId);
  if (!info.canUnlock) return false;
  if (!inventory.spendShards(heroId, info.need)) return false;
  const hs = heroSave(heroId);
  hs.owned = true;
  hs.star = getHeroDef(heroId).startStar ?? 1;
  persist();
  return true;
}

/* ---------------- star promotion ---------------- */

export function promoteInfo(heroId) {
  const def = getHeroDef(heroId);
  const hs = heroSave(heroId);
  if (!def || !hs) return null;
  const atMax = hs.star >= MAX_STARS;
  const cost = atMax ? 0 : STAR_PROMOTE_SHARDS[hs.star];
  const have = inventory.shards(heroId);
  const level = levelOf(heroId);
  const current = baseStatsAt(def, hs.star, level);
  const next = atMax ? current : baseStatsAt(def, hs.star + 1, level);
  return { star: hs.star, atMax, cost, have, canPromote: !atMax && have >= cost, current, next };
}

export function promote(heroId) {
  const info = promoteInfo(heroId);
  if (!info || !info.canPromote) return false;
  if (!inventory.spendShards(heroId, info.cost)) return false;
  heroSave(heroId).star += 1;
  persist();
  return true;
}

/* ---------------- levelling ---------------- */

/** Everything the UI needs to draw an XP bar. */
export function xpInfo(heroId) {
  const hs = heroSave(heroId);
  if (!hs) return null;
  const level = levelOf(heroId);
  const atMax = level >= MAX_LEVEL;
  const xp = hs.xp || 0;
  const base = xpToReach(level);
  const needed = atMax ? 0 : xpForLevel(level);
  const into = atMax ? 0 : xp - base;
  return { level, atMax, xp, into, needed, pct: atMax ? 100 : Math.min(100, (into / needed) * 100) };
}

/**
 * Award XP and report what it bought. Levels fall out of the total, so this
 * cannot desynchronise from the stored value.
 */
export function grantXp(heroId, amount) {
  const hs = heroSave(heroId);
  if (!hs || !hs.owned || amount <= 0) return { gained: 0, from: 1, to: 1 };
  const from = levelOf(heroId);
  hs.xp = (hs.xp || 0) + Math.round(amount);
  const to = levelOf(heroId);
  persist();
  return { gained: Math.round(amount), from, to };
}

/**
 * Battle XP belongs to the protagonist alone. Allies learn nothing from
 * fighting — they are trained with beans and zeni instead, so that the two
 * tracks stay distinct and his is the one the campaign feeds.
 */
export function awardBattleXp(amount) {
  const res = grantXp(PROTAGONIST_ID, amount);
  return res.gained ? [{ heroId: PROTAGONIST_ID, ...res }] : [];
}

/* ---------------- roster view model ---------------- */

/**
 * The collection grid: companions actually recruited. Ones you do not own are
 * deliberately absent — the Bag tracks shard progress toward them instead.
 */
export function allyEntries() {
  return rosterEntries().filter((e) => !isProtagonist(e.id) && e.owned);
}

/** Companions you have enough shards to recruit right now. */
export function recruitableEntries() {
  return rosterEntries().filter((e) => !isProtagonist(e.id) && !e.owned && e.unlock.canUnlock);
}

export function rosterEntries() {
  return HERO_IDS.map((id) => {
    const def = getHeroDef(id);
    const hs = heroSave(id);
    const owned = !!hs?.owned;
    return {
      id, def, rarity: rarityOf(def.rarity), owned,
      protagonist: isProtagonist(id),
      star: hs?.star ?? 0,
      level: levelOf(id),
      power: owned ? powerOf(id) : 0,
      unlock: unlockInfo(id),
    };
  }).sort((a, b) => (b.owned - a.owned) || (b.rarity.order - a.rarity.order) || b.power - a.power);
}
