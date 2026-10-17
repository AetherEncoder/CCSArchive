// Accuracy, heatmap, progress

import { getSortedDecks, deckColorVar } from '../data/decks.js';
import { getAllDeckStats, getDeckStats } from '../data/cards.js';
import { getReviews, getDailyCounts } from '../data/reviews.js';
import { getProfile } from '../services/gamification.js';
import { progressHTML } from '../components/progressBar.js';
import { setTitle } from '../router.js';
import { $, escapeHTML, createEl, pluralize } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { todayKey, addDays, parseKey, keyFromTimestamp, formatDate, daysBetween } from '../utils/date.js';

const HEATMAP_WEEKS = 26;
const HEATMAP_WEEKS_NARROW = 13; // phones show fewer, larger weeks

// Shade relative to the daily goal: half the goal, the goal, double the goal.
function heatLevel(count, goal) {
  if (!count) return 0;
  if (count < goal / 2) return 1;
  if (count < goal) return 2;
  if (count < goal * 2) return 3;
  return 4;
}

function dayTip(key, day) {
  const date = formatDate(key, { weekday: 'short', month: 'short', day: 'numeric' });
  if (!day?.total) return `<strong>${date}</strong>No activity`;
  const accuracy = Math.round((day.correct / day.total) * 100);
  return `<strong>${date}</strong>${pluralize(day.total, 'card')} · ${accuracy}% correct`;
}

// Start at the first week with any activity (at least 16 weeks, at most 26); phones show 16.
function heatmapWeeks(daily, today) {
  if (window.matchMedia('(max-width: 480px)').matches) return HEATMAP_WEEKS_NARROW;
  const first = [...daily.keys()].sort()[0];
  if (!first) return 16;
  const weeks = Math.ceil((daysBetween(first, today) + parseKey(today).getDay() + 1) / 7);
  return Math.min(HEATMAP_WEEKS, Math.max(16, weeks));
}

function heatmapHTML(daily, goal, today, weeks = HEATMAP_WEEKS) {
  // Start on the Sunday of the first week so each column is one Sun-Sat week.
  const start = addDays(today, -7 * (weeks - 1) - parseKey(today).getDay());
  const cells = [];
  const months = [];
  let activeDays = 0;
  let lastMonth = -1;

  // One CSS grid: row 1 holds month labels, column 1 holds weekday labels,
  // and each day sits at (weekday + 2, week + 2) so the cells can stretch to fill the width.
  for (let i = 0; i < weeks * 7; i++) {
    const key = addDays(start, i);
    const day = daily.get(key);
    const isFuture = key > today;
    const week = Math.floor(i / 7);
    if (day?.total && !isFuture) activeDays++;

    if (i % 7 === 0) {
      const month = parseKey(key).getMonth();
      if (month !== lastMonth) {
        months.push({ week, label: formatDate(key, { month: 'short' }) });
        lastMonth = month;
      }
    }

    cells.push(
      `<span class="heatmap__cell ${isFuture ? 'is-future' : ''} ${key === today ? 'is-today' : ''}" style="grid-row:${(i % 7) + 2};grid-column:${week + 2}" data-level="${isFuture ? 0 : heatLevel(day?.total ?? 0, goal)}" ${isFuture ? '' : `data-tip="${escapeHTML(dayTip(key, day))}"`}></span>`,
    );
  }

  // Skip a label that would collide with the next one (e.g. a month starting in the last column).
  const monthLabels = months
    .filter((month, i) => (months[i + 1]?.week ?? weeks + 3) - month.week >= 3)
    .map((month) => `<span class="heatmap__month" style="grid-column:${month.week + 2} / span 3">${month.label}</span>`)
    .join('');
  const dayLabels = [['Mon', 3], ['Wed', 5], ['Fri', 7]]
    .map(([label, row]) => `<span class="heatmap__day" style="grid-row:${row}">${label}</span>`)
    .join('');

  return `
    <div class="heatmap" style="--weeks:${weeks}" role="img" aria-label="Activity over the last ${weeks} weeks: studied on ${pluralize(activeDays, 'day')}.">
      ${monthLabels}${dayLabels}${cells.join('')}
    </div>
    <div class="heatmap__legend" aria-hidden="true">
      <span>Less</span>
      ${[0, 1, 2, 3, 4].map((level) => `<span class="heatmap__cell" data-level="${level}"></span>`).join('')}
      <span>More</span>
    </div>`;
}

