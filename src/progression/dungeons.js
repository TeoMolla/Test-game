/**
 * progression/dungeons.js — Gear dungeons (data only).
 *
 * Dungeons sit beside the story, not inside it. The campaign is where the arc
 * advances and where XP, senzu and shards come from; a dungeon is a repeatable
 * boss fight whose only real payout is GEAR. Keeping the two payout tables
 * disjoint is deliberate — it means a dungeon can be farmed freely without
 * quietly inflating the companion economy that tools/economy.mjs models.
 *
 * Shape
 *   id           save key prefix; a clear is stored as `${id}:${tier}`
 *   saga         grouping label in the UI ("Z Dungeon" holds the Z arcs)
 *   available    false renders the card greyed out as a signpost only
 *   tiers        one entry per difficulty, keyed by DUNGEON_TIERS
 *
 * Tier shape
 *   boss           who the tier is *about* — drives the card art and billing
 *   requiredPower  recommended, warned about, never enforced
 *   enemies        same descriptor the campaign uses
 *   zeni           flat payout
 *   drops          { rolls, weights, level } — see gear/index.js rollGearTable()
 *
 * The two axes move at very different speeds on purpose. RARITY climbs slowly
 * — the whole Saiyan Saga runs common, common, uncommon, uncommon — while
 * LEVEL climbs every tier. That makes level the thing you are actually farming
 * for and leaves rarity as a rare, chunky milestone, which is why a tier can
 * be worth running even when the one below it drops the same rarity.
 *
 * PLACEHOLDER: every number here is a first-pass guess. Run limits (keys,
 * daily attempts, an energy currency) are the obvious next layer and are
 * deliberately absent — right now a dungeon can be run as often as you like.
 */

/** Ordered easiest to hardest. Extreme is the bonus tier. */
export const DUNGEON_TIERS = ['easy', 'normal', 'hard', 'extreme'];

export const TIER_META = {
  easy: {
    id: 'easy', name: 'Easy', short: 'I',
    color: '#4ade80', glow: 'rgba(74,222,128,0.5)',
  },
  normal: {
    id: 'normal', name: 'Normal', short: 'II',
    color: '#38bdf8', glow: 'rgba(56,189,248,0.5)',
  },
  hard: {
    id: 'hard', name: 'Hard', short: 'III',
    color: '#c084fc', glow: 'rgba(192,132,252,0.5)',
  },
  extreme: {
    id: 'extreme', name: 'Extreme', short: 'EX',
    color: '#fb7185', glow: 'rgba(251,113,133,0.55)',
    bonus: true,
  },
};

export const DUNGEONS = [
  {
    id: 'z_saiyan',
    saga: 'Z Dungeon',
    name: 'Saiyan Saga',
    subtitle: 'The invaders, fought on your terms.',
    available: true,
    tiers: {
      easy: {
        boss: 'raditz',
        title: 'Raditz',
        note: 'Alone, and not expecting a fight.',
        requiredPower: 1350,
        enemies: [{ defId: 'raditz', row: 'front', scale: 0.9 }],
        zeni: 140,
        drops: { rolls: 2, weights: { common: 100 }, level: [5, 10] },
      },
      normal: {
        boss: 'nappa',
        title: 'Nappa',
        note: 'He brought help and still barely cares.',
        requiredPower: 3150,
        enemies: [
          { defId: 'nappa', row: 'front', scale: 0.95 },
          { defId: 'saibaman_elite', row: 'back', scale: 1.0 },
        ],
        zeni: 260,
        drops: { rolls: 2, weights: { common: 100 }, level: [10, 18] },
      },
      hard: {
        boss: 'vegeta',
        title: 'Vegeta',
        note: 'The prince, with nothing held back.',
        requiredPower: 4700,
        enemies: [{ defId: 'vegeta', row: 'front', scale: 1.0 }],
        zeni: 420,
        drops: { rolls: 2, weights: { uncommon: 100 }, level: [18, 28] },
      },
      extreme: {
        boss: 'vegeta',
        title: 'Raditz · Nappa · Vegeta',
        note: 'Every Saiyan who ever landed, on the field together.',
        requiredPower: 6800,
        enemies: [
          { defId: 'vegeta', row: 'front', scale: 1.0 },
          { defId: 'nappa', row: 'front', scale: 1.0 },
          { defId: 'raditz', row: 'back', scale: 1.0 },
        ],
        zeni: 700,
        // PLACEHOLDER: rare is a bonus here rather than the expected drop —
        // the Namek saga is where rare should become routine, and epic lands
        // in whatever tops the ladder after that.
        drops: { rolls: 3, weights: { uncommon: 88, rare: 12 }, level: [28, 40] },
      },
    },
  },
  {
    id: 'z_namek',
    saga: 'Z Dungeon',
    name: 'Namek Saga',
    subtitle: 'Frieza’s forces. Not yet open.',
    available: false,
    lockNote: 'Opens with the Namek arc.',
    tiers: {},
  },
];

export function getDungeon(id) {
  return DUNGEONS.find((d) => d.id === id) || null;
}

export function getDungeonTier(id, tier) {
  return getDungeon(id)?.tiers?.[tier] || null;
}

/** Save key for one cleared difficulty. */
export function dungeonKey(id, tier) {
  return `${id}:${tier}`;
}
