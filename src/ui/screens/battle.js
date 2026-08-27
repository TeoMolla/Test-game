/**
 * ui/screens/battle.js — Turn-based battle presentation.
 *
 * The engine (battle/engine.js) owns the fight and knows nothing about the
 * DOM; this file drives it one turn at a time and draws what it emits.
 *
 * The loop is deliberately not a frame loop. It asks the engine to open a
 * turn, plays that turn's events with enough delay to read them, and then
 * either waits for the player to choose (their hero's turn, auto off) or lets
 * the AI choose and carries on. Nothing here runs on requestAnimationFrame,
 * so a fight cannot drift out of step with the simulation.
 *
 * Three things carry the readability:
 *   - the TURN ORDER strip, so "who acts next" is never a guess
 *   - a CHARGING marker on the caster and everyone it is aimed at, so a heavy
 *     hit is a problem you have a turn to answer
 *   - the ACTION BAR, which only ever shows what the engine says is legal
 */

import { h, fmt, clear } from '../dom.js';
import { bodySVG, bustSVG } from '../avatar.js';
import { spriteSet, bustHTML } from '../sprites.js';
import { createAnimator } from '../spriteAnimator.js';
import { startEncounterBattle } from '../../battle/index.js';
import { encounterInfo, completeEncounter, recordDefeat } from '../../progression/index.js';
import { rarityOf } from '../../config.js';
import { navigate } from '../app.js';

let battle = null;
let nodes = new Map();
let speed = 1;
let finished = false;
let timers = [];
let selectedTarget = null;
let els = {};

/**
 * Which sprite set a unit draws from. Heroes carry a heroId, enemies a defId,
 * and either can have drawn art or fall back to the CSS placeholder.
 */
function artId(unit) {
  return unit.heroId || unit.defId || null;
}

/** Per-set drawing corrections: relative size, and a recolour for variants. */
function artStyle(set) {
  if (!set) return '';
  const bits = [];
  if (set.filter) bits.push(`filter:${set.filter}`);
  if (set.scale) bits.push(`--sprite-scale:${set.scale}`);
  return bits.length ? ` style="${bits.join(';')}"` : '';
}

/** Base beats, in ms at x1. Everything else is derived from these. */
const PACE = { open: 140, act: 620, big: 900, death: 480, cutIn: 1150 };

/**
 * HIT STOP — the single cheapest trick in game feel. On contact the whole
 * world holds for a few frames before the damage number flies, which is what
 * makes a hit land rather than merely happen. Scaled by how big the hit was.
 */
function hitStopMs(fraction) {
  if (fraction >= 0.18) return 150;
  if (fraction >= 0.08) return 100;
  return 60;
}

function wait(ms, fn) {
  const id = setTimeout(fn, Math.max(16, ms / speed));
  timers.push(id);
  return id;
}

export function dispose() {
  for (const id of timers) clearTimeout(id);
  timers = [];
  for (const n of nodes.values()) n.animator?.stop();
  battle = null;
  nodes = new Map();
  els = {};
  selectedTarget = null;
  finished = false;
}

