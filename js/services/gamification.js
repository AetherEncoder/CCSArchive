// XP, streaks, levels and the daily goal

import { getSettings, updateSettings } from '../data/settings.js';
import { countReviewsOn } from '../data/reviews.js';
import { todayKey, addDays } from '../utils/date.js';
import { setState } from '../store.js';

export const XP = {
  review: 10, // study card rated Hard/Good/Easy
  reviewAgain: 2, // study card rated Again (still counts as effort)
  quizCorrect: 10,
  matchPair: 5,
  goalBonus: 50,
};

// Total XP needed to reach a level: 0, 100, 300, 600, 1000, ...
function xpForLevel(level) {
  return 50 * (level - 1) * level;
}

export function levelFromXp(xp) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const start = xpForLevel(level);
  return { level, current: xp - start, needed: xpForLevel(level + 1) - start };
}

// A streak survives until the end of the day after the last study day.
export function currentStreak(settings = getSettings(), today = todayKey()) {
  const last = settings.lastStudyDate;
  if (last === today || last === addDays(today, -1)) return settings.streak;
  return 0;
}

export function getProfile() {
  const settings = getSettings();
  const today = todayKey();
  return {
    xp: settings.xp,
    ...levelFromXp(settings.xp),
    streak: currentStreak(settings, today),
    bestStreak: settings.bestStreak,
    studiedToday: settings.lastStudyDate === today,
    todayCount: countReviewsOn(today),
    dailyGoal: settings.dailyGoal,
  };
}

export function publishProfile() {
  setState('profile', getProfile());
}

// Call after logging each answered card. Adds XP, extends the streak and checks
// the daily goal. Returns what happened so the view can celebrate.
export function recordProgress(xpGained) {
  const settings = getSettings();
  const today = todayKey();

  let { streak, lastStudyDate } = settings;
  if (lastStudyDate !== today) {
    streak = lastStudyDate === addDays(today, -1) ? streak + 1 : 1;
    lastStudyDate = today;
  }

  let xp = settings.xp + xpGained;
  const goalReached = settings.goalReachedDate !== today && countReviewsOn(today) >= settings.dailyGoal;
  if (goalReached) xp += XP.goalBonus;

  const before = levelFromXp(settings.xp).level;
  const after = levelFromXp(xp).level;

  updateSettings({
    xp,
    streak,
    bestStreak: Math.max(settings.bestStreak, streak),
    lastStudyDate,
    goalReachedDate: goalReached ? today : settings.goalReachedDate,
  });
  publishProfile();

  return { xpGained: xpGained + (goalReached ? XP.goalBonus : 0), goalReached, levelUp: after > before, level: after };
}
