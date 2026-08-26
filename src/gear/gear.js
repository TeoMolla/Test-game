/**
 * gear/gear.js — Equipment definitions (data only).
 *
 * Four slots per hero: weapon, chest, gloves, boots — matching the reference
 * hero-detail screen. Gear is drop-only for this prototype (no crafting or
 * shop). Pool is deliberately tiny; adding items is a data-only change.
 *
 * PLACEHOLDER: all bonuses and the rarity spread are untuned.
 */

export const GEAR_SLOTS = ['weapon', 'chest', 'gloves', 'boots'];

export const GEAR_SLOT_META = {
  weapon: { name: 'Weapon', icon: '⚔️' },
  chest: { name: 'Chest', icon: '🥋' },
  gloves: { name: 'Gloves', icon: '🧤' },
  boots: { name: 'Boots', icon: '👢' },
};

export const GEAR = {
  training_weights: {
    id: 'training_weights', name: 'Weighted Wristbands', slot: 'gloves',
    rarity: 'common', icon: '🧤',
    flat: { atk: 4, def: 3 }, pct: {},
  },
  turtle_gi: {
    id: 'turtle_gi', name: 'Turtle School Gi', slot: 'chest',
    rarity: 'common', icon: '🥋',
    flat: { hp: 90, def: 5 }, pct: {},
  },
  worn_boots: {
    id: 'worn_boots', name: 'Worn Training Boots', slot: 'boots',
    rarity: 'common', icon: '👢',
    flat: { def: 4 }, pct: { speed: 0.04 },
  },
  power_pole: {
    id: 'power_pole', name: 'Power Pole', slot: 'weapon',
    rarity: 'uncommon', icon: '🥢',
    flat: { atk: 12 }, pct: { atk: 0.05 },
  },
  kame_belt: {
    id: 'kame_belt', name: 'Kame Sash', slot: 'chest',
    rarity: 'uncommon', icon: '🎀',
    flat: { hp: 160, def: 8 }, pct: {},
  },
  scouter: {
    id: 'scouter', name: 'Cracked Scouter', slot: 'gloves',
    rarity: 'uncommon', icon: '🔎',
    flat: { atk: 9 }, pct: { speed: 0.06 },
  },
  saiyan_boots: {
    id: 'saiyan_boots', name: 'Saiyan Battle Boots', slot: 'boots',
    rarity: 'rare', icon: '🥾',
    flat: { def: 12, hp: 90 }, pct: { speed: 0.08 },
  },
  saiyan_armor: {
    id: 'saiyan_armor', name: 'Saiyan Battle Armor', slot: 'chest',
    rarity: 'rare', icon: '🛡️',
    flat: { hp: 320, def: 18 }, pct: { def: 0.1 },
  },
  kaio_gloves: {
    id: 'kaio_gloves', name: 'King Kai’s Gloves', slot: 'gloves',
    rarity: 'rare', icon: '🥊',
    flat: { atk: 18 }, pct: { atk: 0.08 },
  },
  z_sword_shard: {
    id: 'z_sword_shard', name: 'Splintered Blade', slot: 'weapon',
    rarity: 'rare', icon: '🗡️',
    flat: { atk: 26 }, pct: { atk: 0.1 },
  },
};

export const GEAR_IDS = Object.keys(GEAR);

export function getGearDef(id) {
  return GEAR[id] || null;
}
