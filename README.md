# CCSArchive

A flashcard and quiz app made with plain HTML, CSS and JavaScript. There's no framework, build step or AI. Everything stays in your browser.

## Running it

ES modules don't load from `file://`, so serve the folder with a local server:

- **VS Code:** install the Live Server extension, right-click `index.html`, then choose **Open with Live Server**.
- **Python:** run `python -m http.server 5173`, then open http://localhost:5173
- **Node:** run `npx serve`

## Features

The short list. [FEATURES.md](FEATURES.md) describes every feature in detail.

- **Decks:** create, edit, tag, color, search and delete them. Each card is one of:
  - **Basic:** term and definition.
  - **Fill in the blank:** for example `The {{CPU}} executes instructions.`
  - **Multiple choice:** has its own wrong answers.
  - Any card can also have an image.
- **Faster entry:**
  - Bulk paste, one `term - definition` per line.
  - CSV/TSV/TXT import from Quizlet or Anki.
  - Duplicate a card.
  - Press Tab in the last field to add a new card.
- **Study:** spaced repetition (SM-2) with Again / Hard / Good / Easy ratings. Due cards come first, then new ones.
- **Flashcards:** browse cards freely, with shuffle, swap sides and swipe on mobile.
- **Quiz:** multiple choice, true/false, typed answers (small typos are forgiven), or a mix. Optional 3 lives, and you can retry the ones you missed.
- **Match:** pair terms with answers against the clock. Your best time is saved for each deck.
- **Progress:** XP, levels, a daily goal, day streaks, a year-long activity heatmap, and stats for each deck.
- **Your data:**
  - Back up and restore everything as JSON.
  - Share a single deck as a `.ccsdeck.json` file.
  - Export a deck as CSV.
- Light and dark themes, keyboard shortcuts, and a mobile layout.

## Structure

```
index.html            App shell; views render into <main id="app">
assets/icons/         Logo
css/
  main.css            The only linked stylesheet; @imports the rest
  base/               Reset, design tokens (light/dark), typography
  layout/             Navbar, containers, shared layout pieces
  components/         Buttons, forms, flashcard, modal, toast...
  pages/              One file per screen
js/
  app.js              Entry point
  router.js           Hash router (#/deck/:id etc.) with per-view cleanup
  store.js            Tiny shared state (navbar XP/streak)
  data/               The only layer that touches storage
  services/           Pure logic: SRS, quiz building, XP/streaks, search, importers
  views/              One file per screen
  components/         Reusable UI pieces
  utils/              DOM, dates, icons, sounds, images, cloze text...
```

Each view is a function `(root, { params, query })` that renders into `root` and returns a cleanup function. The router calls that cleanup before showing the next page.

## Data model

All data is stored in `localStorage` under keys starting with `ccsarchive:`.

- **Deck:** `id, title, description, color, tags, createdAt, updatedAt, lastStudiedAt, bestMatchMs`
- **Card:** `id, deckId, type (basic | cloze | mcq), front, back, choices, image, createdAt, srs`
  - `srs`: `{ reps, interval, ease, lapses, dueDate, lastReviewed }`
- **Review:** `cardId, deckId, mode (study | quiz | match), rating, correct, at`
- **Settings:** `theme, dailyGoal, newPerSession, soundOn, xp, streak, bestStreak, lastStudyDate, goalReachedDate, quizPrefs`

Browsers allow roughly 5 MB of localStorage per site. Card images are shrunk before they're saved, but they still use the most space. If you outgrow that limit, swap `js/data/db.js` for an IndexedDB version; nothing else touches storage directly.
