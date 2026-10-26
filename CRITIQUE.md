# Design critique loop

A reusable prompt for polishing CCSArchive with a reviewer subagent. Paste the block below to start a round of polishing.

This is polish, not a redesign: the Supabase-style design in `css/base/variables.css` stays. The loop only hunts for places where the design makes the app harder to use or looks broken.

---

Goal: polish CCSArchive's UI in the browser until a reviewer subagent scores it ≥90/100. Keep the existing design (colors, fonts, icons, layout patterns, navigation). Only fix spots where it hurts usability or looks bad.

SETUP (once):
- Read `css/base/variables.css` (the tokens are the source of truth) and the "Design" section of CONTEXT.md.
- Serve the folder: `python -m http.server 5173` (in the background).
- Browser: use Claude in Chrome or the built-in browser if one is connected. Otherwise write a throwaway Playwright script in the session scratchpad (`npx -y playwright install chromium` once). Never add Playwright or a `package.json` to the project.
- Use a fresh browser profile/context, never the owner's: their real decks live in their browser's `localStorage`. Seed it by clicking the sample deck button on the empty dashboard (`[data-action="sample"]`), then add a few study reviews so the stats screens have data.
- Screens to capture (the "set"): Dashboard, Deck, Editor, Study (question and answer side), Flip, Quiz (one question and the results), Stats, Settings. Two widths: desktop 1280×800 and phone 390×844. Screens that scroll get one shot per viewport, top to bottom (max 3 per screen).
- The theme defaults to "system", so switch it with the browser's color scheme (Playwright `colorScheme: 'dark' | 'light'`). Capture the set in light, then in dark.

LOOP (max 6 rounds):
1. Screenshots into the session scratchpad, named `r<n>-<theme>-<width>-<screen>-<part>.png`. Navigate by clicking, or by setting `location.hash` (`#/`, `#/deck/<id>`, `#/deck/<id>/edit`, `#/study/<id>`, `#/flip/<id>`, `#/quiz/<id>`, `#/stats`, `#/settings`).
2. Spawn a reviewer subagent with ONLY the screenshot paths and this brief:
   "You are a strict senior web UI designer doing a polish pass on a finished flashcard and quiz web app. Rate how well it executes ITS OWN design, 0-100.
   The design is fixed and not up for debate: Supabase-inspired developer-tool look, neutral grays, hairline borders, flat surfaces, small radii, compact controls, one blue brand color with an amber accent, Geist + Geist Mono, light and dark themes, works on desktop and phone.
   Look only for two kinds of problem:
   (a) usability: hard to read, hard to click or tap, unclear what's clickable or selected, confusing hierarchy, cramped or cut-off content, focus not visible, broken at phone width;
   (b) visual flaws: misalignment, uneven spacing, inconsistent sizes or styles between screens, low contrast, clipped/overlapping/truncated text, things that look broken in one theme or at one width.
   Anchors: 50=many usability problems or visible flaws, 70=works but several rough spots, 85=polished with a few small flaws, 90+=no usability problems and no visible flaws.
   Do not read code. Do not praise. Never suggest a new style, new colors or fonts, more decoration, new features, or restructuring a screen. Every fix must stay inside the existing design.
   Reply in EXACTLY this format, nothing else:
   SCORE: <n>
   ISSUES (max 5, worst first):
   - <screen/theme/width>: <problem> → <specific fix with values in px, e.g. 'deck title 15px→17px, line-height 1.3'>"
3. If SCORE ≥90: stop and report the final score.
4. Otherwise apply the listed fixes. Skip any that would change the overall design (new colors, fonts, layout patterns, decoration); note them for the final report instead.
   - Prefer changing a token in `css/base/variables.css` or a shared file (`css/components/`, `css/layout/`) over one-off rules in `css/pages/`.
   - When a token changes, check both themes: dark overrides live in the same file.
   - Edit only the relevant styles/markup. Don't rewrite unrelated code.
   - Reload the page before taking the next screenshots.
5. Repeat.

Token rules:
- Reviewer gets screenshots + brief only; never send it source files, CONTEXT.md or earlier reviews.
- Don't re-read whole files; edit targeted sections.
- No narration between rounds. Log one line per round: "R<n>: <score>".
- If the score doesn't improve for 2 rounds, stop and list the remaining issues for me.

Privacy: keep the screenshots in the scratchpad; never upload or publish them.

Finish:
- Load every screen once more in both themes and check the browser console for errors.
- Stop the local server.
- Add an entry to PROGRESS.md (what changed, final score, issues left).
- Final output: score history, a 3-line summary of the main changes, and any skipped fixes that would have changed the design (for me to decide).

---

## Past runs

<!-- One line per run: date, score history, main changes. -->
