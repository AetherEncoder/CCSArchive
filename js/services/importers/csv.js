// Parses Quizlet/Anki CSV exports into cards, and writes decks back out as CSV.

const HEADER_WORDS = ['front', 'back', 'term', 'definition', 'question', 'answer', 'word', 'meaning'];

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const counts = [',', ';', '\t'].map((delimiter) => [delimiter, firstLine.split(delimiter).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

// Handles quoted fields, escaped quotes ("") and line breaks inside quotes.
export function parseCsv(text, delimiter) {
  const source = String(text ?? '').replace(/^﻿/, '');
  delimiter ??= detectDelimiter(source);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (inQuotes) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

// Uses the first two columns as front/back and skips a header row if present.
export function csvToCards(rows) {
  let body = rows;
  const header = rows[0]?.slice(0, 2).map((cell) => cell.trim().toLowerCase()) ?? [];
  if (header.some((cell) => HEADER_WORDS.includes(cell))) body = rows.slice(1);

  const cards = [];
  let skipped = 0;
  for (const row of body) {
    const front = row[0]?.trim() ?? '';
    const back = row[1]?.trim() ?? '';
    if (front.startsWith('#')) continue;
    if (front && back) cards.push({ front, back });
    else skipped++;
  }
  return { cards, skipped };
}

export function cardsToCsv(cards) {
  const escape = (value) => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = ['front,back', ...cards.map((card) => `${escape(card.front)},${escape(card.back)}`)];
  // The BOM makes Excel open the file as UTF-8.
  return `﻿${lines.join('\r\n')}`;
}
