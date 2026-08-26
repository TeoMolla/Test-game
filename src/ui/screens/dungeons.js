/**
 * ui/screens/dungeons.js — Gear dungeons, grouped by saga.
 *
 * One card per difficulty, stacked, because the difficulty ladder *is* the
 * content: each tier is the same fight raised, and the thing the player is
 * choosing between is how hard a run they want and what quality of gear it
 * pays. Sagas that are not built yet still get a card — greyed out and
 * unclickable — so the shape of what is coming reads off the screen.
 */

import { h, fmt, onAction } from '../dom.js';
import { bustSVG } from '../avatar.js';
import { dungeonList, dungeonRef } from '../../progression/index.js';
import { teamPower } from '../../hero/index.js';
import { rarityOf, RARITY_ORDER } from '../../config.js';
import { navigate } from '../app.js';

export function render(host) {
  const power = teamPower();

  host.appendChild(h('div', {
    class: 'power-banner',
    html: `<div class="pb-label">Team Power</div>
           <div class="pb-value">⚡ ${fmt(power)}</div>
           <div class="pb-note">gear runs</div>`,
  }));

  for (const entry of dungeonList()) {
    const { dungeon, available, tiers } = entry;

    host.appendChild(h('div', {
      class: `dungeon-head ${available ? '' : 'soon'}`,
      html: `<div class="dh-saga">${dungeon.saga}</div>
             <div class="dh-name">${dungeon.name}</div>
             <div class="dh-sub">${dungeon.subtitle}</div>
             ${available ? '' : `<div class="dh-lock">🔒 ${dungeon.lockNote}</div>`}`,
    }));

    if (!available) continue;

    const list = h('div', { class: 'tier-list' });
    for (const t of tiers) {
      const { meta, def, cleared, locked, underpowered, enemies } = t;
      const previews = enemies.map((e) => {
        const r = rarityOf(e.rarity);
        return `<span class="enemy-chip" style="--rc:${r.color}">${bustSVG(e.art)}</span>`;
      }).join('');

      const statusClass = locked ? 'locked' : cleared ? 'cleared' : underpowered ? 'risky' : 'ready';

      list.appendChild(h('div', {
        class: `tier-card ${statusClass} ${meta.bonus ? 'bonus' : ''}`,
        style: { '--tier': meta.color, '--tier-glow': meta.glow },
        html: `
          <div class="tc-rank">${meta.short}</div>
          <div class="tc-body">
            <div class="tc-name">
              ${meta.name}${meta.bonus ? '<span class="bonus-tag">BONUS</span>' : ''}
              ${cleared ? '<span class="tick">✓</span>' : ''}
            </div>
            <div class="tc-line">
              <span class="enemy-row">${previews}</span>
              <span class="tc-boss">${def.title}</span>
            </div>
            <div class="tc-drops">${dropLine(def.drops)}</div>
            <div class="stage-meta">
              <span class="gate ${underpowered ? 'warn' : 'ok'}">⚡ ${fmt(def.requiredPower)}</span>
              <span class="tc-zeni">💰 ${fmt(def.zeni)}</span>
            </div>
          </div>
          <div class="stage-action">
            ${locked
              ? '<span class="lock">🔒</span>'
              : `<button class="btn ${underpowered ? 'warn' : 'primary'} small"
                         data-action="run" data-tier="${t.tier}" data-dungeon="${dungeon.id}">
                   ${cleared ? 'Run' : 'Enter'}
                 </button>`}
          </div>`,
      }));
    }
    host.appendChild(list);
  }

  host.appendChild(h('p', {
    class: 'note',
    text: 'Dungeons drop gear and zeni only — no XP, no beans, no shards. Clear a '
        + 'difficulty to open the next one. Run them as often as you like.',
  }));

  onAction(host, {
    run: (el) => navigate('formation', {
      ref: dungeonRef(el.dataset.dungeon, el.dataset.tier),
    }),
  });
}

/**
 * The reason to pick this tier over the one below, in one line that must not
 * wrap on a 390px card: how many pieces, which rarities can drop, and which
 * one is the *expected* result (filled). Exact percentages were tried here and
 * pushed the line onto three rows — the ladder is what the player is choosing
 * between, not the odds.
 */
function dropLine(drops) {
  if (!drops) return '';
  const weights = Object.entries(drops.weights || {}).filter(([, w]) => w > 0);
  if (!weights.length) return '';
  const modal = weights.reduce((best, e) => (e[1] > best[1] ? e : best))[0];
  const pips = weights
    .sort((a, b) => RARITY_ORDER.indexOf(a[0]) - RARITY_ORDER.indexOf(b[0]))
    .map(([id]) => {
      const r = rarityOf(id);
      return `<span class="drop-pip ${id === modal ? 'modal' : ''}" style="--rc:${r.color}">${r.name}</span>`;
    });
  return `<span class="drop-count">${drops.rolls}× gear</span>${pips.join('')}`;
}
