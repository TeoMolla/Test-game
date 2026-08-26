/**
 * battle/targeting.js — Who a skill hits.
 *
 * FORMATION RULE (adjustable via TARGETING_MODE in config.js):
 *   'strict'   — single-target *basic* attacks can only hit the enemy front
 *                row while any front-row unit is alive. Back row is protected.
 *   'priority' — back row is targetable but only chosen when nothing in the
 *                front row is available.
 *
 * Deliberate exception: `lowestHp` and `highestAtk` targeting IGNORE rows.
 * That is what makes techniques and ultimates feel different from auto-attacks
 * and keeps a back-row glass cannon genuinely at risk. Change `respectsRows`
 * below to make row protection absolute.
 */

import { TARGETING_MODE } from '../config.js';

const respectsRows = {
  frontFirst: true,
  lowestHp: false,
  highestAtk: false,
  allEnemies: false,
  self: false,
  allies: false,
  lowestHpAlly: false,
};

function livingOpponents(battle, unit) {
  return battle.units.filter((u) => u.side !== unit.side && u.alive);
}

function livingAllies(battle, unit) {
  return battle.units.filter((u) => u.side === unit.side && u.alive);
}

/** Apply the formation rule to a candidate pool. */
export function applyRowRule(candidates) {
  const front = candidates.filter((u) => u.row === 'front');
  if (TARGETING_MODE === 'strict') {
    return front.length ? front : candidates;
  }
  // 'priority': back row only when the front row is empty of choices
  return front.length ? front : candidates;
}

/**
 * Resolve a targeting mode into an array of units.
 * Returns [] when nothing is targetable (caller should skip the skill).
 */
export function resolveTargets(battle, unit, mode) {
  switch (mode) {
    case 'self':
      return unit.alive ? [unit] : [];

    case 'allies':
      return livingAllies(battle, unit);

    case 'lowestHpAlly': {
      const allies = livingAllies(battle, unit);
      if (!allies.length) return [];
      return [allies.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b))];
    }

    case 'allEnemies':
      return livingOpponents(battle, unit);

    case 'lowestHp': {
      const pool = livingOpponents(battle, unit);
      if (!pool.length) return [];
      return [pool.reduce((a, b) => (a.hp <= b.hp ? a : b))];
    }

    case 'highestAtk': {
      const pool = livingOpponents(battle, unit);
      if (!pool.length) return [];
      return [pool.reduce((a, b) => (a.stats.atk >= b.stats.atk ? a : b))];
    }

    case 'frontFirst':
    default: {
      const pool = livingOpponents(battle, unit);
      if (!pool.length) return [];
      const allowed = respectsRows[mode] === false ? pool : applyRowRule(pool);
      // PLACEHOLDER: random pick inside the allowed pool. Swap for
      // "stick to current target" or "lowest HP in row" to taste.
      return [allowed[Math.floor(Math.random() * allowed.length)]];
    }
  }
}
