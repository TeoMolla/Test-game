/**
 * ui/screens/battle.js — Real-time auto-battle presentation.
 *
 * Side-view lanes: player team on the left, enemies on the right, back row set
 * behind and above the front row. The engine (battle/engine.js) owns the
 * simulation; this file only draws what it emits — HP bars, floating damage
 * numbers, skill call-outs, and the bottom portrait row with each hero's own
 * technique countdown and ultimate-ready indicator.
 */

import { h, fmt, clear } from '../dom.js';
import { bodySVG, bustSVG } from '../avatar.js';
import { spriteSet, bustHTML } from '../sprites.js';
import { createAnimator } from '../spriteAnimator.js';
import { startStageBattle } from '../../battle/index.js';
import { getStage, completeStage, recordDefeat } from '../../progression/index.js';
import { rarityOf, COMBAT, ULTIMATE_MODE } from '../../config.js';
import { navigate } from '../app.js';

let raf = null;
let battle = null;
let nodes = new Map();
let speed = 1;
let finished = false;

export function dispose() {
  if (raf) cancelAnimationFrame(raf);
  for (const n of nodes.values()) n.animator?.stop();
  raf = null;
  battle = null;
  nodes = new Map();
  finished = false;
}

export function render(host, { stageId }) {
  dispose();
  const stage = getStage(stageId);
  battle = startStageBattle(stageId);
  speed = 1;

  const screen = h('div', { class: 'battle-screen' });

  /* ---- top bar ---- */
  const top = h('div', {
    class: 'bt-top',
    html: `
      <span class="bt-stage">${stage ? `${stage.id}. ${stage.name}` : 'Battle'}</span>
      <span class="bt-timer" id="bt-timer">0.0s</span>
      <button class="btn ghost tiny" id="bt-speed">x1</button>`,
  });
  screen.appendChild(top);

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
    const set = spriteSet(unit.heroId);
    const artInner = set
      ? '<div class="u-sprite"><img class="u-frame" alt="" decoding="async"></div><div class="u-beam"></div>'
      : bodySVG(unit.art, { facing: unit.side === 'player' ? 'right' : 'left' });

    const node = h('div', {
      class: `unit ${unit.side} row-${unit.row} ${set ? 'has-sprite' : ''}`,
      style: { '--rarity': r.color, '--aura': unit.art?.aura || r.color },
      html: `
        <div class="u-callout"></div>
        <div class="u-fx"></div>
        <div class="u-art">${artInner}</div>
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
    };

    if (set) {
      const beam = node.querySelector('.u-beam');
      entry.animator = createAnimator(set, node.querySelector('.u-frame'), {
        speed: () => speed,
        onBeam: (ms) => fireBeam(beam, node, unit, ms),
      });
    }
    entry.unit = unit;
    nodes.set(unit.uid, entry);
  }

  /* ---- bottom portrait row (per-hero cooldown timers) ---- */
  const dock = h('div', { class: 'bt-dock' });
  for (const unit of battle.units.filter((u) => u.side === 'player')) {
    const r = rarityOf(unit.rarity);
    const card = h('button', {
      class: 'dock-card',
      style: { '--rarity': r.color, '--glow': r.glow },
      dataset: { uid: unit.uid },
      html: `
        <span class="dc-timer">—</span>
        <span class="dc-art">${bustHTML(unit.heroId, unit.art, bustSVG)}</span>
        <span class="dc-ult"><span class="dc-ult-fill"></span></span>
        <span class="dc-name">${unit.name}</span>
        <span class="dc-hp"><span class="dc-hp-fill"></span></span>`,
    });
    // ULTIMATE_MODE === 'tap' would make this the activation control; in 'auto'
    // the tap is a no-op and the ready state is purely informational.
    card.addEventListener('click', () => {
      if (ULTIMATE_MODE === 'tap') battle.requestUltimate(unit.uid);
    });
    dock.appendChild(card);
    const n = nodes.get(unit.uid);
    n.dock = card;
    n.dockTimer = card.querySelector('.dc-timer');
    n.dockUlt = card.querySelector('.dc-ult-fill');
    n.dockHp = card.querySelector('.dc-hp-fill');
  }
  screen.appendChild(dock);

  host.appendChild(screen);

  // Base positions are read once, before anything is translated, so the
  // advance can be recomputed later without measuring its own effect.
  const arenaBox = arena.getBoundingClientRect();
  for (const n of nodes.values()) {
    const r = n.root.getBoundingClientRect();
    n.baseCX = r.left + r.width / 2 - arenaBox.left;
    n.baseCY = r.top + r.height / 2 - arenaBox.top;
  }
  updateAdvance(true);

  top.querySelector('#bt-speed').addEventListener('click', (ev) => {
    speed = speed === 1 ? 2 : speed === 2 ? 3 : 1;
    ev.currentTarget.textContent = `x${speed}`;
  });

  const timerEl = top.querySelector('#bt-timer');
  let last = performance.now();

  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;

    const events = battle.update(dt * speed);
    for (const ev of events) handleEvent(ev);
    paint(timerEl);

    if (battle.state === 'running') {
      raf = requestAnimationFrame(frame);
    } else if (!finished) {
      finished = true;
      endBattle(stageId);
    }
  };
  raf = requestAnimationFrame(frame);
}

/* ---------------- event -> DOM ---------------- */

function handleEvent(ev) {
  const n = nodes.get(ev.uid);
  switch (ev.t) {
    case 'damage': {
      if (!n) return;
      floater(n.fx, `-${fmt(ev.amount)}`, ev.crit ? 'crit' : (ev.self ? 'self' : 'dmg'));
      const unit = battle.unitById(ev.uid);
      pulse(n.art, 'hit');
      if (n.animator && !ev.self && unit?.alive) {
        // PLACEHOLDER: what counts as a "heavy" hit worth the knockback clip.
        const heavy = ev.crit || ev.amount / unit.maxHp > 0.12;
        n.animator.play(heavy ? 'hit_heavy' : 'hit');
      }
      const from = nodes.get(ev.from);
      if (from && ev.from !== ev.uid && !from.animator) pulse(from.art, 'lunge');
      break;
    }
    case 'heal':
      if (n) floater(n.fx, `+${fmt(ev.amount)}`, 'heal');
      break;
    case 'skill':
      if (!n) break;
      if (ev.slot !== 'attack') callout(n.callout, `${ev.icon || ''} ${ev.name}`, ev.slot);
      if (n.animator) {
        if (ev.slot === 'attack') {
          // Alternate punch and kick so repeated auto-attacks don't loop one pose.
          n.animator.play(n.swings++ % 2 ? 'attack_alt' : 'attack');
        } else if (ev.slot === 'technique' || ev.slot === 'ultimate') {
          n.animator.play(ev.slot);
        }
      }
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
    case 'freeze': {
      // PLACEHOLDER staging for the real cut-in: hold everything but the
      // caster, so the ultimate has the screen to itself.
      const screen = document.querySelector('.battle-screen');
      if (screen) {
        screen.style.setProperty('--freeze-ms', `${Math.round((ev.seconds * 1000) / Math.max(0.25, speed))}ms`);
        screen.classList.add('time-stop');
      }
      for (const other of nodes.values()) other.root.classList.remove('caster');
      if (n) n.root.classList.add('caster');
      break;
    }

    case 'unfreeze': {
      document.querySelector('.battle-screen')?.classList.remove('time-stop');
      for (const other of nodes.values()) other.root.classList.remove('caster');
      break;
    }

    case 'death':
      if (!n) break;
      if (n.animator) {
        // Let the fall play out, then clear the body off the field.
        const ms = n.animator.play('defeat');
        n.root.classList.add('dying');
        clearTimeout(n.deathTimer);
        n.deathTimer = setTimeout(() => n.root.classList.add('dead'), ms);
      } else {
        n.root.classList.add('dead');
      }
      break;
    default:
      break;
  }
}

/**
 * Put every melee unit next to the enemy it is actually fighting.
 *
 * Each attacker runs to the midpoint between itself and its target and squares
 * up there. Attackers sharing a target fan out — the first goes toe to toe, and
 * each one after that stands a step further back and off to one side — which is
 * what makes a group visibly close in on one defender rather than stacking on
 * the same spot. Ranged and back-row units never move.
 *
 * Distances come from the positions captured before anything was translated, so
 * this is safe to re-run whenever targets change or a unit falls.
 * PLACEHOLDER: the spacing constants are feel, not measurement.
 */
const STANDOFF = 56;   // centre-to-centre distance when standing toe to toe
const FAN = 34;        // each extra attacker on the same target stands back this much
const FAN_Y = 18;      // ...and off to one side by this much
const MAX_Y = 26;      // never slide this far vertically; the lanes still read

let advanceSig = '';

function updateAdvance(force = false) {
  const all = [...nodes.values()];
  const sig = all.map((n) => `${n.unit.uid}:${n.unit.targetUid}:${n.unit.alive ? 1 : 0}`).join('|');
  if (!force && sig === advanceSig) return;
  advanceSig = sig;

  const groups = new Map();
  for (const n of all) {
    if (!n.unit.alive || !n.unit.engages) continue;
    const tid = n.unit.targetUid;
    if (!tid) continue;
    if (!groups.has(tid)) groups.set(tid, []);
    groups.get(tid).push(n);
  }

  const ms = Math.round((COMBAT.approachSeconds * 1000) / Math.max(0.25, speed));
  for (const n of all) {
    n.root.style.setProperty('--approach-ms', `${ms}ms`);
  }

  for (const [tid, members] of groups) {
    const target = nodes.get(tid);
    if (!target || !target.unit.alive) continue;
    members.forEach((n, i) => {
      const dir = n.unit.side === 'player' ? 1 : -1;
      // Meet in the middle of the pair rather than running to where the target
      // is standing now — the target is usually charging too, and aiming at its
      // starting spot makes the two of them run straight past each other.
      const meetX = (n.baseCX + target.baseCX) / 2;
      const wantX = meetX - dir * (STANDOFF / 2 + i * FAN);
      // i === 0 squares up; the rest peel off alternating sides
      const offsetY = i === 0 ? 0 : (i % 2 ? -FAN_Y : FAN_Y);
      const dx = wantX - n.baseCX;
      const dy = Math.max(-MAX_Y, Math.min(MAX_Y, target.baseCY + offsetY - n.baseCY));
      // Nobody retreats to engage.
      const clampedX = dir > 0 ? Math.max(0, dx) : Math.min(0, dx);
      n.root.style.setProperty('--advance-x', `${Math.round(clampedX)}px`);
      n.root.style.setProperty('--advance-y', `${Math.round(dy)}px`);
      // Depth order by final height on screen: lower is nearer the viewer, so a
      // unit that peeled downward covers the one it stepped in front of rather
      // than showing through it.
      n.root.style.zIndex = String(2 + Math.round(n.baseCY + dy));
      n.root.classList.add('engaged');
    });
  }
}

/**
 * The release frame draws the hands thrust forward but no beam, so the beam is
 * a DOM effect — which also lets it stretch to actually reach its target.
 */
function fireBeam(beam, casterNode, unit, ms) {
  const foe = battle.units.find((u) => u.side !== unit.side && u.alive);
  const foeNode = foe && nodes.get(foe.uid)?.root;
  let len = 150;                                  // PLACEHOLDER fallback length
  if (foeNode) {
    const a = casterNode.getBoundingClientRect();
    const b = foeNode.getBoundingClientRect();
    len = Math.max(70, Math.abs((unit.side === 'player' ? b.left - a.right : a.left - b.right)) + 40);
  }
  beam.style.setProperty('--beam-len', `${Math.round(len)}px`);
  beam.style.setProperty('--beam-ms', `${Math.round(ms)}ms`);
  beam.classList.remove('fire');
  void beam.offsetWidth;                          // restart the animation
  beam.classList.add('fire');
  setTimeout(() => beam.classList.remove('fire'), ms + 60);
}

function floater(host, text, kind) {
  const node = h('span', { class: `float ${kind}`, text });
  // PLACEHOLDER: jitter so simultaneous numbers don't stack into one
  // unreadable blob. Vertical offset matters more than horizontal.
  node.style.setProperty('--dx', `${(Math.random() * 46 - 23).toFixed(0)}px`);
  node.style.setProperty('--dy', `${(Math.random() * 26 - 8).toFixed(0)}px`);
  host.appendChild(node);
  setTimeout(() => node.remove(), 950);
}

function callout(host, text, kind) {
  host.textContent = text;
  host.className = `u-callout show ${kind}`;
  clearTimeout(host._t);
  host._t = setTimeout(() => { host.className = 'u-callout'; }, 900);
}

function pulse(node, cls) {
  node.classList.remove(cls);
  // force reflow so the animation restarts on rapid repeat hits
  void node.offsetWidth;
  node.classList.add(cls);
}

/* ---------------- per-frame paint ---------------- */

function paint(timerEl) {
  timerEl.textContent = `${battle.elapsed.toFixed(1)}s`;
  updateAdvance();   // cheap: only rewrites when a target or a life changes

  for (const unit of battle.units) {
    const n = nodes.get(unit.uid);
    if (!n) continue;
    const pct = Math.max(0, unit.hp / unit.maxHp) * 100;
    n.fill.style.width = `${pct}%`;
    n.fill.classList.toggle('low', pct < 30);

    // Resting pose: closing the distance, badly hurt, or neither.
    // PLACEHOLDER threshold for "badly hurt".
    const closing = unit.alive && battle.elapsed < unit.readyAt;
    n.root.classList.toggle('advancing', closing);
    if (unit.alive) {
      n.animator?.setIdleFrame(closing ? 'guard' : pct < 25 ? 'heavy_stun' : 'idle');
    }

    if (!n.dock) continue;
    n.dockHp.style.width = `${pct}%`;

    if (!unit.alive) {
      n.dock.classList.add('down');
      n.dockTimer.textContent = 'KO';
      n.dockUlt.style.width = '0%';
      continue;
    }

    // Individual technique cooldown countdown, as in the reference dock.
    if (unit.skills.technique) {
      n.dockTimer.textContent = `${Math.max(0, unit.techniqueTimer).toFixed(1)}s`;
    } else {
      n.dockTimer.textContent = '—';
    }

    const chargePct = unit.skills.ultimate
      ? (unit.ultimateCharge / COMBAT.ultimateChargeMax) * 100
      : 0;
    n.dockUlt.style.width = `${Math.min(100, chargePct)}%`;
    n.dock.classList.toggle('ult-ready', !!unit.ultimateReady);
  }
}

/* ---------------- resolution ---------------- */

function endBattle(stageId) {
  // A finishing ultimate ends the battle on the tick that started the
  // time-stop, so the matching 'unfreeze' never arrives. Clear it here.
  document.querySelector('.battle-screen')?.classList.remove('time-stop');
  for (const n of nodes.values()) n.root.classList.remove('caster');

  const won = battle.state === 'victory';
  const survivors = battle.units.filter((u) => u.side === 'player' && u.alive).length;
  const seconds = battle.elapsed;

  const rewards = won ? completeStage(stageId) : (recordDefeat(), null);

  setTimeout(() => {
    navigate('results', { stageId, won, survivors, seconds, rewards });
  }, 1000);
}
