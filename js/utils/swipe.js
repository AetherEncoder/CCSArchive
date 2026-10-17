// Horizontal swipe detection for touch screens (also works with a mouse drag).
// The click that follows a swipe is swallowed so the card doesn't flip as well.

const SWIPE_DISTANCE = 60;

export function addSwipe(element, { onLeft, onRight }) {
  let startX = null;
  let swiped = false;

  element.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    swiped = false;
  });

  element.addEventListener('pointerup', (event) => {
    if (startX === null) return;
    const dx = event.clientX - startX;
    startX = null;
    if (Math.abs(dx) < SWIPE_DISTANCE) return;
    swiped = true;
    if (dx < 0) onLeft?.();
    else onRight?.();
  });

  element.addEventListener(
    'click',
    (event) => {
      if (!swiped) return;
      swiped = false;
      event.stopPropagation();
      event.preventDefault();
    },
    true,
  );
}
