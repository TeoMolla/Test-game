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
    const node = h('div', {
      class: `unit ${unit.side} row-${unit.row}`,
      style: { '--rarity': r.color, '--aura': unit.art?.aura || r.color },
      html: `
        <div class="u-callout"></div>
        <div class="u-fx"></div>
        <div class="u-art">${bodySVG(unit.art, { facing: unit.side === 'player' ? 'right' : 'left' })}</div>
        <div class="u-bar"><span class="u-fill"></span></div>
        <div class="u-name">${unit.name}</div>`,
    });
    lanes[unit.side][unit.row].appendChild(node);
    nodes.set(unit.uid, {
      root: node,
      fill: node.querySelector('.u-fill'),
      fx: node.querySelector('.u-fx'),
      callout: node.querySelector('.u-callout'),
      art: node.querySelector('.u-art'),
    });
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
        <span class="dc-art">${bustSVG(unit.art)}</span>
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
      pulse(n.art, 'hit');
      const from = nodes.get(ev.from);
      if (from && ev.from !== ev.uid) pulse(from.art, 'lunge');
      break;
    }
    case 'heal':
      if (n) floater(n.fx, `+${fmt(ev.amount)}`, 'heal');
      break;
    case 'skill':
      if (n && ev.slot !== 'attack') callout(n.callout, `${ev.icon || ''} ${ev.name}`, ev.slot);
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
      if (n) n.root.classList.add('dead');
      break;
    default:
      break;
  }
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

  for (const unit of battle.units) {
    const n = nodes.get(unit.uid);
    if (!n) continue;
    const pct = Math.max(0, unit.hp / unit.maxHp) * 100;
    n.fill.style.width = `${pct}%`;
    n.fill.classList.toggle('low', pct < 30);

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
  const won = battle.state === 'victory';
  const survivors = battle.units.filter((u) => u.side === 'player' && u.alive).length;
  const seconds = battle.elapsed;

  const rewards = won ? completeStage(stageId) : (recordDefeat(), null);

  setTimeout(() => {
    navigate('results', { stageId, won, survivors, seconds, rewards });
  }, 1000);
}
