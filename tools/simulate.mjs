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
import { equipGear, addGear } from '../src/inventory/index.js';
import { getHeroDef, statsFor, skillsFor, powerOf, levelOf } from '../src/hero/index.js';
import { xpToReach, computePower } from '../src/config.js';

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

/**
 * Where the protagonist's power actually comes from. Each track is measured by
 * taking it away and seeing what is lost, so the shares answer the question
 * that matters: is power a sum of several things, or a readout of one of them?
 */
function composition() {
  const id = 'goku';
  const star = getState().heroes[id].star;
  const full = powerOf(id);
  const drop = (override, s) => full - computePower(statsFor(id, override), s);
  const level = drop({ level: 1 }, star);
  const stars = drop({ star: 1 }, 1);
  const gear = drop({ equipped: {} }, star);
  const total = level + stars + gear;
  const pct = (v) => total > 0 ? `${Math.round((v / total) * 100)}%`.padStart(4) : '  0%';
  console.log(`   power ${full}  (Lv.${levelOf(id)} ${star}\u2605)  ` +
              `from level ${pct(level)} \u00b7 stars ${pct(stars)} \u00b7 gear ${pct(gear)}`);
}

function run(label, team) {
  const power = team.reduce((s, t) => s + powerOf(t.heroId), 0);
  console.log(`\n=== ${label} — team power ${power} ===`);
  composition();
  console.log('stage                       gate   wins   sim s  real s  avg survivors');
  for (const stage of STAGES) {
    let wins = 0, seconds = 0, survivors = 0, wall = 0;
    for (let i = 0; i < RUNS; i++) {
      const battle = createBattle({
        stageId: stage.id,
        playerUnits: playerUnits(team),
        enemyUnits: buildEnemyTeam(stage.id),
      });
      const res = simulate(battle);
      if (res.result === 'victory') { wins++; survivors += res.survivors; }
      seconds += res.seconds;
      wall += res.wall;
    }
    const name = `${stage.id}. ${stage.name}`.padEnd(26);
    console.log(
      `${name} ${String(stage.requiredPower).padStart(5)}  ` +
      `${String(Math.round((wins / RUNS) * 100) + '%').padStart(4)}  ` +
      `${(seconds / RUNS).toFixed(1).padStart(6)}  ` +
      `${(wall / RUNS).toFixed(1).padStart(6)}  ` +
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
  st.heroes[id].xp = xpToReach(8);
}
run('EARLY-MID (2★ Lv8)', [
  { heroId: 'goku', row: 'front' },
  { heroId: 'tien', row: 'front' },
  { heroId: 'krillin', row: 'back' },
]);

// Gear is the protagonist's and a major share of his power, so from mid-game
// on the harness has to field it — a gearless team is not a player.
function equipSet(defIds) {
  for (const defId of defIds) {
    const inst = addGear(defId);
    if (inst) equipGear('goku', inst.uid);
  }
}

// Mid-game: everything owned, 3★, level 15
for (const id of Object.keys(st.heroes)) {
  st.heroes[id].owned = true;
  st.heroes[id].star = 3;
  st.heroes[id].xp = xpToReach(15);
}
equipSet(['power_pole', 'kame_belt', 'scouter', 'worn_boots']);
run('MID (3★ Lv15, uncommon gear)', [
  { heroId: 'goku', row: 'front' },
  { heroId: 'piccolo', row: 'front' },
  { heroId: 'gohan', row: 'back' },
]);

// Late: 5★, level 30
for (const id of Object.keys(st.heroes)) {
  st.heroes[id].star = 5;
  st.heroes[id].xp = xpToReach(30);
}
// Late-mid: the shape a player is in when stage 6 first looks reachable.
for (const id of Object.keys(st.heroes)) { st.heroes[id].star = 4; st.heroes[id].xp = xpToReach(20); }
equipSet(['z_sword_shard', 'saiyan_armor', 'kaio_gloves', 'saiyan_boots']);
run('LATE-MID (4★ Lv20, rare gear)', [
  { heroId: 'goku', row: 'front' },
  { heroId: 'piccolo', row: 'front' },
  { heroId: 'gohan', row: 'back' },
]);

for (const id of Object.keys(st.heroes)) { st.heroes[id].star = 5; st.heroes[id].xp = xpToReach(30); }
run('LATE (5★ Lv30, rare gear)', [
  { heroId: 'goku', row: 'front' },
  { heroId: 'piccolo', row: 'front' },
  { heroId: 'gohan', row: 'back' },
]);
