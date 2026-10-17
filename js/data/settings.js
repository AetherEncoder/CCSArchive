// User preferences plus XP and streak progress, stored as one object.

import { read, write } from './db.js';

export const SETTING_DEFAULTS = {
  theme: 'system', // 'system' | 'light' | 'dark'
  dailyGoal: 20, // cards answered per day
  newPerSession: 20, // new cards introduced per study session
  soundOn: true,
  xp: 0,
  streak: 0,
  bestStreak: 0,
  lastStudyDate: null, // "YYYY-MM-DD"
  goalReachedDate: null,
  quizPrefs: { mode: 'mcq', count: 10, direction: 'forward', lives: true },
};

export function getSettings() {
  return { ...SETTING_DEFAULTS, ...read('settings', {}) };
}

export function updateSettings(changes) {
  const next = { ...getSettings(), ...changes };
  write('settings', next);
  return next;
}
