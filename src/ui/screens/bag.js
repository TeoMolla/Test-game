/**
 * ui/screens/bag.js — Shared inventory, in three tabs.
 *
 *   Items      currency, senzu, hero shards, record
 *   Gear       everything you own, best first; tap a row for its item card
 *   Dismantle  a selectable grid for clearing surplus in bulk
 *
 * Gear got its own tab once the bag started filling with near-identical
 * fixed-level drops: it is the longest list in the game and it was pushing the
 * record and reset controls off the bottom of a phone screen.
 */

import { h, fmt, onAction, toast } from '../dom.js';
import { bustSVG } from '../avatar.js';
import { bustHTML } from '../sprites.js';
import { getState, resetSave } from '../../save/index.js';
import { getHeroDef, HERO_IDS, isOwned, unlockInfo } from '../../hero/index.js';
import { getGearDef, describeGear, sortGear } from '../../gear/index.js';
import { rarityOf, RARITY_ORDER } from '../../config.js';
import * as inventory from '../../inventory/index.js';
import { openGearCard } from '../gearCard.js';
import { navigate, refresh } from '../app.js';

let activeTab = 'items';
/** Selection survives a re-render, so ticking a box does not clear the rest. */
let selected = new Set();
let excludeUpgrades = true;

const TABS = [
  { id: 'items', label: 'Items' },
  { id: 'gear', label: 'Gear' },
  { id: 'dismantle', label: 'Dismantle' },
];

