// Builds MCQ, true/false, typed and matching questions from cards

import { shuffle, sample, pickOne } from '../utils/shuffle.js';
import { cardPrompt, cardAnswer } from '../utils/cardText.js';

export const QUIZ_MODES = [
  { id: 'mcq', label: 'Multiple choice', description: 'Pick the right answer out of four.', icon: 'list', minCards: 2 },
  { id: 'tf', label: 'True or false', description: 'Decide whether the pair is correct.', icon: 'toggle', minCards: 2 },
  { id: 'typed', label: 'Type the answer', description: 'Recall it yourself. Small typos are forgiven.', icon: 'keyboard', minCards: 1 },
  { id: 'match', label: 'Matching', description: 'Pair terms with answers against the clock.', icon: 'grid', minCards: 2 },
  { id: 'mixed', label: 'Mixed', description: 'A bit of everything, shuffled together.', icon: 'shuffle', minCards: 2 },
];

export const QUESTION_LABELS = { mcq: 'Multiple choice', tf: 'True or false', typed: 'Type the answer' };

export function getMode(id) {
  return QUIZ_MODES.find((mode) => mode.id === id) ?? null;
}

export function canPlay(modeId, cards) {
  const mode = getMode(modeId);
  if (!mode) return { ok: false, reason: 'Unknown quiz mode.' };
  if (cards.length < mode.minCards) {
    return { ok: false, reason: `Needs at least ${mode.minCards} cards.` };
  }
  return { ok: true, reason: '' };
}

// "forward" asks the front and expects the back. "reverse" swaps them,
// except for fill-in-the-blank cards, which only make sense one way.
function sidesFor(card, direction) {
  const reverse = direction === 'reverse' && card.type !== 'cloze';
  return reverse
    ? { prompt: cardAnswer(card), answer: cardPrompt(card), reverse }
    : { prompt: cardPrompt(card), answer: cardAnswer(card), reverse };
}

function wrongAnswers(card, cards, count, direction) {
  const { answer, reverse } = sidesFor(card, direction);
  const key = answer.trim().toLowerCase();
  const picked = [];
  const add = (option) => {
    const text = option?.trim();
    if (!text || text.toLowerCase() === key) return;
    if (picked.some((p) => p.toLowerCase() === text.toLowerCase())) return;
    picked.push(text);
  };

  // A multiple-choice card's own wrong answers are the best distractors.
  if (card.type === 'mcq' && !reverse) shuffle(card.choices ?? []).forEach(add);
  for (const other of shuffle(cards)) {
    if (picked.length >= count) break;
    if (other.id !== card.id) add(sidesFor(other, direction).answer);
  }
  return picked.slice(0, count);
}

function buildQuestion(card, cards, type, direction) {
  const { prompt, answer, reverse } = sidesFor(card, direction);
  // The image belongs to the front, so only show it when the front is the question.
  const base = { card, type, prompt, answer, image: reverse ? null : card.image };

  if (type === 'mcq') {
    const wrong = wrongAnswers(card, cards, 3, direction);
    if (!wrong.length) return buildQuestion(card, cards, 'typed', direction);
    return { ...base, options: shuffle([answer, ...wrong]) };
  }

  if (type === 'tf') {
    const [wrong] = wrongAnswers(card, cards, 1, direction);
    const isTrue = !wrong || Math.random() < 0.5;
    return { ...base, shown: isTrue ? answer : wrong, isTrue };
  }

  return base;
}

const isUsable = (card) => cardPrompt(card).trim() && cardAnswer(card).trim();

// `pool` supplies wrong answers; it defaults to the cards being asked about,
// but "retry missed" passes the whole deck so there are still enough options.
export function buildQuiz(cards, { mode, count = 10, direction = 'forward', pool = cards }) {
  const usable = cards.filter(isUsable);
  const distractorPool = pool.filter(isUsable);
  const chosen = sample(usable, Math.min(count, usable.length));
  return chosen.map((card) => {
    const type = mode === 'mixed' ? pickOne(['mcq', 'tf', 'typed']) : mode;
    return buildQuestion(card, distractorPool, type, direction);
  });
}

// ---------- Typed answers ----------

export function normalizeAnswer(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Number of single-letter edits (insert, delete, replace, or swap two neighbours)
// needed to turn a into b. Swaps count as one so "recursoin" is one typo away.
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// Accepts the exact answer, any alternative separated by " / " or ";", or a close typo.
// (A slash without spaces, like "TCP/IP", is part of the answer.)
export function checkTyped(input, answer) {
  const given = normalizeAnswer(input);
  if (!given) return { correct: false, exact: false };

  const accepted = [answer, ...String(answer).split(/\s+\/\s+|;/)].map(normalizeAnswer).filter(Boolean);
  if (accepted.includes(given)) return { correct: true, exact: true };

  const closeEnough = accepted.some((expected) => {
    if (expected.length < 4) return false;
    const allowed = Math.max(1, Math.floor(expected.length * 0.15));
    return editDistance(given, expected) <= allowed;
  });
  return { correct: closeEnough, exact: false };
}

// ---------- Matching game ----------

export function buildMatchTiles(cards, pairs = 6) {
  const chosen = sample(cards.filter(isUsable), pairs);
  return shuffle(
    chosen.flatMap((card) => [
      { key: `${card.id}:prompt`, side: 'prompt', text: cardPrompt(card), card },
      { key: `${card.id}:answer`, side: 'answer', text: cardAnswer(card), card },
    ]),
  );
}

// Compares text, not ids, so two cards with the same answer can't trap the player.
export function tilesMatch(a, b) {
  if (a.side === b.side) return false;
  const prompt = a.side === 'prompt' ? a : b;
  const answer = a.side === 'answer' ? a : b;
  return normalizeAnswer(cardAnswer(prompt.card)) === normalizeAnswer(answer.text);
}
