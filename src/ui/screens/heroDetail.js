/**
 * ui/screens/heroDetail.js — Hero detail with Stats / Stars / Skills tabs,
 * mirroring the reference hero screens (gear slots around the portrait,
 * star promotion with a stat preview, locked skill slots).
 */

import { h, fmt, onAction, starRow, toast, clear } from '../dom.js';
import { bustSVG } from '../avatar.js';
import { portraitHTML } from '../sprites.js';
import {
  getHeroDef, heroSave, statsFor, powerOf, slotsFor,
  promoteInfo, promote, xpInfo, isProtagonist, trainInfo, trainAlly,
} from '../../hero/index.js';
import { rarityOf, MAX_STARS } from '../../config.js';
import { GEAR_SLOTS, GEAR_SLOT_META, getGearDef, describeGear } from '../../gear/index.js';
import * as inventory from '../../inventory/index.js';
import { refresh } from '../app.js';

let activeTab = 'stats';

export function render(host, { heroId }) {
  const def = getHeroDef(heroId);
  const hs = heroSave(heroId);
  if (!def || !hs?.owned) {
    host.appendChild(h('p', { class: 'note', text: 'Hero not unlocked.' }));
    return;
  }
  const rarity = rarityOf(def.rarity);
  host.style.setProperty('--rarity', rarity.color);
  host.style.setProperty('--glow', rarity.glow);

  host.appendChild(h('div', {
    class: 'hero-hero',
    html: `
      <span class="rarity-badge">${rarity.name}</span>
      ${isProtagonist(heroId) ? '<span class="lead-badge">Hero</span>' : ''}
      <div class="hero-name">${def.name}</div>
      <div class="hero-title">${def.title}</div>`,
  }));

  const body = h('div', { class: 'tab-body' });
  const tabs = h('div', {
    class: 'tab-bar',
    html: ['stats', 'stars', 'skills']
      .map((t) => `<button class="tab-btn ${t === activeTab ? 'active' : ''}" data-action="tab" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`)
      .join(''),
  });

  host.appendChild(body);
  host.appendChild(tabs);

  const draw = () => {
    clear(body);
    if (activeTab === 'stats') renderStats(body, heroId);
    else if (activeTab === 'stars') renderStars(body, heroId);
    else renderSkills(body, heroId);
  };
  draw();

  onAction(host, {
    tab: (el) => {
      activeTab = el.dataset.tab;
      for (const b of tabs.querySelectorAll('.tab-btn')) b.classList.toggle('active', b.dataset.tab === activeTab);
      draw();
    },
  });
}

/* ---------------- Stats tab ---------------- */

