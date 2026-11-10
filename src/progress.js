// The progress bar at the top of the scene: one icon per stage, joined by a line.
//
//   done      the garment has been removed
//   removing  its strip is playing right now (the ring fills up to the moment it comes off)
//   queued    the problem is solved but another strip is still playing
//   current   the stage you are working towards (the next problem to solve)
//   upcoming  later stages
//
// main.js calls update() every frame with one { status, fraction } per stage;
// the DOM is only touched when something actually changed.

import './progress.css';
import { UI } from './config.js';

// Simple line icons, drawn on a 24 x 24 grid
const ICONS = {
  stockings: `
    <path d="M8 3h7v9.5l3.6 3.2c1.6 1.4.9 4.1-1.2 4.6-1.7.4-3.1-.1-4.3-1.2L8 14.5z"/>
    <path d="M8 6.5h7"/>`,
  belt: `
    <rect x="3" y="4.5" width="18" height="4.5" rx="1.5"/>
    <path d="M7 9v7.5M17 9v7.5M12 9v4.5"/>
    <circle cx="7" cy="18.5" r="1.6"/>
    <circle cx="17" cy="18.5" r="1.6"/>
    <circle cx="12" cy="15.2" r="1.3"/>`,
  bra: `
    <path d="M4.5 8.5 7.5 3M19.5 8.5 16.5 3"/>
    <path d="M3 9h8.5L7.2 17.5z"/>
    <path d="M12.5 9H21l-4.2 8.5z"/>
    <path d="M11.5 9.8h1"/>`,
  panties: `
    <path d="M3 5h18l-1.4 4.2c-2.6 1-4.1 3.7-5.1 8.8h-5c-1-5.1-2.5-7.8-5.1-8.8z"/>
    <path d="M3.9 7.6h16.2"/>`,
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// What the line of text under the icons says
function captionFor(steps, model) {
  const name = (index) => steps[index].label.toLowerCase();

  const removing = model.findIndex((m) => m.status === 'removing');
  if (removing >= 0) return `Removing ${name(removing)}…`;

  const queued = model.findIndex((m) => m.status === 'queued');
  if (queued >= 0) return `Up next: ${name(queued)}`;

  const current = model.findIndex((m) => m.status === 'current');
  if (current >= 0) return `Solve problem ${current + 1} to remove the ${name(current)}`;

  return 'All stages complete';
}

/**
 * @param {Array<{label: string, icon: string}>} steps  one entry per stage
 * @returns {{ update(model: Array<{status: string, fraction: number}>): void }}
 */
export function initProgress(steps) {
  const root = document.getElementById(UI.progressId);
  if (!root) return { update() {} };

  root.innerHTML = '';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Progress');

  const list = el('ol', 'steps');
  const items = steps.map((step) => {
    const item = el('li', 'step upcoming');

    const node = el('span', 'node');
    node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[step.icon] ?? ''}</svg>`;
    node.append(el('span', 'check', '✓'));

    item.append(node, el('span', 'label', step.label));
    list.append(item);
    return item;
  });

  const caption = el('div', 'caption');
  caption.setAttribute('aria-live', 'polite');
  root.append(list, caption);

  let last = '';
  return {
    update(model) {
      const key = model.map((m) => `${m.status}:${Math.round(m.fraction * 100)}`).join('|');
      if (key === last) return;
      last = key;

      items.forEach((item, index) => {
        const { status, fraction } = model[index];
        const percent = Math.round(fraction * 100);
        item.className = `step ${status}`;
        item.style.setProperty('--p', percent); // ring fill while removing
        // the line to the next stage fills as this stage's garment comes off
        item.style.setProperty('--fill', `${status === 'done' ? 100 : status === 'removing' ? percent : 0}%`);
        item.setAttribute('aria-current', status === 'current' ? 'step' : 'false');
      });
      caption.textContent = captionFor(steps, model);
    },
  };
}
