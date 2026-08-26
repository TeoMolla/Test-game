/**
 * ui/screens/formation.js — Pre-battle confirmation: pick 3 heroes and put
 * each in the front or back row, then start the auto-battle.
 *
 * Front row soaks single-target basic attacks; the back row is protected
 * until the front row is down (see battle/targeting.js for the exact rule).
 */

import { h, fmt, onAction, toast, starRow } from '../dom.js';
import { bustSVG } from '../avatar.js';
import { bustHTML } from '../sprites.js';
import { getState, persist, enforceProtagonist } from '../../save/index.js';
import { getHeroDef, powerOf, teamPower, allyEntries, isProtagonist } from '../../hero/index.js';
import { getStage, buildEnemyTeam } from '../../progression/index.js';
import { rarityOf, TEAM_SIZE } from '../../config.js';
import { navigate, refresh } from '../app.js';

export function render(host, { stageId }) {
  const state = getState();
  const stage = stageId ? getStage(stageId) : null;
  const power = teamPower();

  if (stage) {
    const enemies = buildEnemyTeam(stage.id);
    const under = power < stage.requiredPower;
    host.appendChild(h('div', {
      class: 'battle-brief',
      html: `
        <div class="brief-title">${stage.id}. ${stage.name}</div>
        <div class="brief-sub">${stage.subtitle}</div>
        <div class="enemy-lineup">
          ${enemies.map((e) => {
            const r = rarityOf(e.rarity);
            return `<div class="lineup-unit" style="--rc:${r.color}">
                <div class="lu-art">${bustSVG(e.art)}</div>
                <div class="lu-name">${e.name}</div>
                <div class="lu-row">${e.row === 'back' ? 'Back' : 'Front'}</div>
              </div>`;
          }).join('')}
        </div>
        <div class="power-compare ${under ? 'warn' : 'ok'}">
          Your power ⚡ ${fmt(power)} · recommended ⚡ ${fmt(stage.requiredPower)}
          ${under ? '<span class="warn-tag">Underpowered</span>' : ''}
        </div>`,
    }));
  } else {
    host.appendChild(h('div', {
      class: 'power-banner',
      html: `<div class="pb-label">Team Power</div><div class="pb-value">⚡ ${fmt(power)}</div>`,
    }));
  }

  /* ---- formation slots ---- */
  const field = h('div', { class: 'formation-field' });
  for (const rowName of ['back', 'front']) {
    const rowEl = h('div', { class: `form-row form-${rowName}`, html: `<div class="row-label">${rowName === 'front' ? 'FRONT — takes the hits' : 'BACK — protected'}</div>` });
    const slots = h('div', { class: 'row-slots' });

    const inRow = state.team.filter((s) => s && s.row === rowName);
    for (const slot of inRow) {
      const def = getHeroDef(slot.heroId);
      const hsv = state.heroes[slot.heroId];
      const r = rarityOf(def.rarity);
      const lead = isProtagonist(slot.heroId);
      slots.appendChild(h('div', {
        class: `form-unit ${lead ? 'lead' : ''}`,
        style: { '--rarity': r.color, '--glow': r.glow },
        html: `
          ${lead ? '<div class="lead-tag">HERO</div>' : ''}
          ${lead
            ? `<div class="fu-art">${bustHTML(slot.heroId, def.art, bustSVG)}</div>`
            : `<button class="fu-art" data-action="swap" data-hero="${slot.heroId}">${bustHTML(slot.heroId, def.art, bustSVG)}</button>`}
          <div class="fu-name">${def.name}</div>
          <div class="fu-sub">Lv.${hsv.level} ⚡${fmt(powerOf(slot.heroId))}</div>
          <div class="fu-stars">${starRow(hsv.star)}</div>
          <button class="btn ghost tiny" data-action="toggle-row" data-hero="${slot.heroId}">
            Move to ${rowName === 'front' ? 'back' : 'front'}
          </button>`,
      }));
    }

    if (rowName === 'front' && state.team.length < TEAM_SIZE) {
      slots.appendChild(h('button', { class: 'form-unit empty', dataset: { action: 'add' }, html: '<span class="plus">＋</span><span>Add ally</span>' }));
    }

    rowEl.appendChild(slots);
    field.appendChild(rowEl);
  }
  host.appendChild(field);

  host.appendChild(h('div', {
    class: 'action-bar',
    html: stage
      ? `<button class="btn primary wide ${state.team.length ? '' : 'disabled'}" data-action="start">Start Battle</button>`
      : '<button class="btn ghost wide" data-action="done">Done</button>',
  }));

  onAction(host, {
    'toggle-row': (el) => {
      const slot = state.team.find((s) => s.heroId === el.dataset.hero);
      if (!slot) return;
      slot.row = slot.row === 'front' ? 'back' : 'front';
      persist();
      refresh();
    },
    swap: (el) => openHeroPicker(el.dataset.hero),
    add: () => openHeroPicker(null),
    start: () => {
      if (!state.team.length) return toast('Add at least one hero.', 'warn');
      navigate('battle', { stageId });
    },
    done: () => navigate('campaign', {}, { replace: true }),
  });
}

/** Pick a hero for a slot; `replacingHeroId` null means "add a new slot". */
function openHeroPicker(replacingHeroId) {
  const state = getState();
  const inTeam = new Set(state.team.map((s) => s.heroId));
  // Allies only — the protagonist holds his slot and is not offered here.
  const candidates = allyEntries().filter((e) => e.owned && (!inTeam.has(e.id) || e.id === replacingHeroId));

  const sheet = h('div', {
    class: 'sheet-backdrop',
    html: `
      <div class="sheet">
        <div class="sheet-title">${replacingHeroId ? 'Swap ally' : 'Add ally'}</div>
        <div class="pick-grid">
          ${candidates.map((e) => `
            <button class="hero-card small ${e.id === replacingHeroId ? 'current' : ''}"
                    style="--rarity:${e.rarity.color};--glow:${e.rarity.glow}"
                    data-action="pick" data-hero="${e.id}">
              <span class="rarity-tag">${e.rarity.short}</span>
              <span class="card-art">${bustHTML(e.id, e.def.art, bustSVG)}</span>
              <span class="card-name">${e.def.name}</span>
              <span class="card-sub">⚡${fmt(e.power)}</span>
            </button>`).join('') || '<p class="note">No other allies available.</p>'}
        </div>
        ${replacingHeroId ? '<button class="btn ghost wide" data-action="remove">Remove from team</button>' : ''}
        <button class="btn ghost wide" data-action="close">Close</button>
      </div>`,
  });

  onAction(sheet, {
    pick: (el) => {
      const heroId = el.dataset.hero;
      const def = getHeroDef(heroId);
      if (replacingHeroId) {
        const slot = state.team.find((s) => s.heroId === replacingHeroId);
        if (slot) slot.heroId = heroId;
      } else if (state.team.length < TEAM_SIZE) {
        state.team.push({ heroId, row: def.preferredRow });
      }
      state.team = enforceProtagonist(state.team);
      persist();
      sheet.remove();
      refresh();
    },
    remove: () => {
      state.team = enforceProtagonist(state.team.filter((s) => s.heroId !== replacingHeroId));
      persist();
      sheet.remove();
      refresh();
    },
    close: () => sheet.remove(),
  });
  sheet.addEventListener('click', (ev) => { if (ev.target === sheet) sheet.remove(); });
  document.body.appendChild(sheet);
}
