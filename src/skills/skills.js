/**
 * skills/skills.js — Skill definitions (data only).
 *
 * A skill is pure data. The battle engine never special-cases a skill by id;
 * it reads `effects` and applies them. To add a skill, add an entry here and
 * reference its id from a hero's loadout in hero/heroes.js.
 *
 * Skill shape
 *   id        unique string
 *   name      display name
 *   slot      'attack' | 'technique' | 'ultimate' | 'passive'
 *   icon      short glyph used by the placeholder art layer
 *   desc      tooltip text
 *   cooldown  seconds (technique only; attacks use the unit's attack interval,
 *             ultimates use the charge meter)
 *   targeting see battle/targeting.js for the supported modes
 *   effects   array of effect descriptors applied in order
 *   trigger   passives only: 'battleStart' | 'onHitDealt' | 'onHitTaken' | 'lowHp'
 *   range     'ranged' for anything thrown, fired or beamed. Omitted means
 *             melee, which is what decides whether a front-row unit runs in to
 *             fight or holds its ground and shoots.
 *
 * Effect descriptors
 *   { kind:'damage',    mult, hits?, defIgnore? }
 *   { kind:'heal',      mult }                        // of caster ATK
 *   { kind:'selfDamage', pctMaxHp }
 *   { kind:'buff',      stat:'atk'|'def'|'speed', pct, seconds, target:'self'|'allies' }
 *   { kind:'debuff',    stat:'atk'|'def'|'speed', pct, seconds }
 *   { kind:'charge',    amount }                      // ultimate meter
 *
 * PLACEHOLDER: every multiplier, cooldown and duration below is unbalanced
 * first-pass tuning.
 */

