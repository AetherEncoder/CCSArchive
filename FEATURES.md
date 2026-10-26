# Features

Every feature in detail, screen by screen, so each one can be tested. README.md has the short version; keep both in sync.

## Everywhere

- **Navbar:** brand link to Decks, links to Decks / Stats / Settings (the current section is highlighted), the day streak and the level.
  - The streak is dimmed when you haven't studied today; its tooltip says to study to keep it going.
  - The level tooltip shows XP toward the next level.
  - Both refresh when the tab comes back into view, so a streak that ended overnight shows as 0.
- **Skip to content** link for keyboard users.
- **Hash routes:** `#/`, `#/deck/new`, `#/deck/:id`, `#/deck/:id/edit`, `#/study/:id` (`all` for every deck), `#/flip/:id`, `#/quiz/:id` (`?mode=match` preselects Match), `#/stats`, `#/settings`. An unknown route or a deleted deck shows a "not found" page.
- **Toasts** for saves, errors and celebrations. Any uncaught error shows as an error toast.
- **Celebrations:** reaching the daily goal (+50 XP) and levelling up show a toast.
- **Sounds** for correct, wrong, match and session complete (can be turned off in Settings).
- **Themes:** System (follows the OS), Light, Dark.
- **Mobile layout:** works at phone width; flashcards can be swiped.

## Decks page (`#/`)

- **Hero:**
  - No decks: a welcome message.
  - Cards to study: greeting, "N cards to study today" (due cards + new cards up to the per-session limit) and a **Study now** button (studies every deck).
  - All caught up: greeting and "You're all caught up for today".
  - Summary line: streak, cards answered today vs the daily goal, level and XP.
  - **This week** bar strip: cards answered on each of the last 7 days, today highlighted.
- **Your decks:** a grid of deck cards (color, title, description, up to 3 tags, card count, due and new badges, mastered bar), most recently studied or edited first. **Import** and **New deck** buttons.
- **Search** (`/` focuses it): filters decks by title, description and tags, and lists up to 12 matching cards from any deck (links to the deck). Accent-insensitive, every word must match.
- **Empty state:** New deck, Import, and **Try a sample deck** (adds "Data Structures Basics": 10 cards of all three types, then opens it).
- **Up next:** the next due review cards across all decks (3 or 6, oldest due first), each linking to its deck's study session. **Review all** studies everything.

## Import dialog

- Choose or drag and drop a file: `.csv`, `.tsv`, `.txt` (Quizlet/Anki exports) or `.ccsdeck.json` (a shared deck).
- CSV: delimiter auto-detected (comma, semicolon, tab), quoted fields and line breaks inside quotes handled, a header row (front/back/term/definition/...) skipped, `#` lines skipped. First two columns become front and back.
- TXT: parsed like bulk paste. A CSV with no cards found falls back to bulk-paste parsing.
- Shows a preview (first 4 cards, skipped line count) and an editable deck title (taken from the file name). Enter imports.
- Clear errors for empty files, invalid JSON, or a full backup picked by mistake (points to Settings).
- If the cards don't fit in storage, the half-made deck is removed.

## Deck page (`#/deck/:id`)

- Header: color swatch, title, description, tags. **Edit deck** button and a **more** menu: Download CSV, Share deck file (`.ccsdeck.json`, no progress), Delete deck (with confirm; past activity stays in Stats).
- **Mode cards:** Study (cards to review now), Flashcards (card count), Quiz, Match (best time).
- **Progress:** mastered / learning / new bar with counts, % mastered, and due today.
- **Cards list:** front (cloze blanks highlighted), back (MCQ cards also list their wrong answers), thumbnail image, state badge (New / Learning / Mastered), due date, delete button (with confirm). Search box filters this deck's cards.
- Empty deck: an "Add cards" prompt.

## Deck editor (`#/deck/new`, `#/deck/:id/edit`)

- **Details:** title (required, max 100), description (optional, max 300), color (8 choices), tags (comma separated).
- **Card rows**, each with: number, type select, image, duplicate and delete buttons.
  - **Basic:** term + definition (both required).
  - **Fill in the blank (cloze):** sentence with `{{hidden words}}` (at least one blank required) + optional note. A **Blank out selection** button wraps the selected text in `{{ }}`.
  - **Multiple choice:** question + correct answer, and up to 3 wrong answers (optional; otherwise taken from other cards).
  - **Image:** any image file, shrunk to at most 640 px (JPEG) before saving. Can be removed.
- New decks start with 3 blank rows. Blank rows are ignored on save.
- **Tab** out of the last field of the last row adds a new row. **Add card** button too.
- **Bulk add:** paste one `term <separator> definition` per line. Separator: auto-detect, tab, ` - `, `:`, `,` or `;`. Splits at the first separator. Live count of cards found and lines skipped. Added cards replace trailing blank rows.
- **Save** (button or Ctrl/Cmd+S): validates the title and every filled card, scrolls to the first problem. Editing keeps each card's study progress. Enter in a one-line field doesn't submit.
- **Unsaved changes:** leaving the page in the app or closing the tab asks first.
- Storage-full errors show as a toast; a new deck that failed to save is removed.

