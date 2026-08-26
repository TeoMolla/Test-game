/**
 * battle/engine.js — Real-time auto-battle simulation.
 *
 * Not turn-based: every unit runs its own timers and acts the moment they
 * come due, so both teams act simultaneously.
 *
 * Per unit, per tick:
 *   1. tick buffs/debuffs down
 *   2. tick the ultimate charge meter; fire it the instant it fills
 *      (ULTIMATE_MODE === 'auto'; 'tap' defers to requestUltimate())
 *   3. tick the technique cooldown; fire it the instant it is off cooldown
 *   4. tick the auto-attack timer; fire when due
 *
 * The engine is headless — it emits events and never touches the DOM, so the
 * same simulation can be replayed, fast-forwarded or run in a test.
 */

import { COMBAT, ULTIMATE_MODE } from '../config.js';
import { resolveTargets } from './targeting.js';
import { getSkill } from '../skills/skills.js';

let uidSeq = 0;

function makeUnit(desc, side) {
  const skills = {};
  for (const [slot, id] of Object.entries(desc.skills || {})) {
    const skill = typeof id === 'string' ? getSkill(id) : id;
    if (skill) skills[slot] = skill;
  }
  const maxHp = Math.max(1, Math.round(desc.stats.hp));
  return {
    uid: desc.uid || `u${uidSeq++}`,
    side,
    heroId: desc.heroId || null,
    defId: desc.defId || null,
    name: desc.name,
    rarity: desc.rarity,
    level: desc.level ?? 1,
    star: desc.star ?? 0,
    row: desc.row === 'back' ? 'back' : 'front',
    art: desc.art,
    stats: { ...desc.stats },
    maxHp,
    hp: maxHp,
    alive: true,
    skills,
    buffs: [],
    // PLACEHOLDER: small random offset so units don't all swing in lockstep.
    attackTimer: Math.random() * 0.4,
    attackInterval: COMBAT.baseAttackInterval / Math.max(0.2, desc.stats.speed || 1),
    techniqueTimer: skills.technique ? (skills.technique.cooldown || 8) * 0.6 : Infinity,
    ultimateCharge: 0,
    ultimateReady: false,
    passiveFired: false,
  };
}

export function effectiveStat(unit, stat) {
  let pct = 0;
  for (const b of unit.buffs) if (b.stat === stat) pct += b.pct;
  return Math.max(0, unit.stats[stat] * (1 + pct));
}

/**
 * PLACEHOLDER damage formula:
 *   atk * mult * K / (K + effectiveDef) , then variance and crit.
 * Defence is a soft mitigation curve, so stacking DEF never reaches immunity.
 */
function computeDamage(attacker, target, effect) {
  const atk = effectiveStat(attacker, 'atk');
  const def = effectiveStat(target, 'def') * (1 - (effect.defIgnore || 0));
  const base = atk * (effect.mult ?? 1) * (COMBAT.defenseConstant / (COMBAT.defenseConstant + def));
  const variance = 1 + (Math.random() * 2 - 1) * COMBAT.damageVariance;
  const crit = Math.random() < COMBAT.critChance;
  const amount = Math.max(1, Math.round(base * variance * (crit ? COMBAT.critMult : 1)));
  return { amount, crit };
}

function addCharge(unit, amount) {
  if (!unit.skills.ultimate || unit.ultimateReady) return;
  unit.ultimateCharge = Math.min(COMBAT.ultimateChargeMax, unit.ultimateCharge + amount);
}

