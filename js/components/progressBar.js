// Progress bar component

import { createEl, escapeHTML } from '../utils/dom.js';

function percent(value, max) {
  return max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
}

// Live bar you can update: const bar = createProgressBar(...); bar.set(3, 10);
// Used for sessions, so it always shows an 8px sliver to read as a progress bar from the start.
export function createProgressBar({ value = 0, max = 100, label = 'Progress', variant = '' } = {}) {
  const fill = createEl('div', { class: 'progress__fill' });
  const el = createEl(
    'div',
    { class: `progress ${variant ? `progress--${variant}` : ''}`, role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0 },
    fill,
  );

  function set(nextValue, nextMax = max) {
    max = nextMax;
    fill.style.transform = `translateX(calc(max(${percent(nextValue, max)}%, 8px) - 100%))`;
    el.setAttribute('aria-valuenow', Math.round(nextValue));
    el.setAttribute('aria-valuemax', max);
  }

  set(value, max);
  return { el, set };
}

// Static bar as an HTML string, for templates.
export function progressHTML(value, max, { label = 'Progress', variant = '' } = {}) {
  const classes = ['progress', ...variant.split(' ').filter(Boolean).map((v) => `progress--${v}`)].join(' ');
  return `<div class="${classes}" role="progressbar" aria-label="${escapeHTML(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}">
    <div class="progress__fill" style="transform:translateX(${percent(value, max) - 100}%)"></div>
  </div>`;
}