export const SKILLS = {
  /* ---------------- Goku (Rare) ---------------- */
  goku_attack: {
    id: 'goku_attack', name: 'Rush Combo', slot: 'attack', icon: '👊',
    desc: 'A flurry of close-range strikes.',
    targeting: 'frontFirst',
    effects: [{ kind: 'damage', mult: 1.0 }],
  },
  goku_technique: {
    id: 'goku_technique', name: 'Kamehameha', slot: 'technique', icon: '🌊', range: 'ranged',
    desc: 'Fires a concentrated ki wave at the strongest foe.',
    cooldown: 8,
    targeting: 'highestAtk',
    effects: [{ kind: 'damage', mult: 2.3 }],
  },
  goku_ultimate: {
    id: 'goku_ultimate', name: 'Kaio-ken Assault', slot: 'ultimate', icon: '🔥', range: 'ranged',
    desc: 'Multiplies his ki, striking all enemies and raising his own ATK.',
    targeting: 'allEnemies',
    effects: [
      { kind: 'damage', mult: 1.45 },
      { kind: 'buff', stat: 'atk', pct: 0.35, seconds: 10, target: 'self' },
    ],
  },

  /* ---------------- Piccolo (Rare) ---------------- */
  piccolo_attack: {
    id: 'piccolo_attack', name: 'Demon Strike', slot: 'attack', icon: '✊',
    desc: 'A heavy elongated-arm blow.',
    targeting: 'frontFirst',
    effects: [{ kind: 'damage', mult: 1.05 }],
  },
  piccolo_technique: {
    id: 'piccolo_technique', name: 'Special Beam Cannon', slot: 'technique', icon: '🌀', range: 'ranged',
    desc: 'A drilling beam that pierces much of the target’s defence.',
    cooldown: 10,
    targeting: 'highestAtk',
    effects: [{ kind: 'damage', mult: 2.6, defIgnore: 0.5 }],
  },
  piccolo_ultimate: {
    id: 'piccolo_ultimate', name: 'Explosive Demon Wave', slot: 'ultimate', icon: '💥', range: 'ranged',
    desc: 'Sweeps the battlefield with an expanding blast.',
    targeting: 'allEnemies',
    effects: [
      { kind: 'damage', mult: 1.6 },
      { kind: 'debuff', stat: 'def', pct: 0.2, seconds: 8 },
    ],
  },

  /* ---------------- Gohan (Rare) ---------------- */
  gohan_attack: {
    id: 'gohan_attack', name: 'Wild Swing', slot: 'attack', icon: '🌟',
    desc: 'Untrained but surprisingly heavy blows.',
    targeting: 'frontFirst',
    effects: [{ kind: 'damage', mult: 0.95 }],
  },
  gohan_technique: {
    id: 'gohan_technique', name: 'Masenko', slot: 'technique', icon: '⚡', range: 'ranged',
    desc: 'A two-handed burst of ki aimed at the weakest foe.',
    cooldown: 9,
    targeting: 'lowestHp',
    effects: [{ kind: 'damage', mult: 2.4 }],
  },
  gohan_ultimate: {
    id: 'gohan_ultimate', name: 'Hidden Potential', slot: 'ultimate', icon: '😤', range: 'ranged',
    desc: 'Latent power erupts, damaging every enemy and empowering the team.',
    targeting: 'allEnemies',
    effects: [
      { kind: 'damage', mult: 1.35 },
      { kind: 'buff', stat: 'atk', pct: 0.2, seconds: 12, target: 'allies' },
    ],
  },

  /* ---------------- Krillin (Uncommon) ---------------- */
  krillin_attack: {
    id: 'krillin_attack', name: 'Ki Blast', slot: 'attack', icon: '🔹', range: 'ranged',
    desc: 'A quick bolt of ki fired from range.',
    targeting: 'frontFirst',
    effects: [{ kind: 'damage', mult: 0.9 }],
  },
  krillin_technique: {
    id: 'krillin_technique', name: 'Destructo Disc', slot: 'technique', icon: '💿', range: 'ranged',
    desc: 'A razor of ki that cuts straight through defences.',
    cooldown: 9,
    targeting: 'highestAtk',
    effects: [{ kind: 'damage', mult: 2.1, defIgnore: 0.7 }],
  },
  krillin_ultimate: {
    id: 'krillin_ultimate', name: 'Solar Flare', slot: 'ultimate', icon: '☀️', range: 'ranged',
    desc: 'Blinds every enemy, sharply cutting their attack power.',
    targeting: 'allEnemies',
    effects: [
      { kind: 'damage', mult: 0.5 },
      { kind: 'debuff', stat: 'atk', pct: 0.3, seconds: 9 },
    ],
  },

  /* ---------------- Yamcha (Uncommon) ---------------- */
  yamcha_attack: {
    id: 'yamcha_attack', name: 'Fist Combo', slot: 'attack', icon: '👊',
    desc: 'Fast martial-arts strikes.',
    targeting: 'frontFirst',
    effects: [{ kind: 'damage', mult: 0.95 }],
  },
  yamcha_technique: {
    id: 'yamcha_technique', name: 'Wolf Fang Fist', slot: 'technique', icon: '🐺',
    desc: 'Four savage clawing blows in sequence.',
    cooldown: 7,
    targeting: 'frontFirst',
    effects: [{ kind: 'damage', mult: 0.62, hits: 4 }],
  },
  yamcha_ultimate: {
    id: 'yamcha_ultimate', name: 'Spirit Ball', slot: 'ultimate', icon: '🔮', range: 'ranged',
    desc: 'A steered orb of ki that hammers a single target.',
    targeting: 'lowestHp',
    effects: [{ kind: 'damage', mult: 3.4 }],
  },

  /* ---------------- Tien (Uncommon) ---------------- */
  tien_attack: {
    id: 'tien_attack', name: 'Volleyball Fist', slot: 'attack', icon: '🖐️',
    desc: 'A punishing downward spike.',
    targeting: 'frontFirst',
    effects: [{ kind: 'damage', mult: 1.0 }],
  },
  tien_technique: {
    id: 'tien_technique', name: 'Dodon Ray', slot: 'technique', icon: '☄️', range: 'ranged',
    desc: 'A piercing beam fired from a single fingertip.',
    cooldown: 8,
    targeting: 'highestAtk',
    effects: [{ kind: 'damage', mult: 2.35 }],
  },
  tien_ultimate: {
    id: 'tien_ultimate', name: 'Tri-Beam', slot: 'ultimate', icon: '🔺', range: 'ranged',
    desc: 'Devastating area damage — at the cost of his own life force.',
    targeting: 'allEnemies',
    effects: [
      { kind: 'damage', mult: 2.0 },
      { kind: 'selfDamage', pctMaxHp: 0.15 },
    ],
  },

  /* ---------------- Enemy skills ---------------- */
  saibaman_attack: {
    id: 'saibaman_attack', name: 'Claw Swipe', slot: 'attack', icon: '🦵',
    desc: 'A raking swipe.',
    targeting: 'frontFirst',
    effects: [{ kind: 'damage', mult: 1.0 }],
  },
  saibaman_technique: {
    id: 'saibaman_technique', name: 'Acid Spit', slot: 'technique', icon: '🧪', range: 'ranged',
    desc: 'Corrosive spray that softens armour.',
    cooldown: 9,
    targeting: 'frontFirst',
    effects: [
      { kind: 'damage', mult: 1.4 },
      { kind: 'debuff', stat: 'def', pct: 0.18, seconds: 8 },
    ],
  },
  raditz_attack: {
    id: 'raditz_attack', name: 'Saiyan Backhand', slot: 'attack', icon: '👋',
    desc: 'A contemptuous heavy blow.',
    targeting: 'frontFirst',
    effects: [{ kind: 'damage', mult: 1.1 }],
  },
  raditz_technique: {
    id: 'raditz_technique', name: 'Double Sunday', slot: 'technique', icon: '☄️', range: 'ranged',
    desc: 'Twin ki beams fired at once.',
    cooldown: 8,
    targeting: 'frontFirst',
    effects: [{ kind: 'damage', mult: 1.3, hits: 2 }],
  },
  raditz_ultimate: {
    id: 'raditz_ultimate', name: 'Shooting Star Attack', slot: 'ultimate', icon: '💫', range: 'ranged',
    desc: 'A brutal charging tackle through the whole team.',
    targeting: 'allEnemies',
    effects: [{ kind: 'damage', mult: 1.5 }],
  },
  nappa_attack: {
    id: 'nappa_attack', name: 'Crushing Blow', slot: 'attack', icon: '🤛',
    desc: 'Raw Saiyan strength.',
    targeting: 'frontFirst',
    effects: [{ kind: 'damage', mult: 1.15 }],
  },
  nappa_technique: {
    id: 'nappa_technique', name: 'Bomber DX', slot: 'technique', icon: '💣', range: 'ranged',
    desc: 'A shockwave that rips through the battlefield.',
    cooldown: 9,
    targeting: 'allEnemies',
    effects: [{ kind: 'damage', mult: 1.15 }],
  },
  nappa_ultimate: {
    id: 'nappa_ultimate', name: 'Break Cannon', slot: 'ultimate', icon: '🌋', range: 'ranged',
    desc: 'A point-blank detonation aimed at the weakest defender.',
    targeting: 'lowestHp',
    effects: [{ kind: 'damage', mult: 3.2 }],
  },
  nappa_passive: {
    id: 'nappa_passive', name: 'Saiyan Brutality', slot: 'passive', icon: '🛡️',
    desc: 'Every landed hit has a chance to erupt for bonus damage.',
    trigger: 'onHitDealt',
    chance: 0.25,                                   // PLACEHOLDER
    effects: [{ kind: 'damage', mult: 0.8 }],
  },
  vegeta_attack: {
    id: 'vegeta_attack', name: 'Elite Strike', slot: 'attack', icon: '🥊',
    desc: 'Precise, merciless blows.',
    targeting: 'frontFirst',
    effects: [{ kind: 'damage', mult: 1.2 }],
  },
  vegeta_technique: {
    id: 'vegeta_technique', name: 'Galick Gun', slot: 'technique', icon: '🟣', range: 'ranged',
    desc: 'A violet torrent of ki.',
    cooldown: 8,
    targeting: 'highestAtk',
    effects: [{ kind: 'damage', mult: 2.5, defIgnore: 0.3 }],
  },
  vegeta_ultimate: {
    id: 'vegeta_ultimate', name: 'Galaxy Breaker', slot: 'ultimate', icon: '🌌', range: 'ranged',
    desc: 'A world-ending sphere hurled at the entire team.',
    targeting: 'allEnemies',
    effects: [{ kind: 'damage', mult: 2.2 }],
  },
  vegeta_passive: {
    id: 'vegeta_passive', name: 'Saiyan Pride', slot: 'passive', icon: '👑',
    desc: 'Below half health, his attack power surges.',
    trigger: 'lowHp',
    hpThreshold: 0.5,                               // PLACEHOLDER
    effects: [{ kind: 'buff', stat: 'atk', pct: 0.45, seconds: 999, target: 'self' }],
  },
};

export function getSkill(id) {
  return SKILLS[id] || null;
}
