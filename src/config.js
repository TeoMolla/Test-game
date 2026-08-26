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
 * NOTE (future): 'transform' is the transformation slot, still locked. It
 * belongs to the protagonist alone. The agreed design, for when it is built:
 *
 *   - MANUAL activation, not automatic. The player taps to transform.
 *   - No countdown is shown. When a transformation is available the character
 *     card glows; that glow is the whole affordance.
 *   - Forms give a MODEST stat boost, not their nominal multiplier. Kaio-ken
 *     x3 is stronger than plain Kaio-ken but nowhere near three times as
 *     strong — think a step up, not a different league.
 *   - Campaign difficulty gets retuned around the forms once they exist, so
 *     they are part of the expected power curve rather than a free win.
 *
 * The Saiyan Saga ladder is Kaio-ken then Kaio-ken x3; Super Saiyan belongs to
 * the next arc and is the first form that needs new art (gold hair). Kaio-ken
 * is a red aura, which is a tint over the existing sprites.
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

/**
 * PLACEHOLDER: +3.5% of base stats per level, so level 30 is about 2.0x rather
 * than the 2.6x it used to be. Still a real step every time one lands — the
 * point of the reduction is that gear and stars get to matter too, not that
 * levelling should feel thin.
 */
export const LEVEL_STAT_STEP = 0.035;

/**
 * PLACEHOLDER: XP needed to go from `level` to `level + 1`. The exponent is
 * what makes levels earned rather than bought — each one costs meaningfully
 * more than the last, so a level late in the game is a genuine milestone.
 */
export function xpForLevel(level) {
  return Math.round(80 * Math.pow(level, 1.55));
}

/** Cumulative XP to reach each level. Index i holds the total for level i + 1. */
const XP_TABLE = (() => {
  const table = [0];
  for (let level = 1; level < MAX_LEVEL; level++) {
    table.push(table[level - 1] + xpForLevel(level));
  }
  return table;
})();

/** Total XP required to stand at `level`. */
export function xpToReach(level) {
  return XP_TABLE[Math.max(0, Math.min(MAX_LEVEL, level) - 1)];
}

/** The level a given lifetime XP total buys. */
export function levelFromXp(xp) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= XP_TABLE[level]) level++;
  return level;
}

/* ---------------- companions ----------------
 *
 * Companions do not level individually. There are COMPANION_SLOTS slots, each
 * with its own level bought with senzu beans and zeni, and every companion you
 * own — equipped or not — fights at the level of the LOWEST slot.
 *
 * That rule is the whole point: a chain is as strong as its weakest link, so
 * there is nothing to gain from pouring everything into one slot, and raising
 * the roster means raising both. It also means a companion recruited today
 * arrives already useful instead of starting again at level 1.
 */
export const COMPANION_SLOTS = 2;

/** PLACEHOLDER: zeni to raise one slot from `level` to `level + 1`. */
export function slotTrainZeni(level) {
  return Math.round(40 * Math.pow(1.18, level - 1));
}

/**
 * PLACEHOLDER: senzu beans for the same step. See tools/economy.mjs — the
 * slope has to outrun the cap, or beans go cheap and the cap silently becomes
 * the only limit. Two slots means paying this twice per effective level.
 */
export function slotTrainSenzu(level) {
  return 1 + Math.floor((level - 1) / 2);
}

/**
 * Companions never out-level the protagonist. Strict: pushing the team forward
 * always means pushing him forward first.
 */
export const COMPANION_LEVEL_CAP_OFFSET = 0;

/* ---------------- bonds ----------------
 *
 * Every companion you own lends the protagonist something, whether or not it
 * is fielded. That is what makes collecting worth doing: a companion you never
 * equip still adds to your hero, and starring it up adds more.
 *
 * amount = base x rarity x star x slot share
 */

/** Rarer companions lend more. Epic and SSR are here for companions to come. */
export const BOND_RARITY_MULT = {
  common: 0.6, uncommon: 1, rare: 1.5, epic: 2.2, ssr: 3.2,
};

/** Indexed by star rank. 0 means unowned, which lends nothing. */
export const BOND_STAR_MULT = [0, 1, 1.35, 1.8, 2.35, 3];

/** An equipped companion lends in full; the rest of the collection a quarter. */
export const BOND_EQUIPPED_SHARE = 1;
export const BOND_COLLECTED_SHARE = 0.25;

/**
 * PLACEHOLDER: Power Level is a single headline number derived from final
 * stats (gear included) plus star rank. Tune freely — nothing branches on it
 * except stage power gates.
 *
 * NOTE (pass 2): levels should be MEANINGFUL AND HARD-EARNED, not weak. The
 * problem to solve is not that a level gives too much — it is that level is
 * currently the only axis that matters. LEVEL_STAT_STEP compounds to about
 * 2.6x by level 30, so power today is essentially a readout of level.
 *
 * The fix is two-sided, and doing only half of it makes levelling feel hollow:
 *   - slow levels down, so each one is earned rather than bought;
 *   - raise what gear, skill ranks and stars contribute, so power reads as the
 *     sum of several tracks and no single one dominates.
 * A level should still land as a real step up when it arrives.
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
