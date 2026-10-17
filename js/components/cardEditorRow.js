// One front/back row in the card editor

import { createEl, autosize } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { CARD_TYPES } from '../data/cards.js';
import { hasCloze } from '../utils/cardText.js';
import { resizeImage } from '../utils/image.js';
import { toast } from './toast.js';

const FIELD_LABELS = {
  basic: { front: 'Term', back: 'Definition', frontHint: 'e.g. Stack', backHint: 'e.g. A last-in, first-out collection' },
  cloze: {
    front: 'Sentence',
    back: 'Extra note (optional)',
    frontHint: 'The {{CPU}} executes instructions.',
    backHint: 'Shown after the answer',
  },
  mcq: { front: 'Question', back: 'Correct answer', frontHint: 'e.g. Which port does HTTPS use?', backHint: 'e.g. 443' },
};

const CHOICE_COUNT = 3;

// card: existing card data (or {} for a blank row)
// handlers: { onChange, onRemove, onDuplicate, onTabOut }
export function createCardEditorRow(card = {}, handlers = {}) {
  let type = CARD_TYPES[card.type] ? card.type : 'basic';
  let image = card.image ?? null;
  const id = card.id ?? null;

  const typeSelect = createEl(
    'select',
    { class: 'input input--sm card-row__type', 'aria-label': 'Card type' },
    Object.entries(CARD_TYPES).map(([value, label]) => createEl('option', { value, selected: value === type }, label)),
  );

  const frontInput = createEl('textarea', { class: 'input', rows: 2, value: card.front ?? '' });
  const backInput = createEl('textarea', { class: 'input', rows: 2, value: card.back ?? '' });
  const frontLabel = createEl('span', { class: 'field__label' });
  const backLabel = createEl('span', { class: 'field__label' });

  const choiceInputs = Array.from({ length: CHOICE_COUNT }, (_, i) =>
    createEl('input', {
      class: 'input input--sm',
      type: 'text',
      placeholder: `Wrong answer ${i + 1}`,
      'aria-label': `Wrong answer ${i + 1}`,
      value: card.choices?.[i] ?? '',
    }),
  );
  const choicesBlock = createEl(
    'div',
    { class: 'card-row__choices field' },
    createEl('span', { class: 'field__label' }, 'Wrong answers (optional, otherwise taken from other cards)'),
    createEl('div', { class: 'card-row__choices-grid' }, choiceInputs),
  );

  const imageInput = createEl('input', { type: 'file', accept: 'image/*', hidden: true });
  const imageButton = createEl('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Add image', title: 'Add image', html: icon('image') });
  const duplicateButton = createEl('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Duplicate card', title: 'Duplicate', html: icon('copy') });
  const removeButton = createEl('button', { type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': 'Delete card', title: 'Delete', html: icon('trash') });
  const blankButton = createEl(
    'button',
    { type: 'button', class: 'btn btn--ghost btn--sm', title: 'Wrap the selected text in {{ }}', html: `${icon('braces')} Blank out selection` },
  );

  const indexLabel = createEl('span', { class: 'card-row__index' });
  const hint = createEl('p', { class: 'card-row__hint' });
  const error = createEl('p', { class: 'field__error', role: 'alert', hidden: true });
  const imagePreview = createEl('div', { class: 'card-row__image' });
  const footer = createEl('div', { class: 'card-row__footer' });

  const el = createEl(
    'li',
    { class: 'card-row is-entering' },
    createEl('div', { class: 'card-row__header' }, indexLabel, typeSelect, createEl('div', { class: 'card-row__tools' }, imageButton, duplicateButton, removeButton)),
    createEl(
      'div',
      { class: 'card-row__fields' },
      createEl('label', { class: 'field' }, frontLabel, frontInput),
      createEl('label', { class: 'field' }, backLabel, backInput),
    ),
    choicesBlock,
    footer,
    error,
    imageInput,
  );
  el.addEventListener('animationend', () => el.classList.remove('is-entering'), { once: true });

  function renderType() {
    const labels = FIELD_LABELS[type];
    frontLabel.textContent = labels.front;
    backLabel.textContent = labels.back;
    frontInput.placeholder = labels.frontHint;
    backInput.placeholder = labels.backHint;
    choicesBlock.hidden = type !== 'mcq';
    hint.textContent = type === 'cloze' ? 'Wrap the hidden words in {{double braces}}.' : '';
    renderFooter();
  }

  function renderFooter() {
    imagePreview.replaceChildren();
    if (image) {
      imagePreview.append(
        createEl('img', { src: image, alt: 'Card image' }),
        createEl('button', {
          type: 'button',
          class: 'icon-btn',
          'aria-label': 'Remove image',
          html: icon('x'),
          onclick: () => {
            image = null;
            renderFooter();
            handlers.onChange?.();
          },
        }),
      );
    }
    footer.replaceChildren(
      ...[image ? imagePreview : null, type === 'cloze' ? blankButton : null, hint.textContent ? hint : null].filter(Boolean),
    );
  }

  function clearError() {
    error.hidden = true;
    el.classList.remove('has-error');
    frontInput.removeAttribute('aria-invalid');
    backInput.removeAttribute('aria-invalid');
  }

  function showError(message, field) {
    error.textContent = message;
    error.hidden = false;
    el.classList.add('has-error');
    field?.setAttribute('aria-invalid', 'true');
  }

  // Wrap the selected text of the front field in {{ }}.
  function blankSelection() {
    const { selectionStart: start, selectionEnd: end, value } = frontInput;
    if (start === end) {
      toast('Select a word in the sentence first.');
      frontInput.focus();
      return;
    }
    frontInput.value = `${value.slice(0, start)}{{${value.slice(start, end)}}}${value.slice(end)}`;
    frontInput.focus();
    frontInput.setSelectionRange(end + 4, end + 4);
    handlers.onChange?.();
  }

  typeSelect.addEventListener('change', () => {
    type = typeSelect.value;
    clearError();
    renderType();
    handlers.onChange?.();
  });

  for (const input of [frontInput, backInput, ...choiceInputs]) {
    input.addEventListener('input', () => {
      if (input.tagName === 'TEXTAREA') autosize(input);
      clearError();
      handlers.onChange?.();
    });
  }

  // Tab out of the last field of the last row adds a new row (like Quizlet).
  backInput.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' && !event.shiftKey && type !== 'mcq') handlers.onTabOut?.(api, event);
  });
  choiceInputs.at(-1).addEventListener('keydown', (event) => {
    if (event.key === 'Tab' && !event.shiftKey) handlers.onTabOut?.(api, event);
  });

  imageButton.addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', async () => {
    const file = imageInput.files?.[0];
    imageInput.value = '';
    if (!file) return;
    try {
      image = await resizeImage(file);
      renderFooter();
      handlers.onChange?.();
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  });

  blankButton.addEventListener('click', blankSelection);
  duplicateButton.addEventListener('click', () => handlers.onDuplicate?.(api));
  removeButton.addEventListener('click', () => handlers.onRemove?.(api));

  const api = {
    el,
    id,
    setIndex(index) {
      indexLabel.textContent = index + 1;
      el.setAttribute('aria-label', `Card ${index + 1}`);
    },
    focus() {
      frontInput.focus();
    },
    fitText() {
      autosize(frontInput);
      autosize(backInput);
    },
    isEmpty() {
      return !frontInput.value.trim() && !backInput.value.trim() && !image;
    },
    // Includes the id so saving keeps this card's study progress.
    getData() {
      return {
        id,
        type,
        front: frontInput.value.trim(),
        back: backInput.value.trim(),
        choices: type === 'mcq' ? choiceInputs.map((input) => input.value.trim()).filter(Boolean) : [],
        image,
      };
    },
    validate() {
      clearError();
      const front = frontInput.value.trim();
      const back = backInput.value.trim();
      if (!front) {
        showError(`Add the ${FIELD_LABELS[type].front.toLowerCase()}.`, frontInput);
        return false;
      }
      if (type === 'cloze' && !hasCloze(front)) {
        showError('Wrap at least one word in {{double braces}} to make a blank.', frontInput);
        return false;
      }
      if (type !== 'cloze' && !back) {
        showError(`Add the ${FIELD_LABELS[type].back.toLowerCase()}.`, backInput);
        return false;
      }
      return true;
    },
  };

  renderType();
  return api;
}
