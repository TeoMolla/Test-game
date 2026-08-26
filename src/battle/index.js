/**
 * battle/index.js — Public interface of the battle system.
 *
 * Bridges saved player/campaign data into the headless engine so the engine
 * itself never imports the save layer.
 */

import { createBattle, effectiveStat } from './engine.js';
import { getState } from '../save/index.js';
import { getHeroDef, statsFor, skillsFor } from '../hero/index.js';
import { buildEnemyTeam } from '../progression/index.js';
import { TEAM_SIZE } from '../config.js';

export { createBattle, effectiveStat };

/** Turn the saved team ([{heroId,row}]) into engine unit descriptors. */
export function buildPlayerUnits(team = getState().team) {
  return team
    .filter((slot) => slot && slot.heroId)
    .slice(0, TEAM_SIZE)
    .map((slot, i) => {
      const def = getHeroDef(slot.heroId);
      const hs = getState().heroes[slot.heroId];
      if (!def || !hs) return null;
      const skills = skillsFor(slot.heroId);
      return {
        uid: `p${i}`,
        heroId: def.id,
        name: def.name,
        rarity: def.rarity,
        row: slot.row || def.preferredRow,
        art: def.art,
        level: hs.level,
        star: hs.star,
        stats: statsFor(slot.heroId),
        // Only unlocked slots make it into combat — a 0★ hero really does
        // fight with nothing but its auto-attack.
        skills: Object.fromEntries(
          Object.entries(skills).filter(([, s]) => !!s).map(([slotName, s]) => [slotName, s.id])
        ),
      };
    })
    .filter(Boolean);
}

export function startStageBattle(stageId) {
  return createBattle({
    stageId,
    playerUnits: buildPlayerUnits(),
    enemyUnits: buildEnemyTeam(stageId),
  });
}

/**
 * Headless run used for balance checks (see tools/simulate.js). Returns the
 * result plus how long the fight took.
 */
export function simulate(battle, { maxSeconds = 120, step = 0.05 } = {}) {
  let guard = Math.ceil(maxSeconds / step) + 10;
  while (battle.state === 'running' && guard-- > 0) battle.update(step);
  return {
    result: battle.state,
    seconds: +battle.elapsed.toFixed(1),
    // Time-stop is held outside `elapsed`, so a fight lasts this much longer
    // on the clock than the simulation says.
    frozen: +battle.frozenTotal.toFixed(1),
    wall: +(battle.elapsed + battle.frozenTotal).toFixed(1),
    survivors: battle.units.filter((u) => u.side === 'player' && u.alive).length,
    enemyHpLeft: battle.units.filter((u) => u.side === 'enemy').reduce((s, u) => s + u.hp, 0),
  };
}