function weekChartHTML(daily, today) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(today, i - 6);
    return { key, ...(daily.get(key) ?? { total: 0, correct: 0 }) };
  });
  const max = Math.max(1, ...days.map((day) => day.total));

  const columns = days
    .map((day) => {
      const label = formatDate(day.key, { weekday: 'long', month: 'short', day: 'numeric' });
      const accuracy = day.total ? `${Math.round((day.correct / day.total) * 100)}% correct` : 'No activity';
      const tip = `<strong>${label}</strong>${pluralize(day.total, 'card')}${day.total ? ` · ${accuracy}` : ''}`;
      return `
        <div class="bar-chart__col ${day.total ? '' : 'is-empty'} ${day.key === today ? 'is-today' : ''}" tabindex="0" data-tip="${escapeHTML(tip)}" aria-label="${escapeHTML(`${label}: ${pluralize(day.total, 'card')}, ${accuracy}`)}">
          <span class="bar-chart__value" aria-hidden="true">${day.total}</span>
          <div class="bar-chart__bar" style="height:${(day.total / max) * 100}%"></div>
        </div>`;
    })
    .join('');

  const labels = days
    .map((day) => `<span class="${day.key === today ? 'is-today' : ''}">${day.key === today ? 'Today' : formatDate(day.key, { weekday: 'short' })}</span>`)
    .join('');

  return `<div class="bar-chart">${columns}</div><div class="bar-chart__labels" aria-hidden="true">${labels}</div>`;
}