export function render(host, { ref }) {
  dispose();
  const info = encounterInfo(ref);
  battle = startEncounterBattle(ref);
  speed = 1;

  const screen = h('div', { class: 'battle-screen' });

  /* ---- top bar ---- */
  const top = h('div', {
    class: 'bt-top',
    html: `
      <span class="bt-stage">${info ? info.title : 'Battle'}</span>
      <span class="bt-timer" id="bt-turn">T1</span>
      <button class="btn ghost tiny" id="bt-auto">AUTO</button>
      <button class="btn ghost tiny" id="bt-speed">x1</button>
      <button class="btn ghost tiny" id="bt-retreat">Retreat</button>`,
  });
  screen.appendChild(top);

  /* ---- turn order ---- */
  const order = h('div', { class: 'turn-order', id: 'turn-order' });
  screen.appendChild(order);

  /* ---- arena ---- */
  const arena = h('div', { class: 'arena' });
  const sides = {
    player: h('div', { class: 'side side-player' }),
    enemy: h('div', { class: 'side side-enemy' }),
  };
  const lanes = {
    player: { back: h('div', { class: 'lane lane-back' }), front: h('div', { class: 'lane lane-front' }) },
    enemy: { front: h('div', { class: 'lane lane-front' }), back: h('div', { class: 'lane lane-back' }) },
  };
  sides.player.append(lanes.player.back, lanes.player.front);
  sides.enemy.append(lanes.enemy.front, lanes.enemy.back);
  arena.append(sides.player, sides.enemy);
  screen.appendChild(arena);

  for (const unit of battle.units) {
    const r = rarityOf(unit.rarity);
    const set = spriteSet(artId(unit));
    const artInner = set
      ? '<div class="u-sprite"><img class="u-frame" alt="" decoding="async"></div><div class="u-beam"></div>'
      : bodySVG(unit.art, { facing: unit.side === 'player' ? 'right' : 'left' });

    const node = h('div', {
      class: `unit ${unit.side} row-${unit.row} ${set ? 'has-sprite' : ''}`,
      style: { '--rarity': r.color, '--aura': unit.art?.aura || r.color },
      dataset: { uid: unit.uid },
      html: `
        <div class="u-callout"></div>
        <div class="u-fx"></div>
        <div class="u-art"${artStyle(set)}>${artInner}</div>
        <div class="u-bar"><span class="u-fill"></span></div>
        <div class="u-name">${unit.name}</div>`,
    });
    lanes[unit.side][unit.row].appendChild(node);

    const entry = {
      root: node,
      fill: node.querySelector('.u-fill'),
      fx: node.querySelector('.u-fx'),
      callout: node.querySelector('.u-callout'),
      art: node.querySelector('.u-art'),
      swings: 0,
      unit,
    };
    if (set) {
      const beam = node.querySelector('.u-beam');
      entry.animator = createAnimator(set, node.querySelector('.u-frame'), {
        speed: () => speed,
        onBeam: (ms) => fireBeam(beam, node, unit, ms),
      });
    }
    nodes.set(unit.uid, entry);

    // Tapping an enemy picks it as the target for your next action.
    if (unit.side === 'enemy') {
      node.addEventListener('click', () => {
        if (!unit.alive || !battle.awaitingInput()) return;
        selectedTarget = selectedTarget === unit.uid ? null : unit.uid;
        paintTargets();
      });
    }
  }

  /* ---- team status ---- */
  const dock = h('div', { class: 'bt-dock' });
  for (const unit of battle.units.filter((u) => u.side === 'player')) {
    const r = rarityOf(unit.rarity);
    const card = h('div', {
      class: 'dock-card',
      style: { '--rarity': r.color, '--glow': r.glow },
      dataset: { uid: unit.uid },
      html: `
        <span class="dc-art">${bustHTML(artId(unit), unit.art, bustSVG)}</span>
        <span class="dc-ult"><span class="dc-ult-fill"></span></span>
        <span class="dc-name">${unit.name}</span>
        <span class="dc-hp"><span class="dc-hp-fill"></span></span>`,
    });
    dock.appendChild(card);
    const n = nodes.get(unit.uid);
    n.dock = card;
    n.dockUlt = card.querySelector('.dc-ult-fill');
    n.dockHp = card.querySelector('.dc-hp-fill');
  }
  screen.appendChild(dock);

  /* ---- action bar ---- */
  const actions = h('div', { class: 'action-bar-battle', id: 'action-bar' });
  screen.appendChild(actions);

  host.appendChild(screen);

  els = {
    turn: top.querySelector('#bt-turn'),
    order,
    actions,
    auto: top.querySelector('#bt-auto'),
  };

  top.querySelector('#bt-speed').addEventListener('click', (ev) => {
    speed = speed === 1 ? 2 : speed === 2 ? 3 : 1;
    ev.currentTarget.textContent = `x${speed}`;
  });

  els.auto.classList.toggle('on', battle.auto);
  els.auto.addEventListener('click', () => {
    battle.setAuto(!battle.auto);
    els.auto.classList.toggle('on', battle.auto);
    // Turning auto on mid-fight should take the turn it is already waiting on.
    // `ref` has to travel with it — the loop carries the encounter all the way
    // to the results screen, and dropping it here lands a dungeon win on the
    // campaign's results.
    if (battle.auto && battle.pending) { clearActions(); step(ref); }
    else if (!battle.auto && battle.pending?.isPlayer) showActions(ref);
  });

  const retreatBtn = top.querySelector('#bt-retreat');
  let retreatArmed = false;
  retreatBtn.addEventListener('click', () => {
    if (!retreatArmed) {
      retreatArmed = true;
      retreatBtn.textContent = 'Give up?';
      retreatBtn.classList.add('danger');
      wait(3000 * speed, () => {
        if (!retreatArmed) return;
        retreatArmed = false;
        retreatBtn.textContent = 'Retreat';
        retreatBtn.classList.remove('danger');
      });
      return;
    }
    battle.retreat();
    paintAll();
    endBattle(ref);
  });

  paintAll();
  step(ref);
}

