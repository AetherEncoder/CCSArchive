// DOM helpers: $(), createEl(), escapeHTML()

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Always run user text through this before putting it inside an HTML template string.
export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

// createEl('button', { class: 'btn', onclick: fn }, 'Save')
export function createEl(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;

    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') {
      for (const [prop, val] of Object.entries(value)) node.style.setProperty(prop, val);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'value' || key === 'checked') node[key] = value;
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }

  return node;
}

// True when a key press should be left alone because the user is typing.
export function isTypingTarget(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'));
}

// True while a modal <dialog> is open, so page shortcuts don't fire behind it.
export function isModalOpen() {
  return Boolean(document.querySelector('dialog[open]'));
}

export function pluralize(count, word, plural = `${word}s`) {
  return `${count} ${count === 1 ? word : plural}`;
}

export function downloadFile(filename, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = createEl('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.readAsText(file);
  });
}

// Grow a textarea to fit its content.
export function autosize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight + 2}px`;
}
