// Parses 'term - definition' lines into cards

export const SEPARATORS = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'tab', label: 'Tab', value: '\t' },
  { id: 'dash', label: 'Dash ( - )', value: ' - ' },
  { id: 'colon', label: 'Colon ( : )', value: ':' },
  { id: 'comma', label: 'Comma ( , )', value: ',' },
  { id: 'semicolon', label: 'Semicolon ( ; )', value: ';' },
];

// Checked in this order; the first one found on most lines wins.
const DETECT_ORDER = ['tab', 'dash', 'colon', 'semicolon', 'comma'];

function separatorById(id) {
  return SEPARATORS.find((sep) => sep.id === id);
}

export function detectSeparator(lines) {
  if (!lines.length) return separatorById('dash');
  for (const id of DETECT_ORDER) {
    const sep = separatorById(id);
    const hits = lines.filter((line) => line.includes(sep.value)).length;
    if (hits / lines.length >= 0.6) return sep;
  }
  return separatorById('dash');
}

// Splits each line at the FIRST separator, so definitions may contain it too.
// Lines starting with # are treated as comments (Anki exports use them).
export function parseBulkText(text, separatorId = 'auto') {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  const separator = separatorId === 'auto' ? detectSeparator(lines) : separatorById(separatorId);
  const cards = [];
  const skipped = [];

  for (const line of lines) {
    const index = line.indexOf(separator.value);
    const front = index === -1 ? '' : line.slice(0, index).trim();
    const back = index === -1 ? '' : line.slice(index + separator.value.length).trim();
    if (front && back) cards.push({ front, back });
    else skipped.push(line);
  }

  return { cards, skipped, separator };
}
