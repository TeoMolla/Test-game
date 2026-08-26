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
import { rosterEntries, unlockHero } from '../../hero/index.js';
import { navigate, refresh } from '../app.js';

export function render(host) {
  const entries = rosterEntries();
  const owned = entries.filter((e) => e.owned).length;

  host.appendChild(h('div', {
    class: 'power-banner',
    html: `<div class="pb-label">Collection</div>
           <div class="pb-value">${owned} / ${entries.length} heroes</div>`,
  }));

  const grid = h('div', { class: 'hero-grid' });

  for (const entry of entries) {
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
  host.appendChild(h('p', { class: 'note', text: 'Shards drop from campaign stages. Collect enough and a hero joins the team.' }));

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
