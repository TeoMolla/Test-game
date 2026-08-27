/**
 * progression/enemies.js — Enemy unit definitions.
 *
 * Enemies are deliberately simpler than heroes: their `stats` are FINAL
 * values (no rarity/star/level multipliers applied) and their skills are
 * listed explicitly rather than gated behind star ranks. A stage entry can
 * apply a `scale` multiplier to make the same enemy tougher later in the arc.
 *
 * Nappa and Vegeta are Epic/SSR, which is what puts the passive-skill rule
 * (passives at Epic and above) on screen in this pass.
 *
 * PHASES (bosses only) give a long fight a shape. Crossing an HP threshold
 * transforms the unit once — it takes the phase's effects, optionally swaps a
 * skill, and the world holds for a beat. Without them a boss at 5% health
 * fights exactly as it did at full, and a fifty-second battle is one
 * eight-second loop played six times.
 *
 *   phases: [{ atPct, name, icon?, skills?: { slot: skillId }, effects: [] }]
 *
 * Thresholds are checked in order and each fires once, so a burst that skips
 * past two thresholds triggers both.
 *
 * PLACEHOLDER: every number here is untuned.
 */

export const ENEMIES = {
  saibaman: {
    id: 'saibaman', name: 'Saibaman', rarity: 'common',
    stats: { atk: 34, hp: 430, def: 16, speed: 1.05 },
    skills: { attack: 'saibaman_attack', technique: 'saibaman_technique' },
    art: { skin: '#65a30d', hair: 'none', hairStyle: 'saibaman', gi: '#3f6212', trim: '#a3e635', aura: '#84cc16' },
  },
  saibaman_elite: {
    id: 'saibaman_elite', name: 'Elite Saibaman', rarity: 'uncommon',
    stats: { atk: 80, hp: 920, def: 26, speed: 1.1 },
    skills: { attack: 'saibaman_attack', technique: 'saibaman_technique' },
    art: { skin: '#4d7c0f', hair: 'none', hairStyle: 'saibaman', gi: '#1a2e05', trim: '#facc15', aura: '#a3e635' },
  },
  raditz: {
    id: 'raditz', name: 'Raditz', rarity: 'rare',
    stats: { atk: 94, hp: 2150, def: 44, speed: 1.05 },
    skills: { attack: 'raditz_attack', technique: 'raditz_technique', ultimate: 'raditz_ultimate' },
    phases: [
      {
        atPct: 0.5, name: 'Full Power', icon: '💢',
        skills: { attack: 'raditz_attack_rage' },
        effects: [{ kind: 'buff', stat: 'speed', pct: 0.25, seconds: 999, target: 'self' }],
      },
    ],
    art: { skin: '#e8b48b', hair: '#171717', hairStyle: 'mane', gi: '#1e293b', trim: '#f5f5f4', aura: '#a855f7' },
  },
  nappa: {
    id: 'nappa', name: 'Nappa', rarity: 'epic',
    stats: { atk: 152, hp: 5400, def: 68, speed: 1.0 },
    skills: {
      attack: 'nappa_attack', technique: 'nappa_technique',
      ultimate: 'nappa_ultimate', passive: 'nappa_passive',
    },
    phases: [
      {
        atPct: 0.45, name: 'Enraged', icon: '💥',
        skills: { technique: 'nappa_technique_rage' },
        effects: [
          { kind: 'buff', stat: 'atk', pct: 0.25, seconds: 999, target: 'self' },
          { kind: 'buff', stat: 'speed', pct: 0.2, seconds: 999, target: 'self' },
        ],
      },
    ],
    art: { skin: '#e8b48b', hair: 'none', hairStyle: 'bald', gi: '#1e293b', trim: '#f59e0b', aura: '#c084fc' },
  },
  vegeta: {
    id: 'vegeta', name: 'Vegeta', rarity: 'ssr',
    stats: { atk: 196, hp: 8600, def: 88, speed: 1.1 },
    skills: {
      attack: 'vegeta_attack', technique: 'vegeta_technique',
      ultimate: 'vegeta_ultimate', passive: 'vegeta_passive',
    },
    phases: [
      {
        atPct: 0.6, name: 'No More Games', icon: '🟣',
        skills: { technique: 'vegeta_technique_rage' },
        effects: [{ kind: 'buff', stat: 'speed', pct: 0.2, seconds: 999, target: 'self' }],
      },
      {
        atPct: 0.2, name: 'Saiyan Rage', icon: '🔥',
        effects: [
          { kind: 'buff', stat: 'atk', pct: 0.4, seconds: 999, target: 'self' },
          { kind: 'buff', stat: 'speed', pct: 0.25, seconds: 999, target: 'self' },
        ],
        freezeSeconds: 1.0,
      },
    ],
    art: { skin: '#e8b48b', hair: '#171717', hairStyle: 'widowsPeak', gi: '#1e293b', trim: '#fbbf24', aura: '#fbbf24' },
  },
};

export function getEnemyDef(id) {
  return ENEMIES[id] || null;
}
