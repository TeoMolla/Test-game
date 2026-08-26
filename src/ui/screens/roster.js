/**
 * ui/screens/roster.js — Your hero.
 *
 * This screen is about the protagonist: his power, his stats, and who is
 * standing beside him. Managing the collection — levelling the slots, starring
 * companions up, recruiting — lives on the Companions screen, so this one does
 * not turn into a console.
 */

import { h, fmt, onAction, starRow } from '../dom.js';
import { bustSVG } from '../avatar.js';
import { bustHTML } from '../sprites.js';
import {
  rosterEntries, PROTAGONIST_ID, statsFor, teamPower,
  companionLevel, getHeroDef, bondOf,
} from '../../hero/index.js';
import { getState } from '../../save/index.js';
import { navigate } from '../app.js';

export function render(host) {
  /* ---- team power leads ----
     Power is a team figure — the hero plus whichever companions are fielded —
     so it sits above everything rather than on his card, where it read as his
     alone. */
  const fielded = getState().team.length;
  host.appendChild(h('div', {
    class: 'power-banner',
    html: `<div class="pb-label">Team Power</div>
           <div class="pb-value">⚡ ${fmt(teamPower())}</div>
           <div class="pb-note">hero + ${fielded - 1} compan${fielded - 1 === 1 ? 'ion' : 'ions'}</div>`,
  }));

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

  /* ---- who is fighting beside him ----
     Equipped companions only. The rest of the collection is not this screen's
     business. */
  const fieldedCompanions = getState().team
    .filter((s) => s.heroId !== PROTAGONIST_ID)
    .map((s) => getHeroDef(s.heroId))
    .filter(Boolean);

  host.appendChild(h('div', {
    class: 'companion-head',
    html: `<span class="ch-title">Fighting with you</span>
           <span class="ch-level">Lv.${companionLevel()}</span>
           <button class="btn ghost tiny" data-action="manage">Manage →</button>`,
  }));

  const row = h('div', { class: 'slot-row-2' });
  for (const def of fieldedCompanions) {
    const entry = rosterEntries().find((e) => e.id === def.id);
    const bond = bondOf(def.id);
    const stats = [
      ...Object.entries(bond?.flat || {}).filter(([, v]) => v >= 0.5)
        .map(([k, v]) => `+${fmt(v)} ${k.toUpperCase()}`),
      ...Object.entries(bond?.pct || {}).filter(([, v]) => v >= 0.0005)
        .map(([k, v]) => `+${(v * 100).toFixed(1)}% ${k.toUpperCase()}`),
    ];
    row.appendChild(h('button', {
      class: 'comp-slot filled',
      style: { '--rarity': entry.rarity.color },
      dataset: { action: 'open', hero: def.id },
      html: `
        <div class="cs-art">${bustHTML(def.id, def.art, bustSVG)}</div>
        <div class="cs-name">${def.name}</div>
        <div class="cs-stars">${starRow(entry.star)}</div>
        <div class="cs-bond">${stats.join(' · ') || '—'}</div>`,
    }));
  }
  if (!fieldedCompanions.length) {
    row.appendChild(h('div', { class: 'comp-slot', html: '<div class="cs-empty">No companions in your team</div>' }));
  }
  host.appendChild(row);

  host.appendChild(h('p', {
    class: 'note',
    text: 'Companions fighting beside you lend their full bond; the rest of your '
        + 'collection lends a quarter. Manage, train and recruit them in Companions.',
  }));

  onAction(host, {
    open: (el) => navigate('heroDetail', { heroId: el.dataset.hero }),
    manage: () => navigate('companions', {}, { replace: true }),
  });
}
