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
import { rosterEntries, allyEntries, unlockHero, PROTAGONIST_ID, statsFor, powerOf } from '../../hero/index.js';
import { navigate, refresh } from '../app.js';

export function render(host) {
  const allies = allyEntries();
  const owned = allies.filter((e) => e.owned).length;

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
        <span class="lead-power">⚡ ${fmt(powerOf(hero.id))}</span>
      </span>`,
  }));

  host.appendChild(h('div', {
    class: 'power-banner',
    html: `<div class="pb-label">Allies</div>
           <div class="pb-value">${owned} / ${allies.length} recruited</div>`,
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
    text: 'Allies fight alongside your hero. Shards drop from campaign stages — collect enough and they join you.',
  }));

  onAction(host, {
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
