// Spaced repetition scheduling (SM-2).
// After each review the card gets an interval in days. Good answers multiply the
// interval by the card's "ease"; Again resets it and lowers the ease so the card
// comes back more often.

import { todayKey, addDays } from '../utils/date.js';

export const RATING = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };

export const RATINGS = [
  { value: RATING.AGAIN, key: 'again', label: 'Again' },
  { value: RATING.HARD, key: 'hard', label: 'Hard' },
  { value: RATING.GOOD, key: 'good', label: 'Good' },
  { value: RATING.EASY, key: 'easy', label: 'Easy' },
];

const MIN_EASE = 1.3;
const EASE_CHANGE = { 1: -0.2, 2: -0.15, 3: 0, 4: 0.15 };
const FIRST_INTERVALS = { 2: 1, 3: 1, 4: 4 }; // after the first successful review
const SECOND_INTERVALS = { 2: 3, 3: 6, 4: 9 }; // after the second
export const MASTERED_DAYS = 14;

export function newSrs() {
  return { reps: 0, interval: 0, ease: 2.5, lapses: 0, dueDate: null, lastReviewed: null };
}

export function nextInterval(srs, rating) {
  if (rating === RATING.AGAIN) return 0;
  if (srs.reps === 0) return FIRST_INTERVALS[rating];
  if (srs.reps === 1) return SECOND_INTERVALS[rating];

  const { interval, ease } = srs;
  if (rating === RATING.HARD) return Math.max(interval + 1, Math.round(interval * 1.2));
  if (rating === RATING.GOOD) return Math.max(interval + 1, Math.round(interval * ease));
  return Math.max(interval + 2, Math.round(interval * ease * 1.3));
}

export function schedule(srs, rating, today = todayKey()) {
  const interval = nextInterval(srs, rating);
  return {
    reps: rating === RATING.AGAIN ? 0 : srs.reps + 1,
    interval,
    ease: Math.max(MIN_EASE, Number((srs.ease + EASE_CHANGE[rating]).toFixed(2))),
    lapses: srs.lapses + (rating === RATING.AGAIN && srs.reps > 0 ? 1 : 0),
    dueDate: addDays(today, interval),
    lastReviewed: today,
  };
}

export function isNew(srs) {
  return !srs.lastReviewed;
}

// New cards count as due; reviewed cards are due on or after their due date.
export function isDue(srs, today = todayKey()) {
  return !srs.dueDate || srs.dueDate <= today;
}

export function cardState(srs) {
  if (isNew(srs)) return 'new';
  if (srs.interval >= MASTERED_DAYS) return 'mastered';
  return 'learning';
}
