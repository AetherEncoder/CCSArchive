// Dashboard: decks, cards due today, streak

import { getSortedDecks } from '../data/decks.js';
import { getAllDeckStats, getCards } from '../data/cards.js';
import { isDue, isNew } from '../services/srs.js';
import { deckColorVar } from '../data/decks.js';
import { getSettings } from '../data/settings.js';
import { createSampleDeck } from '../data/sampleDeck.js';
import { getProfile } from '../services/gamification.js';
import { getDailyCounts } from '../data/reviews.js';
import { searchDecks, searchCards } from '../services/search.js';
import { deckCardHTML } from '../components/deckCard.js';
import { openImportModal } from '../components/importModal.js';
import { toast } from '../components/toast.js';
import { navigate, setTitle } from '../router.js';
import { $, escapeHTML, isTypingTarget, isModalOpen } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { greeting, todayKey, addDays, formatDate, formatDue } from '../utils/date.js';
import { cardPrompt, cardAnswer } from '../utils/cardText.js';

// The next few review cards across all decks, oldest due date first.
function upNextHTML(decks) {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  const today = todayKey();
  const due = getCards()
    .filter((card) => byId.has(card.deckId) && !isNew(card.srs) && isDue(card.srs, today))
    .sort((a, b) => (a.srs.dueDate < b.srs.dueDate ? -1 : 1));
  if (!due.length) return '';
  // Fill whole rows of three on wide screens
  due.length = due.length >= 6 ? 6 : due.length >= 3 ? 3 : due.length;
  return `
    <section class="section" aria-labelledby="next-heading">
      <div class="section-header">
        <h2 id="next-heading">Up next</h2>
        <a class="btn btn--secondary" href="#/study/all">Review all</a>
      </div>
      <ol class="up-next">
        ${due
          .map((card) => {
            const deck = byId.get(card.deckId);
            return `
          <li class="up-next__item" style="--deck-color:${deckColorVar(deck.color)}">
            <a href="#/study/${encodeURIComponent(deck.id)}">
              <span class="up-next__prompt">${escapeHTML(cardPrompt(card))}</span>
              <span class="up-next__meta"><span class="deck-swatch" aria-hidden="true"></span>${escapeHTML(deck.title)} · ${formatDue(card.srs.dueDate, today)}</span>
            </a>
          </li>`;
          })
          .join('')}
      </ol>
    </section>`;
}

// Cards answered on each of the last 7 days, as a small bar strip.
function weekHTML() {
  const daily = getDailyCounts();
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(today, i - 6);
    return { key, total: daily.get(key)?.total ?? 0 };
  });
  const max = Math.max(1, ...days.map((day) => day.total));
  const sum = days.reduce((total, day) => total + day.total, 0);
  return `
    <div class="hero__week">
      <div class="hero__week-head"><span>This week</span><b>${sum}</b></div>
      <div class="hero__week-bars" role="img" aria-label="${sum} cards answered in the last 7 days">
        ${days
          .map(
            (day) =>
              `<span class="hero__week-bar ${day.key === today ? 'is-today' : ''}" style="--h:${(day.total / max) * 100}%" data-value="${day.total}" title="${formatDate(day.key, { weekday: 'short' })}: ${day.total}"></span>`,
          )
          .join('')}
      </div>
      <div class="hero__week-labels" aria-hidden="true">
        ${days.map((day) => `<span>${formatDate(day.key, { weekday: 'narrow' })}</span>`).join('')}
      </div>
    </div>`;
}

// Streak, daily goal and level as one sentence-like line.
function summaryLineHTML(profile) {
  const streak = profile.streak
    ? `<b>${profile.streak}</b>-day streak`
    : 'No streak yet';
  return `
    <p class="hero__summary">
      <span>${streak}</span>
      <span><b>${profile.todayCount}</b> of ${profile.dailyGoal} cards today</span>
      <span>Level <b>${profile.level}</b> · ${profile.xp} XP</span>
    </p>`;
}

function heroHTML(hasDecks, toStudy, profile) {
  if (!hasDecks) {
    return `
      <div class="hero__text">
        <h1>Welcome to CCSArchive</h1>
        <p>Make a deck of flashcards, then study it with spaced repetition, quizzes and matching games.</p>
      </div>`;
  }
  if (!toStudy) {
    return `
      <div class="hero__text">
        <h1>${greeting()}</h1>
        ${summaryLineHTML(profile)}
        <p>You're all caught up for today. Nice work!</p>
      </div>`;
  }
  return `
    <div class="hero__text">
      <h1>${greeting()}</h1>
      ${summaryLineHTML(profile)}
    </div>
    <div class="hero__figure">
      <span class="hero__count"><span class="hero__number">${toStudy}</span>
      <span class="hero__unit">${toStudy === 1 ? 'card' : 'cards'} to study today</span></span>
      <a class="btn btn--primary btn--lg" href="#/study/all">${icon('target')} Study now</a>
    </div>`;
}

