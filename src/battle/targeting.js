/**
 * battle/targeting.js — Who a skill hits.
 *
 * FORMATION RULE (adjustable via TARGETING_MODE in config.js):
 *   'strict'   — single-target *basic* attacks can only hit the enemy front
 *                row while any front-row unit is alive. Back row is protected.
 *   'priority' — back row is targetable but only chosen when nothing in the
 *                front row is available.
 *
 * Basic attacks also STICK: a unit keeps swinging at whoever it picked until
 * that target goes down, rather than choosing again every swing. With
 * FOCUS_FIRE on, the replacement pick prefers whoever its allies are already
 * fighting, so a team converges on one enemy instead of spreading out — which
 * is what makes a group of attackers visibly gang up on a single defender.
 *
 * Deliberate exception: `lowestHp` and `highestAtk` targeting IGNORE rows.
 * That is what makes techniques and ultimates feel different from auto-attacks
 * and keeps a back-row glass cannon genuinely at risk. Change `respectsRows`
 * below to make row protection absolute.
 */

import { TARGETING_MODE, FOCUS_FIRE } from '../config.js';

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

/**
 * Prefer whoever this unit's allies are already attacking. Ties — including
 * the opening pick, when nobody has a target yet — break randomly, so a team
 * does not deterministically pile onto the same slot every battle.
 */
function focusPick(battle, unit, allowed) {
  const votes = new Map();
  for (const ally of battle.units) {
    if (ally === unit || ally.side !== unit.side || !ally.alive || !ally.targetUid) continue;
    votes.set(ally.targetUid, (votes.get(ally.targetUid) || 0) + 1);
  }
  let best = -1;
  let tied = [];
  for (const cand of allowed) {
    const v = votes.get(cand.uid) || 0;
    if (v > best) { best = v; tied = [cand]; }
    else if (v === best) tied.push(cand);
  }
  return tied[Math.floor(Math.random() * tied.length)];
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

      // Keep the current target while it is alive and still a legal pick.
      const held = allowed.find((u) => u.uid === unit.targetUid);
      if (held) return [held];

      const pick = FOCUS_FIRE ? focusPick(battle, unit, allowed) : allowed[Math.floor(Math.random() * allowed.length)];
      unit.targetUid = pick.uid;
      return [pick];
    }
  }
}
