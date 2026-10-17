// Flip mode: browse every card in a deck, no scheduling or scoring.

import { getDeck, deckColorVar } from '../data/decks.js';
import { getCardsByDeck } from '../data/cards.js';
import { createFlashcard } from '../components/flashcard.js';
import { createProgressBar } from '../components/progressBar.js';
import { setTitle } from '../router.js';
import { notFoundView } from './notFoundView.js';
import { $, escapeHTML, pluralize, isTypingTarget, isModalOpen } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { shuffle } from '../utils/shuffle.js';
import { addSwipe } from '../utils/swipe.js';

export function flipView(root, { params }) {
  const deck = getDeck(params.id);
  if (!deck) return notFoundView(root, { message: 'This deck was deleted or never existed.' });
  setTitle(`Flashcards · ${deck.title}`);

  const deckHref = `#/deck/${encodeURIComponent(deck.id)}`;
  const original = getCardsByDeck(deck.id);

  if (!original.length) {
    root.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">${icon('layers')}</div>
        <h1>No cards yet</h1>
        <p>Add cards to this deck to flip through them.</p>
        <div class="row"><a class="btn btn--primary" href="${deckHref}/edit">${icon('plus')} Add cards</a></div>
      </div>`;
    return;
  }

  let order = [...original];
  let index = 0;
  let reverse = false;
  let shuffled = false;
  let finished = false;

  root.innerHTML = `
    <div class="session session--centered" style="--deck-color:${deckColorVar(deck.color)}">
      <div class="session-header">
        <a class="back-link" href="${deckHref}">${icon('arrowLeft')} ${escapeHTML(deck.title)}</a>
        <div class="session-header__meta">
          <span id="counter" aria-live="polite"></span>
          <button class="btn btn--ghost btn--sm toggle-btn" type="button" id="shuffle-toggle" aria-pressed="false">${icon('shuffle')} Shuffle</button>
          <button class="btn btn--ghost btn--sm toggle-btn" type="button" id="reverse-toggle" aria-pressed="false">${icon('swap')} Answer first</button>
        </div>
      </div>
      <div id="progress-slot"></div>

      <div class="stack" id="play-area">
        <div class="study-stage" id="stage"></div>
        <div class="flip-controls">
          <button class="icon-btn" type="button" id="prev" aria-label="Previous card">${icon('chevronLeft')}</button>
          <button class="btn btn--secondary" type="button" id="flip">${icon('rotate')} Flip</button>
          <button class="icon-btn" type="button" id="next" aria-label="Next card">${icon('chevronRight')}</button>
        </div>
        <p class="kbd-hint"><kbd>Space</kbd> flip &nbsp;·&nbsp; <kbd>←</kbd> <kbd>→</kbd> previous / next</p>
      </div>

      <div id="done" hidden></div>
    </div>`;

  const counter = $('#counter', root);
  const playArea = $('#play-area', root);
  const stage = $('#stage', root);
  const done = $('#done', root);
  const prevButton = $('#prev', root);
  const shuffleToggle = $('#shuffle-toggle', root);
  const reverseToggle = $('#reverse-toggle', root);

  const progress = createProgressBar({ label: 'Position in deck' });
  $('#progress-slot', root).append(progress.el);

  const flashcard = createFlashcard(order[0], { reverse, deckColor: deckColorVar(deck.color) });
  stage.append(flashcard.el);

  function show() {
    finished = false;
    done.hidden = true;
    playArea.hidden = false;
    flashcard.setCard(order[index], { reverse });
    counter.textContent = `${index + 1} / ${order.length}`;
    progress.set(index + 1, order.length);
    prevButton.disabled = index === 0;
  }

  function finish() {
    finished = true;
    playArea.hidden = true;
    progress.set(order.length, order.length);
    done.hidden = false;
    done.innerHTML = `
      <div class="summary">
        <div class="summary__icon">${icon('check')}</div>
        <h1>You went through all ${pluralize(order.length, 'card')}</h1>
        <p>Flip mode doesn't change your schedule. Use Study to lock cards into memory, or quiz yourself.</p>
        <div class="row">
          <button class="btn btn--secondary" type="button" data-action="restart">${icon('rotate')} Start over</button>
          <button class="btn btn--secondary" type="button" data-action="shuffle">${icon('shuffle')} Shuffle and restart</button>
          <a class="btn btn--primary" href="#/study/${encodeURIComponent(deck.id)}">${icon('target')} Study</a>
          <a class="btn btn--secondary" href="#/quiz/${encodeURIComponent(deck.id)}">${icon('quiz')} Quiz</a>
        </div>
      </div>`;
    done.querySelector('[data-action="restart"]').focus();
  }

  function next() {
    if (finished) return;
    if (index < order.length - 1) {
      index++;
      show();
    } else {
      finish();
    }
  }

  function prev() {
    if (finished) {
      show();
    } else if (index > 0) {
      index--;
      show();
    }
  }

  function restart(withShuffle) {
    if (withShuffle) {
      shuffled = true;
      shuffleToggle.setAttribute('aria-pressed', 'true');
    }
    order = shuffled ? shuffle(original) : [...original];
    index = 0;
    show();
  }

  $('#flip', root).addEventListener('click', () => flashcard.flip());
  $('#next', root).addEventListener('click', next);
  prevButton.addEventListener('click', prev);

  shuffleToggle.addEventListener('click', () => {
    shuffled = !shuffled;
    shuffleToggle.setAttribute('aria-pressed', String(shuffled));
    restart(false);
  });

  reverseToggle.addEventListener('click', () => {
    reverse = !reverse;
    reverseToggle.setAttribute('aria-pressed', String(reverse));
    if (!finished) flashcard.setCard(order[index], { reverse });
  });

  done.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'restart') restart(false);
    if (action === 'shuffle') restart(true);
  });

  addSwipe(stage, { onLeft: next, onRight: prev });

  function onKeydown(event) {
    if (isTypingTarget(event.target) || isModalOpen() || event.ctrlKey || event.metaKey || event.altKey) return;
    const onControl = event.target.closest?.('button, a');

    if ((event.key === ' ' || event.key === 'Enter') && !onControl && !finished) {
      event.preventDefault();
      flashcard.flip();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prev();
    }
  }

  show();
  window.addEventListener('keydown', onKeydown);
  return () => window.removeEventListener('keydown', onKeydown);
}
