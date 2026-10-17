// Theme, daily goal, backup/restore

import { getSettings, updateSettings } from '../data/settings.js';
import { storageUsage, STORAGE_LIMIT } from '../data/db.js';
import { downloadBackup, parseBackup, restoreBackup, clearAllData } from '../data/backup.js';
import { publishProfile } from '../services/gamification.js';
import { progressHTML } from '../components/progressBar.js';
import { confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { navigate, setTitle } from '../router.js';
import { $, readFileAsText, pluralize } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { applyTheme } from '../utils/theme.js';
import { formatDate } from '../utils/date.js';

const THEMES = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

const SHORTCUTS = [
  [['Space'], 'Flip the card / show the answer'],
  [['1', '2', '3', '4'], 'Rate a card: Again, Hard, Good, Easy'],
  [['←', '→'], 'Previous / next card in flip mode'],
  [['1', '2', '3', '4'], 'Pick a multiple choice answer'],
  [['T', 'F'], 'Answer true or false'],
  [['Enter'], 'Continue to the next question'],
  [['/'], 'Search decks (on the Decks page)'],
  [['Ctrl', 'S'], 'Save in the deck editor'],
];

function formatSize(chars) {
  if (chars < 1000) return `${chars} B`;
  if (chars < 1_000_000) return `${Math.round(chars / 1000)} KB`;
  return `${(chars / 1_000_000).toFixed(1)} MB`;
}

function numberRow({ id, title, description, value, min, max }) {
  return `
    <div class="settings-row">
      <div class="settings-row__text">
        <label for="${id}"><strong>${title}</strong></label>
        <span>${description}</span>
      </div>
      <input class="input" id="${id}" type="number" inputmode="numeric" min="${min}" max="${max}" value="${value}">
    </div>`;
}

export function settingsView(root) {
  setTitle('Settings');
  const settings = getSettings();
  const used = storageUsage();

  root.innerHTML = `
    <div class="page-header">
      <div class="page-header__text"><h1>Settings</h1></div>
    </div>

    <section class="panel" aria-labelledby="appearance-heading">
      <h2 class="panel__title" id="appearance-heading">Appearance</h2>
      <div class="settings-row">
        <div class="settings-row__text">
          <strong id="theme-label">Theme</strong>
          <span>System matches your device's light or dark mode.</span>
        </div>
        <div class="segmented" role="radiogroup" aria-labelledby="theme-label">
          ${THEMES.map(
            ([value, label]) => `
            <label><input type="radio" name="theme" value="${value}" ${settings.theme === value ? 'checked' : ''}><span>${label}</span></label>`,
          ).join('')}
        </div>
      </div>
    </section>

    <section class="panel" aria-labelledby="study-heading">
      <h2 class="panel__title" id="study-heading">Studying</h2>
      ${numberRow({
        id: 'daily-goal',
        title: 'Daily goal',
        description: 'Cards to answer each day. Reaching it earns a 50 XP bonus.',
        value: settings.dailyGoal,
        min: 1,
        max: 500,
      })}
      ${numberRow({
        id: 'new-per-session',
        title: 'New cards per session',
        description: 'How many cards you have never studied each Study session introduces.',
        value: settings.newPerSession,
        min: 1,
        max: 200,
      })}
      <div class="settings-row">
        <div class="settings-row__text">
          <label for="sound-on"><strong>Sound effects</strong></label>
          <span>Short chimes for right and wrong answers.</span>
        </div>
        <label class="switch"><input type="checkbox" id="sound-on" ${settings.soundOn ? 'checked' : ''}><span class="visually-hidden">Sound effects</span></label>
      </div>
    </section>

    <section class="panel" aria-labelledby="data-heading">
      <h2 class="panel__title" id="data-heading">Your data</h2>
      <p class="muted" style="margin-bottom:var(--space-4)">
        Everything is saved in this browser only. Clearing your browsing data deletes it, so download a backup now and then.
        A backup also moves your decks to another computer or browser.
      </p>
      <div class="settings-row">
        <div class="settings-row__text" style="flex:1">
          <strong>Storage used</strong>
          <span>${formatSize(used)} of about ${formatSize(STORAGE_LIMIT)}. Images take the most space.</span>
          <div style="margin-top:var(--space-2)">${progressHTML(used, STORAGE_LIMIT, { label: 'Storage used', variant: 'sm' })}</div>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row__text">
          <strong>Backup</strong>
          <span>Download all decks, cards, progress and settings as one file.</span>
        </div>
        <button class="btn btn--secondary" type="button" id="backup">${icon('download')} Download backup</button>
      </div>
      <div class="settings-row">
        <div class="settings-row__text">
          <strong>Restore</strong>
          <span>Replace everything here with a backup file.</span>
        </div>
        <button class="btn btn--secondary" type="button" id="restore">${icon('upload')} Restore from file</button>
        <input type="file" id="restore-file" accept=".json,application/json" hidden>
      </div>
    </section>

    <section class="panel danger-zone" aria-labelledby="danger-heading">
      <h2 class="panel__title" id="danger-heading">Danger zone</h2>
      <div class="settings-row">
        <div class="settings-row__text">
          <strong>Delete all data</strong>
          <span>Removes every deck, card, your streak and XP. This can't be undone.</span>
        </div>
        <button class="btn btn--danger" type="button" id="delete-all">${icon('trash')} Delete everything</button>
      </div>
    </section>

    <section class="panel" aria-labelledby="keys-heading">
      <h2 class="panel__title" id="keys-heading">Keyboard shortcuts</h2>
      <dl class="shortcut-list">
        ${SHORTCUTS.map(([keys, action]) => `<dt>${keys.map((key) => `<kbd>${key}</kbd>`).join('')}</dt><dd>${action}</dd>`).join('')}
      </dl>
    </section>

    <p class="faint" style="margin-top:var(--space-5); font-size:0.85rem">CCSArchive · built with plain HTML, CSS and JavaScript.</p>`;

  // ---------- Preferences ----------

  for (const radio of root.querySelectorAll('input[name="theme"]')) {
    radio.addEventListener('change', () => {
      updateSettings({ theme: radio.value });
      applyTheme(radio.value);
    });
  }

  function bindNumber(id, key, min, max) {
    const input = $(`#${id}`, root);
    input.addEventListener('change', () => {
      const value = Math.min(max, Math.max(min, Math.round(Number(input.value) || min)));
      input.value = value;
      updateSettings({ [key]: value });
      publishProfile();
      toast('Saved.', { type: 'success', duration: 1500 });
    });
  }
  bindNumber('daily-goal', 'dailyGoal', 1, 500);
  bindNumber('new-per-session', 'newPerSession', 1, 200);

  $('#sound-on', root).addEventListener('change', (event) => {
    updateSettings({ soundOn: event.target.checked });
  });

  // ---------- Data ----------

  $('#backup', root).addEventListener('click', () => {
    downloadBackup();
    toast('Backup downloaded.', { type: 'success' });
  });

  const restoreInput = $('#restore-file', root);
  $('#restore', root).addEventListener('click', () => restoreInput.click());
  restoreInput.addEventListener('change', async () => {
    const file = restoreInput.files?.[0];
    restoreInput.value = '';
    if (!file) return;

    let data;
    try {
      data = parseBackup(await readFileAsText(file));
    } catch (err) {
      toast(err.message, { type: 'error', duration: 5000 });
      return;
    }

    const when = data.exportedAt ? ` from ${formatDate(data.exportedAt)}` : '';
    const ok = await confirmDialog({
      title: 'Restore this backup?',
      message: `The backup${when} has ${pluralize(data.decks.length, 'deck')} and ${pluralize(data.cards.length, 'card')}. Everything currently in CCSArchive will be replaced.`,
      confirmLabel: 'Replace and restore',
      danger: true,
    });
    if (!ok) return;

    try {
      restoreBackup(data);
    } catch (err) {
      toast(err.message, { type: 'error', duration: 6000 });
      return;
    }
    applyTheme(getSettings().theme);
    publishProfile();
    toast('Backup restored.', { type: 'success' });
    navigate('/');
  });

  $('#delete-all', root).addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Delete everything?',
      message: 'All decks, cards, progress and settings will be removed from this browser. Download a backup first if you might want them back.',
      confirmLabel: 'Delete everything',
      danger: true,
    });
    if (!ok) return;
    clearAllData();
    applyTheme('system');
    publishProfile();
    toast('All data deleted.');
    navigate('/');
  });
}
