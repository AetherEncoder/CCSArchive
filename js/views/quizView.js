// Quiz modes: a setup screen, then either a question-by-question quiz
// (multiple choice, true/false, typed, mixed) or the matching game.

import { getDeck, updateDeck, deckColorVar, markDeckStudied } from '../data/decks.js';
import { getCardsByDeck } from '../data/cards.js';
import { getSettings, updateSettings, SETTING_DEFAULTS } from '../data/settings.js';
import { logReview } from '../data/reviews.js';
import { QUIZ_MODES, QUESTION_LABELS, getMode, canPlay, buildQuiz, checkTyped, buildMatchTiles, tilesMatch } from '../services/quiz.js';
import { recordProgress, XP } from '../services/gamification.js';
import { createProgressBar } from '../components/progressBar.js';
import { toast, celebrate } from '../components/toast.js';
import { setTitle } from '../router.js';
import { notFoundView } from './notFoundView.js';
import { $, escapeHTML, pluralize, isTypingTarget, isModalOpen } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { formatDuration, formatSeconds } from '../utils/date.js';
import { playSound } from '../utils/sound.js';
import { pickOne } from '../utils/shuffle.js';

const MAX_LIVES = 3;
const MATCH_PAIRS = 6;
const MATCH_PENALTY_MS = 1000;
const PRAISE = ['Correct!', 'Nice!', 'You got it!', 'Exactly!', 'Well done!'];

