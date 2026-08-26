/**
 * ui/screens/results.js — Post-battle summary and reward payout display.
 */

import { h, fmt, onAction } from '../dom.js';
import { bustSVG } from '../avatar.js';
import { bustHTML } from '../sprites.js';
import { getHeroDef } from '../../hero/index.js';
import { getStage, stageList } from '../../progression/index.js';
import { rarityOf } from '../../config.js';
import { navigate } from '../app.js';

export function render(host, { stageId, won, survivors, seconds, rewards }) {
  const stage = getStage(stageId);

  const rewardRows = [];
  if (rewards) {
    if (rewards.zeni) rewardRows.push(`<div class="reward"><span class="ri">💰</span><span>${fmt(rewards.zeni)} Zeni</span></div>`);
    for (const s of rewards.shards) {
      const def = getHeroDef(s.heroId);
      rewardRows.push(`<div class="reward"><span class="ri shard">${bustHTML(s.heroId, def.art, bustSVG)}</span><span>${def.name} Shard ×${s.amount}</span></div>`);
    }
    for (const g of rewards.gear) {
      const r = rarityOf(g.rarity);
      rewardRows.push(`<div class="reward"><span class="ri" style="color:${r.color}">${g.icon}</span><span>${g.name}</span></div>`);
    }
  }

  const next = stageList().find((s) => !s.cleared && !s.locked);

  host.appendChild(h('div', {
    class: `results ${won ? 'win' : 'lose'}`,
    html: `
      <div class="res-banner">${won ? 'VICTORY' : 'DEFEAT'}</div>
      <div class="res-stage">${stage ? `${stage.id}. ${stage.name}` : ''}</div>
      <div class="res-line">${seconds.toFixed(1)}s · ${survivors} hero${survivors === 1 ? '' : 'es'} standing</div>
      ${rewards?.firstClear ? '<div class="first-clear">First Clear Bonus!</div>' : ''}
      <div class="reward-list">
        ${won ? (rewardRows.join('') || '<p class="note">No drops this time.</p>')
              : '<p class="note">No rewards. Promote a hero, equip gear, or rethink your formation.</p>'}
      </div>
      <div class="res-actions">
        ${won && next
          ? `<button class="btn primary wide" data-action="next" data-stage="${next.stage.id}">Next: ${next.stage.name}</button>`
          : `<button class="btn primary wide" data-action="retry" data-stage="${stageId}">${won ? 'Fight Again' : 'Retry'}</button>`}
        <button class="btn ghost wide" data-action="roster">Manage Heroes</button>
        <button class="btn ghost wide" data-action="campaign">Campaign</button>
      </div>`,
  }));

  onAction(host, {
    next: (el) => navigate('formation', { stageId: Number(el.dataset.stage) }, { replace: true }),
    retry: (el) => navigate('formation', { stageId: Number(el.dataset.stage) }, { replace: true }),
    roster: () => navigate('roster', {}, { replace: true }),
    campaign: () => navigate('campaign', {}, { replace: true }),
  });
}
