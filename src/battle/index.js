/**
 * battle/index.js — Public interface of the battle system.
 *
 * Bridges saved player/campaign data into the headless engine so the engine
 * itself never imports the save layer.
 */

import { createBattle, effectiveStat } from './engine.js';
import { getState } from '../save/index.js';
import { getHeroDef, statsFor, skillsFor, levelOf } from '../hero/index.js';
import { buildEnemyTeam, buildEncounterEnemies, encounterInfo } from '../progression/index.js';
import { TEAM_SIZE, AUTO_BATTLE_ON_CLEARED } from '../config.js';

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
        level: levelOf(slot.heroId),
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
 * Start a fight from an encounter reference (a story stage or a dungeon tier).
 * The engine is told nothing about where the enemies came from — it only ever
 * sees two lists of units.
 *
 * Auto-battle starts ON for anything already cleared: a farming run should be
 * hands-free, and a fight you have never won should have your attention. The
 * player can flip it either way once the fight starts.
 */
export function startEncounterBattle(ref) {
  const info = encounterInfo(ref);
  return createBattle({
    stageId: ref?.stageId ?? null,
    playerUnits: buildPlayerUnits(),
    enemyUnits: buildEncounterEnemies(ref),
    auto: AUTO_BATTLE_ON_CLEARED && !!info?.cleared,
  });
}

/**
 * Headless run used for balance checks (see tools/simulate.mjs). Plays the
 * whole fight with the AI on both sides — which is exactly what auto-battle
 * does, so these numbers describe a real farming run rather than a model of
 * one. A player choosing their own turns should do better than this baseline.
 */
export function simulate(battle, { maxTurns = 200 } = {}) {
  let guard = maxTurns + 20;
  while (battle.state === 'running' && guard-- > 0) {
    battle.advance();
    if (battle.pending) battle.takeAiTurn();
  }
  return {
    result: battle.state,
    turns: battle.turn,
    survivors: battle.units.filter((u) => u.side === 'player' && u.alive).length,
    enemyHpLeft: battle.units.filter((u) => u.side === 'enemy').reduce((s, u) => s + u.hp, 0),
    // Kept so callers that print a duration still work; a turn is about a
    // second and a half of wall time once animations are in.
    seconds: +(battle.turn * 1.5).toFixed(1),
  };
}
