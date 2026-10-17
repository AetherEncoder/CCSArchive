// What a card asks and what it expects, for every card type.
// Cloze cards hide each {{answer}} in their front text; the back is an optional note.

import { escapeHTML } from './dom.js';

const CLOZE_PATTERN = /\{\{(.+?)\}\}/g;

export function hasCloze(text) {
  return /\{\{(.+?)\}\}/.test(text ?? '');
}

export function clozeAnswers(text) {
  return [...(text ?? '').matchAll(CLOZE_PATTERN)].map((match) => match[1].trim());
}

export function maskCloze(text, mask = '_____') {
  return (text ?? '').replace(CLOZE_PATTERN, mask);
}

// Plain-text question for quizzes and lists
export function cardPrompt(card) {
  return card.type === 'cloze' ? maskCloze(card.front) : card.front;
}

// Plain-text answer for quizzes and lists
export function cardAnswer(card) {
  return card.type === 'cloze' ? clozeAnswers(card.front).join(', ') : card.back;
}

// Escaped HTML with blanks shown as boxes
export function clozeMaskedHTML(text) {
  return escapeHTML(text).replace(CLOZE_PATTERN, '<span class="cloze-blank" aria-label="blank">&nbsp;?&nbsp;</span>');
}

// Escaped HTML with the hidden answers highlighted
export function clozeRevealedHTML(text) {
  return escapeHTML(text).replace(CLOZE_PATTERN, (_, answer) => `<mark class="cloze-answer">${answer}</mark>`);
}
