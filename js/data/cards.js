// CRUD for cards. Cards of a deck are kept in the order they were added/edited.

import { read, write } from './db.js';
import { createId } from '../utils/id.js';
import { todayKey } from '../utils/date.js';
import { newSrs, isDue, isNew, cardState } from '../services/srs.js';

export const CARD_TYPES = {
  basic: 'Basic',
  cloze: 'Fill in the blank',
  mcq: 'Multiple choice',
};

export function getCards() {
  return read('cards', []);
}

export function getCardsByDeck(deckId) {
  return getCards().filter((card) => card.deckId === deckId);
}

export function getCard(id) {
  return getCards().find((card) => card.id === id) ?? null;
}

export function createCards(deckId, list) {
  const created = list.map((fields) => buildCard(deckId, fields));
  write('cards', [...getCards(), ...created]);
  return created;
}

export function updateCard(id, changes) {
  write('cards', getCards().map((card) => (card.id === id ? { ...card, ...changes } : card)));
}

export function deleteCard(id) {
  write('cards', getCards().filter((card) => card.id !== id));
}

export function deleteCardsByDeck(deckId) {
  write('cards', getCards().filter((card) => card.deckId !== deckId));
}

// Replaces a deck's cards with the editor's rows. Rows that carry an existing id
// keep their study progress; rows without one become new cards.
export function saveDeckCards(deckId, rows) {
  const existing = new Map(getCardsByDeck(deckId).map((card) => [card.id, card]));
  const others = getCards().filter((card) => card.deckId !== deckId);
  const next = rows.map((row) => {
    const previous = row.id ? existing.get(row.id) : null;
    return previous ? { ...previous, ...pickFields(row) } : buildCard(deckId, row);
  });
  write('cards', [...others, ...next]);
  return next;
}

// Counts for one deck, or every card when deckId is null.
export function getDeckStats(deckId = null, today = todayKey()) {
  const stats = { total: 0, new: 0, learning: 0, mastered: 0, due: 0 };
  for (const card of getCards()) {
    if (deckId && card.deckId !== deckId) continue;
    stats.total++;
    stats[cardState(card.srs)]++;
    if (!isNew(card.srs) && isDue(card.srs, today)) stats.due++;
  }
  return stats;
}

// Stats for every deck in one pass, keyed by deck id.
export function getAllDeckStats(today = todayKey()) {
  const map = new Map();
  for (const card of getCards()) {
    if (!map.has(card.deckId)) map.set(card.deckId, { total: 0, new: 0, learning: 0, mastered: 0, due: 0 });
    const stats = map.get(card.deckId);
    stats.total++;
    stats[cardState(card.srs)]++;
    if (!isNew(card.srs) && isDue(card.srs, today)) stats.due++;
  }
  return map;
}

function buildCard(deckId, fields) {
  return {
    id: createId(),
    deckId,
    type: 'basic',
    front: '',
    back: '',
    choices: [],
    image: null,
    createdAt: Date.now(),
    srs: newSrs(),
    ...pickFields(fields),
  };
}

function pickFields({ type, front, back, choices, image } = {}) {
  const fields = {};
  if (type !== undefined) fields.type = CARD_TYPES[type] ? type : 'basic';
  if (front !== undefined) fields.front = String(front);
  if (back !== undefined) fields.back = String(back);
  if (choices !== undefined) fields.choices = Array.isArray(choices) ? choices.map(String) : [];
  if (image !== undefined) fields.image = image || null;
  return fields;
}
