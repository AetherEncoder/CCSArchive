// Export/import all app data as JSON, plus single-deck files for sharing with classmates.

import { read, write, clearAll } from './db.js';
import { getDeck, createDeck } from './decks.js';
import { getCardsByDeck, createCards } from './cards.js';
import { downloadFile } from '../utils/dom.js';
import { todayKey } from '../utils/date.js';

const BACKUP_FORMAT = 'ccsarchive-backup';
const DECK_FORMAT = 'ccsarchive-deck';
const COLLECTIONS = { decks: [], cards: [], reviews: [], settings: {} };

// ---------- Full backup ----------

export function exportData() {
  const data = { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString() };
  for (const [key, fallback] of Object.entries(COLLECTIONS)) data[key] = read(key, fallback);
  return data;
}

export function downloadBackup() {
  downloadFile(`ccsarchive-backup-${todayKey()}.json`, JSON.stringify(exportData()), 'application/json');
}

export function parseBackup(text) {
  const data = parseJson(text);
  if (data?.format === DECK_FORMAT) throw new Error('That is a single deck file. Import it from the Decks page.');
  if (data?.format !== BACKUP_FORMAT || !Array.isArray(data.decks) || !Array.isArray(data.cards)) {
    throw new Error('That file is not a CCSArchive backup.');
  }
  return data;
}

// Replaces everything. If the new data doesn't fit, the old data is put back.
export function restoreBackup(data) {
  const snapshot = exportData();
  try {
    clearAll();
    write('decks', data.decks);
    write('cards', data.cards);
    write('reviews', Array.isArray(data.reviews) ? data.reviews : []);
    write('settings', data.settings && typeof data.settings === 'object' ? data.settings : {});
  } catch (err) {
    clearAll();
    for (const key of Object.keys(COLLECTIONS)) write(key, snapshot[key]);
    throw err;
  }
}

export function clearAllData() {
  clearAll();
}

// ---------- Single deck sharing ----------

export function downloadDeck(deckId) {
  const deck = getDeck(deckId);
  if (!deck) return;
  const data = {
    format: DECK_FORMAT,
    version: 1,
    deck: { title: deck.title, description: deck.description, color: deck.color, tags: deck.tags },
    cards: getCardsByDeck(deckId).map(({ type, front, back, choices, image }) => ({ type, front, back, choices, image })),
  };
  downloadFile(`${slugify(deck.title)}.ccsdeck.json`, JSON.stringify(data, null, 2), 'application/json');
}

// Returns { deck, cards } ready for importDeck(), or throws with a readable message.
export function parseDeckFile(text) {
  const data = parseJson(text);
  if (data?.format === BACKUP_FORMAT) throw new Error('That is a full backup. Restore it from Settings instead.');
  if (data?.format !== DECK_FORMAT || !data.deck || !Array.isArray(data.cards)) {
    throw new Error('That JSON file is not a CCSArchive deck.');
  }
  const cards = data.cards.filter((card) => card && typeof card.front === 'string');
  return { deck: data.deck, cards };
}

export function importDeck({ deck, cards }) {
  const created = createDeck({ ...deck, title: deck.title || 'Imported deck' });
  try {
    createCards(created.id, cards);
  } catch (err) {
    // Don't leave an empty deck behind if the cards didn't fit.
    write('decks', read('decks', []).filter((item) => item.id !== created.id));
    throw err;
  }
  return created;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
}

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck';
}
