/**
 * save/index.js — Persistence layer.
 *
 * Owns the single mutable player-state object. Every other system reads and
 * mutates it through their own module APIs, then calls `persist()`.
 * Swapping localStorage for a server later means reimplementing only
 * `load()` / `persist()` — the state shape is the contract.
 */

import { HEROES, PROTAGONIST_ID, isProtagonist } from '../hero/heroes.js';
import { GEAR_SLOTS } from '../gear/gear.js';
import { TEAM_SIZE, COMPANION_SLOTS, xpToReach, levelFromXp } from '../config.js';

// The key is deliberately NOT versioned: bumping it would orphan every save on
// every device. SCHEMA_VERSION plus migrate() handle format changes in place.
const STORAGE_KEY = 'dbz-rpg-prototype:v1';
const SCHEMA_VERSION = 9;

/** PLACEHOLDER: starting purse. */
const STARTING_ZENI = 800;

/** PLACEHOLDER: enough to train one ally a couple of levels and see how it works. */
const STARTING_SENZU = 3;

/** PLACEHOLDER: shards the player begins with, to show unlock progress. */
const STARTING_SHARDS = { piccolo: 4, gohan: 2, tien: 6 };

const listeners = new Set();

function emptyEquipped() {
  const e = {};
  for (const s of GEAR_SLOTS) e[s] = null;
  return e;
}

export function defaultState() {
  const heroes = {};
  for (const def of Object.values(HEROES)) {
    heroes[def.id] = {
      owned: !!def.startsOwned,
      star: def.startsOwned ? (def.startStar ?? 1) : 0,
      // Only the protagonist carries progression of his own: lifetime XP,
      // from which his level is derived. Companions have no per-hero level —
      // theirs comes from the slots below.
      xp: 0,
      equipped: emptyEquipped(),
    };
  }

  // The protagonist always leads; allies fill the remaining slots.
  const startingTeam = [HEROES[PROTAGONIST_ID], ...Object.values(HEROES)
    .filter((h) => h.startsOwned && !isProtagonist(h.id))]
    .slice(0, TEAM_SIZE)
    .map((h) => ({ heroId: h.id, row: h.preferredRow }));

  return {
    version: SCHEMA_VERSION,
    zeni: STARTING_ZENI,
    senzu: STARTING_SENZU,
    iron: 0,
    heroes,
    shards: { ...STARTING_SHARDS },
    gear: [],
    // One level per gear slot, bought with iron. Independent of each other and
    // of whatever item is in the slot.
    gearSlotLevels: Object.fromEntries(GEAR_SLOTS.map((s) => [s, 0])),
    campaign: { cleared: {}, highestCleared: 0 },
    // Dungeon clears, keyed `${dungeonId}:${tier}` — see progression/dungeons.js.
    dungeons: { cleared: {} },
    team: startingTeam,
    // One level per companion slot. Every companion fights at the lowest.
    companionSlots: Array.from({ length: COMPANION_SLOTS }, () => ({ level: 1 })),
    stats: { battlesWon: 0, battlesLost: 0 },
  };
}

/**
 * Merge a loaded save over a fresh default so heroes/gear/fields added after
 * the save was written appear with sane values instead of undefined.
 */
