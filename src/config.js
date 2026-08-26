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

/**
 * FIGHT LENGTH — the one knob for pacing. Multiplies the HP of everyone on the
 * field, heroes and enemies alike, so raising it stretches every fight without
 * touching who beats whom: both sides gain the same survivability.
 *
 * It is not perfectly neutral, and the direction is worth knowing. Auto-attacks
 * scale with the clock, but techniques run on fixed cooldowns and ultimates on
 * a charge meter — so a longer fight means more casts, and it quietly favours
 * whoever has the better kit. That is usually the boss. Re-run
 * tools/simulate.mjs after changing this.
 */
export const HP_SCALE = 2.0;

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

  /**
   * Front-line units close the distance before they can swing. Nobody on
   * either side acts until they have arrived, so the simulation and the
   * on-screen run stay in step.
   * PLACEHOLDER: pure feel — longer reads as a heavier charge, shorter as a
   * scrappier brawl.
   */
  approachSeconds: 0.55,

  /**
   * Everything stops when an ultimate goes off — timers, cooldowns, the battle
   * clock, every other unit. The cast's own animation keeps playing, because
   * that runs on the wall clock rather than the simulation, so the moment is
   * held for the ultimate alone.
   * This is where the cut-in, flash and camera work will hang once they exist.
   * PLACEHOLDER: long enough to land, short enough not to stall the fight.
   */
  ultimateFreezeSeconds: 0.7,

  /**
   * After any technique or ultimate, that unit does nothing at all for this
   * long — no second skill, no auto-attack. Without it a hero whose ultimate
   * comes up on one tick can fire its technique on the very next one, 50ms
   * later, which reads on screen as both firing at once.
   * PLACEHOLDER: about a third of an attack interval.
   */
  castRecoverySeconds: 0.5,
};

/**
 * FOCUS FIRE (adjustable): when true, a unit choosing a new target prefers the
 * one its allies are already on, so a team converges instead of spreading
 * damage. This is what makes a group of enemies gang up on a single hero.
 * It cuts both ways — the player's team focuses too — and it is a real
 * difficulty lever: concentrated damage removes attackers sooner, so every
 * fight resolves faster than it did with damage spread evenly.
 */
export const FOCUS_FIRE = true;

/**
 * WHO ENGAGES (adjustable): a unit runs in to fight when it is in the front
 * row and its auto-attack is not ranged. Back-row units hold position and
 * support, which is what gives the formation choice its teeth.
 */
export function engagesInMelee(row, attackSkill) {
  return row === 'front' && (!attackSkill || attackSkill.range !== 'ranged');
}

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
