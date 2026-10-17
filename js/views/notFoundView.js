// Shown for unknown routes or a deck that no longer exists

import { icon } from '../utils/icons.js';
import { escapeHTML } from '../utils/dom.js';
import { setTitle } from '../router.js';

export function notFoundView(root, { message = "That page doesn't exist." } = {}) {
  setTitle('Not found');
  root.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">${icon('search')}</div>
      <h1>Nothing here</h1>
      <p>${escapeHTML(message)}</p>
      <div class="row"><a class="btn btn--primary" href="#/">Back to decks</a></div>
    </div>`;
}
