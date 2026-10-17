// Import dialog: CSV/TSV/text exports from Quizlet or Anki, or a shared .ccsdeck.json file.

import { createEl, escapeHTML, readFileAsText, pluralize } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { parseCsv, csvToCards } from '../services/importers/csv.js';
import { parseBulkText } from '../services/importers/bulkText.js';
import { parseDeckFile, importDeck } from '../data/backup.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';

const PREVIEW_COUNT = 4;

async function parseFile(file) {
  const text = await readFileAsText(file);
  const name = file.name.toLowerCase();
  const baseTitle = file.name.replace(/(\.ccsdeck)?\.[^.]+$/i, '').replace(/[-_]+/g, ' ').trim();

  if (name.endsWith('.json')) {
    const { deck, cards } = parseDeckFile(text);
    return { deck, cards, skipped: 0 };
  }

  // Plain text is usually "term - definition" lines; CSV/TSV go through the CSV parser.
  let result = name.endsWith('.txt') ? parseBulkText(text) : csvToCards(parseCsv(text));
  let skipped = Array.isArray(result.skipped) ? result.skipped.length : result.skipped;
  if (!result.cards.length && !name.endsWith('.txt')) {
    result = parseBulkText(text);
    skipped = result.skipped.length;
  }

  if (!result.cards.length) {
    throw new Error('No cards found. Each line needs a front and a back separated by a comma, tab or " - ".');
  }
  return { deck: { title: baseTitle }, cards: result.cards, skipped };
}

export function openImportModal({ onImported } = {}) {
  let parsed = null;

  const fileInput = createEl('input', { type: 'file', accept: '.csv,.tsv,.txt,.json' });
  const drop = createEl('label', {
    class: 'file-drop',
    html: `${icon('upload')}<strong>Choose a file or drop it here</strong>
      <span>CSV, TSV or TXT from Quizlet or Anki, or a <code>.ccsdeck.json</code> deck shared by a classmate</span>`,
  });
  drop.append(fileInput);

  const titleInput = createEl('input', { class: 'input', type: 'text', maxlength: 100 });
  const titleField = createEl(
    'label',
    { class: 'field', hidden: true },
    createEl('span', { class: 'field__label' }, 'Deck title'),
    titleInput,
  );
  const preview = createEl('div', { class: 'import-preview', hidden: true });
  const error = createEl('p', { class: 'field__error', role: 'alert', hidden: true });

  const body = createEl('div', { class: 'stack' }, drop, error, titleField, preview);

  const { close, actionButtons } = openModal({
    title: 'Import cards',
    body,
    actions: [
      { label: 'Cancel' },
      {
        label: 'Import deck',
        variant: 'primary',
        onClick: () => {
          if (!parsed) return false;
          try {
            const deck = importDeck({ deck: { ...parsed.deck, title: titleInput.value.trim() || 'Imported deck' }, cards: parsed.cards });
            toast(`Imported ${pluralize(parsed.cards.length, 'card')}.`, { type: 'success' });
            onImported?.(deck);
          } catch (err) {
            toast(err.message, { type: 'error' });
            return false;
          }
        },
      },
    ],
  });
  const importButton = actionButtons[1];
  importButton.disabled = true;

  async function handleFile(file) {
    if (!file) return;
    error.hidden = true;
    try {
      parsed = await parseFile(file);
    } catch (err) {
      parsed = null;
      error.textContent = err.message;
      error.hidden = false;
      titleField.hidden = true;
      preview.hidden = true;
      importButton.disabled = true;
      return;
    }

    titleInput.value = parsed.deck.title || 'Imported deck';
    titleField.hidden = false;
    importButton.disabled = false;

    const items = parsed.cards
      .slice(0, PREVIEW_COUNT)
      .map((card) => `<li><strong>${escapeHTML(card.front)}</strong> - ${escapeHTML(card.back)}</li>`)
      .join('');
    const more = parsed.cards.length > PREVIEW_COUNT ? `<li>...and ${parsed.cards.length - PREVIEW_COUNT} more</li>` : '';
    const skippedNote = parsed.skipped ? ` (${pluralize(parsed.skipped, 'line')} skipped)` : '';
    preview.innerHTML = `<strong>Found ${pluralize(parsed.cards.length, 'card')}</strong>${skippedNote}<ul>${items}${more}</ul>`;
    preview.hidden = false;
    titleInput.focus();
    titleInput.select();
  }

  fileInput.addEventListener('change', () => handleFile(fileInput.files?.[0]));

  drop.addEventListener('dragover', (event) => {
    event.preventDefault();
    drop.classList.add('is-dragging');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-dragging'));
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('is-dragging');
    handleFile(event.dataTransfer?.files?.[0]);
  });

  titleInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') importButton.click();
  });

  return { close };
}