export function render(host) {
  const state = getState();

  host.appendChild(h('div', {
    class: 'power-banner',
    html: `<div class="pb-label">Zeni</div><div class="pb-value">💰 ${fmt(state.zeni)}</div>
           <div class="pb-note">🫘 ${fmt(state.senzu)} · 🔩 ${fmt(state.iron || 0)}</div>`,
  }));

  // Same treatment as the hero screen's tabs — top of the page here, since the
  // Bag's content scrolls far and the tabs should not drift away from the
  // wallet they sit under.
  const tabs = h('div', {
    class: 'tab-bar bag-tabs',
    html: TABS.map((t) => `<button class="tab-btn ${activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join(''),
  });
  host.appendChild(tabs);

  const body = h('div', { class: 'tab-body' });
  host.appendChild(body);

  if (activeTab === 'items') renderItems(body, state);
  else if (activeTab === 'gear') renderGear(body, state);
  else renderDismantle(body);

  for (const btn of tabs.querySelectorAll('.tab-btn')) {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      if (activeTab !== 'dismantle') selected.clear();
      refresh();
    });
  }
}

/* ---------------- Items ---------------- */

function renderItems(body, state) {
  body.appendChild(h('section', {
    class: 'panel',
    html: `<h2 class="panel-title">Senzu Beans</h2>
      <p class="note" style="margin-top:0">
        Beans train your allies. Every stage from 2 onward drops them, and the
        deeper the stage the more it gives — stage 6 pays four a run against
        stage 2's one. Farming the hardest fight you can win is the fastest way
        to raise the team, which is why your hero has to get there first.
      </p>`,
  }));

  body.appendChild(h('section', {
    class: 'panel',
    html: `<h2 class="panel-title">Iron</h2>
      <p class="note" style="margin-top:0">
        Iron comes from scrapping gear you will not use, and buys levels on your
        hero's gear slots. Deep drops scrap for more, so surplus from a hard
        dungeon is worth more than surplus from an easy one.
      </p>`,
  }));

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

  body.appendChild(h('section', {
    class: 'panel',
    html: `<h2 class="panel-title">Hero Shards</h2>${shardRows || '<p class="note">No shards yet — clear campaign stages.</p>'}`,
  }));

  body.appendChild(h('section', {
    class: 'panel',
    html: `<h2 class="panel-title">Record</h2>
      <p class="note">Won ${state.stats.battlesWon} · Lost ${state.stats.battlesLost} · Cleared ${Object.keys(state.campaign.cleared).length} stages</p>
      <button class="btn ghost wide" data-action="reset">Reset Progress</button>`,
  }));

  // Two-tap confirmation rather than confirm(): a sandboxed embed (and some
  // in-app browsers) will not show a native modal at all.
  let resetArmed = false;
  onAction(body, {
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

/* ---------------- Gear ---------------- */

function renderGear(body, state) {
  // Best first: with fixed-level drops the bag fills up with near-identical
  // pieces, and the only question being asked of this list is "what is my best
  // option for this slot".
  const rows = sortGear(state.gear).map((inst) => {
    const def = getGearDef(inst.defId);
    if (!def) return '';
    const r = rarityOf(def.rarity);
    const holder = inst.equippedBy ? getHeroDef(inst.equippedBy) : null;
    return `<button class="gear-row" data-action="open" data-uid="${inst.uid}" style="--gr:${r.color}">
        <span class="gi">${def.icon}</span>
        <span class="gt">
          <b>${inst.locked ? '🔒 ' : ''}${def.name} <span class="glv">Lv.${inst.level}</span></b>
          <small>${describeGear(def, inst.level)}</small>
        </span>
        <span class="gr-tag">${holder ? holder.name : r.short}</span>
      </button>`;
  }).join('');

  body.appendChild(h('section', {
    class: 'panel',
    html: `<h2 class="panel-title">Gear (${state.gear.length})</h2>${rows
      || '<p class="note">No gear yet — story stages drop a little, dungeons drop the rest.</p>'}
      ${state.gear.length ? '<p class="note">Tap a piece to inspect it, equip it, or lock it against scrapping.</p>' : ''}`,
  }));

  onAction(body, { open: (el) => openGearCard({ uid: el.dataset.uid }) });
}

/* ---------------- Dismantle ---------------- */

function renderDismantle(body) {
  const candidates = inventory.dismantleCandidates({ excludeUpgrades });
  const open = candidates.filter((c) => !c.blocked);
  const openUids = new Set(open.map((c) => c.inst.uid));

  // A piece can stop being selectable while it is selected — the exclude
  // toggle flips, or it gets locked — so the set is pruned every render rather
  // than trusted.
  for (const uid of [...selected]) if (!openUids.has(uid)) selected.delete(uid);

  const ironTotal = open.filter((c) => selected.has(c.inst.uid))
    .reduce((sum, c) => sum + c.yield, 0);

  const grid = h('div', { class: 'scrap-grid' });
  for (const c of sortGear(candidates.map((x) => x.inst))) {
    const entry = candidates.find((x) => x.inst.uid === c.uid);
    const def = getGearDef(c.defId);
    const r = rarityOf(def.rarity);
    const on = selected.has(c.uid);
    grid.appendChild(h('button', {
      class: `scrap-tile ${on ? 'on' : ''} ${entry.blocked ? `blocked ${entry.blocked}` : ''}`,
      style: { '--gr': r.color },
      dataset: { action: entry.blocked ? 'blocked' : 'pick', uid: c.uid, why: entry.blocked || '' },
      html: `
        <span class="st-check">${on ? '✓' : ''}</span>
        <span class="st-art">${def.icon}</span>
        <span class="st-lv">${c.level}</span>
        ${entry.blocked === 'locked' ? '<span class="st-flag">🔒</span>' : ''}
        ${entry.blocked === 'best' ? '<span class="st-flag">▲</span>' : ''}`,
    }));
  }

  body.appendChild(h('div', {
    class: 'scrap-head',
    html: `<span class="sh-count">Selected: <b>${selected.size}</b>/${open.length}</span>
           <button class="sh-toggle ${excludeUpgrades ? 'on' : ''}" data-action="toggle-exclude">
             <span class="sh-box">${excludeUpgrades ? '✓' : ''}</span> Keep best per slot
           </button>`,
  }));

  body.appendChild(grid);

  if (!candidates.length) {
    body.appendChild(h('p', { class: 'note', text: 'Nothing spare to scrap — everything you own is equipped.' }));
  }

  // One tap per rarity is the fast path for clearing junk. Tapping a rarity
  // that is already fully selected clears it again, so the button is a toggle
  // rather than a one-way action.
  const present = RARITY_ORDER.filter((id) => open.some((c) => getGearDef(c.inst.defId).rarity === id));
  if (present.length) {
    body.appendChild(h('div', {
      class: 'scrap-rarities',
      html: present.map((id) => {
        const r = rarityOf(id);
        const ofRarity = open.filter((c) => getGearDef(c.inst.defId).rarity === id);
        const all = ofRarity.every((c) => selected.has(c.inst.uid));
        return `<button class="rarity-pick ${all ? 'on' : ''}" style="--rc:${r.color}"
                        data-action="pick-rarity" data-rarity="${id}">
                  <span class="rp-dot"></span>${r.name} <small>${ofRarity.length}</small>
                </button>`;
      }).join(''),
    }));
  }

  body.appendChild(h('div', {
    class: 'scrap-actions',
    html: `<button class="btn ${selected.size ? 'primary' : 'ghost'} wide ${selected.size ? '' : 'disabled'}"
                   data-action="dismantle">
             Dismantle ${selected.size || ''} ${selected.size ? `· 🔩 ${fmt(ironTotal)}` : ''}
           </button>`,
  }));

  body.appendChild(h('p', {
    class: 'note',
    text: excludeUpgrades
      ? 'Your best piece for each slot (▲) and anything locked (🔒) is held back. Tap a piece in the Gear tab to lock it.'
      : 'Nothing is held back except locked pieces (🔒). Check what you are selecting.',
  }));

  let armed = false;
  onAction(body, {
    pick: (el) => {
      const uid = el.dataset.uid;
      if (selected.has(uid)) selected.delete(uid); else selected.add(uid);
      armed = false;
      refresh();
    },
    blocked: (el) => toast(el.dataset.why === 'locked'
      ? 'That piece is locked.'
      : 'That is the best one you own for its slot.', 'warn'),
    'toggle-exclude': () => { excludeUpgrades = !excludeUpgrades; armed = false; refresh(); },
    'pick-rarity': (el) => {
      const ofRarity = open.filter((c) => getGearDef(c.inst.defId).rarity === el.dataset.rarity);
      const all = ofRarity.every((c) => selected.has(c.inst.uid));
      for (const c of ofRarity) {
        if (all) selected.delete(c.inst.uid); else selected.add(c.inst.uid);
      }
      armed = false;
      refresh();
    },
    // Two taps, because this destroys several pieces at once and there is no
    // undo. The count and the iron are in the label both times.
    dismantle: (el) => {
      if (!armed) {
        armed = true;
        el.classList.add('danger');
        el.textContent = `Scrap ${selected.size} for good?`;
        return;
      }
      const { iron, count } = inventory.dismantleMany([...selected]);
      selected.clear();
      toast(`Scrapped ${count} for ${iron} iron.`, 'good');
      refresh();
    },
  });
}
