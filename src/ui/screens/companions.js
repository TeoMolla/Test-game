/**
 * ui/screens/companions.js — The companion console.
 *
 * Everything to do with the collection lives here rather than on the hero
 * screen: raising the slot levels, recruiting with shards, and opening a
 * companion to star it up. The hero screen only shows who is fighting.
 */

import { h, fmt, onAction, starRow, toast } from '../dom.js';
import { bustSVG } from '../avatar.js';
import { bustHTML } from '../sprites.js';
import {
  allyEntries, recruitableEntries, unlockHero, PROTAGONIST_ID,
  slotInfo, trainSlot, companionLevel, companionLevelCap, getHeroDef, bondOf,
} from '../../hero/index.js';
import { COMPANION_SLOTS } from '../../config.js';
import { getState } from '../../save/index.js';
import { navigate, refresh } from '../app.js';

export function render(host) {
  const owned = allyEntries();
  const team = getState().team.filter((s) => s.heroId !== PROTAGONIST_ID);
  const slots = Array.from({ length: COMPANION_SLOTS }, (_, i) => slotInfo(i)).filter(Boolean);
  const level = companionLevel();

  /* ---- the slots carry the level ----
     Every companion fights at the LOWEST slot, so that number leads and the
     panel marks which slot is holding it back. */
  host.appendChild(h('div', {
    class: 'power-banner',
    html: `<div class="pb-label">Companion Level</div>
           <div class="pb-value">${level}</div>
           <div class="pb-note">lowest slot · cap Lv.${companionLevelCap()}</div>`,
  }));

  const slotRow = h('div', { class: 'slot-row-2' });
  slots.forEach((slot, i) => {
    const occupant = team[i] ? getHeroDef(team[i].heroId) : null;
    const ahead = slot.level > level;
    slotRow.appendChild(h('div', {
      class: `comp-slot ${slot.binding ? 'binding' : 'ahead'}`,
      html: `
        <div class="cs-head">Slot ${i + 1} <span class="cs-lv">Lv.${slot.level}</span></div>
        <div class="cs-art">${occupant
          ? bustHTML(occupant.id, occupant.art, bustSVG)
          : '<span class="cs-empty">＋</span>'}</div>
        <div class="cs-name">${occupant ? occupant.name : 'Empty'}</div>
        <button class="btn ${slot.binding ? 'primary' : 'ghost'} tiny wide ${slot.canTrain ? '' : 'disabled'}"
                data-action="train-slot" data-slot="${i}">
          ${slot.atMax ? 'Max'
            : slot.atCap ? `Hero Lv.${slot.cap}`
            : `🫘 ${slot.senzuCost} · 💰 ${fmt(slot.zeniCost)}`}
        </button>
        ${ahead ? '<div class="cs-warn">ahead — raise the other slot</div>' : ''}`,
    }));
  });
  host.appendChild(slotRow);

  host.appendChild(h('p', {
    class: 'note',
    text: 'Both slots must rise for your companions to grow: they all fight at the '
        + 'lowest one, and neither can pass your hero.',
  }));

  /* ---- recruiting ---- */
  const ready = recruitableEntries();
  if (ready.length) {
    host.appendChild(h('h2', { class: 'panel-title section-head', text: 'Ready to recruit' }));
    host.appendChild(h('div', {
      class: 'recruit-row',
      html: ready.map((e) => `
        <button class="btn gold small" data-action="unlock" data-hero="${e.id}">
          🔷 Recruit ${e.def.name}
        </button>`).join(''),
    }));
  }

  /* ---- the collection ---- */
  host.appendChild(h('h2', {
    class: 'panel-title section-head',
    text: `Collection — ${owned.length} recruited`,
  }));

  const fielded = new Set(team.map((s) => s.heroId));
  const grid = h('div', { class: 'hero-grid' });
  for (const entry of owned) {
    const bond = bondOf(entry.id);
    grid.appendChild(h('button', {
      class: `hero-card ${fielded.has(entry.id) ? 'fielded' : ''}`,
      style: { '--rarity': entry.rarity.color, '--glow': entry.rarity.glow },
      dataset: { action: 'open', hero: entry.id },
      html: `
        <span class="rarity-tag">${entry.rarity.short}</span>
        ${fielded.has(entry.id) ? '<span class="field-tag">In team</span>' : ''}
        <span class="card-art">${bustHTML(entry.id, entry.def.art, bustSVG)}</span>
        <span class="card-name">${entry.def.name}</span>
        <span class="card-sub">${bond ? bond.label : ''}</span>
        <span class="card-stars">${starRow(entry.star)}</span>`,
    }));
  }
  host.appendChild(grid);

  if (!owned.length) {
    host.appendChild(h('p', { class: 'note', text: 'No companions yet. Shards drop from campaign stages.' }));
  } else {
    host.appendChild(h('p', {
      class: 'note',
      text: 'Open a companion to star it up with shards. Every star raises what it '
          + 'lends your hero, whether or not it is fighting.',
    }));
  }

  onAction(host, {
    'train-slot': (el) => {
      const i = Number(el.dataset.slot);
      const info = slotInfo(i);
      if (trainSlot(i)) {
        toast(info.binding
          ? 'Companions grew stronger.'
          : 'Slot raised — the other slot still sets the level.', 'good');
        refresh();
      } else if (info?.atCap) toast(`Your hero must reach Lv.${info.cap + 1} first.`, 'warn');
      else if (info && info.haveSenzu < info.senzuCost) toast('Not enough senzu beans.', 'warn');
      else toast('Not enough zeni.', 'warn');
    },
    unlock: (el) => {
      const heroId = el.dataset.hero;
      if (unlockHero(heroId)) {
        toast(`${getHeroDef(heroId).name} joined you!`, 'good');
        navigate('heroDetail', { heroId });
      } else {
        toast('Not enough shards yet.', 'warn');
        refresh();
      }
    },
    open: (el) => navigate('heroDetail', { heroId: el.dataset.hero }),
  });
}
