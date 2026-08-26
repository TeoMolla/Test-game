/**
 * main.js — Entry point. Loads the save, boots the shell, shows the campaign.
 */

import { load, persistNow } from './save/index.js';
import { initShell, navigate } from './ui/app.js';

load();
initShell();
navigate('campaign', {}, { replace: true });

// iOS can discard a backgrounded tab without a beforeunload; pagehide is the
// reliable moment to flush.
window.addEventListener('pagehide', persistNow);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persistNow();
});

// Surface module errors on-device, where there is no console.
window.addEventListener('error', (ev) => {
  const box = document.getElementById('toasts');
  if (!box) return;
  box.insertAdjacentHTML('beforeend', `<div class="toast toast-warn">${ev.message}</div>`);
});