function deckTableHTML(decks, statsByDeck, recentByDeck) {
  if (!decks.length) return '<p class="muted">No decks yet.</p>';
  const rows = decks
    .map((deck) => {
      const stats = statsByDeck.get(deck.id) ?? { total: 0, mastered: 0, due: 0 };
      const recent = recentByDeck.get(deck.id);
      const accuracy = recent?.total ? `${Math.round((recent.correct / recent.total) * 100)}%` : '-';
      const mastered = stats.total ? `${Math.round((stats.mastered / stats.total) * 100)}%` : '-';
      return `
        <tr>
          <td><a href="#/deck/${encodeURIComponent(deck.id)}" style="--deck-color:${deckColorVar(deck.color)}"><span class="deck-dot"></span>${escapeHTML(deck.title)}</a></td>
          <td class="num deck-table__meta" data-label="Cards" data-unit="cards">${stats.total}</td>
          <td class="num deck-table__meta" data-label="Mastered" data-unit="mastered">${mastered}</td>
          <td class="num deck-table__meta" data-label="Due" data-unit="due">${stats.due}</td>
          <td class="num deck-table__acc" data-label="Accuracy"><span class="acc-pill ${recent?.total ? '' : 'is-empty'}">${recent?.total ? accuracy : '—'}</span></td>
          <td class="deck-table__last" data-label="Last studied">${deck.lastStudiedAt ? formatDate(deck.lastStudiedAt, { month: 'short', day: 'numeric' }) : '<span class="faint">Never</span>'}</td>
        </tr>`;
    })
    .join('');

  return `
    <div class="table-wrap">
      <table class="deck-table">
        <thead>
          <tr>
            <th scope="col">Deck</th>
            <th scope="col" class="num">Cards</th>
            <th scope="col" class="num">Mastered</th>
            <th scope="col" class="num">Due</th>
            <th scope="col" class="num">Accuracy (30d)</th>
            <th scope="col">Last studied</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// One tooltip element follows whichever chart mark is hovered or focused.
function attachTooltip(container) {
  const tooltip = createEl('div', { class: 'chart-tooltip', role: 'tooltip', hidden: true });
  document.body.append(tooltip);

  function show(event) {
    const target = event.target.closest?.('[data-tip]');
    if (!target || !container.contains(target)) return;
    const rect = target.getBoundingClientRect();
    tooltip.innerHTML = target.dataset.tip;
    tooltip.style.left = `${Math.min(Math.max(rect.left + rect.width / 2, 90), window.innerWidth - 90)}px`;
    tooltip.style.top = `${rect.top}px`;
    tooltip.hidden = false;
  }

  function hide(event) {
    if (event.target.closest?.('[data-tip]')) tooltip.hidden = true;
  }

  const hideNow = () => (tooltip.hidden = true);

  container.addEventListener('mouseover', show);
  container.addEventListener('focusin', show);
  container.addEventListener('mouseout', hide);
  container.addEventListener('focusout', hide);
  window.addEventListener('scroll', hideNow, { passive: true });

  return () => {
    window.removeEventListener('scroll', hideNow);
    tooltip.remove();
  };
}

export function statsView(root) {
  setTitle('Stats');

  const today = todayKey();
  const profile = getProfile();
  const decks = getSortedDecks();
  const statsByDeck = getAllDeckStats(today);
  const overall = getDeckStats(null, today);
  const reviews = getReviews();
  const daily = getDailyCounts();

  // Accuracy over the last 30 days, overall and per deck
  const since = addDays(today, -29);
  const recentByDeck = new Map();
  let recentTotal = 0;
  let recentCorrect = 0;
  for (const review of reviews) {
    if (keyFromTimestamp(review.at) < since) continue;
    recentTotal++;
    if (review.correct) recentCorrect++;
    const entry = recentByDeck.get(review.deckId) ?? { total: 0, correct: 0 };
    entry.total++;
    if (review.correct) entry.correct++;
    recentByDeck.set(review.deckId, entry);
  }
  const accuracy = recentTotal ? `${Math.round((recentCorrect / recentTotal) * 100)}%` : '-';

  root.innerHTML = `
    <div class="page-header">
      <div class="page-header__text">
        <h1>Stats</h1>
        <p class="muted">Every card you answer in Study, Quiz or Match counts here.</p>
      </div>
    </div>

    <div class="stats-tiles">
      <div class="stat-tile">
        <span class="stat-tile__label">Level ${profile.level}</span>
        <span class="stat-tile__value">${profile.xp} <small>XP</small></span>
        ${progressHTML(profile.current, profile.needed, { label: 'Progress to next level', variant: 'sm' })}
        <span class="stat-tile__meta">${profile.needed - profile.current} XP to level ${profile.level + 1}</span>
      </div>
      <div class="stat-tile stat-tile--streak">
        <span class="stat-tile__label">Current streak</span>
        <span class="stat-tile__value">${profile.streak} <small>${profile.streak === 1 ? 'day' : 'days'}</small></span>
        <span class="stat-tile__meta">Best: ${pluralize(profile.bestStreak, 'day')}</span>
      </div>
      <div class="stat-tile">
        <span class="stat-tile__label">Mastered</span>
        <span class="stat-tile__value">${overall.mastered} <small>/ ${overall.total}</small></span>
        <span class="stat-tile__meta">${overall.learning} learning · ${overall.new} new</span>
      </div>
      <div class="stat-tile">
        <span class="stat-tile__label">Accuracy</span>
        <span class="stat-tile__value">${accuracy}</span>
        <span class="stat-tile__meta">${pluralize(recentTotal, 'answer')} · 30d</span>
      </div>
    </div>

    <div class="stats-charts">
    <section class="panel chart-panel" id="activity">
      <div class="chart-panel__header">
        <h2>Activity</h2>
        <p>Brighter cells mean closer to your daily goal of ${profile.dailyGoal}.</p>
      </div>
      ${heatmapHTML(daily, profile.dailyGoal, today, heatmapWeeks(daily, today))}
    </section>

    <section class="panel chart-panel" id="week">
      <div class="chart-panel__header">
        <h2>Cards answered, last 7 days</h2>
        <p>${pluralize(profile.todayCount, 'card')} today</p>
      </div>
      ${weekChartHTML(daily, today)}
    </section>
    </div>

    <section class="section panel">
      <h2 class="panel__title">Decks</h2>
      ${deckTableHTML(decks, statsByDeck, recentByDeck)}
    </section>`;

  const removeHeatTip = attachTooltip($('#activity', root));
  const removeWeekTip = attachTooltip($('#week', root));
  return () => {
    removeHeatTip();
    removeWeekTip();
  };
}
