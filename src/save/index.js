/**
 * save/index.js — Persistence layer.
 *
 * Owns the single mutable player-state object. Every other system reads and
 * mutates it through their own module APIs, then calls `persist()`.
 * Swapping localStorage for a server later means reimplementing only
 * `load()` / `persist()` — the state shape is the contract.
 */

import { HEROES } from '../hero/heroes.js';
import { GEAR_SLOTS } from '../gear/gear.js';

const STORAGE_KEY = 'dbz-rpg-prototype:v1';
const SCHEMA_VERSION = 1;

/** PLACEHOLDER: starting purse. */
const STARTING_ZENI = 800;

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
      level: 1,
      equipped: emptyEquipped(),
    };
  }

  const startingTeam = Object.values(HEROES)
    .filter((h) => h.startsOwned)
    .slice(0, 3)
    .map((h) => ({ heroId: h.id, row: h.preferredRow }));

  return {
    version: SCHEMA_VERSION,
    zeni: STARTING_ZENI,
    heroes,
    shards: { ...STARTING_SHARDS },
    gear: [],
    campaign: { cleared: {}, highestCleared: 0 },
    team: startingTeam,
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
  for (const [id, saved] of Object.entries(raw.heroes || {})) {
    if (!base.heroes[id]) continue; // hero removed from the game
    merged.heroes[id] = {
      ...base.heroes[id],
      ...saved,
      equipped: { ...emptyEquipped(), ...(saved.equipped || {}) },
    };
  }
  merged.shards = { ...raw.shards };
  merged.gear = Array.isArray(raw.gear) ? raw.gear : [];
  merged.campaign = { ...base.campaign, ...(raw.campaign || {}) };
  merged.campaign.cleared = { ...(raw.campaign?.cleared || {}) };
  merged.team = Array.isArray(raw.team) ? raw.team.filter((s) => s && merged.heroes[s.heroId]) : base.team;
  merged.stats = { ...base.stats, ...(raw.stats || {}) };
  return merged;
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
