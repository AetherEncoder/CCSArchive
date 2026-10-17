// Review session with Again/Hard/Good/Easy ratings.
// Due cards come first (oldest first), then up to `newPerSession` new cards.
// Cards rated Again go to the back of the queue and come back this session.

import { getDeck, getDecks, deckColorVar, markDeckStudied } from '../data/decks.js';
import { getCards, getCardsByDeck, updateCard } from '../data/cards.js';
import { getSettings } from '../data/settings.js';
import { logReview } from '../data/reviews.js';
import { RATING, RATINGS, schedule, nextInterval, isDue, isNew } from '../services/srs.js';
import { recordProgress, XP } from '../services/gamification.js';
import { createFlashcard } from '../components/flashcard.js';
import { createProgressBar } from '../components/progressBar.js';
import { celebrate } from '../components/toast.js';
import { setTitle } from '../router.js';
import { notFoundView } from './notFoundView.js';
import { $, escapeHTML, pluralize, isTypingTarget, isModalOpen } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { todayKey, formatInterval, formatDate, formatDuration } from '../utils/date.js';
import { playSound } from '../utils/sound.js';

function caughtUpHTML(pool, deck, backHref, today) {
  const upcoming = pool
    .filter((card) => !isNew(card.srs) && card.srs.dueDate > today)
    .map((card) => card.srs.dueDate)
    .sort()[0];

  const message = !pool.length
    ? 'There are no cards to study yet.'
    : upcoming
      ? `Nothing is due right now. Your next review is on ${formatDate(upcoming, { weekday: 'long', month: 'short', day: 'numeric' })}.`
      : 'Nothing is due right now.';

  const deckLinks = deck
    ? `<a class="btn btn--secondary" href="#/flip/${encodeURIComponent(deck.id)}">${icon('book')} Flip through cards</a>
       <a class="btn btn--secondary" href="#/quiz/${encodeURIComponent(deck.id)}">${icon('quiz')} Take a quiz</a>`
    : '';

  return `
    <div class="summary">
      <div class="summary__icon">${icon('check')}</div>
      <h1>All caught up!</h1>
      <p>${message}</p>
      <div class="row">
        <a class="btn btn--primary" href="${backHref}">${icon('arrowLeft')} Back</a>
        ${deckLinks}
      </div>
    </div>`;
}

