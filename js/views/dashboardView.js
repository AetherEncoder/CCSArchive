// Dashboard: decks, cards due today, streak

import { getSortedDecks, deckColorVar } from '../data/decks.js';
import { getAllDeckStats } from '../data/cards.js';
import { getSettings } from '../data/settings.js';
import { createSampleDeck } from '../data/sampleDeck.js';
import { getProfile } from '../services/gamification.js';
import { searchDecks, searchCards } from '../services/search.js';
import { deckCardHTML } from '../components/deckCard.js';
import { progressHTML } from '../components/progressBar.js';
import { openImportModal } from '../components/importModal.js';
import { toast } from '../components/toast.js';
import { navigate, setTitle } from '../router.js';
import { $, escapeHTML, pluralize, isTypingTarget, isModalOpen } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { greeting } from '../utils/date.js';
import { cardPrompt, cardAnswer } from '../utils/cardText.js';

function heroHTML(hasDecks, toStudy) {
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
        <p>You're all caught up for today. Nice work!</p>
      </div>`;
  }
  return `
    <div class="hero__text">
      <h1>${greeting()}</h1>
      <p>You have <strong>${pluralize(toStudy, 'card')}</strong> to study today.</p>
    </div>
    <div class="hero__actions">
      <a class="btn btn--primary btn--lg" href="#/study/all">${icon('target')} Study now</a>
    </div>`;
}

function tilesHTML(profile) {
  const streakMeta = profile.studiedToday
    ? 'You studied today'
    : profile.streak
      ? 'Study today to keep it going'
      : 'Answer a card to start a streak';

  return `
    <div class="today-grid">
      <div class="stat-tile stat-tile--streak">
        <span class="stat-tile__label">${icon('flame')} Streak</span>
        <span class="stat-tile__value">${profile.streak} <small>${profile.streak === 1 ? 'day' : 'days'}</small></span>
        <span class="stat-tile__meta">${streakMeta}</span>
      </div>
      <div class="stat-tile">
        <span class="stat-tile__label">${icon('target')} Daily goal</span>
        <span class="stat-tile__value">${profile.todayCount} <small>/ ${profile.dailyGoal}</small></span>
        ${progressHTML(profile.todayCount, profile.dailyGoal, { label: 'Daily goal progress', variant: 'sm accent' })}
        <span class="stat-tile__meta">${
          profile.todayCount >= profile.dailyGoal ? 'Goal reached today' : `${profile.dailyGoal - profile.todayCount} more to reach your goal`
        }</span>
      </div>
      <div class="stat-tile">
        <span class="stat-tile__label">${icon('zap')} Level ${profile.level}</span>
        <span class="stat-tile__value">${profile.xp} <small>XP</small></span>
        ${progressHTML(profile.current, profile.needed, { label: 'Progress to next level', variant: 'sm' })}
        <span class="stat-tile__meta">${profile.needed - profile.current} XP to level ${profile.level + 1}</span>
      </div>
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
  // Tint the greeting with the color of the first deck that has cards waiting.
  const nextDeck = decks.find((deck) => statsByDeck.get(deck.id)?.due) ?? decks[0];
  const heroTint = nextDeck ? deckColorVar(nextDeck.color) : 'var(--primary)';

  root.innerHTML = `
    <section class="hero" style="--hero-tint:${heroTint}">${heroHTML(decks.length > 0, toStudy)}</section>
    ${tilesHTML(profile)}

    <section class="section" aria-labelledby="decks-heading">
      <div class="section-header">
        <h2 id="decks-heading">Your decks</h2>
        ${
          decks.length
            ? `<div class="section-header__actions">
                <button class="btn btn--secondary" type="button" data-action="import">${icon('upload')} Import</button>
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
    </section>`;

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
