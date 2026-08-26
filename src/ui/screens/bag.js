/**
 * ui/screens/bag.js — Shared inventory: currency, hero shards, gear.
 */

import { h, fmt, onAction, toast } from '../dom.js';
import { bustSVG } from '../avatar.js';
import { getState, resetSave } from '../../save/index.js';
import { getHeroDef, HERO_IDS, isOwned, unlockInfo } from '../../hero/index.js';
import { getGearDef, describeGear } from '../../gear/index.js';
import { rarityOf } from '../../config.js';
import * as inventory from '../../inventory/index.js';
import { navigate, refresh } from '../app.js';

export function render(host) {
  const state = getState();

  host.appendChild(h('div', {
    class: 'power-banner',
    html: `<div class="pb-label">Zeni</div><div class="pb-value">💰 ${fmt(state.zeni)}</div>`,
  }));

  /* ---- shards ---- */
  const shardRows = HERO_IDS
    .filter((id) => (state.shards[id] || 0) > 0 || !isOwned(id))
    .map((id) => {
      const def = getHeroDef(id);
      const info = unlockInfo(id);
      const owned = isOwned(id);
      const r = rarityOf(def.rarity);
      return `<div class="shard-row" style="--rc:${r.color}">
          <span class="sr-art">${bustSVG(def.art)}</span>
          <span class="sr-text"><b>${def.name}</b><small>${owned ? 'Unlocked · shards go to promotions' : (info.canUnlock ? 'Ready to summon' : `${info.have}/${info.need} to summon`)}</small></span>
          <span class="sr-count">🔷 ${inventory.shards(id)}</span>
        </div>`;
    }).join('');

  host.appendChild(h('section', {
    class: 'panel',
    html: `<h2 class="panel-title">Hero Shards</h2>${shardRows || '<p class="note">No shards yet — clear campaign stages.</p>'}`,
  }));

  /* ---- gear ---- */
  const gearRows = state.gear.map((inst) => {
    const def = getGearDef(inst.defId);
    if (!def) return '';
    const r = rarityOf(def.rarity);
    const holder = inst.equippedBy ? getHeroDef(inst.equippedBy) : null;
    return `<div class="gear-row static" style="--gr:${r.color}">
        <span class="gi">${def.icon}</span>
        <span class="gt"><b>${def.name}</b><small>${describeGear(def)}</small></span>
        <span class="gr-tag">${holder ? holder.name : r.short}</span>
      </div>`;
  }).join('');

  host.appendChild(h('section', {
    class: 'panel',
    html: `<h2 class="panel-title">Gear (${state.gear.length})</h2>${gearRows || '<p class="note">No gear yet — it drops from campaign stages.</p>'}`,
  }));

  host.appendChild(h('section', {
    class: 'panel',
    html: `<h2 class="panel-title">Record</h2>
      <p class="note">Won ${state.stats.battlesWon} · Lost ${state.stats.battlesLost} · Cleared ${Object.keys(state.campaign.cleared).length} stages</p>
      <button class="btn ghost wide" data-action="reset">Reset Progress</button>`,
  }));

  // Two-tap confirmation rather than confirm(): a sandboxed embed (and some
  // in-app browsers) will not show a native modal at all.
  let resetArmed = false;
  onAction(host, {
    reset: (el) => {
      if (!resetArmed) {
        resetArmed = true;
        el.textContent = 'Tap again to erase everything';
        el.classList.add('danger');
        setTimeout(() => {
          if (!resetArmed) return;
          resetArmed = false;
          el.textContent = 'Reset Progress';
          el.classList.remove('danger');
        }, 4000);
        return;
      }
      resetArmed = false;
      resetSave();
      toast('Progress reset.', 'warn');
      navigate('campaign', {}, { replace: true });
    },
  });
}
