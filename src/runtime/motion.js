/**
 * @module @arraypress/effects-astro/motion
 *
 * The script side of motion.css: replaying a one-shot motion. A class
 * that is already there does not restart its animation, so the class is
 * taken off, a reflow forced, and put back.
 */

/**
 * Plays an element's one-shot motion again: `.fx-bump` by default (a cart
 * count going up), or `is-active` for `.fx-heartbeat`.
 *
 * @param {Element | null} el The element.
 * @param {string} [state='is-bumped'] The class that plays it.
 */
export function bump(el, state = 'is-bumped') {
	if (!(el instanceof HTMLElement)) return;
	el.classList.remove(state);
	void el.offsetWidth;
	el.classList.add(state);
}
