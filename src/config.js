/**
 * config.js — Global balance knobs.
 *
 * PLACEHOLDER BALANCE: essentially every number in this file is a first-pass
 * guess meant to be tuned. Nothing here is load-bearing for architecture —
 * changing a value should never require touching a system module.
 */

/** Rarity ladder. Only UNCOMMON and RARE have heroes in this pass;
 *  EPIC and SSR are reserved for the stronger heroes coming later, and are
 *  currently only used by boss enemies. */
export const RARITIES = {
  common: {
    id: 'common', name: 'Common', short: 'C',
    color: '#93a3b8', glow: 'rgba(147,163,184,0.55)',
    statMult: 0.8,        // PLACEHOLDER
    hasPassive: false,
    shardsToUnlock: 10,   // PLACEHOLDER
    order: 0,
  },
  uncommon: {
    id: 'uncommon', name: 'Uncommon', short: 'U',
    color: '#4ade80', glow: 'rgba(74,222,128,0.55)',
    statMult: 1.0,
    hasPassive: false,
    shardsToUnlock: 10,
    order: 1,
  },
  rare: {
    id: 'rare', name: 'Rare', short: 'R',
    color: '#38bdf8', glow: 'rgba(56,189,248,0.6)',
    statMult: 1.22,
    hasPassive: false,
    shardsToUnlock: 15,
    order: 2,
  },
  epic: {
    id: 'epic', name: 'Epic', short: 'E',
    color: '#c084fc', glow: 'rgba(192,132,252,0.6)',
    statMult: 1.55,
    hasPassive: true,
    shardsToUnlock: 25,
    order: 3,
  },
  ssr: {
    id: 'ssr', name: 'SSR', short: 'SSR',
    color: '#fbbf24', glow: 'rgba(251,191,36,0.65)',
    statMult: 2.0,
    hasPassive: true,
    shardsToUnlock: 40,
    order: 4,
  },
};

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'ssr'];

export function rarityOf(id) {
  return RARITIES[id] || RARITIES.common;
}

/** Max star rank. Reference UI shows 5 pips. */
export const MAX_STARS = 5;

/**
 * PLACEHOLDER: stat multiplier applied at each star rank. "Promote" raises a
 * hero's stats to the next star's fixed value, so these are absolute rungs,
 * not stacking bonuses.
 */
export const STAR_STAT_MULT = [1.0, 1.15, 1.35, 1.6, 1.9, 2.25];

/** PLACEHOLDER: shard cost to promote FROM index star TO star+1. */
export const STAR_PROMOTE_SHARDS = [6, 10, 20, 40, 80];

/**
 * PLACEHOLDER: star rank at which each skill slot unlocks.
 * Mirrors the reference screenshot's locked skill slots.
 * The passive slot ALSO requires a rarity with hasPassive === true.
 */
export const SKILL_SLOT_UNLOCK = {
  attack: 0,
  technique: 1,
  ultimate: 2,
  passive: 3,
};

/** Order the five slots are laid out in the Stars tab. */
export const SKILL_SLOTS = ['attack', 'technique', 'ultimate', 'passive', 'transform'];

/**
 * NOTE (future): 'transform' is intentionally reserved as an always-locked
 * fifth slot. The transformation / power-up form system is out of scope for
 * this pass — this reserves its place in the data model and UI so adding it
 * later does not require reshaping hero data.
 */
export const RESERVED_SLOTS = ['transform'];

export const MAX_LEVEL = 60;             // PLACEHOLDER
export const LEVEL_STAT_STEP = 0.055;    // PLACEHOLDER: +5.5% of base per level

/** PLACEHOLDER: zeni cost to go from `level` to `level + 1`. */
export function levelUpCost(level) {
  return Math.round(60 * Math.pow(1.16, level - 1));
}

/**
 * PLACEHOLDER: Power Level is a single headline number derived from final
 * stats (gear included) plus star rank. Tune freely — nothing branches on it
 * except stage power gates.
 */
export function computePower(stats, star = 0) {
  return Math.round(
    stats.atk * 2.4 +
    stats.hp * 0.22 +
    stats.def * 1.8 +
    stats.speed * 40 +
    star * 120
  );
}

/** Combat tuning. PLACEHOLDER across the board. */
export const COMBAT = {
  tickMs: 50,                  // fixed simulation step
  baseAttackInterval: 1.7,     // seconds between auto-attacks at speed 1.0
  maxBattleSeconds: 90,        // draw -> defeat if nobody wipes
  defenseConstant: 240,        // dmg * K / (K + def)
  damageVariance: 0.12,        // +/- 12% roll
  critChance: 0.1,
  critMult: 1.6,
  ultimateChargePerSecond: 5.6,   // passive charge
  ultimateChargeOnHitDealt: 4,
  ultimateChargeOnHitTaken: 3,
  ultimateChargeMax: 100,
  backRowDamageTakenMult: 1.0, // if back row ever becomes targetable early
};

/**
 * TARGETING RULE (adjustable): 'strict' means back-row units cannot be hit by
 * single-target attacks until every front-row unit on their team is down.
 * Set to 'priority' to instead make back-row units merely a last-resort
 * choice (targetable, just heavily deprioritised).
 */
export const TARGETING_MODE = 'strict';

/**
 * ULTIMATE ACTIVATION (adjustable): 'auto' fires the ultimate the instant the
 * meter fills — the simpler prototype behaviour requested. Switching this to
 * 'tap' is the hook for making ultimates player-activated later; the battle
 * portraits already render a distinct ready state and accept taps.
 */
export const ULTIMATE_MODE = 'auto';

export const TEAM_SIZE = 3;