function renderStats(body, heroId) {
  const def = getHeroDef(heroId);
  const hs = heroSave(heroId);
  const stats = statsFor(heroId);
  const lead = isProtagonist(heroId);
  const lvl = xpInfo(heroId);
  const train = lead ? null : trainInfo(heroId);

  // Gear is the protagonist's alone; allies have no equipment slots.
  const gearNodes = !isProtagonist(heroId) ? '' : GEAR_SLOTS.map((slot) => {
    const uid = hs.equipped[slot];
    const inst = uid ? inventory.gearByUid(uid) : null;
    const gdef = inst ? getGearDef(inst.defId) : null;
    return `<button class="gear-slot slot-${slot} ${gdef ? 'filled' : ''}"
              data-action="gear" data-slot="${slot}"
              style="--gr:${gdef ? rarityOf(gdef.rarity).color : 'transparent'}"
              aria-label="${GEAR_SLOT_META[slot].name}">
              <span class="gi">${gdef ? gdef.icon : GEAR_SLOT_META[slot].icon}</span>
            </button>`;
  }).join('');

  body.appendChild(h('div', {
    class: `portrait-stage ${isProtagonist(heroId) ? '' : 'no-gear'}`,
    html: `
      <div class="portrait-art">${portraitHTML(heroId, def.art, bustSVG)}</div>
      ${gearNodes}
      <div class="power-plate">⚡ ${fmt(powerOf(heroId))}</div>`,
  }));

  body.appendChild(h('div', {
    class: 'stat-panel',
    html: `
      <div class="level-line">Lv.${lvl.level}</div>
      ${lead ? `
        <div class="xp-track" role="img" aria-label="${lvl.atMax ? 'Max level' : `${fmt(lvl.into)} of ${fmt(lvl.needed)} XP`}">
          <span class="xp-fill" style="width:${lvl.pct}%"></span>
        </div>
        <div class="xp-line">${lvl.atMax ? 'Max level' : `${fmt(lvl.into)} / ${fmt(lvl.needed)} XP to Lv.${lvl.level + 1}`}</div>`
        : `<div class="xp-line">Trained, not blooded · cap Lv.${train.cap}</div>`}
      <div class="stat-grid">
        <div class="stat"><span class="sn">⚔️ ATK</span><span class="sv">${fmt(stats.atk)}</span></div>
        <div class="stat"><span class="sn">❤️ HP</span><span class="sv">${fmt(stats.hp)}</span></div>
        <div class="stat"><span class="sn">🛡️ DEF</span><span class="sv">${fmt(stats.def)}</span></div>
        <div class="stat"><span class="sn">💨 SPD</span><span class="sv">${stats.speed.toFixed(2)}</span></div>
      </div>
      ${lead ? '' : `
        <button class="btn primary wide ${train.canTrain ? '' : 'disabled'}" data-action="train">
          ${train.atMax ? 'Max Level'
            : train.atCap ? `Limited by your hero (Lv.${train.cap})`
            : `Train <span class="cost">🫘 ${train.senzuCost} · 💰 ${fmt(train.zeniCost)}</span>`}
        </button>`}`,
  }));

  body.appendChild(h('p', {
    class: 'note',
    text: lead
      ? `${def.lore} Levels come from fighting — clear stages to earn XP.`
      : `${def.lore} Allies train rather than fight for it: senzu beans and zeni, and they never pass your hero's level.`,
  }));

  onAction(body, {
    gear: (el) => openGearSheet(heroId, el.dataset.slot),
    train: () => {
      const info = trainInfo(heroId);
      if (trainAlly(heroId)) { toast('Trained!', 'good'); refresh(); }
      else if (info?.atCap) toast(`Your hero must reach Lv.${info.cap + 1} first.`, 'warn');
      else if (info && info.haveSenzu < info.senzuCost) toast('Not enough senzu beans.', 'warn');
      else toast('Not enough zeni.', 'warn');
    },
  });
}

/* ---------------- Stars tab ---------------- */

function renderStars(body, heroId) {
  const info = promoteInfo(heroId);
  const slots = slotsFor(heroId);

  const statRows = ['atk', 'hp', 'def'].map((k) => `
    <div class="promo-row">
      <span class="pk">${k.toUpperCase()}</span>
      <span class="pv">${fmt(info.current[k])}</span>
      <span class="parrow">➜</span>
      <span class="pv next">${info.atMax ? '—' : fmt(info.next[k])}</span>
    </div>`).join('');

  const slotIcons = slots.map((s) => `
    <div class="skill-slot ${s.unlocked ? 'on' : 'off'} ${s.reserved ? 'reserved' : ''}"
         title="${s.skill ? s.skill.name : s.slot}">
      <span class="si">${s.unlocked && s.skill ? s.skill.icon : '🔒'}</span>
      ${s.unlocked ? '' : `<span class="req">${s.lockLabel}</span>`}
    </div>`).join('');

  body.appendChild(h('div', {
    class: 'stars-panel',
    html: `
      <div class="big-stars">${starRow(info.star, MAX_STARS)}</div>
      <div class="star-caption">${info.star}★ ${info.atMax ? '· Max rank' : `· next rank ${info.star + 1}★`}</div>
      <div class="promo-table">${statRows}</div>
      <div class="slot-row">${slotIcons}</div>
      <button class="btn gold wide ${info.canPromote ? '' : 'disabled'}" data-action="promote">
        ${info.atMax ? 'Fully Promoted' : `Promote <span class="cost">🔷 ${info.have}/${info.cost}</span>`}
      </button>`,
  }));

  body.appendChild(h('p', {
    class: 'note',
    text: 'Promoting raises stats to the next rank’s fixed value and unlocks skill slots. The fifth slot is reserved for transformations — a later addition.',
  }));

  onAction(body, {
    promote: () => {
      if (promote(heroId)) { toast('Promoted!', 'good'); refresh(); }
      else toast('Not enough shards.', 'warn');
    },
  });
}

