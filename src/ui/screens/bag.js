/**
 * ui/screens/bag.js — Shared inventory: currency, hero shards, gear.
 */

import { h, fmt, onAction, toast } from '../dom.js';
import { bustSVG } from '../avatar.js';
import { bustHTML } from '../sprites.js';
import { getState, resetSave } from '../../save/index.js';
import { getHeroDef, HERO_IDS, isOwned, unlockInfo } from '../../hero/index.js';
import { getGearDef, describeGear, sortGear, dismantleYield } from '../../gear/index.js';
import { rarityOf } from '../../config.js';
import * as inventory from '../../inventory/index.js';
import { navigate, refresh } from '../app.js';

export function render(host) {
  const state = getState();

  host.appendChild(h('div', {
    class: 'power-banner',
    html: `<div class="pb-label">Zeni</div><div class="pb-value">💰 ${fmt(state.zeni)}</div>
           <div class="pb-note">🫘 ${fmt(state.senzu)} · 🔩 ${fmt(state.iron || 0)}</div>`,
  }));

  host.appendChild(h('section', {
    class: 'panel',
    html: `<h2 class="panel-title">Senzu Beans</h2>
      <p class="note" style="margin-top:0">
        Beans train your allies. Every stage from 2 onward drops them, and the
        deeper the stage the more it gives — stage 6 pays four a run against
        stage 2's one. Farming the hardest fight you can win is the fastest way
        to raise the team, which is why your hero has to get there first.
      </p>`,
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
          <span class="sr-art">${bustHTML(id, def.art, bustSVG)}</span>
          <span class="sr-text"><b>${def.name}</b><small>${owned ? 'Unlocked · shards go to promotions' : (info.canUnlock ? 'Ready to summon' : `${info.have}/${info.need} to summon`)}</small></span>
          <span class="sr-count">🔷 ${inventory.shards(id)}</span>
        </div>`;
    }).join('');

  host.appendChild(h('section', {
    class: 'panel',
    html: `<h2 class="panel-title">Hero Shards</h2>${shardRows || '<p class="note">No shards yet — clear campaign stages.</p>'}`,
  }));

  /* ---- gear ---- */
  // Best first: with fixed-level drops the bag fills up with near-identical
  // pieces, and the only question being asked of this list is "what is my best
  // option for this slot".
  const gearRows = sortGear(state.gear).map((inst) => {
    const def = getGearDef(inst.defId);
    if (!def) return '';
    const r = rarityOf(def.rarity);
    const holder = inst.equippedBy ? getHeroDef(inst.equippedBy) : null;
    // Equipped gear gets no scrap button at all — the safest way to stop
    // someone dismantling what they are wearing is to never offer it.
    return `<div class="gear-row static" style="--gr:${r.color}">
        <span class="gi">${def.icon}</span>
        <span class="gt">
          <b>${def.name} <span class="glv">Lv.${inst.level}</span></b>
          <small>${describeGear(def, inst.level)}</small>
        </span>
        ${holder
          ? `<span class="gr-tag">${holder.name}</span>`
          : `<button class="btn ghost tiny scrap" data-action="scrap" data-uid="${inst.uid}">
               🔩 ${dismantleYield(def, inst.level)}
             </button>`}
      </div>`;
  }).join('');

  host.appendChild(h('section', {
    class: 'panel',
    html: `<h2 class="panel-title">Gear (${state.gear.length})</h2>${gearRows
      || '<p class="note">No gear yet — story stages drop a little, dungeons drop the rest.</p>'}
      ${state.gear.length ? '<p class="note">Scrap what you will not use for iron, then spend it raising a gear slot on your hero.</p>' : ''}`,
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
  let armedScrap = null;
  onAction(host, {
    // Two taps to scrap: destructive, irreversible, and sitting in a long list
    // where a mis-tap is easy.
    scrap: (el) => {
      const uid = el.dataset.uid;
      if (armedScrap !== uid) {
        armedScrap = uid;
        el.classList.add('danger');
        el.textContent = 'Scrap?';
        setTimeout(() => {
          if (armedScrap !== uid) return;
          armedScrap = null;
          refresh();
        }, 3000);
        return;
      }
      armedScrap = null;
      const gained = inventory.dismantleGear(uid);
      if (gained) toast(`Scrapped for ${gained} iron.`, 'good');
      refresh();
    },
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
