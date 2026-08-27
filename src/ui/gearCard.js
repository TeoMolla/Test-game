/**
 * ui/gearCard.js — The item card, shared by the hero screen and the Bag.
 *
 * One piece of gear, everything about it, and the things you can do to it.
 * It opens in two modes because the same item means different things in
 * different places:
 *
 *   SLOT mode  — reached by tapping a slot on the hero. The slot may be empty.
 *                Stats are shown already multiplied by the slot level, because
 *                that is what the hero actually receives. Actions: Replace,
 *                Enhance.
 *   ITEM mode  — reached by tapping a row in the Bag, for a piece that is not
 *                equipped. Stats are the item's own; the slot's level is shown
 *                as what it *would* add. Actions: Equip, Scrap.
 *
 * Locking lives in the header in both modes, which is the point of putting the
 * card behind Bag rows at all — before this, unequipped gear could not be
 * inspected, so there was nowhere to lock it.
 */

import { h, fmt, onAction, toast } from './dom.js';
import { rarityOf } from '../config.js';
import {
  GEAR_SLOT_META, getGearDef, statsAtLevel, gearSlotMult, GEAR_SLOT_LEVEL_STEP,
} from '../gear/index.js';
import * as inventory from '../inventory/index.js';
import { heroSave, powerOf, PROTAGONIST_ID } from '../hero/index.js';
import { getState } from '../save/index.js';
import { refresh } from './app.js';

const STAT_LABEL = { atk: 'ATK', hp: 'HP', def: 'DEF', speed: 'SPD' };

/**
 * @param {object} opts
 *   slot       — open the card for this equipment slot (may be empty)
 *   uid        — open the card for this owned piece; if it happens to be
 *                equipped, the card falls back to slot mode for its slot
 *   onReplace  — called instead of the built-in equip when the player taps the
 *                first action button (the hero screen passes its gear picker)
 */
