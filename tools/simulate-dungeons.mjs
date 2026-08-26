/**
 * tools/simulate-dungeons.mjs — Headless balance harness for the gear dungeons.
 *
 * The question this answers is narrow: does the difficulty ladder actually
 * work as a ladder? Each tier should be clearable by a team a step stronger
 * than the one below, and Extreme should still be a wall for a team that has
 * finished the story. Usage:  node tools/simulate-dungeons.mjs [runsPerTier]
 *
 * This is a dev tool, not part of the game bundle.
 */

import { DUNGEONS, DUNGEON_TIERS, TIER_META } from '../src/progression/dungeons.js';
import { buildDungeonEnemies } from '../src/progression/index.js';
import { createBattle } from '../src/battle/engine.js';
import { simulate } from '../src/battle/index.js';
import { getState } from '../src/save/index.js';
import { equipGear, addGear } from '../src/inventory/index.js';
import { getHeroDef, statsFor, skillsFor, powerOf } from '../src/hero/index.js';
import { xpToReach } from '../src/config.js';
import { isProtagonist } from '../src/hero/heroes.js';

const RUNS = Number(process.argv[2] || 40);
const st = getState();

function setLevel(hero, level) {
  if (isProtagonist(hero)) st.heroes[hero].xp = xpToReach(level);
  for (const slot of st.companionSlots) slot.level = level;
}

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
  console.log('tier      gate   wins   sim s  real s  avg survivors');
  for (const dungeon of DUNGEONS.filter((d) => d.available)) {
    for (const tier of DUNGEON_TIERS) {
      const def = dungeon.tiers[tier];
      if (!def) continue;
      let wins = 0, seconds = 0, survivors = 0, wall = 0;
      for (let i = 0; i < RUNS; i++) {
        const battle = createBattle({
          playerUnits: playerUnits(team),
          enemyUnits: buildDungeonEnemies(dungeon.id, tier),
        });
        const res = simulate(battle, { maxSeconds: 180 });
        if (res.result === 'victory') { wins++; survivors += res.survivors; }
        seconds += res.seconds;
        wall += res.wall;
      }
      console.log(
        `${TIER_META[tier].name.padEnd(9)} ${String(def.requiredPower).padStart(5)}  ` +
        `${String(Math.round((wins / RUNS) * 100) + '%').padStart(4)}  ` +
        `${(seconds / RUNS).toFixed(1).padStart(6)}  ` +
        `${(wall / RUNS).toFixed(1).padStart(6)}  ` +
        `${wins ? (survivors / wins).toFixed(2) : '—'}`
      );
    }
  }
}

function equipSet(defIds, level = 1) {
  for (const defId of defIds) {
    const inst = addGear(defId, level);
    if (inst) equipGear('goku', inst.uid);
  }
}

// Where a player is when the Dungeons tab first has anything to offer.
for (const id of Object.keys(st.heroes)) { st.heroes[id].owned = true; st.heroes[id].star = 2; setLevel(id, 8); }
run('EARLY-MID (2★ Lv8, no gear)', [
  { heroId: 'goku', row: 'front' },
  { heroId: 'tien', row: 'front' },
  { heroId: 'krillin', row: 'back' },
]);

for (const id of Object.keys(st.heroes)) { st.heroes[id].star = 3; setLevel(id, 15); }
equipSet(['bamboo_staff', 'turtle_gi', 'training_weights', 'worn_boots'], 14);
run('MID (3★ Lv15, Lv14 common gear)', [
  { heroId: 'goku', row: 'front' },
  { heroId: 'piccolo', row: 'front' },
  { heroId: 'gohan', row: 'back' },
]);

for (const id of Object.keys(st.heroes)) { st.heroes[id].star = 4; setLevel(id, 20); }
equipSet(['power_pole', 'kame_belt', 'scouter', 'worn_boots'], 24);
run('LATE-MID (4★ Lv20, Lv24 uncommon gear)', [
  { heroId: 'goku', row: 'front' },
  { heroId: 'piccolo', row: 'front' },
  { heroId: 'gohan', row: 'back' },
]);

for (const id of Object.keys(st.heroes)) { st.heroes[id].star = 5; setLevel(id, 30); }
equipSet(['power_pole', 'kame_belt', 'scouter', 'saiyan_boots'], 36);
run('LATE (5★ Lv30, Lv36 gear)', [
  { heroId: 'goku', row: 'front' },
  { heroId: 'piccolo', row: 'front' },
  { heroId: 'gohan', row: 'back' },
]);