/* ---------------- Skills tab ---------------- */

const SLOT_LABEL = {
  attack: 'Auto-Attack', technique: 'Auto-Technique',
  ultimate: 'Ultimate', passive: 'Passive', transform: 'Transformation',
};

function renderSkills(body, heroId) {
  const slots = slotsFor(heroId);
  const list = h('div', { class: 'skill-list' });

  for (const s of slots) {
    const name = s.skill ? s.skill.name : (s.reserved ? 'Reserved' : 'Empty');
    const desc = s.reserved
      ? 'A transformation slot for a later build — not implemented yet.'
      : s.skill ? s.skill.desc : 'This hero has no skill for this slot.';

    list.appendChild(h('div', {
      class: `skill-row ${s.unlocked ? '' : 'locked'}`,
      html: `
        <span class="skill-icon">${s.unlocked && s.skill ? s.skill.icon : '🔒'}</span>
        <span class="skill-text">
          <span class="skill-name">${name}
            ${s.unlocked ? '' : `<span class="lock-tag">${s.lockLabel}</span>`}
          </span>
          <span class="skill-slot-label">${SLOT_LABEL[s.slot]}${s.skill?.cooldown ? ` · ${s.skill.cooldown}s cooldown` : ''}</span>
          <span class="skill-desc">${desc}</span>
        </span>`,
    }));
  }

  body.appendChild(list);
  body.appendChild(h('p', {
    class: 'note',
    text: 'Auto-attacks fire on the unit’s own timer, techniques the moment they leave cooldown, and ultimates the instant the meter fills.',
  }));
}

/* ---------------- Gear picker sheet ---------------- */

function openGearSheet(heroId, slot) {
  const hs = heroSave(heroId);
  const equippedUid = hs.equipped[slot];
  const options = inventory.availableGearForSlot(slot);

  const rows = options.map((inst) => {
    const gdef = getGearDef(inst.defId);
    const r = rarityOf(gdef.rarity);
    return `<button class="gear-row" data-action="equip" data-uid="${inst.uid}" style="--gr:${r.color}">
        <span class="gi">${gdef.icon}</span>
        <span class="gt"><b>${gdef.name}</b><small>${describeGear(gdef)}</small></span>
        <span class="gr-tag">${r.short}</span>
      </button>`;
  }).join('');

  const sheet = h('div', {
    class: 'sheet-backdrop',
    html: `
      <div class="sheet">
        <div class="sheet-title">${GEAR_SLOT_META[slot].name}</div>
        ${equippedUid ? '<button class="btn ghost wide" data-action="unequip">Unequip current</button>' : ''}
        <div class="gear-rows">${rows || '<p class="note">No spare gear for this slot. Gear drops from campaign stages.</p>'}</div>
        <button class="btn ghost wide" data-action="close">Close</button>
      </div>`,
  });

  onAction(sheet, {
    equip: (el) => {
      inventory.equipGear(heroId, el.dataset.uid);
      sheet.remove();
      toast('Equipped.', 'good');
      refresh();
    },
    unequip: () => {
      inventory.unequipGear(heroId, slot);
      sheet.remove();
      refresh();
    },
    close: () => sheet.remove(),
  });
  sheet.addEventListener('click', (ev) => { if (ev.target === sheet) sheet.remove(); });

  document.body.appendChild(sheet);
}
