/**
 * battle/engine.js — Turn-based combat simulation.
 *
 * TURN ORDER is an action-value queue, not rounds. Every unit carries an
 * `av` — the distance until its next turn — and whoever is closest acts next.
 * Acting resets that unit's av to BASE_AV / speed, so a faster unit simply
 * comes round again sooner. Two consequences worth knowing:
 *   - SPEED is a real stat again. It buys turns, not a shorter timer.
 *   - The order is knowable ahead of time, so `battle.preview()` can show the
 *     next several turns and a charging attack can say which turn it lands on.
 *
 * A TURN, in order:
 *   1. the unit's cooldowns and buffs tick down one turn
 *   2. a hit it was charging resolves now, and the turn ends
 *   3. otherwise it picks an action — the player chooses for their heroes,
 *      the AI chooses for everyone else (and for the player under auto-battle)
 *
 * CHARGING replaces the real-time telegraph: a heavy skill is announced on one
 * turn and lands at the start of the caster's next one, so the answer to it is
 * a turn you actually get rather than a second of reaction time.
 *
 * The engine is headless — it emits events and never touches the DOM — so the
 * same fight runs in a browser, in a test, or a thousand times in the balance
 * harness.
 */

import { COMBAT, engagesInMelee } from '../config.js';
import { resolveTargets } from './targeting.js';
import { getSkill } from '../skills/skills.js';

let uidSeq = 0;

/** Turn-order distance a unit of speed 1.0 travels per turn. */
const BASE_AV = 1000;

function avStep(unit) {
  return BASE_AV / Math.max(0.2, effectiveStat(unit, 'speed'));
}

function makeUnit(desc, side) {
  const skills = {};
  for (const [slot, id] of Object.entries(desc.skills || {})) {
    const skill = typeof id === 'string' ? getSkill(id) : id;
    if (skill) skills[slot] = skill;
  }
  const maxHp = Math.max(1, Math.round(desc.stats.hp));
  const unit = {
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
    // Front-line melee units stand forward; the UI reads this for staging.
    engages: engagesInMelee(desc.row === 'back' ? 'back' : 'front', skills.attack),
    // Turns, not seconds, from here down.
    techniqueCd: 0,
    ultimateCharge: 0,
    ultimateReady: false,
    guarding: false,
    charging: null,          // { skill, slot } announced, lands next turn
    turnsTaken: 0,
    passiveFired: false,
    phases: desc.phases || null,
    phasesFired: new Set(),
    av: 0,
  };
  unit.av = avStep(unit);
  return unit;
}

export function effectiveStat(unit, stat) {
  let pct = 0;
  for (const b of unit.buffs) if (b.stat === stat) pct += b.pct;
  return Math.max(0, unit.stats[stat] * (1 + pct));
}

/**
 * PLACEHOLDER damage formula:
 *   atk * mult * K / (K + effectiveDef) , then variance, crit and guard.
 * Defence is a soft mitigation curve, so stacking DEF never reaches immunity.
 */
function computeDamage(attacker, target, effect) {
  const atk = effectiveStat(attacker, 'atk');
  const def = effectiveStat(target, 'def') * (1 - (effect.defIgnore || 0));
  const base = atk * (effect.mult ?? 1) * (COMBAT.defenseConstant / (COMBAT.defenseConstant + def));
  const variance = 1 + (Math.random() * 2 - 1) * COMBAT.damageVariance;
  const crit = Math.random() < COMBAT.critChance;
  let amount = base * variance * (crit ? COMBAT.critMult : 1);
  const guarded = !!target.guarding;
  if (guarded) amount *= COMBAT.guardDamageMult;
  return { amount: Math.max(1, Math.round(amount)), crit, guarded };
}

function addCharge(unit, amount) {
  if (!unit.skills.ultimate || unit.ultimateReady) return;
  unit.ultimateCharge = Math.min(COMBAT.ultimateChargeMax, unit.ultimateCharge + amount);
  if (unit.ultimateCharge >= COMBAT.ultimateChargeMax) unit.ultimateReady = true;
}

