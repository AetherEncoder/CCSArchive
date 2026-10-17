// CRUD for decks

import { read, write } from './db.js';
import { createId } from '../utils/id.js';
import { deleteCardsByDeck } from './cards.js';

export const DECK_COLORS = ['violet', 'blue', 'teal', 'green', 'amber', 'orange', 'rose', 'slate'];

export function deckColorVar(color) {
  return `var(--deck-${DECK_COLORS.includes(color) ? color : 'violet'})`;
}

export function getDecks() {
  return read('decks', []);
}

export function getDeck(id) {
  return getDecks().find((deck) => deck.id === id) ?? null;
}

// Most recently studied or edited first
export function getSortedDecks() {
  const recency = (deck) => Math.max(deck.lastStudiedAt ?? 0, deck.updatedAt ?? 0);
  return [...getDecks()].sort((a, b) => recency(b) - recency(a));
}

export function createDeck(fields) {
  const now = Date.now();
  const deck = {
    id: createId(),
    title: '',
    description: '',
    color: 'violet',
    tags: [],
    createdAt: now,
    updatedAt: now,
    lastStudiedAt: null,
    bestMatchMs: null,
    ...cleanFields(fields),
  };
  write('decks', [...getDecks(), deck]);
  return deck;
}

// `touch: false` changes the deck without counting it as an edit (used for study stats).
export function updateDeck(id, changes, { touch = true } = {}) {
  let updated = null;
  const decks = getDecks().map((deck) => {
    if (deck.id !== id) return deck;
    updated = { ...deck, ...changes, ...(touch ? { updatedAt: Date.now() } : {}) };
    return updated;
  });
  write('decks', decks);
  return updated;
}

export function markDeckStudied(id) {
  return updateDeck(id, { lastStudiedAt: Date.now() }, { touch: false });
}

// Review history is kept so the stats heatmap and streaks survive deleting a deck.
export function deleteDeck(id) {
  write('decks', getDecks().filter((deck) => deck.id !== id));
  deleteCardsByDeck(id);
}

export function parseTags(text) {
  return [...new Set(String(text ?? '').split(',').map((tag) => tag.trim()).filter(Boolean))];
}

function cleanFields({ title, description, color, tags } = {}) {
  const fields = {};
  if (title !== undefined) fields.title = String(title).trim();
  if (description !== undefined) fields.description = String(description).trim();
  if (color !== undefined) fields.color = DECK_COLORS.includes(color) ? color : 'violet';
  if (tags !== undefined) fields.tags = Array.isArray(tags) ? tags : parseTags(tags);
  return fields;
}
