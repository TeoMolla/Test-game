/**
 * progression/index.js — Campaign state: which stages are open, what a clear
 * pays out, and how the enemy team for a stage is built.
 */

import { STAGES, getStage } from './stages.js';
import { ENEMIES, getEnemyDef } from './enemies.js';
import {
  DUNGEONS, DUNGEON_TIERS, TIER_META, getDungeon, getDungeonTier, dungeonKey,
} from './dungeons.js';
import { getState, persist } from '../save/index.js';
import { teamPower, awardBattleXp } from '../hero/index.js';
import { HP_SCALE } from '../config.js';
import { rollGearDrops, rollGearTable } from '../gear/index.js';
import * as inventory from '../inventory/index.js';

export { STAGES, getStage, ENEMIES, getEnemyDef };
export { DUNGEONS, DUNGEON_TIERS, TIER_META, getDungeon, getDungeonTier };

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
  return buildUnits(getStage(stageId)?.enemies);
}

/** Shared by stages and dungeons — both describe enemies the same way. */
function buildUnits(entries) {
  if (!entries) return [];
  return entries.map((entry, i) => {
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
      phases: def.phases || null,
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
  return unitsPower(buildEnemyTeam(stageId));
}

function unitsPower(units) {
  return units.reduce(
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
  let senzu = stage.rewards.senzu || 0;
  if (first && stage.firstClear) {
    zeni += stage.firstClear.zeni || 0;
    senzu += stage.firstClear.senzu || 0;
    for (const [heroId, amount] of Object.entries(stage.firstClear.shards || {})) {
      shards[heroId] = (shards[heroId] || 0) + amount;
    }
  }

  const gear = rollGearDrops(stage.rewards.gearTable, stage.rewards.gearLevel);
  // A boss stage always hands over one piece, at a level above anything it
  // rolls — so clearing a boss is never a dry run and always moves the gear
  // floor up.
  if (stage.rewards.bossDrop) gear.push({ ...stage.rewards.bossDrop });
  const summary = inventory.grantRewards({ zeni, senzu, shards, gear });

  // XP is not an inventory item — it goes straight to the roster. First clears
  // pay double, which is what makes pushing forward better than farming.
  const xp = (stage.rewards.xp || 0) * (first ? 2 : 1);
  summary.xp = xp;
  summary.levels = awardBattleXp(xp).filter((r) => r.to > r.from);

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

/* ==========================================================================
   DUNGEONS

   Repeatable gear fights, kept structurally separate from the campaign: a
   dungeon has no story position, no XP, no senzu and no shards. It exists so
   the gear track has a source the player controls, rather than gear arriving
   only as a side effect of pushing the story forward.
   ========================================================================== */

export function isDungeonCleared(dungeonId, tier) {
  return !!getState().dungeons.cleared[dungeonKey(dungeonId, tier)];
}

/**
 * View model for the dungeon screen: every dungeon, each with its four
 * difficulties resolved against what the player has cleared.
 *
 * A tier opens when the one below it is cleared, and Easy is always open. As
 * on the campaign, `requiredPower` is a warning rather than a wall — the
 * difficulty ladder is the real gate.
 */
export function dungeonList() {
  const power = teamPower();
  return DUNGEONS.map((dungeon) => ({
    dungeon,
    available: dungeon.available,
    tiers: DUNGEON_TIERS.map((tier, idx) => {
      const def = dungeon.tiers[tier];
      if (!def) return null;
      const prev = DUNGEON_TIERS[idx - 1];
      return {
        tier,
        meta: TIER_META[tier],
        def,
        cleared: isDungeonCleared(dungeon.id, tier),
        locked: !!prev && !isDungeonCleared(dungeon.id, prev),
        underpowered: power < def.requiredPower,
        enemies: buildUnits(def.enemies),
      };
    }).filter(Boolean),
  }));
}

export function buildDungeonEnemies(dungeonId, tier) {
  return buildUnits(getDungeonTier(dungeonId, tier)?.enemies);
}

/**
 * Pay out a dungeon clear. Gear and zeni only — see the note at the top of
 * this block for why nothing else belongs here.
 */
export function completeDungeon(dungeonId, tier) {
  const def = getDungeonTier(dungeonId, tier);
  if (!def) return null;
  const first = !isDungeonCleared(dungeonId, tier);

  const summary = inventory.grantRewards({
    zeni: def.zeni || 0,
    gear: rollGearTable(def.drops),
  });
  summary.xp = 0;
  summary.levels = [];

  const st = getState();
  st.dungeons.cleared[dungeonKey(dungeonId, tier)] = true;
  st.stats.battlesWon += 1;
  persist();

  // Dungeons pay the same on every run — there is no first-clear bonus to
  // announce. What a first clear *does* do is open the next difficulty, so
  // that is what the results screen gets told about.
  const next = DUNGEON_TIERS[DUNGEON_TIERS.indexOf(tier) + 1];
  const unlocked = first && next && getDungeonTier(dungeonId, next)
    ? TIER_META[next].name
    : null;

  return { ...summary, firstClear: false, unlocked, dungeon: getDungeon(dungeonId), tier };
}

/* ==========================================================================
   ENCOUNTERS

   The battle and results screens do not care whether a fight came from the
   story or a dungeon — they need a name, a lineup, a recommended power and
   something to call on victory. An encounter reference is the small
   serialisable value that carries that, so those screens have exactly one
   code path and adding a third source of fights later touches neither.
   ========================================================================== */

export function stageRef(stageId) {
  return { kind: 'stage', stageId: Number(stageId) };
}

export function dungeonRef(dungeonId, tier) {
  return { kind: 'dungeon', dungeonId, tier };
}

/** Everything the pre-battle and battle screens need to draw an encounter. */
export function encounterInfo(ref) {
  if (ref?.kind === 'dungeon') {
    const dungeon = getDungeon(ref.dungeonId);
    const def = getDungeonTier(ref.dungeonId, ref.tier);
    if (!dungeon || !def) return null;
    const meta = TIER_META[ref.tier];
    return {
      kind: 'dungeon',
      title: `${dungeon.name} · ${meta.name}`,
      shortTitle: `${meta.name} — ${def.title}`,
      subtitle: def.note,
      requiredPower: def.requiredPower,
      enemies: buildUnits(def.enemies),
      accent: meta.color,
      cleared: isDungeonCleared(ref.dungeonId, ref.tier),
    };
  }

  const stage = getStage(ref?.stageId);
  if (!stage) return null;
  return {
    kind: 'stage',
    title: `${stage.id}. ${stage.name}`,
    shortTitle: stage.name,
    subtitle: stage.subtitle,
    requiredPower: stage.requiredPower,
    enemies: buildEnemyTeam(stage.id),
    accent: null,
    cleared: isCleared(stage.id),
  };
}

export function buildEncounterEnemies(ref) {
  return ref?.kind === 'dungeon'
    ? buildDungeonEnemies(ref.dungeonId, ref.tier)
    : buildEnemyTeam(ref?.stageId);
}

export function completeEncounter(ref) {
  return ref?.kind === 'dungeon'
    ? completeDungeon(ref.dungeonId, ref.tier)
    : completeStage(ref?.stageId);
}