export function studyView(root, { params }) {
  const all = params.id === 'all';
  const deck = all ? null : getDeck(params.id);
  if (!all && !deck) return notFoundView(root, { message: 'This deck was deleted or never existed.' });
  setTitle(all ? 'Study' : `Study · ${deck.title}`);

  const today = todayKey();
  const settings = getSettings();
  const decksById = new Map(getDecks().map((item) => [item.id, item]));
  const backHref = all ? '#/' : `#/deck/${encodeURIComponent(deck.id)}`;
  const backLabel = all ? 'All decks' : deck.title;

  const pool = (all ? getCards() : getCardsByDeck(deck.id)).filter((card) => decksById.has(card.deckId));
  const dueCards = pool
    .filter((card) => !isNew(card.srs) && isDue(card.srs, today))
    .sort((a, b) => a.srs.dueDate.localeCompare(b.srs.dueDate));
  const newCards = pool.filter((card) => isNew(card.srs)).slice(0, settings.newPerSession);
  const queue = [...dueCards, ...newCards];

  if (!queue.length) {
    root.innerHTML = caughtUpHTML(pool, deck, backHref, today);
    return;
  }

  const total = queue.length;
  const startedAt = Date.now();
  let current = null;
  let revealed = false;
  let completed = 0;
  let reviews = 0;
  let againCount = 0;
  let xpEarned = 0;

  root.innerHTML = `
    <div class="session session--centered" id="session">
      <div class="session-header">
        <a class="back-link" href="${backHref}">${icon('arrowLeft')} ${escapeHTML(backLabel)}</a>
        <div class="session-header__meta"><span id="remaining" aria-live="polite"></span></div>
      </div>
      <div id="progress-slot"></div>

      <div class="stack" id="play-area">
        <div class="study-stage" id="stage">
          <div class="study-stage__tags" id="tags"></div>
        </div>
        <div class="study-actions">
          <button class="btn btn--primary btn--lg" type="button" id="reveal">Show answer <kbd>Space</kbd></button>
          <div class="rating-row" id="ratings" role="group" aria-label="How well did you remember?" hidden>
            ${RATINGS.map(
              (rating) => `
              <button class="rating rating--${rating.key}" type="button" data-rating="${rating.value}">
                <span>${rating.label}</span>
                <small data-interval></small>
              </button>`,
            ).join('')}
          </div>
        </div>
        <p class="kbd-hint" id="hint-back" hidden><span><kbd>1</kbd> Again</span><span><kbd>2</kbd> Hard</span><span><kbd>3</kbd> Good</span><span><kbd>4</kbd> Easy</span></p>
      </div>

      <div id="done" hidden></div>
    </div>`;

  const session = $('#session', root);
  const playArea = $('#play-area', root);
  const stage = $('#stage', root);
  const tags = $('#tags', root);
  const remaining = $('#remaining', root);
  const revealButton = $('#reveal', root);
  const ratingRow = $('#ratings', root);
  const hintBack = $('#hint-back', root);
  const done = $('#done', root);

  const progress = createProgressBar({ max: total, label: 'Session progress' });
  $('#progress-slot', root).append(progress.el);

  const flashcard = createFlashcard(queue[0], {
    onFlip: (flipped) => {
      if (flipped) revealAnswer();
    },
  });
  stage.append(flashcard.el);
  flashcard.el.append(tags);

  function updateRatingLabels() {
    for (const button of ratingRow.querySelectorAll('[data-rating]')) {
      const value = Number(button.dataset.rating);
      const days = nextInterval(current.srs, value);
      button.querySelector('[data-interval]').textContent = value === RATING.AGAIN ? '<10m' : formatInterval(days);
    }
  }

  function showCard() {
    current = queue.shift();
    if (!current) {
      finish();
      return;
    }

    revealed = false;
    const cardDeck = decksById.get(current.deckId);
    session.style.setProperty('--deck-color', deckColorVar(cardDeck?.color));
    flashcard.setCard(current);
    tags.innerHTML = `
      <span class="badge ${isNew(current.srs) ? 'badge--new' : 'badge--due'}">${isNew(current.srs) ? 'New' : 'Review'}</span>
      ${all && cardDeck ? `<span class="badge">${escapeHTML(cardDeck.title)}</span>` : ''}`;

    ratingRow.hidden = true;
    revealButton.hidden = false;
    hintBack.hidden = true;
    remaining.textContent = `${total - completed} left`;
    progress.set(completed, total);
    updateRatingLabels();
  }

  function revealAnswer() {
    if (revealed) return;
    revealed = true;
    flashcard.setFlipped(true);
    revealButton.hidden = true;
    ratingRow.hidden = false;
    hintBack.hidden = false;
  }

  function rate(value) {
    if (!revealed || !current) return;
    const card = current;
    const srs = schedule(card.srs, value, today);

    updateCard(card.id, { srs });
    logReview({ cardId: card.id, deckId: card.deckId, mode: 'study', rating: value, correct: value !== RATING.AGAIN });
    markDeckStudied(card.deckId);

    const result = recordProgress(value === RATING.AGAIN ? XP.reviewAgain : XP.review);
    xpEarned += result.xpGained;
    celebrate(result);

    reviews++;
    if (value === RATING.AGAIN) {
      againCount++;
      queue.push({ ...card, srs });
    } else {
      completed++;
    }

    showCard();
    // The button that was clicked is now hidden, so keep focus somewhere useful.
    flashcard.el.focus({ preventScroll: true });
  }

  function finish() {
    current = null;
    playArea.hidden = true;
    progress.set(total, total);
    remaining.textContent = 'Done';
    playSound('complete');

    const accuracy = reviews ? Math.round(((reviews - againCount) / reviews) * 100) : 0;
    done.hidden = false;
    done.innerHTML = `
      <div class="summary">
        <div class="summary__icon">${icon('trophy')}</div>
        <h1>Session complete</h1>
        <p>You studied ${pluralize(completed, 'card')} in ${formatDuration(Date.now() - startedAt)}.</p>
        <div class="summary-stats">
          <div class="summary-stat"><strong>${completed}</strong><span>Cards studied</span></div>
          <div class="summary-stat"><strong>${accuracy}%</strong><span>Remembered first try</span></div>
          <div class="summary-stat"><strong>+${xpEarned}</strong><span>XP earned</span></div>
        </div>
        <div class="row">
          <a class="btn btn--primary" href="${backHref}">${icon('arrowLeft')} ${all ? 'Back to decks' : 'Back to deck'}</a>
          ${deck ? `<a class="btn btn--secondary" href="#/quiz/${encodeURIComponent(deck.id)}">${icon('quiz')} Quiz yourself</a>` : ''}
        </div>
      </div>`;
    done.querySelector('a').focus();
  }

  revealButton.addEventListener('click', () => {
    revealAnswer();
    flashcard.el.focus({ preventScroll: true });
  });

  ratingRow.addEventListener('click', (event) => {
    const button = event.target.closest('[data-rating]');
    if (button) rate(Number(button.dataset.rating));
  });

  function onKeydown(event) {
    if (!current || isTypingTarget(event.target) || isModalOpen() || event.ctrlKey || event.metaKey || event.altKey) return;
    const onControl = event.target.closest?.('button, a');

    if ((event.key === ' ' || event.key === 'Enter') && !onControl) {
      event.preventDefault();
      if (revealed) rate(RATING.GOOD);
      else revealAnswer();
    } else if (['1', '2', '3', '4'].includes(event.key) && revealed) {
      event.preventDefault();
      rate(Number(event.key));
    }
  }

  showCard();
  window.addEventListener('keydown', onKeydown);
  return () => window.removeEventListener('keydown', onKeydown);
}
