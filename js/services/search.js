// Search/filter cards across decks

import { getDecks } from '../data/decks.js';
import { getCards } from '../data/cards.js';

// Lowercase and strip accents so "cafe" finds "Café".
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// Every word of the query must appear in at least one of the fields.
export function matches(fields, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = fields.map(normalize);
  return terms.every((term) => haystack.some((field) => field.includes(term)));
}

export function searchDecks(query, decks = getDecks()) {
  return decks.filter((deck) => matches([deck.title, deck.description, ...(deck.tags ?? [])], query));
}

export function searchCards(query, { deckId = null, cards = getCards(), limit = Infinity } = {}) {
  const results = [];
  for (const card of cards) {
    if (deckId && card.deckId !== deckId) continue;
    if (matches([card.front, card.back, ...(card.choices ?? [])], query)) {
      results.push(card);
      if (results.length >= limit) break;
    }
  }
  return results;
}