/* ---------------- the turn loop ---------------- */

function step(ref) {
  if (!battle) return;
  if (battle.state !== 'running') return endBattle(ref);

  if (battle.pending) {
    if (battle.awaitingInput()) { showActions(ref); return; }
    // AI turn (an enemy, or one of yours under auto-battle). The bar says who
    // is acting rather than going blank — the space is reserved either way.
    showActing(battle.unitById(battle.pending.uid));
    wait(PACE.open, () => {
      if (!battle || battle.state !== 'running') return endBattle(ref);
      battle.takeAiTurn();
      playEvents(battle.events, () => step(ref));
    });
    return;
  }

  const events = battle.advance();
  playEvents(events, () => step(ref), PACE.open);
}

/**
 * Draw a turn's events, then continue. Everything lands at once in the
 * simulation; the pacing here is purely so a person can read it.
 *
 * An ultimate or a boss phase is split into two beats: the announce plays
 * alone with the screen to itself, and only when the cut-in clears does the
 * damage land. Rendering them together is what made a finisher read as one
 * more number a moment ago.
 */
function playEvents(events, done, lead = 0) {
  const cut = events.findIndex((e) => e.t === 'phase'
    || (e.t === 'skill' && e.slot === 'ultimate')
    || (e.t === 'release' && e.slot === 'ultimate'));

  if (cut >= 0 && !lead) {
    for (const ev of events.slice(0, cut + 1)) handleEvent(ev);
    paintAll();
    const ms = playCutIn(events[cut]);
    wait(ms, () => {
      for (const ev of events.slice(cut + 1)) handleEvent(ev);
      paintAll();
      settle(events, done);
    });
    return;
  }

  for (const ev of events) handleEvent(ev);
  paintAll();
  if (lead) { wait(lead, done); return; }
  settle(events, done);
}

/** Hold on the impact, then carry on. */
function settle(events, done) {
  const hit = events.filter((e) => e.t === 'damage' && !e.self);
  const died = events.some((e) => e.t === 'death');
  const ended = events.some((e) => e.t === 'end');

  let stop = 0;
  if (hit.length) {
    const worst = Math.max(...hit.map((e) => {
      const u = battle.unitById(e.uid);
      return u ? e.amount / u.maxHp : 0;
    }));
    stop = hitStopMs(worst);
    shake(worst);
    const screen = document.querySelector('.battle-screen');
    screen?.classList.add('hitstop');
    wait(stop, () => screen?.classList.remove('hitstop'));
  }

  const beat = stop + PACE.act + (died ? PACE.death : 0);
  wait(ended ? PACE.big : beat, done);
}

/* ---------------- player input ---------------- */

function clearActions() {
  if (els.actions) clear(els.actions);
  for (const n of nodes.values()) n.root.classList.remove('acting');
  selectedTarget = null;
  paintTargets();
}

function showActing(unit) {
  if (!els.actions || !unit) return;
  clear(els.actions);
  for (const n of nodes.values()) n.root.classList.toggle('acting', n.unit.uid === unit.uid);
  els.actions.appendChild(h('div', {
    class: 'ab-who waiting',
    text: unit.side === 'player' ? `${unit.name} — auto` : `${unit.name} acts`,
  }));
}

