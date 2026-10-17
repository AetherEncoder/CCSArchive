// Storage wrapper (localStorage now, IndexedDB later) - only file that touches storage directly.
// Values are cached in memory after the first read. Treat everything returned from
// read() as read-only: build a new array/object and write() it back instead of mutating.

const PREFIX = 'ccsarchive:';
const cache = new Map();

export function read(key, fallback) {
  if (cache.has(key)) return cache.get(key);

  let value = fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw !== null) value = JSON.parse(raw);
  } catch (err) {
    console.warn(`Could not read "${key}" from storage`, err);
  }
  cache.set(key, value);
  return value;
}

export function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      throw new Error('Browser storage is full. Remove some images or decks, or export a backup first.');
    }
    throw new Error('Could not save. Your browser may be blocking storage for this page.');
  }
  cache.set(key, value);
}

export function remove(key) {
  localStorage.removeItem(PREFIX + key);
  cache.delete(key);
}

export function clearAll() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  }
  cache.clear();
}

// Browsers cap localStorage at roughly 5 million characters per site.
export const STORAGE_LIMIT = 5_000_000;

// Characters used by this app, which is the unit the browser limit is counted in.
export function storageUsage() {
  let chars = 0;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(PREFIX)) chars += key.length + (localStorage.getItem(key)?.length ?? 0);
  }
  return chars;
}

// Keep the cache honest when another tab changes the data.
window.addEventListener('storage', (event) => {
  if (event.key === null) cache.clear();
  else if (event.key.startsWith(PREFIX)) cache.delete(event.key.slice(PREFIX.length));
});
