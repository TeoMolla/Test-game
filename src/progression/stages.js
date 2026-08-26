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
 *   rewards         granted on every clear
 *   firstClear      one-time bonus on the first clear
 *
 * PLACEHOLDER: power gates, reward amounts and drop chances are all untuned.
 */

export const STAGES = [
  {
    id: 1,
    name: 'Landing Zone',
    subtitle: 'A pod cracks the earth open outside the city.',
    requiredPower: 600,
    enemies: [
      { defId: 'saibaman', row: 'front', scale: 1.0 },
      { defId: 'saibaman', row: 'front', scale: 1.0 },
    ],
    rewards: {
      zeni: 120,
      shards: { tien: 2 },
      gearTable: [{ defId: 'training_weights', chance: 0.5 }],
    },
    firstClear: { zeni: 150, shards: { tien: 3 } },
  },
  {
    id: 2,
    name: 'Farmland Skirmish',
    subtitle: 'The scouts spread out across the fields.',
    requiredPower: 1200,
    enemies: [
      { defId: 'saibaman', row: 'front', scale: 1.15 },
      { defId: 'saibaman', row: 'front', scale: 1.15 },
      { defId: 'saibaman', row: 'back', scale: 1.1 },
    ],
    rewards: {
      zeni: 165,
      shards: { tien: 2 },
      gearTable: [
        { defId: 'turtle_gi', chance: 0.45 },
        { defId: 'worn_boots', chance: 0.4 },
      ],
    },
    firstClear: { zeni: 200, shards: { tien: 4 } },
  },
  {
    id: 3,
    name: 'Raditz Strikes',
    subtitle: 'Goku’s brother has come to collect him.',
    requiredPower: 2100,
    enemies: [
      { defId: 'raditz', row: 'front', scale: 1.0 },
      { defId: 'saibaman', row: 'back', scale: 1.2 },
    ],
    rewards: {
      zeni: 230,
      shards: { piccolo: 3 },
      gearTable: [
        { defId: 'power_pole', chance: 0.4 },
        { defId: 'scouter', chance: 0.35 },
      ],
    },
    firstClear: { zeni: 320, shards: { piccolo: 5 } },
  },
  {
    id: 4,
    name: 'One Year Later',
    subtitle: 'Training ends. The sky turns the colour of a scouter.',
    requiredPower: 3100,
    enemies: [
      { defId: 'saibaman_elite', row: 'front', scale: 1.0 },
      { defId: 'saibaman_elite', row: 'front', scale: 1.0 },
      { defId: 'saibaman_elite', row: 'back', scale: 1.0 },
      { defId: 'saibaman_elite', row: 'back', scale: 1.0 },
    ],
    rewards: {
      zeni: 280,
      shards: { gohan: 3 },
      gearTable: [
        { defId: 'kame_belt', chance: 0.4 },
        { defId: 'scouter', chance: 0.3 },
      ],
    },
    firstClear: { zeni: 380, shards: { gohan: 5 } },
  },
  {
    id: 5,
    name: 'Nappa’s Rampage',
    subtitle: 'He is not even trying yet.',
    requiredPower: 4700,
    enemies: [
      { defId: 'nappa', row: 'front', scale: 1.0 },
      { defId: 'saibaman_elite', row: 'back', scale: 1.1 },
      { defId: 'saibaman_elite', row: 'back', scale: 1.1 },
    ],
    rewards: {
      zeni: 360,
      shards: { piccolo: 4 },
      gearTable: [
        { defId: 'saiyan_boots', chance: 0.3 },
        { defId: 'kaio_gloves', chance: 0.3 },
      ],
    },
    firstClear: { zeni: 500, shards: { piccolo: 8, gohan: 4 } },
  },
  {
    id: 6,
    name: 'The Prince of All Saiyans',
    subtitle: 'Vegeta stops watching and steps forward.',
    requiredPower: 6300,
    enemies: [
      { defId: 'vegeta', row: 'front', scale: 1.0 },
    ],
    rewards: {
      zeni: 520,
      shards: { gohan: 5 },
      gearTable: [
        { defId: 'saiyan_armor', chance: 0.3 },
        { defId: 'z_sword_shard', chance: 0.25 },
      ],
    },
    firstClear: { zeni: 900, shards: { gohan: 10, tien: 10 } },
  },
];

export function getStage(id) {
  return STAGES.find((s) => s.id === id) || null;
}