function showActions(ref) {
  const uid = battle.pending?.uid;
  const unit = battle.unitById(uid);
  if (!unit) return;

  for (const n of nodes.values()) n.root.classList.toggle('acting', n.unit.uid === uid);
  clear(els.actions);

  const label = h('div', { class: 'ab-who', text: `${unit.name}'s turn` });
  els.actions.appendChild(label);

  const row = h('div', { class: 'ab-row' });
  for (const action of battle.actions(uid)) {
    const sub = action.id === 'technique' && !action.ready ? `${action.cooldown} turn${action.cooldown === 1 ? '' : 's'}`
      : action.id === 'ultimate' && !action.ready ? `${Math.floor((action.charge / action.chargeMax) * 100)}%`
      : '';
    const btn = h('button', {
      class: `ab-btn ${action.id} ${action.ready ? '' : 'disabled'}`,
      html: `<span class="ab-ico">${action.skill.icon || '•'}</span>
             <span class="ab-name">${action.skill.name}</span>
             ${sub ? `<span class="ab-sub">${sub}</span>` : ''}`,
    });
    if (action.ready) {
      btn.addEventListener('click', () => {
        if (!battle.awaitingInput()) return;
        clearActions();
        battle.act(action.id, selectedTarget);
        playEvents(battle.events, () => step(ref));
      });
    }
    row.appendChild(btn);
  }
  els.actions.appendChild(row);
  paintTargets();
}

/* ---------------- events -> DOM ---------------- */

function handleEvent(ev) {
  const n = nodes.get(ev.uid);
  switch (ev.t) {
    case 'turnStart':
      break;

    case 'damage': {
      if (!n) return;
      const unit = battle.unitById(ev.uid);
      const frac = unit ? ev.amount / unit.maxHp : 0;
      const heavy = ev.crit || frac > 0.12;
      floater(n.fx, `-${fmt(ev.amount)}`, ev.crit ? 'crit' : (ev.self ? 'self' : 'dmg'), heavy);
      if (ev.guarded) floater(n.fx, 'GUARD', 'guard');
      if (!ev.self) impact(n, heavy);
      pulse(n.art, 'hit');
      if (n.animator && !ev.self && unit?.alive) {
        n.animator.play(heavy ? 'hit_heavy' : 'hit');
      }
      break;
    }

    case 'heal':
      if (n) floater(n.fx, `+${fmt(ev.amount)}`, 'heal');
      break;

    case 'guard':
      if (n) { callout(n.callout, `${ev.icon} ${ev.name}`, 'guard'); n.root.classList.add('guarding'); }
      break;

    case 'skill': {
      if (!n) break;
      if (ev.slot !== 'ultimate') callout(n.callout, `${ev.icon || ''} ${ev.name}`, ev.slot);
      n.root.classList.remove('guarding');
      if (n.animator) {
        if (ev.slot === 'attack') n.animator.play(n.swings++ % 2 ? 'attack_alt' : 'attack');
        else if (ev.slot === 'technique' || ev.slot === 'ultimate') n.animator.play(ev.slot);
      }
      // Melee crosses the gap; anything with reach plants and fires.
      const melee = ev.slot === 'attack' && n.unit.engages;
      const first = (ev.targets || [])[0];
      if (first) lunge(ev.uid, first, melee ? 'attack' : 'cast');
      break;
    }

    // Announced now, lands at the start of this unit's next turn. Both the
    // caster and everyone in the blast are marked until it goes off.
    case 'charge': {
      if (n) {
        n.root.classList.add('charging');
        callout(n.callout, `${ev.icon || ''} ${ev.name}`, 'charge');
      }
      for (const uid of ev.targets || []) nodes.get(uid)?.root.classList.add('threatened');
      break;
    }

    case 'release': {
      if (n) {
        n.root.classList.remove('charging');
        n.animator?.play('ultimate');
      }
      for (const other of nodes.values()) other.root.classList.remove('threatened');
      break;
    }

    // The cut-in names the move in 30px display type, so the callout pill and
    // the old centre banner would be the same words three times over.
    case 'phase':
      if (n) n.root.classList.add('phased');
      break;

    case 'passive':
      if (n) callout(n.callout, `${ev.icon || ''} ${ev.name}`, 'passive');
      break;

    case 'buff':
      if (n) floater(n.fx, `${ev.stat.toUpperCase()} ▲`, 'buff');
      break;

    case 'debuff':
      if (n) floater(n.fx, `${ev.stat.toUpperCase()} ▼`, 'debuff');
      break;

    case 'death':
      if (!n) break;
      n.root.classList.remove('charging', 'threatened', 'guarding');
      if (n.animator) {
        const ms = n.animator.play('defeat');
        n.root.classList.add('dying');
        wait(ms * speed, () => n.root.classList.add('dead'));
      } else {
        n.root.classList.add('dead');
      }
      break;

    default:
      break;
  }
}