function emptyDecksHTML() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">${icon('layers')}</div>
      <h2>Build your first deck</h2>
      <p>Type your cards, paste a list, or import a CSV from Quizlet or Anki.</p>
      <div class="row">
        <a class="btn btn--primary" href="#/deck/new">${icon('plus')} New deck</a>
        <button class="btn btn--secondary" type="button" data-action="import">${icon('upload')} Import</button>
        <button class="btn btn--ghost" type="button" data-action="sample">${icon('sparkle')} Try a sample deck</button>
      </div>
    </div>`;
}

export function dashboardView(root) {
  setTitle('Decks');

  const decks = getSortedDecks();
  const statsByDeck = getAllDeckStats();
  const settings = getSettings();
  const profile = getProfile();
  const deckTitles = new Map(decks.map((deck) => [deck.id, deck.title]));

  let due = 0;
  let fresh = 0;
  for (const stats of statsByDeck.values()) {
    due += stats.due;
    fresh += stats.new;
  }
  const toStudy = due + Math.min(fresh, settings.newPerSession);

  root.innerHTML = `
    <section class="hero"><div class="hero__main">${heroHTML(decks.length > 0, toStudy, profile)}</div>${decks.length ? weekHTML() : ''}</section>

    <section class="section" aria-labelledby="decks-heading">
      <div class="section-header">
        <h2 id="decks-heading">Your decks</h2>
        ${
          decks.length
            ? `<div class="section-header__actions">
                <button class="btn btn--secondary deck-import-btn" type="button" data-action="import" aria-label="Import" title="Import">${icon('upload')}<span class="btn__label">Import</span></button>
                <a class="btn btn--primary" href="#/deck/new">${icon('plus')} New deck</a>
              </div>`
            : ''
        }
      </div>
      ${
        decks.length
          ? `<div class="deck-toolbar" style="margin-bottom:var(--space-4)">
              <div class="search">
                ${icon('search')}
                <input class="input" type="search" id="deck-search" placeholder="Search decks and cards  ( / )" aria-label="Search decks and cards">
              </div>
            </div>
            <div class="deck-grid" id="deck-grid"></div>
            <div class="search-results" id="search-results"></div>`
          : emptyDecksHTML()
      }
    </section>
    ${upNextHTML(decks)}`;

  const grid = $('#deck-grid', root);
  const results = $('#search-results', root);
  const searchInput = $('#deck-search', root);

  function renderDecks(query = '') {
    if (!grid) return;
    const matching = query ? searchDecks(query, decks) : decks;
    grid.innerHTML = matching.map((deck) => deckCardHTML(deck, statsByDeck.get(deck.id))).join('');
    if (!matching.length) {
      grid.innerHTML = `<p class="muted">No decks match "${escapeHTML(query)}".</p>`;
    }

    if (!query) {
      results.replaceChildren();
      return;
    }
    const cards = searchCards(query, { limit: 12 });
    results.innerHTML = cards.length
      ? `<div class="section-header"><h3>Matching cards</h3></div>
        <div class="result-list">
          ${cards
            .map(
              (card) => `
            <a class="result-item" href="#/deck/${encodeURIComponent(card.deckId)}">
              <span><strong>${escapeHTML(cardPrompt(card))}</strong></span>
              <span class="muted">${escapeHTML(cardAnswer(card))}</span>
              <span class="result-item__deck">${escapeHTML(deckTitles.get(card.deckId) ?? '')}</span>
            </a>`,
            )
            .join('')}
        </div>`
      : '';
  }

  renderDecks();
  searchInput?.addEventListener('input', () => renderDecks(searchInput.value.trim()));

  function onClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'import') {
      openImportModal({ onImported: (deck) => navigate(`/deck/${deck.id}`) });
    } else if (action === 'sample') {
      const deck = createSampleDeck();
      toast('Sample deck added.', { type: 'success' });
      navigate(`/deck/${deck.id}`);
    }
  }

  // Press "/" to jump to the search box.
  function onKeydown(event) {
    if (event.key === '/' && searchInput && !isTypingTarget(event.target) && !isModalOpen()) {
      event.preventDefault();
      searchInput.focus();
    }
  }

  // root (<main>) outlives this view, so its listeners must be removed on cleanup.
  root.addEventListener('click', onClick);
  window.addEventListener('keydown', onKeydown);
  return () => {
    root.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKeydown);
  };
}
