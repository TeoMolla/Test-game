/**
 * gear/gear.js — Equipment definitions (data only).
 *
 * Four slots per hero: weapon, chest, gloves, boots — matching the reference
 * hero-detail screen. Gear is drop-only for this prototype (no crafting or
 * shop). Pool is deliberately tiny; adding items is a data-only change.
 *
 * PLACEHOLDER: all bonuses and the rarity spread are untuned.
 *
 * These carry real weight now. Since levels were slowed down so that level is
 * no longer the only thing driving power, gear has to be one of the tracks
 * taking up the slack — a full set should read as a genuine step up, not a
 * rounding error next to a couple of levels.
 */

export const GEAR_SLOTS = ['weapon', 'chest', 'gloves', 'boots'];

/**
 * GEAR LEVEL — the main axis of gear progression.
 *
 * An item drops at a level and keeps it forever; there is no upgrading. What
 * a level is worth: +8% of the item's own base stats, compounding linearly, so
 * a Lv.10 piece is 1.7x its Lv.1 self and a Lv.40 piece is 4.1x.
 *
 * Level is NOT tied to the hero's level and has no ceiling of its own. What
 * limits it is content: every drop source declares the band it rolls in, so
 * the deepest thing you have unlocked is the best gear you can hold. Adding a
 * saga raises the ceiling without touching this file.
 *
 * The multiplier applies to flat AND percentage bonuses alike. Percentages are
 * the ones to watch when tuning — they compound with every other multiplier in
 * statsFor() — so if late-game gear ever starts dwarfing the other power
 * tracks, this constant is the knob, not the drop tables.
 *
 * PLACEHOLDER: 0.08 is a first pass, checked against tools/simulate.mjs.
 */
export const GEAR_LEVEL_STEP = 0.08;

export function gearLevelMult(level = 1) {
  return 1 + (Math.max(1, level) - 1) * GEAR_LEVEL_STEP;
}

/** An item's actual bonuses at a given level. */
export function statsAtLevel(def, level = 1) {
  const mult = gearLevelMult(level);
  const scale = (obj) => Object.fromEntries(
    Object.entries(obj || {}).map(([k, v]) => [k, v * mult])
  );
  return { flat: scale(def.flat), pct: scale(def.pct) };
}

export const GEAR_SLOT_META = {
  weapon: { name: 'Weapon', icon: '⚔️' },
  chest: { name: 'Chest', icon: '🥋' },
  gloves: { name: 'Gloves', icon: '🧤' },
  boots: { name: 'Boots', icon: '👢' },
};

export const GEAR = {
  // The common tier has to cover all four slots on its own: the story drops
  // nothing else, so without a common weapon the campaign could never fill
  // that slot at all.
  bamboo_staff: {
    id: 'bamboo_staff', name: 'Bamboo Training Staff', slot: 'weapon',
    rarity: 'common', icon: '🎋',
    flat: { atk: 9 }, pct: {},
  },
  training_weights: {
    id: 'training_weights', name: 'Weighted Wristbands', slot: 'gloves',
    rarity: 'common', icon: '🧤',
    flat: { atk: 6, def: 5 }, pct: {},
  },
  turtle_gi: {
    id: 'turtle_gi', name: 'Turtle School Gi', slot: 'chest',
    rarity: 'common', icon: '🥋',
    flat: { hp: 150, def: 8 }, pct: {},
  },
  worn_boots: {
    id: 'worn_boots', name: 'Worn Training Boots', slot: 'boots',
    rarity: 'common', icon: '👢',
    flat: { def: 6 }, pct: { speed: 0.04 },
  },
  power_pole: {
    id: 'power_pole', name: 'Power Pole', slot: 'weapon',
    rarity: 'uncommon', icon: '🥢',
    flat: { atk: 18 }, pct: { atk: 0.05 },
  },
  kame_belt: {
    id: 'kame_belt', name: 'Kame Sash', slot: 'chest',
    rarity: 'uncommon', icon: '🎀',
    flat: { hp: 260, def: 14 }, pct: { hp: 0.05 },
  },
  scouter: {
    id: 'scouter', name: 'Cracked Scouter', slot: 'gloves',
    rarity: 'uncommon', icon: '🔎',
    flat: { atk: 14 }, pct: { speed: 0.06 },
  },
  saiyan_boots: {
    id: 'saiyan_boots', name: 'Saiyan Battle Boots', slot: 'boots',
    rarity: 'rare', icon: '🥾',
    flat: { def: 18, hp: 150 }, pct: { speed: 0.08 },
  },
  saiyan_armor: {
    id: 'saiyan_armor', name: 'Saiyan Battle Armor', slot: 'chest',
    rarity: 'rare', icon: '🛡️',
    flat: { hp: 520, def: 28 }, pct: { def: 0.12, hp: 0.08 },
  },
  kaio_gloves: {
    id: 'kaio_gloves', name: 'King Kai’s Gloves', slot: 'gloves',
    rarity: 'rare', icon: '🥊',
    flat: { atk: 26 }, pct: { atk: 0.08 },
  },
  z_sword_shard: {
    id: 'z_sword_shard', name: 'Splintered Blade', slot: 'weapon',
    rarity: 'rare', icon: '🗡️',
    flat: { atk: 38 }, pct: { atk: 0.12 },
  },
};

export const GEAR_IDS = Object.keys(GEAR);

export function getGearDef(id) {
  return GEAR[id] || null;
}
