/**
 * hero/heroes.js — Hero definitions (data only).
 *
 * This pass ships 3 Rare and 3 Uncommon heroes from the Saiyan Saga.
 * Epic and SSR are deliberately unused by player heroes — those tiers are
 * reserved for the much stronger heroes arriving later. (Boss enemies in
 * progression/stages.js do use them, which is what exercises the Epic+
 * passive rule.)
 *
 * Adding a hero = adding an entry here. No system module needs to change.
 *
 * `art` drives the CSS-drawn placeholder avatar in ui/avatar.js — clearly
 * temporary stand-ins for real art.
 * `baseStats` are the 0-star, level-1 values before rarity multiplier.
 * PLACEHOLDER: all stat values below are unbalanced first-pass numbers.
 */

export const HEROES = {
  goku: {
    id: 'goku',
    name: 'Goku',
    title: 'Raised on Earth',
    // The protagonist. This one flag is what separates him from the allies:
    // he is never benched, gear is his alone, and the deep progression tracks
    // (skill ranks, transformations) hang off him. Exactly one hero may carry
    // it — see PROTAGONIST_ID below.
    protagonist: true,
    rarity: 'rare',
    role: 'Bruiser',
    preferredRow: 'front',
    baseStats: { atk: 58, hp: 640, def: 34, speed: 1.12 },
    loadout: {
      attack: 'goku_attack',
      technique: 'goku_technique',
      ultimate: 'goku_ultimate',
    },
    art: { skin: '#f2c9a0', hair: '#1b1b23', hairStyle: 'spiky', gi: '#f97316', trim: '#1d4ed8', aura: '#fb923c' },
    startsOwned: true,
    startStar: 2,
    lore: 'A Saiyan raised as a human, and Earth’s first line of defence.',
  },
  piccolo: {
    id: 'piccolo',
    name: 'Piccolo',
    title: 'The Demon King’s Heir',
    rarity: 'rare',
    role: 'Tank',
    preferredRow: 'front',
    baseStats: { atk: 50, hp: 760, def: 44, speed: 0.95 },
    loadout: {
      attack: 'piccolo_attack',
      technique: 'piccolo_technique',
      ultimate: 'piccolo_ultimate',
    },
    art: { skin: '#4ade80', hair: '#f8fafc', hairStyle: 'turban', gi: '#a855f7', trim: '#e2e8f0', aura: '#a3e635' },
    startsOwned: false,
    startStar: 1,
    lore: 'A reluctant ally whose piercing beam can end a fight outright.',
  },
  gohan: {
    id: 'gohan',
    name: 'Gohan',
    title: 'Hidden Potential',
    rarity: 'rare',
    role: 'Burst',
    preferredRow: 'back',
    baseStats: { atk: 62, hp: 470, def: 26, speed: 1.0 },
    loadout: {
      attack: 'gohan_attack',
      technique: 'gohan_technique',
      ultimate: 'gohan_ultimate',
    },
    art: { skin: '#f2c9a0', hair: '#1b1b23', hairStyle: 'bowl', gi: '#f8fafc', trim: '#dc2626', aura: '#facc15' },
    startsOwned: false,
    startStar: 1,
    lore: 'A frightened child with a power level nobody can explain.',
  },
  krillin: {
    id: 'krillin',
    name: 'Krillin',
    title: 'Strongest Human',
    rarity: 'uncommon',
    role: 'Support',
    preferredRow: 'back',
    baseStats: { atk: 46, hp: 480, def: 24, speed: 1.15 },
    loadout: {
      attack: 'krillin_attack',
      technique: 'krillin_technique',
      ultimate: 'krillin_ultimate',
    },
    art: { skin: '#f2c9a0', hair: 'none', hairStyle: 'bald', gi: '#f97316', trim: '#1d4ed8', aura: '#38bdf8' },
    startsOwned: true,
    startStar: 2,
    lore: 'No hair, no ki to spare, and the sharpest technique on the field.',
  },
  yamcha: {
    id: 'yamcha',
    name: 'Yamcha',
    title: 'Desert Bandit',
    rarity: 'uncommon',
    role: 'Fighter',
    preferredRow: 'front',
    baseStats: { atk: 44, hp: 520, def: 28, speed: 1.2 },
    loadout: {
      attack: 'yamcha_attack',
      technique: 'yamcha_technique',
      ultimate: 'yamcha_ultimate',
    },
    art: { skin: '#f2c9a0', hair: '#2a1d16', hairStyle: 'long', gi: '#fb923c', trim: '#166534', aura: '#f472b6' },
    startsOwned: true,
    startStar: 1,
    lore: 'Fast hands, bad luck. Do not leave him next to a Saibaman.',
  },
  tien: {
    id: 'tien',
    name: 'Tien',
    title: 'Three-Eyed Master',
    rarity: 'uncommon',
    role: 'Bruiser',
    preferredRow: 'front',
    baseStats: { atk: 52, hp: 545, def: 30, speed: 1.0 },
    loadout: {
      attack: 'tien_attack',
      technique: 'tien_technique',
      ultimate: 'tien_ultimate',
    },
    art: { skin: '#f6d6ae', hair: 'none', hairStyle: 'thirdEye', gi: '#22c55e', trim: '#facc15', aura: '#4ade80' },
    startsOwned: false,
    startStar: 1,
    lore: 'Will trade his own life force for one more shot at the enemy.',
  },
};

export const HERO_IDS = Object.keys(HEROES);

/** Derived rather than hard-coded, so the flag above is the single source. */
export const PROTAGONIST_ID = (() => {
  const found = Object.values(HEROES).filter((h) => h.protagonist);
  if (found.length !== 1) {
    throw new Error(`expected exactly one protagonist, found ${found.length}`);
  }
  return found[0].id;
})();

export function isProtagonist(heroId) {
  return heroId === PROTAGONIST_ID;
}

/** Everyone who is not the protagonist: the allies you bring along.  */
export const ALLY_IDS = HERO_IDS.filter((id) => id !== PROTAGONIST_ID);

export function getHeroDef(id) {
  return HEROES[id] || null;
}
