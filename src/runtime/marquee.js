/**
 * @module @arraypress/effects-astro/marquee
 *
 * The pause button on a `<Marquee>`: moving content that lasts more than
 * five seconds needs a way to stop it (WCAG 2.2.2). Toggles `is-paused` on
 * the marquee, which freezes the scroll, and keeps the button's pressed
 * state and label in step for assistive technology.
 */

/**
 * Wires one marquee's pause button.
 *
 * @param {HTMLElement} el The marquee.
 * @returns {() => void} Unwires it.
 */
export function marquee(el) {
	const button = el.querySelector('[data-marquee-toggle]');
	if (!(button instanceof HTMLButtonElement)) return () => {};
	/** Pauses or resumes, and says so. */
	const toggle = () => {
		const paused = el.classList.toggle('is-paused');
		button.setAttribute('aria-pressed', String(paused));
		button.setAttribute('aria-label', paused ? button.dataset.resume ?? 'Resume scrolling' : button.dataset.pause ?? 'Pause scrolling');
	};
	button.addEventListener('click', toggle);
	return () => button.removeEventListener('click', toggle);
}
