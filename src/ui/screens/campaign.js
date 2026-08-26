/**
 * ui/screens/campaign.js — Linear story stage list.
 */

import { h, fmt, onAction } from '../dom.js';
import { bustSVG } from '../avatar.js';
import { stageList, buildEnemyTeam } from '../../progression/index.js';
import { teamPower } from '../../hero/index.js';
import { rarityOf } from '../../config.js';
import { navigate } from '../app.js';

export function render(host) {
  const power = teamPower();
  const list = stageList();

  host.appendChild(h('div', {
    class: 'power-banner',
    html: `<div class="pb-label">Team Power</div>
           <div class="pb-value">⚡ ${fmt(power)}</div>
           <button class="btn ghost small" data-action="edit-team">Edit Team</button>`,
  }));

  const wrap = h('div', { class: 'stage-list' });

  for (const entry of list) {
    const { stage, cleared, locked, underpowered } = entry;
    const enemies = buildEnemyTeam(stage.id);
    const previews = enemies.slice(0, 4).map((e) => {
      const r = rarityOf(e.rarity);
      return `<span class="enemy-chip" style="--rc:${r.color}">${bustSVG(e.art)}</span>`;
    }).join('');

    const statusClass = locked ? 'locked' : cleared ? 'cleared' : underpowered ? 'risky' : 'ready';

    wrap.appendChild(h('div', {
      class: `stage-card ${statusClass}`,
      dataset: { stage: stage.id },
      html: `
        <div class="stage-num">${stage.id}</div>
        <div class="stage-body">
          <div class="stage-name">${stage.name} ${cleared ? '<span class="tick">✓</span>' : ''}</div>
          <div class="stage-sub">${stage.subtitle}</div>
          <div class="enemy-row">${previews}${enemies.length > 4 ? `<span class="more">+${enemies.length - 4}</span>` : ''}</div>
          <div class="stage-meta">
            <span class="gate ${underpowered ? 'warn' : 'ok'}">⚡ ${fmt(stage.requiredPower)} recommended</span>
          </div>
        </div>
        <div class="stage-action">
          ${locked
            ? '<span class="lock">🔒</span>'
            : `<button class="btn ${underpowered ? 'warn' : 'primary'} small" data-action="play" data-stage="${stage.id}">${cleared ? 'Replay' : 'Fight'}</button>`}
        </div>`,
    }));
  }

  host.appendChild(wrap);

  host.appendChild(h('p', {
    class: 'note',
    text: 'Recommended power is a warning, not a wall — you can attempt an over-tuned fight and lose.',
  }));

  onAction(host, {
    play: (el) => navigate('formation', { stageId: Number(el.dataset.stage) }),
    'edit-team': () => navigate('formation', { stageId: null }),
  });
}
