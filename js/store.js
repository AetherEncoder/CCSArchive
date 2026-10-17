// Small shared in-memory state with subscribe/notify.
// Used for values several parts of the page show at once (e.g. XP and streak in the navbar).

const state = {};
const listeners = new Map();

export function getState(key) {
  return state[key];
}

export function setState(key, value) {
  state[key] = value;
  listeners.get(key)?.forEach((fn) => fn(value));
}

// Returns an unsubscribe function.
export function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key).delete(fn);
}
