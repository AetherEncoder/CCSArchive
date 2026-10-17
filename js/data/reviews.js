// Review history log: one entry per card answered in study, quiz or match mode.

import { read, write } from './db.js';
import { keyFromTimestamp, todayKey } from '../utils/date.js';

// Oldest entries are dropped past this point to stay well inside the storage quota.
const MAX_REVIEWS = 15000;

export function getReviews() {
  return read('reviews', []);
}

export function logReview({ cardId, deckId, mode, rating = null, correct }) {
  const entry = { cardId, deckId, mode, rating, correct: Boolean(correct), at: Date.now() };
  const reviews = [...getReviews(), entry];
  write('reviews', reviews.length > MAX_REVIEWS ? reviews.slice(-MAX_REVIEWS) : reviews);
  return entry;
}

export function countReviewsOn(dayKey = todayKey()) {
  let count = 0;
  for (const review of getReviews()) {
    if (keyFromTimestamp(review.at) === dayKey) count++;
  }
  return count;
}

// Map of "YYYY-MM-DD" -> { total, correct }
export function getDailyCounts() {
  const counts = new Map();
  for (const review of getReviews()) {
    const key = keyFromTimestamp(review.at);
    const day = counts.get(key) ?? { total: 0, correct: 0 };
    day.total++;
    if (review.correct) day.correct++;
    counts.set(key, day);
  }
  return counts;
}