function migrate(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;

  const merged = { ...base, ...raw, version: SCHEMA_VERSION };
  merged.heroes = { ...base.heroes };
  let bestAllyLevel = 1;
  for (const [id, saved] of Object.entries(raw.heroes || {})) {
    if (!base.heroes[id]) continue; // hero removed from the game
    merged.heroes[id] = {
      ...base.heroes[id],
      ...saved,
      equipped: { ...emptyEquipped(), ...(saved.equipped || {}) },
    };
    // v2 -> v3 levels became XP; v3 -> v4 allies went back to a stored level.
    // v5 drops per-companion levels entirely — the slots carry it now — so a
    // companion's old level is folded into the starting slot level instead of
    // being thrown away.
    const hero = merged.heroes[id];
    const storedXp = Math.max(saved.xp ?? 0, xpToReach(saved.level ?? 1));
    if (isProtagonist(id)) {
      hero.xp = storedXp;
    } else {
      hero.xp = 0;
      bestAllyLevel = Math.max(bestAllyLevel, saved.level ?? levelFromXp(storedXp));
    }
    delete hero.level;
  }
  merged.senzu = Number.isFinite(raw.senzu) ? raw.senzu : base.senzu;
  // v8 adds iron and per-slot levels. An older save simply has neither.
  merged.iron = Number.isFinite(raw.iron) ? raw.iron : 0;
  merged.gearSlotLevels = Object.fromEntries(
    GEAR_SLOTS.map((s) => [s, Math.max(0, Math.round(raw.gearSlotLevels?.[s] ?? 0))])
  );
  merged.shards = { ...raw.shards };
  // v7 gives every gear instance a level. Anything from an older save was
  // earned before levels existed, so it starts at 1 rather than being guessed
  // at from where it might have dropped.
  // v9 adds a lock flag. Anything from an older save starts unlocked.
  merged.gear = (Array.isArray(raw.gear) ? raw.gear : []).map((g) => ({
    ...g,
    level: Math.max(1, Math.round(g.level ?? 1)),
    locked: !!g.locked,
  }));
  merged.campaign = { ...base.campaign, ...(raw.campaign || {}) };
  merged.campaign.cleared = { ...(raw.campaign?.cleared || {}) };
  // v6 adds dungeons. An older save simply has none cleared.
  merged.dungeons = { cleared: { ...(raw.dungeons?.cleared || {}) } };
  merged.team = Array.isArray(raw.team) ? raw.team.filter((s) => s && merged.heroes[s.heroId]) : base.team;
  merged.stats = { ...base.stats, ...(raw.stats || {}) };

  // v1 -> v2: gear used to belong to every hero. Anything an ally was wearing
  // goes back in the bag rather than quietly disappearing, and the protagonist
  // is put back at the head of the team if an old save had him benched.
  for (const [id, hero] of Object.entries(merged.heroes)) {
    if (isProtagonist(id)) continue;
    for (const slot of GEAR_SLOTS) {
      const uid = hero.equipped[slot];
      if (!uid) continue;
      const inst = merged.gear.find((g) => g.uid === uid);
      if (inst) inst.equippedBy = null;
      hero.equipped[slot] = null;
    }
  }
  merged.team = enforceProtagonist(merged.team, merged.heroes);

  merged.companionSlots = Array.from({ length: COMPANION_SLOTS }, (_, i) => ({
    level: Math.max(1, raw.companionSlots?.[i]?.level ?? bestAllyLevel),
  }));
  return merged;
}

/**
 * The protagonist is never absent and never anywhere but the first slot. Called
 * on load and after any team edit, so no path can produce a team without him.
 */
export function enforceProtagonist(team, heroes = getState().heroes) {
  const rest = (team || []).filter((s) => s && s.heroId !== PROTAGONIST_ID && heroes[s.heroId]);
  const lead = (team || []).find((s) => s && s.heroId === PROTAGONIST_ID)
    || { heroId: PROTAGONIST_ID, row: HEROES[PROTAGONIST_ID].preferredRow };
  return [lead, ...rest].slice(0, TEAM_SIZE);
}

let state = defaultState();

export function getState() {
  return state;
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = migrate(raw ? JSON.parse(raw) : null);
  } catch (err) {
    // Private-browsing Safari can throw on read; fall back to a fresh run.
    console.warn('[save] load failed, starting fresh', err);
    state = defaultState();
  }
  return state;
}

let pending = null;

/** Debounced write — battles mutate state often. */
export function persist() {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('[save] persist failed (quota or private mode)', err);
    }
    emit();
  }, 60);
}

/** Write immediately — used before navigating away. */
export function persistNow() {
  if (pending) { clearTimeout(pending); pending = null; }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[save] persist failed', err);
  }
  emit();
}

export function resetSave() {
  state = defaultState();
  persistNow();
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) {
    try { fn(state); } catch (err) { console.error('[save] listener error', err); }
  }
}