export function createBattle({ playerUnits = [], enemyUnits = [], stageId = null, auto = false } = {}) {
  const units = [
    ...playerUnits.map((d) => makeUnit(d, 'player')),
    ...enemyUnits.map((d) => makeUnit(d, 'enemy')),
  ];

  const battle = {
    stageId,
    units,
    turn: 0,                 // turns taken by anyone, for the readout
    state: 'running',        // 'running' | 'victory' | 'defeat'
    events: [],
    auto,
    pending: null,           // { uid, isPlayer } — a turn open and waiting
    retreated: false,
    log: [],
  };

  battle.player = () => battle.units.filter((u) => u.side === 'player');
  battle.enemy = () => battle.units.filter((u) => u.side === 'enemy');
  battle.unitById = (uid) => battle.units.find((u) => u.uid === uid) || null;
  battle.living = () => battle.units.filter((u) => u.alive);
  battle.setAuto = (v) => { battle.auto = !!v; };

  // Passives with a battleStart trigger land before anyone acts.
  for (const unit of units) {
    const passive = unit.skills.passive;
    if (passive && passive.trigger === 'battleStart') firePassive(battle, unit, passive);
  }

  /**
   * The next `count` units to act, soonest first. Pure lookahead — it clones
   * the queue state and rolls it forward, so asking never changes anything.
   */
  battle.preview = (count = 6) => {
    const sim = battle.living().map((u) => ({ uid: u.uid, av: u.av, step: avStep(u) }));
    const out = [];
    for (let i = 0; i < count && sim.length; i++) {
      sim.sort((a, b) => a.av - b.av);
      const next = sim[0];
      const delta = next.av;
      for (const s of sim) s.av -= delta;
      out.push(next.uid);
      next.av = next.step;
    }
    return out;
  };

  /** Open the next turn. Returns the events it produced. */
  battle.advance = () => {
    battle.events = [];
    if (battle.state !== 'running' || battle.pending) return battle.events;

    const alive = battle.living();
    if (!alive.length) { checkEnd(battle); return battle.events; }

    // Roll the queue forward to whoever is closest.
    alive.sort((a, b) => a.av - b.av);
    const actor = alive[0];
    const delta = actor.av;
    if (delta > 0) for (const u of alive) u.av -= delta;

    battle.turn += 1;
    actor.turnsTaken += 1;

    // Start-of-turn upkeep. Guard only lasts until your own next turn, which
    // is what makes guarding a trade rather than a free mitigation.
    actor.guarding = false;
    if (actor.techniqueCd > 0) actor.techniqueCd -= 1;
    if (actor.buffs.length) {
      actor.buffs = actor.buffs.filter((b) => {
        b.turns -= 1;
        return b.turns > 0;
      });
    }
    addCharge(actor, COMBAT.ultimateChargePerTurn);

    battle.events.push({ t: 'turnStart', uid: actor.uid, turn: battle.turn, side: actor.side });

    // A charged hit lands now and consumes the turn.
    if (actor.charging) {
      const { skill, slot } = actor.charging;
      actor.charging = null;
      battle.events.push({ t: 'release', uid: actor.uid, skillId: skill.id, name: skill.name, icon: skill.icon });
      resolveCast(battle, actor, skill, slot);
      endTurn(battle, actor);
      return battle.events;
    }

    battle.pending = { uid: actor.uid, isPlayer: actor.side === 'player' };
    return battle.events;
  };

  /**
   * What the unit whose turn it is can legally do. The UI renders this
   * directly, so anything not in here cannot be chosen.
   */
  battle.actions = (uid = battle.pending?.uid) => {
    const unit = battle.unitById(uid);
    if (!unit || !unit.alive) return [];
    const list = [];
    if (unit.skills.attack) {
      list.push({ id: 'attack', skill: unit.skills.attack, ready: true });
    }
    if (unit.skills.technique) {
      list.push({
        id: 'technique', skill: unit.skills.technique,
        ready: unit.techniqueCd <= 0, cooldown: unit.techniqueCd,
      });
    }
    if (unit.skills.ultimate) {
      list.push({
        id: 'ultimate', skill: unit.skills.ultimate,
        ready: unit.ultimateReady,
        charge: unit.ultimateCharge, chargeMax: COMBAT.ultimateChargeMax,
      });
    }
    list.push({ id: 'guard', skill: GUARD, ready: true });
    return list;
  };

  /**
   * Take the pending turn. `targetUid` overrides the skill's own targeting for
   * single-target skills; everything else ignores it.
   * Returns true if the action was legal and resolved.
   */
  battle.act = (actionId, targetUid = null) => {
    battle.events = [];
    if (battle.state !== 'running' || !battle.pending) return false;
    const unit = battle.unitById(battle.pending.uid);
    if (!unit || !unit.alive) { battle.pending = null; return false; }

    const action = battle.actions(unit.uid).find((a) => a.id === actionId);
    if (!action || !action.ready) return false;

    battle.pending = null;

    if (actionId === 'guard') {
      unit.guarding = true;
      addCharge(unit, COMBAT.ultimateChargeOnGuard);
      battle.events.push({ t: 'guard', uid: unit.uid, name: GUARD.name, icon: GUARD.icon });
      endTurn(battle, unit);
      return true;
    }

    const skill = action.skill;
    if (actionId === 'ultimate') {
      unit.ultimateCharge = 0;
      unit.ultimateReady = false;
    }
    if (actionId === 'technique') {
      unit.techniqueCd = skill.cooldownTurns ?? COMBAT.defaultTechniqueCooldown;
    }

    castSkill(battle, unit, skill, actionId, targetUid);
    endTurn(battle, unit);
    return true;
  };

  /** What the AI would do with the pending turn. Also drives auto-battle. */
  battle.aiChoose = (uid = battle.pending?.uid) => chooseAction(battle, battle.unitById(uid));

  /** Resolve the pending turn with the AI's choice. */
  battle.takeAiTurn = () => {
    const choice = battle.aiChoose();
    if (!choice) return false;
    return battle.act(choice.actionId, choice.targetUid);
  };

  /** True when the fight is waiting on the player rather than on a timer. */
  battle.awaitingInput = () => !!battle.pending && battle.pending.isPlayer && !battle.auto;

  /** Give up now rather than play out a decided fight. */
  battle.retreat = () => {
    if (battle.state !== 'running') return false;
    battle.events = [];
    battle.state = 'defeat';
    battle.retreated = true;
    battle.pending = null;
    battle.events.push({ t: 'end', result: 'defeat', retreated: true });
    return true;
  };

  return battle;
}