## Study (`#/study/:id`, `#/study/all`)

- Spaced repetition (SM-2). The queue: due cards (oldest due first), then new cards up to **New cards per session**.
- Card shows New or Review, and the deck name when studying all decks.
- **Show answer** (Space/Enter, or click the card) flips it; then rate **Again / Hard / Good / Easy** (keys 1-4; Space/Enter = Good). Each button shows the next interval (Again = "<10m").
- Again puts the card back at the end of this session.
- Progress bar and "N left".
- XP: 10 per Hard/Good/Easy, 2 per Again.
- **Session complete:** cards studied, time, % remembered first try, XP earned; links back and to a quiz.
- **All caught up:** says when the next review is due; links to flip mode and quiz.
- Interval rules: first review Hard/Good 1 day, Easy 4; second review 3 / 6 / 9 days; after that interval × ease (Hard ×1.2, Easy ×ease×1.3). Ease starts at 2.5, minimum 1.3. A card with an interval of 14+ days counts as **Mastered**.

## Flashcards (`#/flip/:id`)

- Browse every card in order; doesn't change the schedule or give XP.
- Flip (button, Space/Enter, click), previous / next (buttons, ←/→, swipe on touch).
- **Shuffle** and **Answer first** (shows the back first; cloze cards always show the sentence first) toggles.
- Counter and progress bar. At the end: start over, shuffle and restart, or go to Study / Quiz.
- Long text gets smaller type so it fits on the card.

## Quiz (`#/quiz/:id`)

- **Setup:** pick a mode (modes that need more cards are disabled with the reason), the number of questions (5 / 10 / 20 / all), **Answer with** (definition or term; cloze cards always ask the sentence), and **3 lives** on/off. Deck at a glance: mastered / learning / new / due. The last choices are remembered.
- **Modes:**
  - **Multiple choice:** 4 options; wrong options come from the card's own wrong answers first, then other cards. Keys 1-4. Falls back to typed if there are no wrong options.
  - **True or false:** a pairing that's right or wrong. Keys T/F (or 1/2).
  - **Type the answer:** accent, case and punctuation insensitive; small typos are forgiven (about 15% of the letters, answers of 4+ letters); answers separated by ` / ` or `;` are all accepted (`TCP/IP` stays one answer). **I don't know** skips; **I was right** overrides a wrong mark.
  - **Mixed:** a random mix of the three.
  - **Matching:** see below.
- During a quiz: progress bar, counter, hearts (lives), feedback with the right answer, Continue (Enter). A wrong answer shakes the card. Running out of lives ends the quiz.
- **Results:** score ring, heading by score, correct count, best streak, XP, time; a **Review these** list of missed questions with your answer; **Retry missed**, **New quiz**, **Back to deck**.
- XP: 10 per correct answer. Every answer is logged for Stats.

## Match game (`#/quiz/:id?mode=match`)

- Up to 6 pairs as shuffled tiles. Click a term, then its answer (clicking the same side switches the selection).
- Live timer; each wrong pair adds 1 second. Pairs are matched by text, so two cards with the same answer can't trap you.
- End screen: time, mistakes, XP (5 per pair), new best time (saved per deck and shown on the deck page). Play again or pick another quiz.

## Stats (`#/stats`)

- Tiles: level and XP with progress to the next level, current and best streak, mastered / learning / new across all decks, accuracy over the last 30 days.
- **Activity heatmap:** 16-26 weeks (13 on phones); cell shade is relative to the daily goal; tooltips show cards and accuracy per day.
- **Last 7 days** bar chart with tooltips (hover or keyboard focus).
- **Decks table:** cards, % mastered, due, 30-day accuracy, last studied. Links to each deck.
- Study, Quiz and Match answers all count.

## Settings (`#/settings`)

- **Theme:** System / Light / Dark.
- **Daily goal** (1-500, default 20) and **New cards per session** (1-200, default 20). Out-of-range values are clamped.
- **Sound effects** on/off.
- **Storage used** vs about 5 MB, with a bar.
- **Download backup** (`ccsarchive-backup-YYYY-MM-DD.json`: decks, cards, reviews, settings).
- **Restore from file:** shows the backup's date and counts, asks before replacing everything. A deck file picked by mistake gets a clear error. If the restore doesn't fit, the old data is put back.
- **Delete everything** (with confirm).
- Keyboard shortcuts list.

## XP and streaks

- Levels need 100, 300, 600, 1000, ... total XP (each level 100 more than the last).
- The streak grows on the first answer of each day and survives until the end of the next day.
- Daily goal: answering that many cards in a day adds a 50 XP bonus once that day.
