/**
 * tools/economy.mjs — Do the two progression tracks actually mesh?
 *
 * The protagonist levels on battle XP; allies are trained with senzu beans and
 * zeni, capped near his level. Those are different curves fed by the same
 * stages, and it is easy to end up with one of them idle — beans piling up
 * against a cap, or zeni that nothing spends. This prints the shape of both so
 * that is visible rather than assumed.
 *
 *   node tools/economy.mjs
 */

import { STAGES } from '../src/progression/stages.js';
import {
  xpToReach, slotTrainZeni, slotTrainSenzu, COMPANION_LEVEL_CAP_OFFSET, levelFromXp,
} from '../src/config.js';

const money = (n) => Math.round(n).toLocaleString('en-US');

console.log('PER STAGE');
console.log('stage                        xp   senzu     zeni    | first clear');
let firstXp = 0, firstSenzu = 0, firstZeni = 0;
for (const s of STAGES) {
  const r = s.rewards, f = s.firstClear || {};
  firstXp += (r.xp || 0) * 2;
  firstSenzu += (r.senzu || 0) + (f.senzu || 0);
  firstZeni += (r.zeni || 0) + (f.zeni || 0);
  console.log(
    `${(s.id + '. ' + s.name).padEnd(26)} ${String(r.xp || 0).padStart(5)}  ${String(r.senzu || 0).padStart(5)}  ${money(r.zeni || 0).padStart(7)}` +
    `    | +${f.senzu || 0} senzu, +${money(f.zeni || 0)} zeni`);
}
console.log(`\nA full first playthrough: ${money(firstXp)} XP, ${firstSenzu} senzu, ${money(firstZeni)} zeni`);
console.log(`  -> that puts the hero at Lv.${levelFromXp(firstXp)}, so the companion cap is Lv.${levelFromXp(firstXp) + COMPANION_LEVEL_CAP_OFFSET}`);

const best = STAGES[STAGES.length - 1];
console.log(`\nFARMING ${best.name}: ${best.rewards.xp} xp · ${best.rewards.senzu} senzu · ${money(best.rewards.zeni)} zeni per run`);

console.log('\nCOST TO GET THERE');
console.log('target   hero: XP needed   runs  |  one ally: senzu    zeni   runs(senzu)');
for (const level of [5, 10, 15, 20, 25, 30]) {
  const xp = xpToReach(level);
  const heroRuns = Math.ceil((xp - firstXp) / best.rewards.xp);
  let senzu = 0, zeni = 0;
  for (let l = 1; l < level; l++) { senzu += slotTrainSenzu(l); zeni += slotTrainZeni(l); }
  const allyRuns = Math.ceil((senzu - firstSenzu) / best.rewards.senzu);
  console.log(
    `Lv.${String(level).padEnd(4)} ${money(xp).padStart(14)} ${String(Math.max(0, heroRuns)).padStart(6)}  |` +
    `${String(senzu).padStart(11)} ${money(zeni).padStart(7)} ${String(Math.max(0, allyRuns)).padStart(8)}`);
}

console.log('\nWHAT BINDS, AS THE HERO CLIMBS (two allies trained in step)');
console.log('hero Lv   companion cap   senzu banked   senzu to cap x2   binding');
let banked = firstSenzu, runs = 0;
for (let heroLevel = levelFromXp(firstXp); heroLevel <= 24; heroLevel += 3) {
  const need = Math.max(0, xpToReach(heroLevel) - firstXp);
  runs = Math.ceil(need / best.rewards.xp);
  banked = firstSenzu + runs * best.rewards.senzu;
  const cap = heroLevel + COMPANION_LEVEL_CAP_OFFSET;
  let cost = 0;
  for (let l = 1; l < cap; l++) cost += slotTrainSenzu(l);
  cost *= 2;
  console.log(
    `${String(heroLevel).padStart(7)} ${String(cap).padStart(10)} ${String(banked).padStart(14)} ` +
    `${String(cost).padStart(17)}   ${banked >= cost ? 'the cap' : 'senzu'}`);
}
