# CCSArchive

A manual flashcard and quiz app built with plain HTML, CSS and JavaScript. It has no AI, frameworks or build step.

## Running it

ES modules don't load from `file://`, so serve the folder locally, for example with VS Code's Live Server extension or `npx serve`.

## Structure

- `index.html` is the app shell. Views render into `<main id="app">`.
- `css/` is split into `base/` (reset, tokens), `layout/`, `components/` and `pages/`. Only `main.css` is linked.
- `js/data/` is the only layer that touches storage.
- `js/services/` holds pure logic with no DOM: spaced repetition, quizzes, gamification, importers.
- `js/views/` has one file per screen. `js/components/` has reusable UI pieces.

## Data model

- **Deck**: `id, title, description, color, tags, createdAt, updatedAt`
- **Card**: `id, deckId, front, back, type (basic | cloze | mcq), choices?, image?, srs: { interval, ease, reps, dueDate }`
- **Review**: `id, cardId, rating, timestamp`
- **Settings**: `theme, dailyGoal, xp, streak, lastStudyDate`

## Build order

1. Deck and card editing, saved to localStorage
2. Routing and layout: dashboard, deck page, navbar, dark mode
3. Flip mode: browse cards with shuffle and keyboard controls
4. Spaced repetition: Again/Hard/Good/Easy ratings, SM-2, cards due today
5. Quiz modes: multiple choice, true/false, typed answer, matching
6. Faster entry: bulk paste, CSV import, cloze cards
7. Gamification and stats: XP, streaks, heatmap, accuracy
8. Polish: JSON backup/restore, search, mobile layout, sounds
