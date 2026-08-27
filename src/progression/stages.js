/**
 * progression/stages.js — Linear story campaign (Saiyan Saga).
 *
 * Difficulty rises along the arc: Saibamen, then Raditz, then Nappa, then
 * Vegeta. Plot accuracy is loose on purpose — the shape of the escalation is
 * what matters for the prototype.
 *
 * Stage shape
 *   id              1-based, also the ordering
 *   name/subtitle   narrative beat shown on the stage card
 *   requiredPower   team power gate (the only gate in this pass — no
 *                   resource-gated obstacles yet)
 *   enemies         [{ defId, row, scale }] — `scale` multiplies final stats
 *   rewards         granted on every clear: zeni, XP, senzu beans, shards, gear
 *   firstClear      one-time bonus on the first clear
 *
 * GEAR FROM THE STORY is deliberately poor: common only, and at low levels.
 * The campaign's job is XP, beans and shards; gear is what dungeons are for.
 * What the story does give is a floor — each boss stage drops one GUARANTEED
 * piece at a level above anything the stage itself rolls, so beating a boss
 * always hands you a usable piece and an entry ticket to the next dungeon
 * band.
 *
 *   gearLevel       [lo, hi] band every ordinary drop from this stage rolls in
 *   bossDrop        { defId, level } — one guaranteed piece, boss stages only
 *
 * PLACEHOLDER: power gates, reward amounts and drop chances are all untuned.
 */

export const STAGES = [
  {
    id: 1,
    name: 'Landing Zone',
    subtitle: 'A pod cracks the earth open outside the city.',
    requiredPower: 450,
    enemies: [
      { defId: 'saibaman', row: 'front', scale: 1.0 },
      { defId: 'saibaman', row: 'front', scale: 1.0 },
    ],
    rewards: {
      zeni: 120,
      xp: 70,
      shards: { tien: 2 },
      gearLevel: [1, 2],
      gearTable: [{ defId: 'training_weights', chance: 0.5 }],
    },
    firstClear: { senzu: 3, zeni: 150, shards: { tien: 3 } },
  },
  {
    id: 2,
    name: 'Farmland Skirmish',
    subtitle: 'The scouts spread out across the fields.',
    requiredPower: 900,
    enemies: [
      { defId: 'saibaman', row: 'front', scale: 1.15 },
      { defId: 'saibaman', row: 'front', scale: 1.15 },
      { defId: 'saibaman', row: 'back', scale: 1.1 },
    ],
    rewards: {
      zeni: 165,
      xp: 130,
      senzu: 1,
      shards: { tien: 2 },
      gearLevel: [1, 3],
      gearTable: [
        { defId: 'turtle_gi', chance: 0.45 },
        { defId: 'worn_boots', chance: 0.4 },
      ],
    },
    firstClear: { senzu: 3, zeni: 200, shards: { tien: 4 } },
  },
  {
    id: 3,
    name: 'Raditz Strikes',
    subtitle: 'Goku’s brother has come to collect him.',
    requiredPower: 1600,
    enemies: [
      { defId: 'raditz', row: 'front', scale: 1.0 },
      { defId: 'saibaman', row: 'back', scale: 1.2 },
    ],
    rewards: {
      zeni: 230,
      xp: 240,
      senzu: 1,
      shards: { piccolo: 3 },
      gearLevel: [1, 3],
      bossDrop: { defId: 'bamboo_staff', level: 5 },
      gearTable: [
        { defId: 'bamboo_staff', chance: 0.4 },
        { defId: 'training_weights', chance: 0.35 },
      ],
    },
    firstClear: { senzu: 4, zeni: 320, shards: { piccolo: 5 } },
  },
  {
    id: 4,
    name: 'One Year Later',
    subtitle: 'Training ends. The sky turns the colour of a scouter.',
    requiredPower: 2350,
    enemies: [
      { defId: 'saibaman_elite', row: 'front', scale: 1.0 },
      { defId: 'saibaman_elite', row: 'front', scale: 1.0 },
      { defId: 'saibaman_elite', row: 'back', scale: 1.0 },
      { defId: 'saibaman_elite', row: 'back', scale: 1.0 },
    ],
    rewards: {
      zeni: 280,
      xp: 380,
      senzu: 2,
      shards: { gohan: 3 },
      gearLevel: [2, 4],
      gearTable: [
        { defId: 'turtle_gi', chance: 0.4 },
        { defId: 'worn_boots', chance: 0.3 },
      ],
    },
    firstClear: { senzu: 5, zeni: 380, shards: { gohan: 5 } },
  },
  {
    id: 5,
    name: 'Nappa’s Rampage',
    subtitle: 'He is not even trying yet.',
    requiredPower: 3500,
    enemies: [
      { defId: 'nappa', row: 'front', scale: 1.0 },
      { defId: 'saibaman_elite', row: 'back', scale: 1.1 },
      { defId: 'saibaman_elite', row: 'back', scale: 1.1 },
    ],
    rewards: {
      zeni: 360,
      xp: 620,
      senzu: 3,
      shards: { piccolo: 4 },
      gearLevel: [3, 5],
      bossDrop: { defId: 'worn_boots', level: 8 },
      gearTable: [
        { defId: 'training_weights', chance: 0.4 },
        { defId: 'bamboo_staff', chance: 0.3 },
      ],
    },
    firstClear: { senzu: 8, zeni: 500, shards: { piccolo: 8, gohan: 4 } },
  },
  {
    id: 6,
    name: 'The Prince of All Saiyans',
    subtitle: 'Vegeta stops watching and steps forward.',
    requiredPower: 4800,
    enemies: [
      { defId: 'vegeta', row: 'front', scale: 1.0 },
    ],
    rewards: {
      zeni: 520,
      xp: 950,
      senzu: 4,
      shards: { gohan: 5 },
      gearLevel: [4, 6],
      bossDrop: { defId: 'turtle_gi', level: 12 },
      gearTable: [
        { defId: 'turtle_gi', chance: 0.4 },
        { defId: 'worn_boots', chance: 0.35 },
      ],
    },
    firstClear: { senzu: 12, zeni: 900, shards: { gohan: 10, tien: 10 } },
  },
];

export function getStage(id) {
  return STAGES.find((s) => s.id === id) || null;
}
