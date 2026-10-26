# Progress

Running log of what's done and what's next. Newest entries at the top. See CONTEXT.md for background.

## Status (2026-10-26)

Every screen in README.md → Features is built and works on `localStorage` data. The Supabase-style theme is applied. There's no automated test suite; changes are checked by hand in the browser.

## Next

- Write FEATURES.md (every feature in detail, for testing).
- Nothing else planned yet.

## Done

### 2026-10-26: Project docs
- Added CLAUDE.md, adapted from the Wallet project: no framework or build step, testing in the browser without leaving data behind, storage only through `js/data/db.js`, views return a cleanup function, use the CSS tokens.
- Added CONTEXT.md, PROGRESS.md, SUGGESTIONS.md and CRITIQUE.md (the design critique loop, rewritten for the browser).

### 2026-10-17: Supabase theme
- Redesigned the tokens in `css/base/variables.css` after Supabase: neutral grays, hairline borders, flat surfaces, small radii, one blue brand color, Geist and Geist Mono.
- Restyled every page and component; the dashboard and deck views got new markup.

### 2026-10-17: Base app
- Decks with basic, fill-in-the-blank and multiple-choice cards, images, bulk paste and CSV/TSV import.
- Study (SM-2), flashcards, quiz (multiple choice, true/false, typed, mixed, lives), match game.
- XP, levels, daily goal, streaks, activity heatmap, per-deck stats.
- JSON backup and restore, `.ccsdeck.json` sharing, CSV export. Light and dark themes, keyboard shortcuts, mobile layout.
