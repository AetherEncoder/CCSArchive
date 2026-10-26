# Context

Background on the project. Read this first, then PROGRESS.md for current status.

## What it is

CCSArchive is a flashcard and quiz app that runs entirely in the browser. You make decks of cards, then study them with spaced repetition, browse them as flashcards, take quizzes or play a matching game. XP, levels, streaks and stats track progress.

Feature summary: `README.md`. Detailed feature list: `FEATURES.md`. Backlog and rejected features: `SUGGESTIONS.md`.

## Platform and stack

- Plain HTML, CSS and JavaScript ES modules. No framework, no build step, no npm dependencies, no AI.
- Runs in any modern browser, desktop and mobile. ES modules don't load from `file://`, so serve the folder (`python -m http.server 5173`).
- The only outside resource is Google Fonts (Geist, Geist Mono) in `index.html`.

## Code layout

- `index.html`: the app shell. Views render into `<main id="app">`.
- `js/app.js`: the entry point. `js/router.js`: the hash router (`#/deck/:id` and so on); more specific routes go first. `js/store.js`: a small shared state for the navbar's XP and streak.
- `js/views/`: one file per screen (dashboard, deck, editor, study, flip, quiz, stats, settings, not found). Each is `(root, { params, query })` and returns a cleanup function.
- `js/components/`: reusable UI (modal, confirm dialog, toast, flashcard, card editor row, deck card, progress bar, import modal).
- `js/services/`: pure logic: SRS (SM-2), quiz building, XP/levels/streaks, search, importers (bulk text, CSV). No DOM or storage.
- `js/data/`: the only layer that touches storage. `db.js` wraps `localStorage`; the rest (`decks`, `cards`, `reviews`, `settings`, `backup`, `sampleDeck`) build on it.
- `js/utils/`: DOM helpers, dates, icons, sounds, image resizing, cloze text, swipe, theme.
- `css/main.css`: the only linked stylesheet; it `@import`s `base/` (reset, tokens, typography), `layout/`, `components/` and `pages/` (one per screen).

## Data model conventions

- Stored in `localStorage` under `ccsarchive:` keys. `read()` caches values in memory: never mutate them, write a new copy back.
- Deck, card, review and settings fields are listed in README.md → Data model.
- Card types: `basic`, `cloze` (`The {{CPU}} executes instructions.`) and `mcq` (with its own wrong choices). Any card can have an image.
- Dates for streaks and due cards are local calendar days (`todayKey()`).
- Backups are JSON (`js/data/backup.js`). A single deck is shared as `.ccsdeck.json`. Old backups have to keep loading when fields change.

## Design

- Modeled on Supabase's look: neutral grays, hairline borders, flat surfaces, small radii, compact controls. One blue brand color (`--primary`) and an amber accent.
- Fonts are Geist and Geist Mono. All colors, spacing and radii are tokens in `css/base/variables.css`.
- Light and dark themes both have to be complete. The default theme is "system" (follows the OS); Settings can force light or dark (`data-theme` on `<html>`).
- Has to work at phone width (swipe on flashcards, mobile navbar) and with the keyboard (shortcuts, `/` to search).
- UI work uses the `impeccable` skill.

## Gotchas

- **Storage limit:** browsers allow about 5 MB of `localStorage` per site, and card images use most of it. `write()` throws a readable error when it's full. Moving to IndexedDB only means replacing `js/data/db.js`.
- **Data is per browser:** clearing site data loses everything that wasn't backed up. Each browser and device has its own copy.
- **Testing touches real data:** studying writes reviews, XP and streaks. Back up first or test in a private window.