/* ---------------- painting ---------------- */

function paintAll() {
  if (!battle) return;
  if (els.turn) els.turn.textContent = `T${battle.turn}`;

  for (const unit of battle.units) {
    const n = nodes.get(unit.uid);
    if (!n) continue;
    const pct = Math.max(0, unit.hp / unit.maxHp) * 100;
    n.fill.style.width = `${pct}%`;
    n.fill.classList.toggle('low', pct < 30);
    n.root.classList.toggle('guarding', !!unit.guarding && unit.alive);
    if (unit.alive) n.animator?.setIdleFrame(pct < 25 ? 'heavy_stun' : 'idle');

    if (!n.dock) continue;
    n.dockHp.style.width = `${pct}%`;
    n.dock.classList.toggle('down', !unit.alive);
    const chargePct = unit.skills.ultimate ? unit.ultimateCharge : 0;
    n.dockUlt.style.width = `${Math.min(100, chargePct)}%`;
    n.dock.classList.toggle('ult-ready', !!unit.ultimateReady && unit.alive);
  }
  paintOrder();
  paintTargets();
}

/** The next several turns, soonest first. */
function paintOrder() {
  if (!els.order) return;
  clear(els.order);
  const upcoming = battle.preview(7);
  upcoming.forEach((uid, i) => {
    const unit = battle.unitById(uid);
    if (!unit) return;
    const r = rarityOf(unit.rarity);
    els.order.appendChild(h('div', {
      class: `to-pip ${unit.side} ${i === 0 ? 'now' : ''}`,
      style: { '--rarity': r.color },
      html: `<span class="to-art">${bustHTML(artId(unit), unit.art, bustSVG)}</span>
             ${unit.charging ? '<span class="to-flag">⚠</span>' : ''}`,
    }));
  });
}

/** Which enemy the next action will hit. */
function paintTargets() {
  const picking = !!battle && battle.awaitingInput();
  for (const n of nodes.values()) {
    const selectable = picking && n.unit.side === 'enemy' && n.unit.alive;
    n.root.classList.toggle('selectable', selectable);
    n.root.classList.toggle('selected', selectable && n.unit.uid === selectedTarget);
  }
}

/* ---------------- impact ---------------- */

/**
 * The attacker crosses the gap and comes back. Anticipation, contact,
 * follow-through — standing still and emitting a number is what made every
 * hit read the same weight regardless of what it was.
 */
function lunge(attacker, targetUid, kind = 'attack') {
  const a = nodes.get(attacker);
  const t = nodes.get(targetUid);
  if (!a || !t) return;
  const ab = a.root.getBoundingClientRect();
  const tb = t.root.getBoundingClientRect();
  // Stop short of the target rather than standing inside it.
  const gap = a.unit.side === 'player' ? -58 : 58;
  const dx = Math.round((tb.left + tb.width / 2) - (ab.left + ab.width / 2) + gap);
  const dy = Math.round((tb.top + tb.height / 2) - (ab.top + ab.height / 2));
  a.root.style.setProperty('--lunge-x', `${dx}px`);
  a.root.style.setProperty('--lunge-y', `${dy}px`);
  a.root.style.setProperty('--lunge-ms', `${Math.round(520 / speed)}ms`);
  a.root.classList.remove('lunging', 'stepping');
  void a.root.offsetWidth;
  a.root.classList.add(kind === 'attack' ? 'lunging' : 'stepping');
  wait(560, () => a.root.classList.remove('lunging', 'stepping'));
}

/** Screen shake, scaled by how much of the target's health went. */
function shake(fraction) {
  const screen = document.querySelector('.battle-screen');
  if (!screen) return;
  const cls = fraction >= 0.18 ? 'shake-lg' : fraction >= 0.07 ? 'shake-md' : 'shake-sm';
  screen.classList.remove('shake-sm', 'shake-md', 'shake-lg');
  void screen.offsetWidth;
  screen.classList.add(cls);
  wait(420, () => screen.classList.remove(cls));
}

