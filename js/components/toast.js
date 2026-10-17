// Toast notification helper

import { createEl } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { playSound } from '../utils/sound.js';

const ICONS = { success: 'check', error: 'alert', info: 'info', reward: 'sparkle' };

export function toast(message, { type = 'info', duration = 3200 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;

  const node = createEl('div', { class: `toast toast--${type}`, html: icon(ICONS[type] ?? 'info') });
  node.append(createEl('span', {}, message));
  root.append(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));

  setTimeout(() => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 300);
  }, duration);
}

// Shows level-ups and daily-goal bonuses returned by recordProgress().
export function celebrate(result) {
  if (!result) return;
  if (result.goalReached) {
    toast('Daily goal reached! +50 XP', { type: 'reward', duration: 4000 });
    playSound('complete');
  }
  if (result.levelUp) {
    toast(`Level up! You're now level ${result.level}.`, { type: 'reward', duration: 4000 });
    if (!result.goalReached) playSound('complete');
  }
}
