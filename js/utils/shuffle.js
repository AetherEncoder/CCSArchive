// Array shuffle

// Fisher-Yates shuffle. Returns a new array and leaves the input untouched.
export function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Pick `count` random items without repeats.
export function sample(items, count) {
  return shuffle(items).slice(0, count);
}

export function pickOne(items) {
  return items[Math.floor(Math.random() * items.length)];
}