/** White flash and an expanding ring at the point of contact. */
function impact(node, big) {
  const fx = h('span', { class: `impact ${big ? 'big' : ''}` });
  node.fx.appendChild(fx);
  setTimeout(() => fx.remove(), 500);
  node.art.classList.remove('flashed');
  void node.art.offsetWidth;
  node.art.classList.add('flashed');
}

/**
 * The cut-in: the screen darkens, speed lines rake across it, the caster's
 * portrait slides in and the move is named. This is the whole reason an
 * ultimate is worth saving a turn for, and a boss turning gets the same
 * treatment because it is the same kind of moment.
 * Returns how long to hold before the damage lands.
 */
function playCutIn(ev) {
  const screen = document.querySelector('.battle-screen');
  const unit = battle.unitById(ev.uid);
  if (!screen || !unit) return PACE.big;

  const r = rarityOf(unit.rarity);
  const phase = ev.t === 'phase';
  const node = h('div', {
    class: `cut-in ${unit.side} ${phase ? 'phase' : ''}`,
    style: { '--rarity': r.color, '--aura': unit.art?.aura || r.color },
    html: `
      <div class="ci-lines"></div>
      <div class="ci-body">
        <div class="ci-portrait">${bustHTML(artId(unit), unit.art, bustSVG)}</div>
        <div class="ci-text">
          <div class="ci-who">${unit.name}</div>
          <div class="ci-move">${ev.name}</div>
        </div>
      </div>`,
  });
  node.style.setProperty('--cut-ms', `${Math.round(PACE.cutIn / speed)}ms`);
  screen.appendChild(node);
  const ms = PACE.cutIn / speed;
  setTimeout(() => node.remove(), ms + 120);

  // The caster keeps the light while everything else is held down.
  screen.classList.add('cinematic');
  wait(PACE.cutIn, () => screen.classList.remove('cinematic'));
  for (const n of nodes.values()) n.root.classList.toggle('spotlit', n.unit.uid === ev.uid);
  wait(PACE.cutIn, () => { for (const n of nodes.values()) n.root.classList.remove('spotlit'); });

  return PACE.cutIn;
}

/* ---------------- fx helpers ---------------- */

function fireBeam(beam, node, unit, ms) {
  const target = battle.units.find((u) => u.side !== unit.side && u.alive);
  const tn = target && nodes.get(target.uid);
  let len = 150;
  if (tn) {
    const a = node.getBoundingClientRect();
    const b = tn.root.getBoundingClientRect();
    len = Math.max(60, Math.abs((b.left + b.width / 2) - (a.left + a.width / 2)) - 30);
  }
  beam.style.setProperty('--beam-len', `${Math.round(len)}px`);
  beam.style.setProperty('--beam-ms', `${Math.round(ms)}ms`);
  beam.classList.remove('fire');
  void beam.offsetWidth;
  beam.classList.add('fire');
}

/**
 * Numbers scatter so simultaneous hits stay readable, but they scatter INWARD:
 * a big crit on the rightmost enemy used to run off the side of the phone.
 */
function floater(host, text, kind, heavy = false) {
  const node = h('span', { class: `float ${kind} ${heavy ? 'heavy' : ''}`, text });
  const unit = host.closest('.unit');
  const bias = unit?.classList.contains('enemy') ? -30 : 24;
  node.style.setProperty('--dx', `${(bias + Math.random() * 30 - 15).toFixed(0)}px`);
  node.style.setProperty('--dy', `${(Math.random() * 26 - 8).toFixed(0)}px`);
  host.appendChild(node);
  setTimeout(() => node.remove(), 1100);
}

function callout(host, text, kind) {
  host.textContent = text;
  host.className = `u-callout show ${kind}`;
  clearTimeout(host._t);
  host._t = setTimeout(() => { host.className = 'u-callout'; }, 1100);
}

function pulse(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

/* ---------------- resolution ---------------- */

function endBattle(ref) {
  if (finished) return;
  finished = true;
  clearActions();

  const won = battle.state === 'victory';
  const survivors = battle.units.filter((u) => u.side === 'player' && u.alive).length;
  const turns = battle.turn;

  const rewards = won ? completeEncounter(ref) : (recordDefeat(), null);

  wait(700, () => {
    navigate('results', { ref, won, survivors, turns, rewards });
  });
}
