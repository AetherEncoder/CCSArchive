// Modal dialog helper built on the native <dialog> element
// (it handles the focus trap, Esc key and backdrop for us).

import { createEl } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

let modalCount = 0;

// actions: [{ label, variant, onClick }] - return false from onClick to keep the modal open.
export function openModal({ title, body, actions = [], size = 'md', onClose } = {}) {
  const titleId = `modal-title-${++modalCount}`;
  let closed = false;

  const dialog = createEl('dialog', { class: `modal modal--${size}`, 'aria-labelledby': titleId });
  const closeButton = createEl('button', {
    type: 'button',
    class: 'icon-btn',
    'aria-label': 'Close',
    html: icon('x'),
    onclick: () => close(),
  });

  const actionButtons = actions.map((action) =>
    createEl(
      'button',
      {
        type: 'button',
        class: `btn btn--${action.variant ?? 'secondary'}`,
        onclick: async () => {
          if ((await action.onClick?.()) !== false) close();
        },
      },
      action.label,
    ),
  );

  const panel = createEl(
    'div',
    { class: 'modal__panel' },
    createEl('header', { class: 'modal__header' }, createEl('h2', { id: titleId }, title), closeButton),
    createEl('div', { class: 'modal__body' }, body),
    actionButtons.length ? createEl('footer', { class: 'modal__actions' }, actionButtons) : null,
  );
  dialog.append(panel);
  document.body.append(dialog);

  function close() {
    if (closed) return;
    closed = true;
    dialog.close();
    dialog.remove();
    onClose?.();
  }

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  // A click on the dialog itself (not the panel) means the backdrop was clicked.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  dialog.showModal();
  return { dialog, close, actionButtons };
}

// Resolves true if the user confirms, false otherwise.
export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let confirmed = false;
    const { actionButtons } = openModal({
      title,
      body: createEl('p', {}, message),
      actions: [
        { label: 'Cancel' },
        {
          label: confirmLabel,
          variant: danger ? 'danger' : 'primary',
          onClick: () => {
            confirmed = true;
          },
        },
      ],
      onClose: () => resolve(confirmed),
    });
    actionButtons[1].focus();
  });
}