export function openGearCard({ slot, uid, onReplace } = {}) {
  const heroId = PROTAGONIST_ID;

  // An equipped piece is always shown as its slot — "what am I wearing" is the
  // same question however you arrived at it.
  let mode = 'item';
  let openSlot = slot || null;
  if (!openSlot) {
    const inst = uid ? inventory.gearByUid(uid) : null;
    const def = inst && getGearDef(inst.defId);
    if (inst?.equippedBy && def) { openSlot = def.slot; }
  }
  if (openSlot) mode = 'slot';

  const cardHTML = () => {
    const hs = heroSave(heroId);
    const inst = mode === 'slot'
      ? (hs.equipped[openSlot] ? inventory.gearByUid(hs.equipped[openSlot]) : null)
      : inventory.gearByUid(uid);
    const def = inst ? getGearDef(inst.defId) : null;
    const slotId = openSlot || def?.slot;
    const meta = GEAR_SLOT_META[slotId] || { name: 'Gear', icon: '🎒' };
    const r = def
      ? rarityOf(def.rarity)
      : { color: 'var(--panel-line)', name: 'Empty' };
    const up = inventory.slotUpgradeInfo(slotId);
    // In slot mode the slot level is already in these numbers; in item mode it
    // is not, because the piece is not in the slot yet.
    const mult = mode === 'slot' ? gearSlotMult(up.level) : 1;

    const worth = (mode === 'slot' && def)
      ? powerOf(heroId) - powerOf(heroId, { equipped: { ...hs.equipped, [openSlot]: null } })
      : 0;

    const at = def ? statsAtLevel(def, inst.level) : { flat: {}, pct: {} };
    const mainRows = Object.entries(at.flat).filter(([, v]) => v)
      .map(([k, v]) => `<div class="gd-stat main"><span>${STAT_LABEL[k] || k}</span><b>+${fmt(Math.round(v * mult))}</b></div>`).join('');
    const addRows = Object.entries(at.pct).filter(([, v]) => v)
      .map(([k, v]) => `<div class="gd-stat"><span>${STAT_LABEL[k] || k}</span><b>+${(v * mult * 100).toFixed(1)}%</b></div>`).join('');

    const slotPct = (up.level * GEAR_SLOT_LEVEL_STEP * 100).toFixed(1);
    const slotRow = mode === 'slot'
      ? `<div class="gd-stat"><span>Slot level +${up.level}</span><b>+${slotPct}%</b></div>`
      : `<div class="gd-stat"><span>${meta.name} slot is +${up.level}</span><b>+${slotPct}% once equipped</b></div>`;

    const actions = mode === 'slot'
      ? `<button class="btn ghost small" data-action="replace">${def ? 'Replace' : 'Equip'}</button>
         <button class="btn ${up.canUpgrade ? 'primary' : 'ghost'} small ${up.canUpgrade ? '' : 'disabled'}"
                 data-action="enhance">Enhance 🔩${fmt(up.cost)}</button>`
      : `<button class="btn primary small" data-action="equip">Equip</button>
         <button class="btn ghost small ${inst?.locked ? 'disabled' : ''}" data-action="scrap">
           Scrap 🔩${inst ? fmt(inventory.dismantleCandidates({ excludeUpgrades: false })
             .find((c) => c.inst.uid === inst.uid)?.yield ?? 0) : 0}
         </button>`;

    return `
      <div class="gd-head" style="--gr:${r.color}">
        <span class="gd-name">${def ? def.name : meta.name}</span>
        ${mode === 'slot' ? `<span class="gd-plus">+${up.level}</span>` : ''}
        ${inst ? `<button class="gd-lock ${inst.locked ? 'on' : ''}" data-action="lock"
                    aria-label="${inst.locked ? 'Unlock' : 'Lock'}">${inst.locked ? '🔒' : '🔓'}</button>` : ''}
      </div>

      <div class="gd-band" style="--gr:${r.color}">
        <div class="gd-band-text">
          <div class="gd-slot">${meta.name}</div>
          <div class="gd-rarity">${def ? r.name : 'Empty'}</div>
          ${worth ? `<div class="gd-worth">⚡ ${fmt(worth)}</div>` : ''}
        </div>
        <div class="gd-art">${def ? def.icon : meta.icon}</div>
        ${def ? `<div class="gd-level">Level <b>${inst.level}</b></div>` : ''}
      </div>

      <div class="gd-stats">
        ${def ? mainRows : '<p class="note">Nothing equipped in this slot.</p>'}
        ${addRows ? `<div class="gd-sub">Additional Stats</div>${addRows}` : ''}
        <div class="gd-sub">Slot</div>
        ${slotRow}
        ${inst?.locked ? '<p class="note lock-note">🔒 Locked — this piece will not be offered for scrapping.</p>' : ''}
      </div>

      <div class="gd-actions">${actions}</div>`;
  };

  const sheet = h('div', {
    // Centred rather than a bottom sheet: the picker is a list you scroll, this
    // is a single object you are looking at, and they should not feel alike.
    class: 'sheet-backdrop centred',
    html: `<div class="sheet gear-detail">${cardHTML()}</div>`,
  });
  const redraw = () => { sheet.querySelector('.gear-detail').innerHTML = cardHTML(); };

  let armedScrap = false;
  onAction(sheet, {
    lock: () => {
      const target = mode === 'slot' ? heroSave(heroId).equipped[openSlot] : uid;
      inventory.toggleGearLock(target);
      armedScrap = false;
      redraw();
      refresh();
    },
    replace: () => { sheet.remove(); onReplace?.(); },
    // Enhancing is a repeated action, so the card updates in place: the +N, the
    // stat rows and the power figure all move together on each tap.
    enhance: () => {
      if (inventory.upgradeGearSlot(openSlot)) { redraw(); refresh(); }
      else toast('Not enough iron. Scrap spare gear in the Bag.', 'warn');
    },
    equip: () => {
      inventory.equipGear(heroId, uid);
      sheet.remove();
      refresh();
      openGearCard({ uid, onReplace });
    },
    // Two taps: scrapping is destructive and there is no undo.
    scrap: (el) => {
      if (!armedScrap) {
        armedScrap = true;
        el.classList.add('danger');
        el.textContent = 'Scrap for good?';
        return;
      }
      const gained = inventory.dismantleGear(uid);
      sheet.remove();
      if (gained) toast(`Scrapped for ${gained} iron.`, 'good');
      else toast('Locked gear cannot be scrapped.', 'warn');
      refresh();
    },
  });
  sheet.addEventListener('click', (ev) => { if (ev.target === sheet) sheet.remove(); });
  document.body.appendChild(sheet);
  return sheet;
}
