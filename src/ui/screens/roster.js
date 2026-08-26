/**
 * ui/screens/roster.js — Hero grid.
 *
 * Owned heroes show level + stars; unowned heroes are greyed out with a
 * shard-collection fraction (e.g. "5/15") toward unlocking, mirroring the
 * reference roster screen.
 */

import { h, fmt, onAction, starRow, toast } from '../dom.js';
import { bustSVG } from '../avatar.js';
import { bustHTML } from '../sprites.js';
import {
  rosterEntries, allyEntries, recruitableEntries, unlockHero, PROTAGONIST_ID,
  statsFor, teamPower, slotInfo, trainSlot, companionLevel, getHeroDef,
} from '../../hero/index.js';
import { COMPANION_SLOTS } from '../../config.js';
import { getState } from '../../save/index.js';
import { navigate, refresh } from '../app.js';

export function render(host) {
  const allies = allyEntries();
  const owned = allies.filter((e) => e.owned).length;

  /* ---- team power leads the screen ----
     Power is a team figure, not the hero's: it sums him and whichever allies
     are in the team. Putting it on his card read as though it were his alone,
     so it sits above everything instead. */
  const fielded = getState().team.length;
  host.appendChild(h('div', {
    class: 'power-banner',
    html: `<div class="pb-label">Team Power</div>
           <div class="pb-value">⚡ ${fmt(teamPower())}</div>
           <div class="pb-note">hero + ${fielded - 1} all${fielded - 1 === 1 ? 'y' : 'ies'}</div>`,
  }));

  /* ---- the protagonist gets his own panel above the collection ---- */
  const hero = rosterEntries().find((e) => e.id === PROTAGONIST_ID);
  const hStats = statsFor(hero.id);
  host.appendChild(h('button', {
    class: 'lead-card',
    style: { '--rarity': hero.rarity.color, '--glow': hero.rarity.glow },
    dataset: { action: 'open', hero: hero.id },
    html: `
      <span class="lead-eyebrow">Your hero</span>
      <span class="lead-art">${bustHTML(hero.id, hero.def.art, bustSVG)}</span>
      <span class="lead-body">
        <span class="lead-name">${hero.def.name}</span>
        <span class="lead-sub">Lv.${hero.level} · ${starRow(hero.star)}</span>
        <span class="lead-stats">⚔️ ${fmt(hStats.atk)} · ❤️ ${fmt(hStats.hp)} · 🛡️ ${fmt(hStats.def)}</span>
      </span>`,
  }));

  /* ---- companion slots ----
     The slots carry the level, not the companions, and everyone fights at the
     lowest of them — so the panel leads with that number and marks which slot
     is holding it back. */
  const team = getState().team.filter((s) => s.heroId !== PROTAGONIST_ID);
  const slots = Array.from({ length: COMPANION_SLOTS }, (_, i) => slotInfo(i)).filter(Boolean);

  host.appendChild(h('div', {
    class: 'companion-head',
    html: `<span class="ch-title">Companions</span>
           <span class="ch-level">Lv.${companionLevel()}</span>
           <span class="ch-note">lowest slot sets the level</span>`,
  }));

  const slotRow = h('div', { class: 'slot-row-2' });
  slots.forEach((slot, i) => {
    const occupant = team[i] ? getHeroDef(team[i].heroId) : null;
    const held = slot.level > companionLevel();
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
        ${held ? '<div class="cs-warn">ahead of the other slot</div>' : ''}`,
    }));
  });
  host.appendChild(slotRow);

  /* ---- recruitable, when shards allow ---- */
  const ready = recruitableEntries();
  if (ready.length) {
    host.appendChild(h('div', {
      class: 'recruit-row',
      html: ready.map((e) => `
        <button class="btn gold small" data-action="unlock" data-hero="${e.id}">
          Recruit ${e.def.name}
        </button>`).join(''),
    }));
  }

  host.appendChild(h('h2', {
    class: 'panel-title section-head',
    text: `Collection — ${owned} recruited`,
  }));

  const grid = h('div', { class: 'hero-grid' });

  for (const entry of allies) {
    const { id, def, rarity, owned: isOwned, star, level, unlock } = entry;
    const canUnlock = unlock.canUnlock;

    grid.appendChild(h('button', {
      class: `hero-card ${isOwned ? '' : 'locked'} ${canUnlock ? 'unlockable' : ''}`,
      style: { '--rarity': rarity.color, '--glow': rarity.glow },
      dataset: { action: isOwned ? 'open' : 'unlock', hero: id },
      html: `
        <span class="rarity-tag">${rarity.short}</span>
        <span class="card-art">${bustHTML(id, def.art, bustSVG)}</span>
        <span class="card-name">${def.name}</span>
        ${isOwned
          ? `<span class="card-sub">Lv.${level} · ⚡${fmt(entry.power)}</span>
             <span class="card-stars">${starRow(star)}</span>`
          : `<span class="shard-frac ${canUnlock ? 'ready' : ''}">${unlock.have}/${unlock.need}</span>
             <span class="card-sub">${canUnlock ? 'Tap to summon' : 'Shards needed'}</span>`}`,
    }));
  }

  host.appendChild(grid);
  host.appendChild(h('p', {
    class: 'note',
    text: 'Every companion you own lends your hero stats, fielded or not — a quarter '
        + 'of it from the collection, all of it from the two equipped. Star them up '
        + 'to lend more. Shard progress toward companions you have not met is in the Bag.',
  }));

  onAction(host, {
    'train-slot': (el) => {
      const i = Number(el.dataset.slot);
      const info = slotInfo(i);
      if (trainSlot(i)) {
        toast(info.binding ? 'Companions grew stronger.' : 'Slot raised — the other slot still sets the level.', 'good');
        refresh();
      } else if (info?.atCap) toast(`Your hero must reach Lv.${info.cap + 1} first.`, 'warn');
      else if (info && info.haveSenzu < info.senzuCost) toast('Not enough senzu beans.', 'warn');
      else toast('Not enough zeni.', 'warn');
    },
    open: (el) => navigate('heroDetail', { heroId: el.dataset.hero }),
    unlock: (el) => {
      const heroId = el.dataset.hero;
      if (unlockHero(heroId)) {
        toast(`${heroId.toUpperCase()} joined your team!`, 'good');
        navigate('heroDetail', { heroId });
      } else {
        toast('Not enough shards yet.', 'warn');
        refresh();
      }
    },
  });
}
