/**
 * @module @arraypress/effects-astro/glass-sheen
 *
 * The sheen on every `.glass` panel (glass.css): a soft light where the
 * pointer is, from two custom properties kept up to date here. One
 * document listener for every panel on the page.
 */

let installed = false;

/**
 * Moves the sheen to the pointer: its place within whichever panel it is
 * over, as percentages.
 *
 * @param {PointerEvent} event The pointer's move.
 */
function follow(event) {
	const panel = /** @type {Element | null} */ (event.target)?.closest?.('.glass');
	if (!(panel instanceof HTMLElement)) return;
	const box = panel.getBoundingClientRect();
	panel.style.setProperty('--glass-x', `${((event.clientX - box.left) / box.width) * 100}%`);
	panel.style.setProperty('--glass-y', `${((event.clientY - box.top) / box.height) * 100}%`);
}

/** Starts the sheen for every `.glass` panel on the page, now and later; once is enough. */
export function glassSheen() {
	if (installed || typeof document === 'undefined') return;
	installed = true;
	document.addEventListener('pointermove', follow, { passive: true });
}
