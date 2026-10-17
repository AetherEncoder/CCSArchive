// Deck tile shown on the dashboard

import { escapeHTML, pluralize } from '../utils/dom.js';
import { deckColorVar } from '../data/decks.js';
import { progressHTML } from './progressBar.js';

const EMPTY_STATS = { total: 0, new: 0, learning: 0, mastered: 0, due: 0 };

export function deckCardHTML(deck, stats = EMPTY_STATS) {
  const tags = (deck.tags ?? [])
    .slice(0, 3)
    .map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`)
    .join('');

  return `
    <a class="deck-card" href="#/deck/${encodeURIComponent(deck.id)}" style="--deck-color:${deckColorVar(deck.color)}">
      <div class="stack" style="gap:6px">
        <h3 class="deck-card__title"><span class="deck-swatch" aria-hidden="true"></span>${escapeHTML(deck.title)}</h3>
        ${
          deck.description
            ? `<p class="deck-card__desc">${escapeHTML(deck.description)}</p>`
            : '<p class="deck-card__desc deck-card__desc--empty">No description</p>'
        }
      </div>
      ${tags ? `<div class="tag-list">${tags}</div>` : ''}
      <div class="deck-card__footer">
        <div class="deck-card__counts">
          <span>${pluralize(stats.total, 'card')}</span>
          ${stats.due ? `<span class="badge badge--due">${stats.due} due</span>` : ''}
          ${stats.new ? `<span class="badge badge--new">${stats.new} new</span>` : ''}
        </div>
        ${progressHTML(stats.mastered, stats.total, { label: `${stats.mastered} of ${stats.total} mastered`, variant: 'sm deck' })}
      </div>
    </a>`;
}
