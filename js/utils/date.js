// Date helpers: due checks, day differences for streaks.
// Days are stored as local "YYYY-MM-DD" keys so streaks and due dates follow the
// user's calendar, and two keys can be compared as plain strings.

const DAY_MS = 24 * 60 * 60 * 1000;

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function keyFromTimestamp(timestamp) {
  return todayKey(new Date(timestamp));
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, days) {
  const date = parseKey(key);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

export function daysBetween(fromKey, toKey) {
  // Math.round absorbs the 23/25-hour days around daylight saving changes.
  return Math.round((parseKey(toKey) - parseKey(fromKey)) / DAY_MS);
}

export function formatDue(key, today = todayKey()) {
  if (!key) return 'New';
  const diff = daysBetween(today, key);
  if (diff <= 0) return 'Due now';
  if (diff === 1) return 'Due tomorrow';
  if (diff < 30) return `Due in ${diff} days`;
  if (diff < 365) return `Due in ${Math.round(diff / 30)} mo`;
  return `Due in ${(diff / 365).toFixed(1)} yr`;
}

// Short label for a rating button: "now", "3d", "1.5mo", "1.2y"
export function formatInterval(days) {
  if (days <= 0) return 'now';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Number((days / 30).toFixed(1))}mo`;
  return `${Number((days / 365).toFixed(1))}y`;
}

export function formatDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const date = typeof value === 'string' ? parseKey(value) : new Date(value);
  return date.toLocaleDateString(undefined, options);
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

// "12.4s" for the matching game timer
export function formatSeconds(ms) {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
