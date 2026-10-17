// Flippable flashcard component

import { createEl, escapeHTML } from '../utils/dom.js';
import { clozeMaskedHTML, clozeRevealedHTML } from '../utils/cardText.js';

const LABELS = {
  basic: ['Term', 'Definition'],
  cloze: ['Fill in the blank', 'Answer'],
  mcq: ['Question', 'Answer'],
};

// Smaller type for longer text so it still fits on the card.
function sizeClass(text) {
  const length = String(text ?? '').length;
  if (length > 220) return 'is-long';
  if (length > 90) return 'is-medium';
  return '';
}

function textHTML(html, plain) {
  return `<p class="flashcard__text ${sizeClass(plain)}">${html}</p>`;
}

function imageHTML(card) {
  return card.image ? `<img class="flashcard__image" src="${escapeHTML(card.image)}" alt="">` : '';
}

function faceContent(card, side, reverse) {
  const [frontLabel, backLabel] = LABELS[card.type] ?? LABELS.basic;

  if (card.type === 'cloze') {
    if (side === 'front') {
      return { label: frontLabel, body: imageHTML(card) + textHTML(clozeMaskedHTML(card.front), card.front) };
    }
    const note = card.back ? `<p class="flashcard__note">${escapeHTML(card.back)}</p>` : '';
    return { label: backLabel, body: textHTML(clozeRevealedHTML(card.front), card.front) + note };
  }

  // In reverse mode the definition is shown first.
  const showFront = (side === 'front') !== reverse;
  return showFront
    ? { label: frontLabel, body: imageHTML(card) + textHTML(escapeHTML(card.front), card.front) }
    : { label: backLabel, body: textHTML(escapeHTML(card.back), card.back) };
}

export function createFlashcard(card, { reverse = false, deckColor = '', onFlip } = {}) {
  const front = createEl('div', { class: 'flashcard__face flashcard__face--front' });
  const back = createEl('div', { class: 'flashcard__face flashcard__face--back' });
  const el = createEl(
    'div',
    {
      class: 'flashcard',
      role: 'button',
      tabindex: 0,
      'aria-label': 'Flashcard. Click to flip.',
      style: deckColor ? { '--deck-color': deckColor } : {},
    },
    createEl('div', { class: 'flashcard__inner' }, front, back),
  );

  let flipped = false;
  let current = card;

  function render() {
    for (const [face, side] of [[front, 'front'], [back, 'back']]) {
      const { label, body } = faceContent(current, side, reverse);
      face.innerHTML = `
        <div class="flashcard__content"><span class="flashcard__label">${label}</span>${body}</div>
        ${side === 'front' ? '<p class="flashcard__hint">Click or tap to flip</p>' : ''}`;
    }
  }

  function setFlipped(value) {
    flipped = value;
    el.classList.toggle('is-flipped', flipped);
    front.setAttribute('aria-hidden', String(flipped));
    back.setAttribute('aria-hidden', String(!flipped));
    onFlip?.(flipped);
  }

  // Swap in another card, showing its front without playing the flip animation.
  function setCard(nextCard, options = {}) {
    current = nextCard;
    if (options.reverse !== undefined) reverse = options.reverse;
    el.classList.add('no-transition');
    flipped = false;
    el.classList.remove('is-flipped');
    front.setAttribute('aria-hidden', 'false');
    back.setAttribute('aria-hidden', 'true');
    render();
    void el.offsetWidth; // force a reflow so the class removal below re-enables the transition
    el.classList.remove('no-transition');
  }

  el.addEventListener('click', () => setFlipped(!flipped));
  setCard(card);

  return {
    el,
    flip: () => setFlipped(!flipped),
    setFlipped,
    isFlipped: () => flipped,
    setCard,
  };
}
