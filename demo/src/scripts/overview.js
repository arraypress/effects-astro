/**
 * The "All effects" overview: the bar's button opens it with the hero on
 * show marked and in view, a card goes there (src/scripts/viewer.js does
 * the going), and Escape or the close button shuts it, handing focus back
 * to the bar's button.
 */

const overview = /** @type {HTMLElement} */ (document.querySelector('[data-overview]'));
const button = /** @type {HTMLElement} */ (document.querySelector('[data-overview-open]'));

/** The card for the hero on show. */
let marked = /** @type {HTMLElement | null} */ (null);

/**
 * Opens the overview, the card for the hero on show focused and in view.
 */
function open() {
	overview.hidden = false;
	button.setAttribute('aria-expanded', 'true');
	marked?.scrollIntoView({ block: 'center' });
	(marked ?? overview.querySelector('[data-stop]'))?.focus({ preventScroll: true });
}

/**
 * Closes the overview, and hands focus back to the bar's button.
 */
function close() {
	overview.hidden = true;
	button.setAttribute('aria-expanded', 'false');
	button.focus({ preventScroll: true });
}

button.addEventListener('click', () => (overview.hidden ? open() : close()));

overview.addEventListener('click', (e) => {
	if (/** @type {HTMLElement} */ (e.target).closest('[data-overview-close], [data-stop]')) close();
});

// Escape shuts the overview and nothing under it (the panel listens on the document).
overview.addEventListener('keydown', (e) => {
	if (e.key !== 'Escape') return;
	e.stopPropagation();
	close();
});

document.addEventListener('gallery:hero', (e) => {
	const { stop } = /** @type {CustomEvent<import('./viewer.js').Shown>} */ (e).detail;
	marked?.removeAttribute('aria-current');
	marked = stop ?? null;
	marked?.setAttribute('aria-current', 'true');
});
