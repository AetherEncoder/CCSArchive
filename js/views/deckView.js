// Deck detail: card list, search, edit/delete

import { getDeck, deleteDeck, deckColorVar } from '../data/decks.js';
import { getCardsByDeck, getDeckStats, deleteCard } from '../data/cards.js';
import { getSettings } from '../data/settings.js';
import { downloadDeck } from '../data/backup.js';
import { cardState } from '../services/srs.js';
import { searchCards } from '../services/search.js';
import { cardsToCsv } from '../services/importers/csv.js';
import { confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { navigate, refresh, setTitle } from '../router.js';
import { notFoundView } from './notFoundView.js';
import { $, escapeHTML, pluralize, downloadFile } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { formatDue, formatSeconds } from '../utils/date.js';
import { clozeRevealedHTML } from '../utils/cardText.js';

const STATE_LABELS = { new: 'New', learning: 'Learning', mastered: 'Mastered' };

function cardItemHTML(card) {
  const state = cardState(card.srs);
  const front = card.type === 'cloze' ? clozeRevealedHTML(card.front) : escapeHTML(card.front);
  let back = escapeHTML(card.back);
  if (card.type === 'mcq' && card.choices?.length) {
    back += `<br><small class="faint">Wrong: ${escapeHTML(card.choices.join(', '))}</small>`;
  }
  if (!back) back = '<span class="faint">No note</span>';

  return `
    <li class="card-item">
      <div>
        <div class="card-item__front">${front}</div>
        ${card.image ? `<img class="card-item__thumb" src="${escapeHTML(card.image)}" alt="">` : ''}
      </div>
      <div class="card-item__back">${back}</div>
      <div class="card-item__meta">
        <span class="badge badge--${state}">${STATE_LABELS[state]}</span>
        <span>${state === 'new' ? 'Not studied yet' : formatDue(card.srs.dueDate)}</span>
      </div>
      <button class="icon-btn icon-btn--danger" type="button" data-delete="${escapeHTML(card.id)}" aria-label="Delete card" title="Delete card">${icon('trash')}</button>
    </li>`;
}

function masteryHTML(stats) {
  const pct = (count) => (stats.total ? (count / stats.total) * 100 : 0);
  const masteredPct = Math.round(pct(stats.mastered));
  return `
    <section class="section panel mastery" aria-labelledby="progress-heading">
      <div class="section-header" style="margin:0">
        <h2 id="progress-heading">Progress</h2>
        <span class="muted">${masteredPct}% mastered</span>
      </div>
      <div class="mastery__bar" role="img" aria-label="${stats.mastered} mastered, ${stats.learning} learning, ${stats.new} new">
        <div class="mastery__segment mastery__segment--mastered" style="width:${pct(stats.mastered)}%"></div>
        <div class="mastery__segment mastery__segment--learning" style="width:${pct(stats.learning)}%"></div>
        <div class="mastery__segment mastery__segment--new" style="width:${pct(stats.new)}%"></div>
      </div>
      <div class="mastery__legend">
        <span><i style="background:var(--seq-4)"></i> Mastered <strong>${stats.mastered}</strong></span>
        <span><i style="background:var(--seq-2)"></i> Learning <strong>${stats.learning}</strong></span>
        <span><i style="background:var(--seq-1)"></i> New <strong>${stats.new}</strong></span>
        ${stats.due ? `<span>${icon('clock')} Due today <strong>${stats.due}</strong></span>` : ''}
      </div>
    </section>`;
}

function modesHTML(deck, cards, toStudy) {
  const id = encodeURIComponent(deck.id);
  const matchMeta = deck.bestMatchMs ? `Best time ${formatSeconds(deck.bestMatchMs)}` : 'Beat the clock';
  return `
    <section class="mode-grid" aria-label="Study modes">
      <a class="mode-card mode-card--primary" href="#/study/${id}">
        <span class="mode-card__icon">${icon('target')}</span>
        <span class="mode-card__title">Study</span>
        <span class="mode-card__meta">${toStudy ? `${pluralize(toStudy, 'card')} to review` : 'All caught up'}</span>
      </a>
      <a class="mode-card" href="#/flip/${id}">
        <span class="mode-card__icon">${icon('book')}</span>
        <span class="mode-card__title">Flashcards</span>
        <span class="mode-card__meta">Flip through all ${cards.length}</span>
      </a>
      <a class="mode-card" href="#/quiz/${id}">
        <span class="mode-card__icon">${icon('quiz')}</span>
        <span class="mode-card__title">Quiz</span>
        <span class="mode-card__meta">Test yourself</span>
      </a>
      <a class="mode-card" href="#/quiz/${id}?mode=match">
        <span class="mode-card__icon">${icon('grid')}</span>
        <span class="mode-card__title">Match</span>
        <span class="mode-card__meta">${matchMeta}</span>
      </a>
    </section>`;
}

export function deckView(root, { params }) {
  const deck = getDeck(params.id);
  if (!deck) return notFoundView(root, { message: 'This deck was deleted or never existed.' });
  setTitle(deck.title);

  const cards = getCardsByDeck(deck.id);
  const stats = getDeckStats(deck.id);
  const toStudy = stats.due + Math.min(stats.new, getSettings().newPerSession);
  const tags = (deck.tags ?? []).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join('');

  root.innerHTML = `
    <div style="--deck-color:${deckColorVar(deck.color)}">
      <a class="back-link" href="#/">${icon('arrowLeft')} All decks</a>
      <header class="deck-header">
        <div class="deck-header__text">
          <h1 class="deck-header__title"><span class="deck-swatch" aria-hidden="true"></span>${escapeHTML(deck.title)}</h1>
          ${deck.description ? `<p>${escapeHTML(deck.description)}</p>` : ''}
          ${tags ? `<div class="tag-list">${tags}</div>` : ''}
        </div>
        <div class="page-header__actions deck-actions">
          <a class="btn btn--secondary" href="#/deck/${encodeURIComponent(deck.id)}/edit">${icon('edit')} Edit deck</a>
          <details class="menu">
            <summary class="btn btn--secondary menu__toggle" aria-label="More actions" title="More actions">${icon('more')}</summary>
            <div class="menu__list">
              ${
                cards.length
                  ? `<button class="menu__item" type="button" data-action="csv">${icon('download')} Download CSV</button>
                    <button class="menu__item" type="button" data-action="share">${icon('share')} Share deck file</button>`
                  : ''
              }
              <button class="menu__item menu__item--danger" type="button" data-action="delete">${icon('trash')} Delete deck</button>
            </div>
          </details>
        </div>
      </header>

      ${
        cards.length
          ? `${modesHTML(deck, cards, toStudy)}
            ${masteryHTML(stats)}
            <section class="section" aria-labelledby="cards-heading">
              <div class="section-header">
                <h2 id="cards-heading">Cards <span class="faint">(${cards.length})</span></h2>
                <div class="search search--compact">
                  ${icon('search')}
                  <input class="input input--sm" type="search" id="card-search" placeholder="Search this deck" aria-label="Search this deck">
                </div>
              </div>
              <ul class="card-list" id="card-list"></ul>
            </section>`
          : `<div class="empty-state">
              <div class="empty-state__icon">${icon('layers')}</div>
              <h2>This deck is empty</h2>
              <p>Add some cards to start studying.</p>
              <div class="row"><a class="btn btn--primary" href="#/deck/${encodeURIComponent(deck.id)}/edit">${icon('plus')} Add cards</a></div>
            </div>`
      }
    </div>`;

  const list = $('#card-list', root);
  const searchInput = $('#card-search', root);

  function renderCards(query = '') {
    if (!list) return;
    const shown = query ? searchCards(query, { cards }) : cards;
    list.innerHTML = shown.length
      ? shown.map(cardItemHTML).join('')
      : `<li class="muted">No cards match "${escapeHTML(query)}".</li>`;
  }

  renderCards();
  searchInput?.addEventListener('input', () => renderCards(searchInput.value.trim()));

  async function onClick(event) {
    // Close the "more actions" menu after picking an item or clicking elsewhere.
    const openMenu = root.querySelector('details.menu[open]');
    if (openMenu && (!openMenu.contains(event.target) || event.target.closest('.menu__item'))) {
      openMenu.removeAttribute('open');
    }

    const deleteId = event.target.closest('[data-delete]')?.dataset.delete;
    if (deleteId) {
      const ok = await confirmDialog({ title: 'Delete this card?', message: 'Its study progress will be lost.', confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      deleteCard(deleteId);
      toast('Card deleted.');
      refresh();
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'csv') {
      downloadFile(`${deck.title || 'deck'}.csv`, cardsToCsv(cards), 'text/csv;charset=utf-8');
    } else if (action === 'share') {
      downloadDeck(deck.id);
      toast('Deck file downloaded. Classmates can import it from their Decks page.', { type: 'success', duration: 4500 });
    } else if (action === 'delete') {
      const ok = await confirmDialog({
        title: `Delete "${deck.title}"?`,
        message: `This removes the deck and its ${pluralize(cards.length, 'card')}. Your past activity stays in Stats.`,
        confirmLabel: 'Delete deck',
        danger: true,
      });
      if (!ok) return;
      deleteDeck(deck.id);
      toast('Deck deleted.');
      navigate('/');
    }
  }

  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
