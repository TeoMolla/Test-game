/**
 * progression/index.js — Campaign state: which stages are open, what a clear
 * pays out, and how the enemy team for a stage is built.
 */

import { STAGES, getStage } from './stages.js';
import { ENEMIES, getEnemyDef } from './enemies.js';
import { getState, persist } from '../save/index.js';
import { teamPower } from '../hero/index.js';
import { HP_SCALE } from '../config.js';
import { rollGearDrops } from '../gear/index.js';
import * as inventory from '../inventory/index.js';

export { STAGES, getStage, ENEMIES, getEnemyDef };

export function isCleared(stageId) {
  return !!getState().campaign.cleared[stageId];
}

/**
 * A stage is playable when the previous stage is cleared. Power is a *warning*
 * gate, not a hard lock — the player can attempt an over-tuned fight and lose,
 * which reads better than a greyed-out button.
 * PLACEHOLDER: flip `locked` to include power if a hard gate is preferred.
 */
export function stageList() {
  const power = teamPower();
  return STAGES.map((stage, idx) => {
    const prevCleared = idx === 0 || isCleared(STAGES[idx - 1].id);
    return {
      stage,
      cleared: isCleared(stage.id),
      locked: !prevCleared,
      underpowered: power < stage.requiredPower,
      power,
    };
  });
}

export function nextStage() {
  const list = stageList();
  return (list.find((s) => !s.cleared && !s.locked) || list[list.length - 1]).stage;
}

/** Build the concrete enemy units for a stage (pre-battle preview + combat). */
export function buildEnemyTeam(stageId) {
  const stage = getStage(stageId);
  if (!stage) return [];
  return stage.enemies.map((entry, i) => {
    const def = getEnemyDef(entry.defId);
    if (!def) return null;
    const scale = entry.scale ?? 1;
    return {
      uid: `e${i}`,
      defId: def.id,
      name: def.name,
      rarity: def.rarity,
      row: entry.row || 'front',
      art: def.art,
      skills: def.skills,
      stats: {
        atk: Math.round(def.stats.atk * scale),
        hp: Math.round(def.stats.hp * scale * HP_SCALE),
        def: Math.round(def.stats.def * scale),
        speed: def.stats.speed,
      },
    };
  }).filter(Boolean);
}

/** Rough "how hard is this" number, shown next to the team's power. */
export function stagePower(stageId) {
  return buildEnemyTeam(stageId).reduce(
    (sum, e) => sum + Math.round(e.stats.atk * 2.4 + e.stats.hp * 0.22 + e.stats.def * 1.8),
    0
  );
}

/**
 * Record a victory and pay out. First clear adds a one-time bonus.
 * Returns a summary for the results screen.
 */
export function completeStage(stageId) {
  const stage = getStage(stageId);
  if (!stage) return null;
  const first = !isCleared(stageId);

  const shards = { ...(stage.rewards.shards || {}) };
  let zeni = stage.rewards.zeni || 0;
  if (first && stage.firstClear) {
    zeni += stage.firstClear.zeni || 0;
    for (const [heroId, amount] of Object.entries(stage.firstClear.shards || {})) {
      shards[heroId] = (shards[heroId] || 0) + amount;
    }
  }

  const gear = rollGearDrops(stage.rewards.gearTable);
  const summary = inventory.grantRewards({ zeni, shards, gear });

  const st = getState();
  st.campaign.cleared[stageId] = true;
  st.campaign.highestCleared = Math.max(st.campaign.highestCleared, stageId);
  st.stats.battlesWon += 1;
  persist();

  return { ...summary, firstClear: first, stage };
}

export function recordDefeat() {
  getState().stats.battlesLost += 1;
  persist();
}
