/**
 * ui/dom.js — Minimal DOM helpers. No framework, no build step.
 */

export function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') {
      // Custom properties (--foo) are invisible to Object.assign — they must
      // go through setProperty, which is how rarity colours reach the CSS.
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, val);
        else node.style[prop] = val;
      }
    }
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Bind clicks by [data-action] within a root — cheap event delegation. */
export function onAction(root, handlers) {
  root.addEventListener('click', (ev) => {
    const target = ev.target.closest('[data-action]');
    if (!target || !root.contains(target)) return;
    const fn = handlers[target.dataset.action];
    if (fn) { ev.preventDefault(); fn(target, ev); }
  });
}

export function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}

/** Star pip row, e.g. ★★★☆☆ */
export function starRow(star, max = 5) {
  let out = '';
  for (let i = 0; i < max; i++) out += `<span class="pip ${i < star ? 'on' : ''}">★</span>`;
  return `<span class="stars">${out}</span>`;
}

/** Brief non-blocking message at the top of the screen. */
export function toast(message, kind = 'info') {
  const host = document.getElementById('toasts') || document.body;
  const node = h('div', { class: `toast toast-${kind}`, text: message });
  host.appendChild(node);
  setTimeout(() => node.classList.add('out'), 1800);
  setTimeout(() => node.remove(), 2200);
}