export function createBattle({ playerUnits = [], enemyUnits = [], stageId = null } = {}) {
  const units = [
    ...playerUnits.map((d) => makeUnit(d, 'player')),
    ...enemyUnits.map((d) => makeUnit(d, 'enemy')),
  ];

  const battle = {
    stageId,
    units,
    elapsed: 0,
    state: 'running',      // 'running' | 'victory' | 'defeat'
    events: [],
    _accumulator: 0,
    log: [],
  };

  battle.player = () => battle.units.filter((u) => u.side === 'player');
  battle.enemy = () => battle.units.filter((u) => u.side === 'enemy');
  battle.unitById = (uid) => battle.units.find((u) => u.uid === uid) || null;

  // Passives with a battleStart trigger land before the first swing.
  for (const unit of units) {
    const passive = unit.skills.passive;
    if (passive && passive.trigger === 'battleStart') {
      firePassive(battle, unit, passive);
    }
  }

  /** Player-activated ultimates (ULTIMATE_MODE === 'tap'). */
  battle.requestUltimate = (uid) => {
    const unit = battle.unitById(uid);
    if (!unit || !unit.alive || !unit.ultimateReady) return false;
    castSkill(battle, unit, unit.skills.ultimate, 'ultimate');
    unit.ultimateCharge = 0;
    unit.ultimateReady = false;
    return true;
  };

  /**
   * Advance the simulation. `dt` is wall-clock seconds; internally the battle
   * runs on fixed COMBAT.tickMs steps so results don't depend on frame rate.
   * Returns the events produced during this call.
   */
  battle.update = (dt) => {
    battle.events = [];
    if (battle.state !== 'running') return battle.events;

    battle._accumulator += Math.min(dt, 0.25); // clamp: tab-switch catch-up
    const step = COMBAT.tickMs / 1000;

    while (battle._accumulator >= step && battle.state === 'running') {
      battle._accumulator -= step;
      tick(battle, step);
    }
    return battle.events;
  };

  return battle;
}

function tick(battle, dt) {
  battle.elapsed += dt;

  for (const unit of battle.units) {
    if (!unit.alive) continue;

    // 1. buffs expire
    if (unit.buffs.length) {
      unit.buffs = unit.buffs.filter((b) => {
        b.remaining -= dt;
        return b.remaining > 0;
      });
    }

    // 2. ultimate meter
    if (unit.skills.ultimate) {
      if (!unit.ultimateReady) {
        addCharge(unit, COMBAT.ultimateChargePerSecond * dt);
        if (unit.ultimateCharge >= COMBAT.ultimateChargeMax) {
          unit.ultimateReady = true;
          battle.events.push({ t: 'ultReady', uid: unit.uid });
        }
      }
      if (unit.ultimateReady && ULTIMATE_MODE === 'auto') {
        castSkill(battle, unit, unit.skills.ultimate, 'ultimate');
        unit.ultimateCharge = 0;
        unit.ultimateReady = false;
        continue; // one action per tick keeps the readout legible
      }
    }

    // 3. technique
    if (unit.skills.technique) {
      unit.techniqueTimer -= dt;
      if (unit.techniqueTimer <= 0) {
        const fired = castSkill(battle, unit, unit.skills.technique, 'technique');
        unit.techniqueTimer = unit.skills.technique.cooldown || 8;
        if (fired) continue;
      }
    }

    // 4. auto-attack
    if (unit.skills.attack) {
      unit.attackTimer -= dt;
      if (unit.attackTimer <= 0) {
        unit.attackTimer = unit.attackInterval;
        castSkill(battle, unit, unit.skills.attack, 'attack');
      }
    }
  }

  checkEnd(battle);
}

/** Returns true if the skill actually went off (had a legal target). */
function castSkill(battle, caster, skill, slot) {
  if (!skill || !caster.alive) return false;
  const targets = resolveTargets(battle, caster, skill.targeting || 'frontFirst');
  const needsTarget = (skill.effects || []).some((e) => e.kind === 'damage');
  if (needsTarget && !targets.length) return false;

  battle.events.push({ t: 'skill', uid: caster.uid, skillId: skill.id, slot, name: skill.name, icon: skill.icon });

  for (const effect of skill.effects || []) {
    applyEffect(battle, caster, effect, targets, { skill, slot });
  }
  return true;
}

