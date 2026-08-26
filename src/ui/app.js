/**
 * ui/app.js — Screen router and app shell.
 *
 * Screens are plain modules exporting `render(container, params)` and an
 * optional `dispose()`. Adding a screen is a one-line registry change.
 */

import { clear, $, fmt } from './dom.js';
import { getState, subscribe } from '../save/index.js';
import { PROTAGONIST_ID } from '../hero/heroes.js';

import * as campaign from './screens/campaign.js';
import * as dungeons from './screens/dungeons.js';
import * as roster from './screens/roster.js';
import * as companions from './screens/companions.js';
import * as bag from './screens/bag.js';
import * as heroDetail from './screens/heroDetail.js';
import * as formation from './screens/formation.js';
import * as battle from './screens/battle.js';
import * as results from './screens/results.js';

const SCREENS = { campaign, dungeons, roster, companions, bag, heroDetail, formation, battle, results };

const TITLES = {
  campaign: 'Campaign',
  dungeons: 'Dungeons',
  roster: 'Hero',
  companions: 'Companions',
  bag: 'Bag',
  heroDetail: 'Hero',
  formation: 'Formation',
  battle: 'Battle',
  results: 'Results',
};

/** Screens that hide the shell chrome. */
const FULLSCREEN = new Set(['battle', 'results']);

/** Which tab lights up for a given screen. */
const TAB_OF = {
  campaign: 'campaign', dungeons: 'dungeons', roster: 'roster',
  companions: 'companions', bag: 'bag',
};

let current = null;
let history = [];

export function navigate(name, params = {}, { replace = false } = {}) {
  const screen = SCREENS[name];
  if (!screen) { console.error('[app] unknown screen', name); return; }

  if (current && SCREENS[current.name]?.dispose) {
    try { SCREENS[current.name].dispose(); } catch (err) { console.error(err); }
  }

  if (current && !replace) history.push(current);
  if (FULLSCREEN.has(name)) history = history.filter((h) => !FULLSCREEN.has(h.name));

  current = { name, params };

  const host = $('#screen');
  clear(host);
  host.dataset.screen = name;
  document.body.dataset.screen = name;

  $('#screen-title').textContent = TITLES[name] || name;
  $('#topbar').hidden = FULLSCREEN.has(name);
  $('#tabbar').hidden = FULLSCREEN.has(name);
  $('.back-btn').hidden = history.length === 0 || FULLSCREEN.has(name);

  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('active', tab.dataset.tab === tabFor(name, params));
  }

  host.scrollTop = 0;
  screen.render(host, params);
  refreshWallet();
}

export function back() {
  const prev = history.pop();
  if (!prev) return navigate('campaign', {}, { replace: true });
  const keep = history;
  navigate(prev.name, prev.params, { replace: true });
  history = keep;
}

/** Re-render the current screen in place (after a purchase, promote, etc). */
export function refresh() {
  if (!current) return;
  const keep = history.slice();
  navigate(current.name, current.params, { replace: true });
  history = keep;
}

export function currentScreen() {
  return current;
}

/** Which tab should light up. Hero detail depends on whose detail it is. */
function tabFor(name, params) {
  // A companion opened from either place still belongs to the companion tab;
  // the protagonist belongs to his own.
  if (name === 'heroDetail') {
    return params?.heroId === PROTAGONIST_ID ? 'roster' : 'companions';
  }
  // The pre-battle screen belongs to whichever list the fight came from.
  if (name === 'formation') {
    return params?.ref?.kind === 'dungeon' ? 'dungeons' : 'campaign';
  }
  return TAB_OF[name];
}

function refreshWallet() {
  const zeni = $('#wallet-zeni .val');
  if (zeni) zeni.textContent = fmt(getState().zeni);
  const senzu = $('#wallet-senzu .val');
  if (senzu) senzu.textContent = fmt(getState().senzu);
  const iron = $('#wallet-iron .val');
  if (iron) iron.textContent = fmt(getState().iron || 0);
}

export function initShell() {
  document.querySelector('.back-btn').addEventListener('click', back);
  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
      history = [];
      navigate(tab.dataset.tab, {}, { replace: true });
    });
  }
  subscribe(refreshWallet);
  refreshWallet();
}
