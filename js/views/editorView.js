// Create/edit deck and cards (manual + bulk paste)

import { getDeck, createDeck, updateDeck, deleteDeck, DECK_COLORS } from '../data/decks.js';
import { getCardsByDeck, saveDeckCards } from '../data/cards.js';
import { SEPARATORS, parseBulkText } from '../services/importers/bulkText.js';
import { createCardEditorRow } from '../components/cardEditorRow.js';
import { toast } from '../components/toast.js';
import { navigate, setLeaveGuard, setTitle } from '../router.js';
import { notFoundView } from './notFoundView.js';
import { $, escapeHTML, pluralize } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

const BLANK_ROWS = 3;

function colorPickerHTML(selected) {
  return DECK_COLORS.map(
    (color) => `
      <label class="color-swatch" title="${color}">
        <input type="radio" name="color" value="${color}" ${color === selected ? 'checked' : ''} aria-label="${color}">
        <span style="--swatch:var(--deck-${color})"></span>
      </label>`,
  ).join('');
}

export function editorView(root, { params }) {
  const isNew = !params.id;
  const deck = isNew ? null : getDeck(params.id);
  if (!isNew && !deck) return notFoundView(root, { message: 'This deck was deleted or never existed.' });
  setTitle(isNew ? 'New deck' : `Edit ${deck.title}`);

  const backHref = isNew ? '#/' : `#/deck/${encodeURIComponent(deck.id)}`;
  const rows = [];
  let dirty = false;

  root.innerHTML = `
    <a class="back-link" href="${backHref}">${icon('arrowLeft')} ${isNew ? 'All decks' : 'Back to deck'}</a>
    <div class="page-header">
      <div class="page-header__text"><h1>${isNew ? 'New deck' : 'Edit deck'}</h1></div>
    </div>

    <form class="editor" id="editor-form" novalidate>
      <section class="panel editor__details" aria-label="Deck details">
        <label class="field field--wide">
          <span class="field__label">Title</span>
          <input class="input" name="title" type="text" maxlength="100" placeholder="e.g. Data Structures: Midterms" value="${escapeHTML(deck?.title ?? '')}">
          <span class="field__error" id="title-error" hidden>Give your deck a title.</span>
        </label>
        <label class="field field--wide">
          <span class="field__label">Description <span class="faint">(optional)</span></span>
          <textarea class="input" name="description" rows="2" maxlength="300" placeholder="What is this deck for?">${escapeHTML(deck?.description ?? '')}</textarea>
        </label>
        <fieldset class="field">
          <legend class="field__label" style="margin-bottom:6px">Color</legend>
          <div class="color-picker">${colorPickerHTML(deck?.color ?? 'violet')}</div>
        </fieldset>
        <label class="field">
          <span class="field__label">Tags <span class="faint">(comma separated)</span></span>
          <input class="input" name="tags" type="text" placeholder="midterms, cs101" value="${escapeHTML((deck?.tags ?? []).join(', '))}">
        </label>
      </section>

      <section aria-labelledby="cards-heading">
        <div class="section-header">
          <h2 id="cards-heading">Cards</h2>
          <button class="btn btn--secondary btn--sm toggle-btn" type="button" id="bulk-toggle" aria-pressed="false" aria-controls="bulk-panel">
            ${icon('list')} Bulk add
          </button>
        </div>

        <div class="panel bulk-panel" id="bulk-panel" hidden>
          <label class="field">
            <span class="field__label">Paste one card per line: term, separator, definition</span>
            <textarea class="input" id="bulk-text" spellcheck="false" placeholder="Stack - Last in, first out&#10;Queue - First in, first out&#10;Heap - A complete binary tree"></textarea>
          </label>
          <div class="bulk-panel__controls">
            <label class="field">
              <span class="field__label">Separator</span>
              <select class="input input--sm" id="bulk-separator">
                ${SEPARATORS.map((sep) => `<option value="${sep.id}">${sep.label}</option>`).join('')}
              </select>
            </label>
            <span class="bulk-panel__status" id="bulk-status" aria-live="polite"></span>
            <button class="btn btn--primary btn--sm" type="button" id="bulk-add" disabled>${icon('plus')} Add cards</button>
          </div>
        </div>

        <ol class="card-rows" id="card-rows"></ol>
        <button class="btn btn--ghost add-card-btn" type="button" id="add-card">${icon('plus')} Add card</button>
      </section>

      <div class="editor-footer">
        <span class="editor-footer__info" id="card-count"></span>
        <div class="editor-footer__actions">
          <a class="btn btn--ghost" href="${backHref}">Cancel</a>
          <button class="btn btn--primary" type="submit">${icon('check')} Save deck <kbd class="editor-footer__shortcut">Ctrl S</kbd></button>
        </div>
      </div>
    </form>`;

  const form = $('#editor-form', root);
  const fields = form.elements;
  const list = $('#card-rows', root);
  const countLabel = $('#card-count', root);
  const titleError = $('#title-error', root);
  const bulkToggle = $('#bulk-toggle', root);
  const bulkPanel = $('#bulk-panel', root);
  const bulkText = $('#bulk-text', root);
  const bulkSeparator = $('#bulk-separator', root);
  const bulkStatus = $('#bulk-status', root);
  const bulkAdd = $('#bulk-add', root);

  // ---------- Rows ----------

  function updateCount() {
    const filled = rows.filter((row) => !row.isEmpty()).length;
    countLabel.textContent = `${pluralize(filled, 'card')} · Tab from the last field adds a new card`;
  }

  function reindex() {
    rows.forEach((row, index) => row.setIndex(index));
    updateCount();
  }

  function markDirty() {
    dirty = true;
    updateCount();
  }

  function addRow(card = {}, { after = null, focus = false } = {}) {
    const row = createCardEditorRow(card, {
      onChange: markDirty,
      onRemove: removeRow,
      onDuplicate: duplicateRow,
      onTabOut,
    });
    if (after) {
      rows.splice(rows.indexOf(after) + 1, 0, row);
      after.el.after(row.el);
    } else {
      rows.push(row);
      list.append(row.el);
    }
    row.fitText();
    reindex();
    if (focus) {
      row.focus();
      row.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    return row;
  }

  function removeRow(row) {
    rows.splice(rows.indexOf(row), 1);
    row.el.remove();
    if (!rows.length) addRow({}, { focus: true });
    reindex();
    markDirty();
  }

  function duplicateRow(row) {
    addRow({ ...row.getData(), id: null }, { after: row, focus: true });
    markDirty();
  }

  function onTabOut(row, event) {
    if (row === rows.at(-1) && !row.isEmpty()) {
      event.preventDefault();
      addRow({}, { focus: true });
    }
  }

  const existing = deck ? getCardsByDeck(deck.id) : [];
  if (existing.length) existing.forEach((card) => addRow(card));
  else for (let i = 0; i < BLANK_ROWS; i++) addRow();

  $('#add-card', root).addEventListener('click', () => {
    addRow({}, { focus: true });
    markDirty();
  });

  // ---------- Bulk add ----------

  function previewBulk() {
    const text = bulkText.value.trim();
    if (!text) {
      bulkStatus.textContent = '';
      bulkAdd.disabled = true;
      return null;
    }
    const result = parseBulkText(text, bulkSeparator.value);
    const skipped = result.skipped.length ? `, ${pluralize(result.skipped.length, 'line')} skipped` : '';
    const detected = bulkSeparator.value === 'auto' ? ` (separator: ${result.separator.label})` : '';
    bulkStatus.textContent = `${pluralize(result.cards.length, 'card')} found${skipped}${detected}`;
    bulkAdd.disabled = !result.cards.length;
    return result;
  }

  bulkToggle.addEventListener('click', () => {
    const open = bulkPanel.hidden;
    bulkPanel.hidden = !open;
    bulkToggle.setAttribute('aria-pressed', String(open));
    if (open) bulkText.focus();
  });
  bulkText.addEventListener('input', previewBulk);
  bulkSeparator.addEventListener('change', previewBulk);

  bulkAdd.addEventListener('click', () => {
    const result = previewBulk();
    if (!result?.cards.length) return;
    // Fill the trailing blank rows first instead of leaving them above the new cards.
    while (rows.length && rows.at(-1).isEmpty()) {
      rows.pop().el.remove();
    }
    result.cards.forEach((card) => addRow(card));
    bulkText.value = '';
    previewBulk();
    markDirty();
    toast(`Added ${pluralize(result.cards.length, 'card')}.`, { type: 'success' });
    rows.at(-1)?.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  // ---------- Saving ----------

  function save() {
    const title = fields.title.value.trim();
    if (!title) {
      titleError.hidden = false;
      fields.title.setAttribute('aria-invalid', 'true');
      fields.title.focus();
      fields.title.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    const filled = rows.filter((row) => !row.isEmpty());
    const invalid = filled.filter((row) => !row.validate());
    if (invalid.length) {
      invalid[0].el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      invalid[0].focus();
      toast(`Fix ${pluralize(invalid.length, 'card')} before saving.`, { type: 'error' });
      return;
    }

    const deckFields = {
      title,
      description: fields.description.value,
      color: fields.color.value,
      tags: fields.tags.value,
    };

    let deckId = deck?.id;
    try {
      if (isNew) deckId = createDeck(deckFields).id;
      else updateDeck(deck.id, deckFields);
      saveDeckCards(deckId, filled.map((row) => row.getData()));
    } catch (err) {
      if (isNew && deckId) deleteDeck(deckId);
      toast(err.message, { type: 'error', duration: 6000 });
      return;
    }

    dirty = false;
    toast(isNew ? 'Deck created.' : 'Changes saved.', { type: 'success' });
    navigate(`/deck/${deckId}`);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    save();
  });

  form.addEventListener('input', (event) => {
    if (event.target === bulkText) return;
    if (event.target === fields.title) {
      titleError.hidden = true;
      fields.title.removeAttribute('aria-invalid');
    }
    markDirty();
  });

  // Enter in a one-line field shouldn't save the whole deck by accident.
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault();
  });

  function onKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save();
    }
  }

  function onBeforeUnload(event) {
    if (dirty) event.preventDefault();
  }

  setLeaveGuard(() => !dirty || window.confirm('You have unsaved changes. Leave without saving?'));
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('beforeunload', onBeforeUnload);

  if (isNew) fields.title.focus();

  return () => {
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}
