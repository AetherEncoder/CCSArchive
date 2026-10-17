// Maps #/routes to view functions.
// A view is a function (root, { params, query }) that renders into root and may
// return a cleanup function, which runs before the next view renders.

import { dashboardView } from './views/dashboardView.js';
import { deckView } from './views/deckView.js';
import { editorView } from './views/editorView.js';
import { studyView } from './views/studyView.js';
import { flipView } from './views/flipView.js';
import { quizView } from './views/quizView.js';
import { statsView } from './views/statsView.js';
import { settingsView } from './views/settingsView.js';
import { notFoundView } from './views/notFoundView.js';

// More specific paths first: "/deck/new" must win over "/deck/:id".
const ROUTES = [
  ['/', dashboardView],
  ['/deck/new', editorView],
  ['/deck/:id', deckView],
  ['/deck/:id/edit', editorView],
  ['/study/:id', studyView],
  ['/flip/:id', flipView],
  ['/quiz/:id', quizView],
  ['/stats', statsView],
  ['/settings', settingsView],
].map(([path, view]) => ({ segments: path.split('/').filter(Boolean), view }));

let root = null;
let cleanup = null;
let leaveGuard = null;
let currentHash = '#/';
let restoringHash = false;

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, search = ''] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(search)) };
}

function matchRoute(path) {
  const parts = path.split('/').filter(Boolean);
  for (const route of ROUTES) {
    if (route.segments.length !== parts.length) continue;
    const params = {};
    const ok = route.segments.every((segment, i) => {
      if (segment.startsWith(':')) {
        params[segment.slice(1)] = decodeURIComponent(parts[i]);
        return true;
      }
      return segment === parts[i];
    });
    if (ok) return { view: route.view, params };
  }
  return null;
}

function updateActiveNav(path) {
  const section = `/${path.split('/').filter(Boolean)[0] ?? ''}`;
  const active = ['/stats', '/settings'].includes(section) ? section : '/';
  for (const link of document.querySelectorAll('[data-nav]')) {
    const isActive = link.dataset.nav === active;
    link.classList.toggle('is-active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function render() {
  const { path, query } = parseHash();
  const match = matchRoute(path);

  cleanup?.();
  cleanup = null;
  leaveGuard = null;

  root.replaceChildren();
  window.scrollTo(0, 0);
  updateActiveNav(path);
  setTitle('');

  const view = match?.view ?? notFoundView;
  const result = view(root, { params: match?.params ?? {}, query });
  cleanup = typeof result === 'function' ? result : null;

  currentHash = location.hash || '#/';
  // Move focus to the new page for keyboard/screen reader users, unless the view focused something itself.
  if (!root.contains(document.activeElement)) root.focus({ preventScroll: true });
}

function onHashChange() {
  if (restoringHash) {
    restoringHash = false;
    return;
  }
  if (leaveGuard && !leaveGuard()) {
    // Stay on the page: put the old hash back without re-rendering.
    restoringHash = true;
    location.hash = currentHash;
    return;
  }
  render();
}

export function startRouter(container) {
  root = container;
  window.addEventListener('hashchange', onHashChange);
  render();
}

export function navigate(path) {
  const hash = `#${path}`;
  if (location.hash === hash) render();
  else location.hash = hash;
}

// Re-render the current view (e.g. after data changed underneath it).
export function refresh() {
  render();
}

// fn returns true to allow leaving the page. Cleared automatically on navigation.
export function setLeaveGuard(fn) {
  leaveGuard = fn;
}

export function clearLeaveGuard() {
  leaveGuard = null;
}

export function setTitle(text) {
  document.title = text ? `${text} · CCSArchive` : 'CCSArchive';
}