export function quizView(root, { params, query }) {
  const deck = getDeck(params.id);
  if (!deck) return notFoundView(root, { message: 'This deck was deleted or never existed.' });
  setTitle(`Quiz · ${deck.title}`);

  const cards = getCardsByDeck(deck.id);
  const deckHref = `#/deck/${encodeURIComponent(deck.id)}`;
  const deckColor = deckColorVar(deck.color);
  let screenCleanup = null;
  let active = true; // false once the user leaves this page

  if (!cards.length) {
    root.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">${icon('quiz')}</div>
        <h1>No cards to quiz on</h1>
        <p>Add some cards to this deck first.</p>
        <div class="row"><a class="btn btn--primary" href="${deckHref}/edit">${icon('plus')} Add cards</a></div>
      </div>`;
    return;
  }

  // Each screen renders into root and returns its own cleanup (key handlers, timers).
  function showScreen(render, ...args) {
    screenCleanup?.();
    screenCleanup = render(...args) ?? null;
    window.scrollTo(0, 0);
  }

  function addKeyHandler(handler) {
    const wrapped = (event) => {
      if (isModalOpen() || event.ctrlKey || event.metaKey || event.altKey) return;
      handler(event);
    };
    window.addEventListener('keydown', wrapped);
    return () => window.removeEventListener('keydown', wrapped);
  }

  // ---------- Setup ----------

  function renderSetup() {
    const prefs = { ...SETTING_DEFAULTS.quizPrefs, ...getSettings().quizPrefs };
    let mode = getMode(query.mode) ? query.mode : prefs.mode;
    if (!canPlay(mode, cards).ok) mode = QUIZ_MODES.find((item) => canPlay(item.id, cards).ok)?.id ?? 'typed';

    const counts = [5, 10, 20].filter((n) => n < cards.length);
    const count = counts.includes(prefs.count) ? prefs.count : cards.length;

    root.innerHTML = `
      <a class="back-link" href="${deckHref}">${icon('arrowLeft')} ${escapeHTML(deck.title)}</a>
      <div class="page-header">
        <div class="page-header__text">
          <h1>Quiz</h1>
          <p class="muted">${pluralize(cards.length, 'card')} in this deck. Pick how you want to be tested.</p>
        </div>
      </div>

      <form class="quiz-setup" id="setup-form">
        <fieldset>
          <legend class="visually-hidden">Quiz type</legend>
          <div class="mode-options">
            ${QUIZ_MODES.map((item) => {
              const check = canPlay(item.id, cards);
              return `
                <label class="mode-option">
                  <input type="radio" name="mode" value="${item.id}" ${item.id === mode ? 'checked' : ''} ${check.ok ? '' : 'disabled'}>
                  <span class="mode-option__card">
                    ${icon(item.icon)}
                    <strong>${item.label}</strong>
                    <span>${check.ok ? item.description : check.reason}</span>
                  </span>
                </label>`;
            }).join('')}
          </div>
        </fieldset>

        <div class="panel setup-options">
          <p class="muted setup-options__note" id="match-note" hidden>Match ${Math.min(MATCH_PAIRS, cards.length)} pairs as fast as you can. Wrong pairs add 1 second.</p>
          <div class="setup-options__fields" id="quiz-options">
          <label class="field">
            <span class="field__label">Questions</span>
            <select class="input" name="count">
              ${counts.map((n) => `<option value="${n}" ${n === count ? 'selected' : ''}>${n}</option>`).join('')}
              <option value="${cards.length}" ${count === cards.length ? 'selected' : ''}>All ${cards.length}</option>
            </select>
          </label>
          <label class="field">
            <span class="field__label">Answer with</span>
            <select class="input" name="direction">
              <option value="forward" ${prefs.direction === 'forward' ? 'selected' : ''}>Definition (back)</option>
              <option value="reverse" ${prefs.direction === 'reverse' ? 'selected' : ''}>Term (front)</option>
            </select>
          </label>
          <label class="switch">
            <input type="checkbox" name="lives" ${prefs.lives ? 'checked' : ''}>
            <span>${MAX_LIVES} lives</span>
          </label>
          </div>
          <button class="btn btn--primary btn--lg setup-options__start" type="submit">${icon('zap')} Start quiz</button>
        </div>
      </form>`;

    const form = $('#setup-form', root);
    const options = $('#quiz-options', root);
    const matchNote = $('#match-note', root);

    function syncOptions() {
      const isMatch = form.elements.mode.value === 'match';
      options.hidden = isMatch;
      matchNote.hidden = !isMatch;
    }
    form.addEventListener('change', syncOptions);
    syncOptions();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const settings = {
        mode: form.elements.mode.value,
        count: Number(form.elements.count.value),
        direction: form.elements.direction.value,
        lives: form.elements.lives.checked,
      };
      updateSettings({ quizPrefs: settings });

      if (settings.mode === 'match') {
        showScreen(renderMatch);
        return;
      }
      const questions = buildQuiz(cards, settings);
      if (!questions.length) {
        toast('None of these cards has both a question and an answer to quiz on.', { type: 'error' });
        return;
      }
      showScreen(renderQuiz, questions, settings);
    });
  }

  // ---------- Question quiz ----------

  function renderQuiz(questions, settings) {
    const startedAt = Date.now();
    const results = [];
    let index = 0;
    let lives = settings.lives ? MAX_LIVES : null;
    let streak = 0;
    let bestStreak = 0;
    let xpEarned = 0;
    let pending = null; // the current answer, before Continue commits it

    root.innerHTML = `
      <div class="session" style="--deck-color:${deckColor}">
        <div class="session-header">
          <a class="back-link" href="${deckHref}">${icon('x')} Quit</a>
          <div class="quiz-stats">
            ${lives !== null ? '<div class="hearts" id="hearts"></div>' : ''}
            <span class="session-header__meta" id="counter"></span>
          </div>
        </div>
        <div id="progress-slot"></div>
        <div class="question-card" id="question"></div>
      </div>`;

    const counter = $('#counter', root);
    const hearts = $('#hearts', root);
    const questionCard = $('#question', root);
    const progress = createProgressBar({ max: questions.length, label: 'Quiz progress' });
    $('#progress-slot', root).append(progress.el);

    function renderHearts() {
      if (!hearts) return;
      const showing = lives - (pending && !pending.correct ? 1 : 0);
      hearts.innerHTML = Array.from({ length: MAX_LIVES }, (_, i) => icon('heart', i < showing ? '' : 'is-lost')).join('');
      hearts.setAttribute('aria-label', `${pluralize(showing, 'life', 'lives')} left`);
      hearts.setAttribute('role', 'img');
    }

    function answerAreaHTML(question) {
      if (question.type === 'mcq') {
        return `<div class="options">
          ${question.options
            .map((option, i) => `<button class="option" type="button" data-option="${i}"><kbd>${i + 1}</kbd><span>${escapeHTML(option)}</span></button>`)
            .join('')}
        </div>`;
      }
      if (question.type === 'tf') {
        return `<div class="options">
          <button class="option" type="button" data-tf="true"><kbd>T</kbd><span>True</span></button>
          <button class="option" type="button" data-tf="false"><kbd>F</kbd><span>False</span></button>
        </div>`;
      }
      return `<form class="typed-form" id="typed-form">
        <input class="input" id="typed-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type your answer" aria-label="Your answer">
        <button class="btn btn--primary" type="submit">Check</button>
        <button class="btn btn--ghost" type="button" data-skip>I don't know</button>
      </form>`;
    }

    function renderQuestion() {
      const question = questions[index];
      pending = null;
      counter.textContent = `${index + 1} / ${questions.length}`;
      progress.set(index, questions.length);
      renderHearts();

      const isLong = question.prompt.length > 140;
      questionCard.innerHTML = `
        <span class="eyebrow">${QUESTION_LABELS[question.type]}</span>
        ${question.image ? `<img class="question-image" src="${escapeHTML(question.image)}" alt="">` : ''}
        <h2 class="question-prompt ${isLong ? 'is-long' : ''}">${escapeHTML(question.prompt)}</h2>
        ${question.type === 'tf' ? `<p class="tf-statement">${escapeHTML(question.shown)}</p>` : ''}
        ${answerAreaHTML(question)}
        <div id="feedback-slot" aria-live="polite"></div>`;

      if (question.type === 'typed') $('#typed-input', questionCard).focus();
      else questionCard.querySelector('.option')?.focus({ preventScroll: true });
    }

    function answer(correct, given, { close = false } = {}) {
      if (pending) return;
      const question = questions[index];
      pending = { correct, given, close };

      // Lock the answer controls and mark the right/wrong choices.
      for (const button of questionCard.querySelectorAll('.option')) {
        button.disabled = true;
        const isAnswer =
          question.type === 'mcq'
            ? question.options[button.dataset.option] === question.answer
            : String(question.isTrue) === button.dataset.tf;
        const isChosen = question.type === 'mcq' ? question.options[button.dataset.option] === given : button.dataset.tf === String(given === 'True');
        if (isAnswer) button.classList.add('is-correct');
        else if (isChosen) button.classList.add('is-wrong');
        else button.classList.add('is-dimmed');
      }
      const input = $('#typed-input', questionCard);
      if (input) {
        input.disabled = true;
        input.classList.add(correct ? 'is-correct' : 'is-wrong');
        questionCard.querySelectorAll('.typed-form button').forEach((button) => (button.disabled = true));
      }

      playSound(correct ? 'correct' : 'wrong');
      if (!correct) {
        questionCard.classList.remove('is-shaking');
        void questionCard.offsetWidth;
        questionCard.classList.add('is-shaking');
      }
      renderHearts();
      renderFeedback();
    }

    function renderFeedback() {
      const question = questions[index];
      const { correct, given, close } = pending;
      const title = correct ? (close ? 'Close enough!' : pickOne(PRAISE)) : given ? 'Not quite' : 'Here is the answer';
      const showAnswer = !correct || close;
      const canOverride = !correct && question.type === 'typed' && given;
      const isLast = index === questions.length - 1 || (lives !== null && lives - (correct ? 0 : 1) <= 0);

      $('#feedback-slot', questionCard).innerHTML = `
        <div class="feedback feedback--${correct ? 'correct' : 'wrong'}">
          <div class="feedback__text">
            <span class="feedback__title">${icon(correct ? 'check' : 'x')} ${title}</span>
            ${showAnswer ? `<span class="feedback__answer">Answer: <strong>${escapeHTML(question.answer)}</strong></span>` : ''}
          </div>
          <div class="feedback__actions">
            ${canOverride ? '<button class="btn btn--ghost btn--sm" type="button" data-override>I was right</button>' : ''}
            <button class="btn btn--primary" type="button" data-continue>${isLast ? 'See results' : 'Continue'} <kbd>Enter</kbd></button>
          </div>
        </div>`;
      $('[data-continue]', questionCard).focus({ preventScroll: true });
    }

    function override() {
      if (!pending || pending.correct) return;
      pending.correct = true;
      const input = $('#typed-input', questionCard);
      input?.classList.replace('is-wrong', 'is-correct');
      questionCard.classList.remove('is-shaking');
      renderHearts();
      renderFeedback();
    }

    function next() {
      if (!pending) return;
      const question = questions[index];
      const { correct, given } = pending;
      results.push({ question, correct, given });

      logReview({ cardId: question.card.id, deckId: question.card.deckId, mode: 'quiz', correct });
      const result = recordProgress(correct ? XP.quizCorrect : 0);
      xpEarned += result.xpGained;
      celebrate(result);

      if (correct) {
        streak++;
        bestStreak = Math.max(bestStreak, streak);
      } else {
        streak = 0;
        if (lives !== null) lives--;
      }
      pending = null;

      if (lives === 0) return finish(true);
      index++;
      if (index >= questions.length) return finish(false);
      renderQuestion();
    }

    function finish(outOfLives) {
      markDeckStudied(deck.id);
      const answered = results.length;
      const score = results.filter((r) => r.correct).length;
      const percent = answered ? Math.round((score / answered) * 100) : 0;
      const missed = results.filter((r) => !r.correct);
      playSound(outOfLives ? 'wrong' : 'complete');

      const heading = outOfLives
        ? 'Out of lives'
        : percent >= 90
          ? 'Excellent!'
          : percent >= 70
            ? 'Nice work!'
            : percent >= 50
              ? 'Getting there'
              : 'Keep practicing';
      const remainingNote = outOfLives && questions.length > answered ? ` ${pluralize(questions.length - answered, 'question')} were left.` : '';

      showScreen(() => {
        root.innerHTML = `
          <div class="summary">
            <div class="score-ring" style="--score:${percent}"><span>${percent}%</span></div>
            <h1>${heading}</h1>
            <p>You got ${score} of ${pluralize(answered, 'question')} right.${remainingNote}</p>
            <div class="summary-stats">
              <div class="summary-stat"><strong>${score}/${answered}</strong><span>Correct</span></div>
              <div class="summary-stat"><strong>${bestStreak}</strong><span>Best streak</span></div>
              <div class="summary-stat"><strong>+${xpEarned}</strong><span>XP earned</span></div>
              <div class="summary-stat"><strong>${formatDuration(Date.now() - startedAt)}</strong><span>Time</span></div>
            </div>
            ${
              missed.length
                ? `<div class="missed-list">
                    <h2>Review these</h2>
                    ${missed
                      .map(
                        ({ question, given }) => `
                      <div class="missed-item">
                        <span><strong>${escapeHTML(question.prompt)}</strong></span>
                        <span>${escapeHTML(question.answer)}${given ? `<small>You answered: ${escapeHTML(given)}</small>` : ''}</span>
                      </div>`,
                      )
                      .join('')}
                  </div>`
                : ''
            }
            <div class="row">
              ${missed.length ? `<button class="btn btn--primary" type="button" data-action="retry">${icon('rotate')} Retry missed (${missed.length})</button>` : ''}
              <button class="btn ${missed.length ? 'btn--secondary' : 'btn--primary'}" type="button" data-action="setup">${icon('quiz')} New quiz</button>
              <a class="btn btn--ghost" href="${deckHref}">Back to deck</a>
            </div>
          </div>`;

        root.querySelector('.summary [data-action]').focus({ preventScroll: true });
        const onClick = (event) => {
          const action = event.target.closest('[data-action]')?.dataset.action;
          if (action === 'retry') {
            const missedCards = missed.map((r) => r.question.card);
            showScreen(renderQuiz, buildQuiz(missedCards, { ...settings, count: missedCards.length, pool: cards }), settings);
          } else if (action === 'setup') {
            showScreen(renderSetup);
          }
        };
        root.addEventListener('click', onClick);
        return () => root.removeEventListener('click', onClick);
      });
    }

    function onClick(event) {
      const option = event.target.closest('[data-option]');
      const tf = event.target.closest('[data-tf]');
      const question = questions[index];

      if (option && !pending) {
        const chosen = question.options[option.dataset.option];
        answer(chosen === question.answer, chosen);
      } else if (tf && !pending) {
        const saysTrue = tf.dataset.tf === 'true';
        answer(saysTrue === question.isTrue, saysTrue ? 'True' : 'False');
      } else if (event.target.closest('[data-skip]')) {
        answer(false, '');
      } else if (event.target.closest('[data-override]')) {
        override();
      } else if (event.target.closest('[data-continue]')) {
        next();
      }
    }

    function onSubmit(event) {
      if (event.target.id !== 'typed-form') return;
      event.preventDefault();
      const input = $('#typed-input', questionCard);
      const value = input.value.trim();
      if (!value) {
        input.focus();
        return;
      }
      const result = checkTyped(value, questions[index].answer);
      answer(result.correct, value, { close: result.correct && !result.exact });
    }

    const removeKeys = addKeyHandler((event) => {
      if (isTypingTarget(event.target)) return;
      const question = questions[index];
      const onControl = event.target.closest?.('button, a');

      if (pending) {
        if (event.key === 'Enter' && !onControl) {
          event.preventDefault();
          next();
        }
        return;
      }
      if (question.type === 'mcq' && /^[1-4]$/.test(event.key)) {
        questionCard.querySelector(`[data-option="${Number(event.key) - 1}"]`)?.click();
      } else if (question.type === 'tf' && ['t', 'f', '1', '2'].includes(event.key.toLowerCase())) {
        const saysTrue = ['t', '1'].includes(event.key.toLowerCase());
        questionCard.querySelector(`[data-tf="${saysTrue}"]`)?.click();
      }
    });

    questionCard.addEventListener('click', onClick);
    questionCard.addEventListener('submit', onSubmit);
    renderQuestion();
    return removeKeys;
  }

  // ---------- Matching game ----------

  function renderMatch() {
    const tiles = buildMatchTiles(cards, MATCH_PAIRS);
    const pairs = tiles.length / 2;
    const mistakeCards = new Set();
    let selected = null;
    let matched = 0;
    let mistakes = 0;
    let busy = false;
    const startedAt = Date.now();

    root.innerHTML = `
      <div class="session" style="--deck-color:${deckColor}; max-width:900px">
        <div class="session-header">
          <a class="back-link" href="${deckHref}">${icon('x')} Quit</a>
          <div class="quiz-stats">
            <span class="session-header__meta" id="pairs-left"></span>
            <span class="match-timer" id="timer" aria-label="Time">0.0s</span>
          </div>
        </div>
        <p class="muted">Click a term, then its answer. Wrong pairs add 1 second.</p>
        <div class="match-grid" id="match-grid">
          ${tiles
            .map(
              (tile) => `<button class="match-tile match-tile--${tile.side}" type="button" data-key="${escapeHTML(tile.key)}">${escapeHTML(tile.text)}</button>`,
            )
            .join('')}
        </div>
      </div>`;

    const grid = $('#match-grid', root);
    const timer = $('#timer', root);
    const pairsLeft = $('#pairs-left', root);
    const tileByKey = new Map(tiles.map((tile) => [tile.key, tile]));
    const elapsed = () => Date.now() - startedAt + mistakes * MATCH_PENALTY_MS;

    const interval = setInterval(() => {
      timer.textContent = formatSeconds(elapsed());
    }, 100);

    function updatePairsLeft() {
      pairsLeft.textContent = `${pairs - matched} ${pairs - matched === 1 ? 'pair' : 'pairs'} left`;
    }

    function buttonFor(tile) {
      return grid.querySelector(`[data-key="${CSS.escape(tile.key)}"]`);
    }

    function onTileClick(event) {
      const button = event.target.closest('.match-tile');
      if (!button || busy || button.disabled) return;
      const tile = tileByKey.get(button.dataset.key);

      if (!selected || selected === tile || selected.side === tile.side) {
        if (selected) buttonFor(selected).classList.remove('is-selected');
        selected = selected === tile ? null : tile;
        if (selected) button.classList.add('is-selected');
        return;
      }

      const first = selected;
      const firstButton = buttonFor(first);
      selected = null;

      if (tilesMatch(first, tile)) {
        for (const b of [firstButton, button]) {
          b.classList.remove('is-selected');
          b.classList.add('is-matched');
          b.disabled = true;
        }
        matched++;
        playSound('match');
        updatePairsLeft();
        if (matched === pairs) finish();
      } else {
        mistakes++;
        mistakeCards.add(first.card.id);
        mistakeCards.add(tile.card.id);
        playSound('wrong');
        busy = true;
        for (const b of [firstButton, button]) {
          b.classList.remove('is-selected');
          b.classList.add('is-wrong');
        }
        setTimeout(() => {
          firstButton.classList.remove('is-wrong');
          button.classList.remove('is-wrong');
          busy = false;
        }, 450);
      }
    }

    function finish() {
      clearInterval(interval);
      const time = elapsed();
      const isBest = !deck.bestMatchMs || time < deck.bestMatchMs;
      const previousBest = deck.bestMatchMs;
      if (isBest) {
        updateDeck(deck.id, { bestMatchMs: time }, { touch: false });
        deck.bestMatchMs = time;
      }
      markDeckStudied(deck.id);

      const played = new Map(tiles.map((tile) => [tile.card.id, tile.card]));
      for (const card of played.values()) {
        logReview({ cardId: card.id, deckId: card.deckId, mode: 'match', correct: !mistakeCards.has(card.id) });
      }
      const result = recordProgress(pairs * XP.matchPair);
      celebrate(result);
      playSound('complete');

      // Short pause so the last pair's animation can finish.
      setTimeout(() => {
        if (!active) return;
        showScreen(() => {
          root.innerHTML = `
            <div class="summary">
              <div class="summary__icon">${icon('trophy')}</div>
              <h1>${isBest ? 'New best time!' : 'All matched!'}</h1>
              <p>${
                isBest && previousBest
                  ? `You beat your old record of ${formatSeconds(previousBest)}.`
                  : isBest
                    ? 'Play again to beat it.'
                    : `Your best is ${formatSeconds(deck.bestMatchMs)}.`
              }</p>
              <div class="summary-stats">
                <div class="summary-stat"><strong>${formatSeconds(time)}</strong><span>Time</span></div>
                <div class="summary-stat"><strong>${mistakes}</strong><span>${mistakes === 1 ? 'Mistake' : 'Mistakes'}</span></div>
                <div class="summary-stat"><strong>+${result.xpGained}</strong><span>XP earned</span></div>
              </div>
              <div class="row">
                <button class="btn btn--primary" type="button" data-action="again">${icon('rotate')} Play again</button>
                <button class="btn btn--secondary" type="button" data-action="setup">${icon('quiz')} Other quiz</button>
                <a class="btn btn--ghost" href="${deckHref}">Back to deck</a>
              </div>
            </div>`;
          root.querySelector('[data-action="again"]').focus({ preventScroll: true });
          const onClick = (event) => {
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (action === 'again') showScreen(renderMatch);
            else if (action === 'setup') showScreen(renderSetup);
          };
          root.addEventListener('click', onClick);
          return () => root.removeEventListener('click', onClick);
        });
      }, 500);
    }

    grid.addEventListener('click', onTileClick);
    updatePairsLeft();
    return () => clearInterval(interval);
  }

  // The deck page's Match button links here with ?mode=match to preselect it.
  showScreen(renderSetup);
  return () => {
    active = false;
    screenCleanup?.();
  };
}
