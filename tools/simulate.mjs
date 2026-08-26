/**
 * tools/simulate.mjs — Headless balance harness.
 *
 * Runs every campaign stage against the starting team (and against a
 * fully-promoted team) so balance can be sanity-checked without opening a
 * browser.  Usage:  node tools/simulate.mjs [runsPerStage]
 *
 * This is a dev tool, not part of the game bundle.
 */

import { STAGES } from '../src/progression/stages.js';
import { buildEnemyTeam } from '../src/progression/index.js';
import { createBattle } from '../src/battle/engine.js';
import { simulate } from '../src/battle/index.js';
import { getState } from '../src/save/index.js';
import { getHeroDef, statsFor, skillsFor, powerOf } from '../src/hero/index.js';

const RUNS = Number(process.argv[2] || 40);

function playerUnits(team) {
  return team.map((slot, i) => {
    const def = getHeroDef(slot.heroId);
    const skills = skillsFor(slot.heroId);
    return {
      uid: `p${i}`, heroId: def.id, name: def.name, rarity: def.rarity,
      row: slot.row, art: def.art, star: getState().heroes[def.id].star,
      stats: statsFor(slot.heroId),
      skills: Object.fromEntries(
        Object.entries(skills).filter(([, s]) => s).map(([k, s]) => [k, s.id])
      ),
    };
  });
}

function run(label, team) {
  const power = team.reduce((s, t) => s + powerOf(t.heroId), 0);
  console.log(`\n=== ${label} — team power ${power} ===`);
  console.log('stage                       gate   wins   avg s  avg survivors');
  for (const stage of STAGES) {
    let wins = 0, seconds = 0, survivors = 0;
    for (let i = 0; i < RUNS; i++) {
      const battle = createBattle({
        stageId: stage.id,
        playerUnits: playerUnits(team),
        enemyUnits: buildEnemyTeam(stage.id),
      });
      const res = simulate(battle);
      if (res.result === 'victory') { wins++; survivors += res.survivors; }
      seconds += res.seconds;
    }
    const name = `${stage.id}. ${stage.name}`.padEnd(26);
    console.log(
      `${name} ${String(stage.requiredPower).padStart(5)}  ` +
      `${String(Math.round((wins / RUNS) * 100) + '%').padStart(4)}  ` +
      `${(seconds / RUNS).toFixed(1).padStart(6)}  ` +
      `${wins ? (survivors / wins).toFixed(2) : '—'}`
    );
  }
}

const st = getState();

// Starting account: Goku 2★, Krillin 2★, Yamcha 1★
run('STARTING ACCOUNT', st.team);

// Early-mid: starters promoted a rung, Tien unlocked
for (const id of Object.keys(st.heroes)) {
  st.heroes[id].owned = true;
  st.heroes[id].star = 2;
  st.heroes[id].level = 8;
}
run('EARLY-MID (2★ Lv8)', [
  { heroId: 'goku', row: 'front' },
  { heroId: 'tien', row: 'front' },
  { heroId: 'krillin', row: 'back' },
]);

// Mid-game: everything owned, 3★, level 15
for (const id of Object.keys(st.heroes)) {
  st.heroes[id].owned = true;
  st.heroes[id].star = 3;
  st.heroes[id].level = 15;
}
run('MID (all 3★ Lv15)', [
  { heroId: 'goku', row: 'front' },
  { heroId: 'piccolo', row: 'front' },
  { heroId: 'gohan', row: 'back' },
]);

// Late: 5★, level 30
for (const id of Object.keys(st.heroes)) {
  st.heroes[id].star = 5;
  st.heroes[id].level = 30;
}
run('LATE (all 5★ Lv30)', [
  { heroId: 'goku', row: 'front' },
  { heroId: 'piccolo', row: 'front' },
  { heroId: 'gohan', row: 'back' },
]);
