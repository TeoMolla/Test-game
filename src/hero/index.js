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
  allyTrainZeni, allyTrainSenzu, ALLY_LEVEL_CAP_OFFSET,
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
 * The protagonist's level is derived from lifetime XP and never stored; an
 * ally's is stored outright, because it is bought rather than earned.
 */
export function levelOf(heroId) {
  const hs = heroSave(heroId);
  if (!hs) return 1;
  return isProtagonist(heroId) ? levelFromXp(hs.xp || 0) : (hs.level || 1);
}

/** Allies cannot pass the protagonist. */
export function allyLevelCap() {
  return Math.min(MAX_LEVEL, levelOf(PROTAGONIST_ID) + ALLY_LEVEL_CAP_OFFSET);
}

/** Everything the ally training panel needs. */
export function trainInfo(heroId) {
  const hs = heroSave(heroId);
  if (!hs || isProtagonist(heroId)) return null;
  const level = levelOf(heroId);
  const cap = allyLevelCap();
  const atCap = level >= cap;
  const atMax = level >= MAX_LEVEL;
  const zeniCost = allyTrainZeni(level);
  const senzuCost = allyTrainSenzu(level);
  return {
    level, cap, atCap, atMax,
    zeniCost, senzuCost,
    haveZeni: inventory.zeni(), haveSenzu: inventory.senzu(),
    canTrain: !atCap && !atMax
      && inventory.zeni() >= zeniCost && inventory.senzu() >= senzuCost,
  };
}

/** Spend zeni and beans to raise an ally one level. */
export function trainAlly(heroId) {
  const info = trainInfo(heroId);
  if (!info || !info.canTrain) return false;
  // Take the scarce resource first: if beans are short nothing is spent.
  if (!inventory.spendSenzu(info.senzuCost)) return false;
  if (!inventory.spendZeni(info.zeniCost)) {
    inventory.addSenzu(info.senzuCost);   // put the beans back
    return false;
  }
  heroSave(heroId).level = levelOf(heroId) + 1;
  persist();
  return true;
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
  const { flat, pct } = bonusesFor(equipped, getState().gear);

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

/** Allies only, for the collection grid — the protagonist gets his own panel. */
export function allyEntries() {
  return rosterEntries().filter((e) => !isProtagonist(e.id));
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
