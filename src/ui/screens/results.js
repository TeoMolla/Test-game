/**
 * ui/screens/results.js — Post-battle summary and reward payout display.
 */

import { h, fmt, onAction } from '../dom.js';
import { bustSVG } from '../avatar.js';
import { bustHTML } from '../sprites.js';
import { getHeroDef, levelOf } from '../../hero/index.js';
import {
  encounterInfo, stageList, stageRef, dungeonRef, dungeonList,
} from '../../progression/index.js';
import { rarityOf } from '../../config.js';
import { navigate } from '../app.js';

export function render(host, { ref, won, survivors, seconds, rewards }) {
  const info = encounterInfo(ref);

  const rewardRows = [];
  if (rewards) {
    if (rewards.xp) {
      rewardRows.push(`<div class="reward"><span class="ri">✨</span><span>${fmt(rewards.xp)} XP</span></div>`);
    }
    for (const up of rewards.levels || []) {
      const def = getHeroDef(up.heroId);
      rewardRows.push(`<div class="reward level-up">
          <span class="ri">⬆️</span>
          <span>${def.name} reached <b>Lv.${up.to}</b></span>
        </div>`);
    }
    if (rewards.senzu) {
      rewardRows.push(`<div class="reward"><span class="ri">🫘</span><span>Senzu Bean ×${rewards.senzu}</span></div>`);
    }
    if (rewards.zeni) rewardRows.push(`<div class="reward"><span class="ri">💰</span><span>${fmt(rewards.zeni)} Zeni</span></div>`);
    for (const s of rewards.shards) {
      const def = getHeroDef(s.heroId);
      rewardRows.push(`<div class="reward"><span class="ri shard">${bustHTML(s.heroId, def.art, bustSVG)}</span><span>${def.name} Shard ×${s.amount}</span></div>`);
    }
    for (const g of rewards.gear) {
      const r = rarityOf(g.rarity);
      rewardRows.push(`<div class="reward">
          <span class="ri" style="color:${r.color}">${g.icon}</span>
          <span>${g.name} <span class="glv" style="color:${r.color}">Lv.${g.level}</span></span>
        </div>`);
    }
  }

  // What to offer next depends on where the fight came from: the story moves
  // you forward, a dungeon offers the difficulty you just unlocked.
  const follow = won ? nextEncounter(ref) : null;
  const home = ref?.kind === 'dungeon'
    ? { screen: 'dungeons', label: 'Dungeons' }
    : { screen: 'campaign', label: 'Campaign' };

  host.appendChild(h('div', {
    class: `results ${won ? 'win' : 'lose'}`,
    html: `
      <div class="res-banner">${won ? 'VICTORY' : 'DEFEAT'}</div>
      <div class="res-stage">${info ? info.title : ''}</div>
      <div class="res-line">${seconds.toFixed(1)}s · ${survivors} hero${survivors === 1 ? '' : 'es'} standing</div>
      ${rewards?.firstClear ? '<div class="first-clear">First Clear Bonus!</div>' : ''}
      ${rewards?.unlocked ? `<div class="first-clear unlock">${rewards.unlocked} Unlocked!</div>` : ''}
      <div class="reward-list">
        ${won ? (rewardRows.join('') || '<p class="note">No drops this time.</p>')
              : '<p class="note">No rewards. Promote a hero, equip gear, or rethink your formation.</p>'}
      </div>
      <div class="res-actions">
        ${follow
          ? `<button class="btn primary wide" data-action="next">Next: ${follow.label}</button>`
          : `<button class="btn primary wide" data-action="retry">${won ? 'Fight Again' : 'Retry'}</button>`}
        <button class="btn ghost wide" data-action="roster">Manage Heroes</button>
        <button class="btn ghost wide" data-action="home">${home.label}</button>
      </div>`,
  }));

  onAction(host, {
    next: () => navigate('formation', { ref: follow.ref }, { replace: true }),
    retry: () => navigate('formation', { ref }, { replace: true }),
    roster: () => navigate('roster', {}, { replace: true }),
    home: () => navigate(home.screen, {}, { replace: true }),
  });
}

/**
 * The natural follow-up after a win. A story clear points at the next stage;
 * a dungeon clear points at the difficulty that clear just opened, and stops
 * offering one at Extreme.
 */
function nextEncounter(ref) {
  if (ref?.kind === 'dungeon') {
    const entry = dungeonList().find((d) => d.dungeon.id === ref.dungeonId);
    const idx = entry?.tiers.findIndex((t) => t.tier === ref.tier) ?? -1;
    const up = idx >= 0 ? entry.tiers[idx + 1] : null;
    return up
      ? { label: `${up.meta.name} — ${up.def.title}`, ref: dungeonRef(ref.dungeonId, up.tier) }
      : null;
  }
  const next = stageList().find((s) => !s.cleared && !s.locked);
  return next ? { label: next.stage.name, ref: stageRef(next.stage.id) } : null;
}
