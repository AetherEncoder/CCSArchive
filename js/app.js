// Entry point: init DB, load settings, start router

import { startRouter } from './router.js';
import { subscribe } from './store.js';
import { getSettings } from './data/settings.js';
import { publishProfile } from './services/gamification.js';
import { applyTheme } from './utils/theme.js';
import { toast } from './components/toast.js';

function renderNavStats(profile) {
  const streak = document.getElementById('nav-streak');
  const level = document.getElementById('nav-level');
  streak.textContent = profile.streak;
  streak.closest('.nav-stat').classList.toggle('is-inactive', !profile.studiedToday);
  streak.closest('.nav-stat').title = profile.studiedToday
    ? `${profile.streak} day streak`
    : `${profile.streak} day streak. Study today to keep it going.`;
  level.textContent = `Lv ${profile.level}`;
  level.closest('.nav-stat').title = `Level ${profile.level}: ${profile.current} / ${profile.needed} XP to the next level`;
}

function reportError(error) {
  console.error(error);
  toast(error?.message || 'Something went wrong.', { type: 'error', duration: 5000 });
}

function init() {
  applyTheme(getSettings().theme);

  subscribe('profile', renderNavStats);
  publishProfile();

  window.addEventListener('error', (event) => reportError(event.error));
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason));

  // The streak display depends on the date, so refresh it when the tab comes back.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) publishProfile();
  });

  startRouter(document.getElementById('app'));
}

init();