/** The one action every unit always has, and the answer to a charging hit. */
const GUARD = {
  id: 'guard', name: 'Guard', slot: 'guard', icon: '🛡️',
  desc: 'Brace. Halves damage until your next turn and builds ki.',
};

function endTurn(battle, unit) {
  unit.av += avStep(unit);
  checkEnd(battle);
  battle.events.push({ t: 'turnEnd', uid: unit.uid });
}

/* ---------------- casting ---------------- */

/**
 * Start a skill. A skill with `charge: true` is announced now and lands at the
 * start of this unit's next turn; everything else resolves immediately.
 */
function castSkill(battle, caster, skill, slot, targetUid = null) {
  if (!skill || !caster.alive) return false;

  if (skill.charge) {
    caster.charging = { skill, slot };
    const targets = resolveTargets(battle, caster, skill.targeting || 'frontFirst');
    battle.events.push({
      t: 'charge', uid: caster.uid, skillId: skill.id, slot,
      name: skill.name, icon: skill.icon,
      targets: targets.map((u) => u.uid),
    });
    return true;
  }
  return resolveCast(battle, caster, skill, slot, targetUid);
}

/** Apply a skill now. */
function resolveCast(battle, caster, skill, slot, targetUid = null) {
  if (!skill || !caster.alive) return false;

  let targets = resolveTargets(battle, caster, skill.targeting || 'frontFirst');
  // A player-picked target overrides the rule, but only for skills that hit
  // one thing — overriding an "everyone" skill is meaningless.
  if (targetUid && targets.length <= 1) {
    const picked = battle.unitById(targetUid);
    if (picked && picked.alive && picked.side !== caster.side) targets = [picked];
  }

  const needsTarget = (skill.effects || []).some((e) => e.kind === 'damage');
  if (needsTarget && !targets.length) return false;

  battle.events.push({
    t: 'skill', uid: caster.uid, skillId: skill.id, slot,
    name: skill.name, icon: skill.icon, targets: targets.map((u) => u.uid),
  });

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
        target.buffs.push({ stat: effect.stat, pct: effect.pct, turns: turnsFor(effect) });
        battle.events.push({ t: 'buff', uid: target.uid, stat: effect.stat, pct: effect.pct });
      }
      break;
    }

    case 'debuff': {
      for (const target of targets) {
        if (!target.alive) continue;
        target.buffs.push({ stat: effect.stat, pct: -Math.abs(effect.pct), turns: turnsFor(effect) });
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

/**
 * Buff durations are authored in seconds (the real-time era) or in turns.
 * Turns win when given; otherwise a second is worth roughly a third of a turn,
 * which keeps the old data usable without a rewrite of every skill.
 */
function turnsFor(effect) {
  if (effect.turns != null) return effect.turns;
  const seconds = effect.seconds ?? 6;
  return seconds >= 900 ? 9999 : Math.max(1, Math.round(seconds / 3));
}

function dealDamage(battle, attacker, target, effect, ctx = {}) {
  const { amount, crit, guarded } = computeDamage(attacker, target, effect);
  target.hp = Math.max(0, target.hp - amount);
  battle.events.push({
    t: 'damage', uid: target.uid, from: attacker.uid,
    amount, crit, guarded, slot: ctx.slot || null,
  });

  addCharge(attacker, COMBAT.ultimateChargeOnHitDealt);
  addCharge(target, COMBAT.ultimateChargeOnHitTaken);

  if (target.hp <= 0) {
    killUnit(battle, target);
  } else {
    checkLowHpPassive(battle, target);
    checkPhase(battle, target);
  }

  if (!ctx.fromPassive) {
    const passive = attacker.skills.passive;
    if (passive && passive.trigger === 'onHitDealt' && Math.random() < (passive.chance ?? 1)) {
      firePassive(battle, attacker, passive, [target]);
    }
  }
}

/**
 * Boss phases. Crossing an HP threshold transforms the unit once: it takes the
 * phase's effects and, if the phase names one, swaps in a new skill.
 *
 * This is what gives a long fight a shape. Without it a boss at 5% health
 * fights exactly as it did at full.
 */
function checkPhase(battle, unit) {
  if (!unit.phases) return;
  const pct = unit.hp / unit.maxHp;
  unit.phases.forEach((phase, i) => {
    if (unit.phasesFired.has(i) || pct > phase.atPct) return;
    unit.phasesFired.add(i);

    for (const [slot, id] of Object.entries(phase.skills || {})) {
      const skill = getSkill(id);
      if (skill) unit.skills[slot] = skill;
    }
    for (const effect of phase.effects || []) {
      applyEffect(battle, unit, effect, [unit], { slot: 'phase', fromPassive: true });
    }
    // Turning interrupts whatever it was charging — the transformation is the
    // moment, not the attack it was about to throw.
    unit.charging = null;
    battle.events.push({ t: 'phase', uid: unit.uid, name: phase.name, icon: phase.icon || '⚡' });
  });
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
  unit.guarding = false;
  // Killing something mid-charge cancels the hit. That is the payoff for
  // answering a telegraph by removing the caster.
  unit.charging = null;
  battle.events.push({ t: 'death', uid: unit.uid });
}

function checkEnd(battle) {
  if (battle.state !== 'running') return;
  const playersAlive = battle.units.some((u) => u.side === 'player' && u.alive);
  const enemiesAlive = battle.units.some((u) => u.side === 'enemy' && u.alive);

  if (!enemiesAlive) battle.state = 'victory';
  else if (!playersAlive) battle.state = 'defeat';
  else if (battle.turn >= COMBAT.maxTurns) battle.state = 'defeat';
  else return;

  battle.pending = null;
  battle.events.push({ t: 'end', result: battle.state });
}

/* ---------------- the AI ----------------
   Drives the enemy team, and the player's team under auto-battle — so it has
   to be good enough that a farming run is not a worse run. The order is a
   priority list, not a score: simple to reason about and to explain on screen.
*/

function chooseAction(battle, unit) {
  if (!unit || !unit.alive) return null;
  const foes = battle.units.filter((u) => u.side !== unit.side && u.alive);
  if (!foes.length) return { actionId: 'guard', targetUid: null };

  // 1. Ultimate the moment it is up. Held charge does nothing.
  if (unit.ultimateReady && unit.skills.ultimate) {
    return { actionId: 'ultimate', targetUid: pickTarget(battle, unit, unit.skills.ultimate, foes) };
  }

  // 2. Brace for a hit already in the air aimed at this unit, if it is hurt
  //    enough to care. Guarding at full health wastes the turn.
  const incoming = battle.units.some((u) => (
    u.alive && u.side !== unit.side && u.charging
    && (u.charging.skill.targeting === 'allEnemies'
        || resolveTargets(battle, u, u.charging.skill.targeting || 'frontFirst').some((t) => t.uid === unit.uid))
  ));
  if (incoming && unit.hp / unit.maxHp < COMBAT.aiGuardHpThreshold) {
    return { actionId: 'guard', targetUid: null };
  }

  // 3. Technique off cooldown.
  if (unit.skills.technique && unit.techniqueCd <= 0) {
    return { actionId: 'technique', targetUid: pickTarget(battle, unit, unit.skills.technique, foes) };
  }

  // 4. Swing.
  return { actionId: 'attack', targetUid: pickTarget(battle, unit, unit.skills.attack, foes) };
}

/** Finish anything already in range of dying; otherwise take the rule's pick. */
function pickTarget(battle, unit, skill, foes) {
  if (!skill) return foes[0]?.uid ?? null;
  const legal = resolveTargets(battle, unit, skill.targeting || 'frontFirst');
  if (legal.length !== 1) return null;   // AoE and self-targeting ignore the pick
  const finisher = legal.find((t) => t.hp <= estimateDamage(unit, t, skill));
  return (finisher || legal[0]).uid;
}

function estimateDamage(attacker, target, skill) {
  const dmg = (skill.effects || []).find((e) => e.kind === 'damage');
  if (!dmg) return 0;
  const atk = effectiveStat(attacker, 'atk');
  const def = effectiveStat(target, 'def') * (1 - (dmg.defIgnore || 0));
  return atk * (dmg.mult ?? 1) * (COMBAT.defenseConstant / (COMBAT.defenseConstant + def)) * (dmg.hits || 1);
}