function applyEffect(battle, caster, effect, targets, ctx) {
  switch (effect.kind) {
    case 'damage': {
      const hits = effect.hits || 1;
      for (let h = 0; h < hits; h++) {
        for (const target of targets) {
          if (!target.alive) continue;
          dealDamage(battle, caster, target, effect, ctx);
        }
      }
      break;
    }

    case 'heal': {
      const amount = Math.round(effectiveStat(caster, 'atk') * (effect.mult ?? 1));
      for (const target of targets) {
        if (!target.alive) continue;
        target.hp = Math.min(target.maxHp, target.hp + amount);
        battle.events.push({ t: 'heal', uid: target.uid, amount });
      }
      break;
    }

    case 'selfDamage': {
      const amount = Math.max(1, Math.round(caster.maxHp * (effect.pctMaxHp || 0)));
      caster.hp = Math.max(0, caster.hp - amount);
      battle.events.push({ t: 'damage', uid: caster.uid, from: caster.uid, amount, crit: false, self: true });
      if (caster.hp <= 0) killUnit(battle, caster);
      break;
    }

    case 'buff': {
      const pool = effect.target === 'allies'
        ? battle.units.filter((u) => u.side === caster.side && u.alive)
        : [caster];
      for (const target of pool) {
        target.buffs.push({ stat: effect.stat, pct: effect.pct, remaining: effect.seconds });
        battle.events.push({ t: 'buff', uid: target.uid, stat: effect.stat, pct: effect.pct });
      }
      break;
    }

    case 'debuff': {
      for (const target of targets) {
        if (!target.alive) continue;
        target.buffs.push({ stat: effect.stat, pct: -Math.abs(effect.pct), remaining: effect.seconds });
        battle.events.push({ t: 'debuff', uid: target.uid, stat: effect.stat, pct: effect.pct });
      }
      break;
    }

    case 'charge':
      addCharge(caster, effect.amount || 0);
      break;

    default:
      console.warn('[battle] unknown effect kind', effect.kind);
  }
}

function dealDamage(battle, attacker, target, effect, ctx = {}) {
  const { amount, crit } = computeDamage(attacker, target, effect);
  target.hp = Math.max(0, target.hp - amount);
  battle.events.push({
    t: 'damage', uid: target.uid, from: attacker.uid,
    amount, crit, slot: ctx.slot || null,
  });

  addCharge(attacker, COMBAT.ultimateChargeOnHitDealt);
  addCharge(target, COMBAT.ultimateChargeOnHitTaken);

  if (target.hp <= 0) {
    killUnit(battle, target);
  } else {
    checkLowHpPassive(battle, target);
  }

  // on-hit passives — `fromPassive` stops a passive proccing itself
  if (!ctx.fromPassive) {
    const passive = attacker.skills.passive;
    if (passive && passive.trigger === 'onHitDealt' && Math.random() < (passive.chance ?? 1)) {
      firePassive(battle, attacker, passive, [target]);
    }
  }
}

function checkLowHpPassive(battle, unit) {
  const passive = unit.skills.passive;
  if (!passive || passive.trigger !== 'lowHp' || unit.passiveFired) return;
  if (unit.hp / unit.maxHp <= (passive.hpThreshold ?? 0.5)) {
    unit.passiveFired = true;
    firePassive(battle, unit, passive);
  }
}

function firePassive(battle, unit, passive, targets) {
  const resolved = targets || resolveTargets(battle, unit, passive.targeting || 'self');
  battle.events.push({
    t: 'passive', uid: unit.uid, skillId: passive.id, name: passive.name, icon: passive.icon,
  });
  for (const effect of passive.effects || []) {
    applyEffect(battle, unit, effect, resolved, { skill: passive, slot: 'passive', fromPassive: true });
  }
}

function killUnit(battle, unit) {
  if (!unit.alive) return;
  unit.alive = false;
  unit.hp = 0;
  unit.ultimateReady = false;
  battle.events.push({ t: 'death', uid: unit.uid });
}

function checkEnd(battle) {
  if (battle.state !== 'running') return;
  const playersAlive = battle.units.some((u) => u.side === 'player' && u.alive);
  const enemiesAlive = battle.units.some((u) => u.side === 'enemy' && u.alive);

  if (!enemiesAlive) {
    battle.state = 'victory';
  } else if (!playersAlive) {
    battle.state = 'defeat';
  } else if (battle.elapsed >= COMBAT.maxBattleSeconds) {
    // PLACEHOLDER: a timeout counts as a loss. Could become a judged result
    // (most remaining HP%) later.
    battle.state = 'defeat';
  } else {
    return;
  }
  battle.events.push({ t: 'end', result: battle.state });
}
