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
  promoteInfo, promote, xpInfo, isProtagonist, bondOf, levelOf,
} from '../../hero/index.js';
import { rarityOf, MAX_STARS } from '../../config.js';
import {
  GEAR_SLOTS, GEAR_SLOT_META, getGearDef, describeGear, sortGear, GEAR_SLOT_LEVEL_STEP,
} from '../../gear/index.js';
import * as inventory from '../../inventory/index.js';
import { getState } from '../../save/index.js';
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
  const bond = lead ? null : bondOf(heroId);

  // Gear is the protagonist's alone; allies have no equipment slots.
  // Two numbers live on a slot and they mean different things: the item's own
  // level sits with the item (top-left, in its rarity colour), the slot's
  // bought level sits with the slot (bottom-right, as a +N).
  const slotLevels = getState().gearSlotLevels || {};
  const gearNodes = !isProtagonist(heroId) ? '' : GEAR_SLOTS.map((slot) => {
    const uid = hs.equipped[slot];
    const inst = uid ? inventory.gearByUid(uid) : null;
    const gdef = inst ? getGearDef(inst.defId) : null;
    const slotLv = slotLevels[slot] || 0;
    return `<button class="gear-slot slot-${slot} ${gdef ? 'filled' : ''}"
              data-action="gear" data-slot="${slot}"
              style="--gr:${gdef ? rarityOf(gdef.rarity).color : 'transparent'}"
              aria-label="${GEAR_SLOT_META[slot].name}">
              <span class="gi">${gdef ? gdef.icon : GEAR_SLOT_META[slot].icon}</span>
              ${gdef ? `<span class="gs-item">${inst.level}</span>` : ''}
              ${slotLv ? `<span class="gs-lv">+${slotLv}</span>` : ''}
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
      <div class="level-line">Lv.${lead ? lvl.level : levelOf(heroId)}</div>
      ${lead ? `
        <div class="xp-track" role="img" aria-label="${lvl.atMax ? 'Max level' : `${fmt(lvl.into)} of ${fmt(lvl.needed)} XP`}">
          <span class="xp-fill" style="width:${lvl.pct}%"></span>
        </div>
        <div class="xp-line">${lvl.atMax ? 'Max level' : `${fmt(lvl.into)} / ${fmt(lvl.needed)} XP to Lv.${lvl.level + 1}`}</div>`
        : '<div class="xp-line">Level comes from your companion slots</div>'}
      <div class="stat-grid">
        <div class="stat"><span class="sn">⚔️ ATK</span><span class="sv">${fmt(stats.atk)}</span></div>
        <div class="stat"><span class="sn">❤️ HP</span><span class="sv">${fmt(stats.hp)}</span></div>
        <div class="stat"><span class="sn">🛡️ DEF</span><span class="sv">${fmt(stats.def)}</span></div>
        <div class="stat"><span class="sn">💨 SPD</span><span class="sv">${stats.speed.toFixed(2)}</span></div>
      </div>
      `,
  }));

  if (bond) {
    const rows = [
      ...Object.entries(bond.flat).filter(([, v]) => v >= 0.5)
        .map(([k, v]) => `+${fmt(v)} ${k.toUpperCase()}`),
      ...Object.entries(bond.pct).filter(([, v]) => v >= 0.0005)
        .map(([k, v]) => `+${(v * 100).toFixed(1)}% ${k.toUpperCase()}`),
    ];
    body.appendChild(h('section', {
      class: `bond-panel ${bond.equipped ? 'equipped' : ''}`,
      html: `
        <div class="bond-head">
          <span class="bond-label">${bond.label}</span>
          <span class="bond-share">${bond.equipped ? 'Equipped · full' : 'Collected · 25%'}</span>
        </div>
        <div class="bond-rows">${rows.map((r) => `<span class="bond-stat">${r}</span>`).join('')}</div>
        <p class="note" style="margin-top:8px">
          Lent to your hero${bond.equipped ? '' : ' even while benched'}. Starring
          this companion up raises it.
        </p>`,
    }));
  }

  body.appendChild(h('p', {
    class: 'note',
    text: lead
      ? `${def.lore} Levels come from fighting — clear stages to earn XP.`
      : `${def.lore}`,
  }));

  onAction(body, {
    gear: (el) => openGearSheet(heroId, el.dataset.slot),
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

  const rows = sortGear(options).map((inst) => {
    const gdef = getGearDef(inst.defId);
    const r = rarityOf(gdef.rarity);
    return `<button class="gear-row" data-action="equip" data-uid="${inst.uid}" style="--gr:${r.color}">
        <span class="gi">${gdef.icon}</span>
        <span class="gt">
          <b>${gdef.name} <span class="glv">Lv.${inst.level}</span></b>
          <small>${describeGear(gdef, inst.level)}</small>
        </span>
        <span class="gr-tag">${r.short}</span>
      </button>`;
  }).join('');

  // The slot's own level lives here rather than on a separate screen: this is
  // the one place you are already thinking about this slot.
  const upgradePanel = () => {
    const up = inventory.slotUpgradeInfo(slot);
    return `
      <div class="su-head">
        <span class="su-label">Slot level</span>
        <span class="su-lv">+${up.level}</span>
        <span class="su-boost">+${(up.level * GEAR_SLOT_LEVEL_STEP * 100).toFixed(1)}% to whatever is equipped here</span>
      </div>
      <button class="btn ${up.canUpgrade ? 'primary' : 'ghost'} small wide ${up.canUpgrade ? '' : 'disabled'}"
              data-action="upgrade-slot">
        🔩 ${fmt(up.cost)} iron${up.canUpgrade ? '' : ` · you have ${fmt(up.haveIron)}`}
      </button>`;
  };

  const sheet = h('div', {
    class: 'sheet-backdrop',
    html: `
      <div class="sheet">
        <div class="sheet-title">${GEAR_SLOT_META[slot].name}</div>
        <div class="slot-upgrade">${upgradePanel()}</div>
        ${equippedUid ? '<button class="btn ghost wide" data-action="unequip">Unequip current</button>' : ''}
        <div class="gear-rows">${rows || '<p class="note">No spare gear for this slot. Dungeons are where gear comes from.</p>'}</div>
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
    // Buying slot levels is a repeated action, so the sheet stays open and
    // updates in place. The +N ticking up is the feedback; a toast per tap
    // would just stack up over the screen.
    'upgrade-slot': () => {
      if (inventory.upgradeGearSlot(slot)) {
        sheet.querySelector('.slot-upgrade').innerHTML = upgradePanel();
        refresh();
      } else {
        toast('Not enough iron. Scrap spare gear in the Bag.', 'warn');
      }
    },
    close: () => sheet.remove(),
  });
  sheet.addEventListener('click', (ev) => { if (ev.target === sheet) sheet.remove(); });

  document.body.appendChild(sheet);
}
