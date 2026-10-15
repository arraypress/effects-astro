/**
 * @module @arraypress/effects-astro/scroll-chrome
 *
 * What follows the page's scroll: a reading-progress bar, and a back-to-top
 * button that appears once you are a little way down and hides again near
 * the bottom, so it never sits on the footer. One scroll listener for all
 * of them, reading the position once and writing to whichever exist; the
 * elements are looked up each time, so it survives view transitions.
 *
 * A hidden button is also `inert` and `aria-hidden`, in the same step: a
 * faded-out button that can still be tabbed to is a trap (WCAG 4.1.2).
 *
 * From the LaunchGrid theme.
 */

import { prefersReducedMotion } from './device.js';

let installed = false;

/**
 * Shows or hides a floating control, with its accessibility state in step.
 *
 * @param {HTMLElement} el The control.
 * @param {boolean} shown Whether it should show.
 */
function setShown(el, shown) {
	el.dataset.show = shown ? 'true' : 'false';
	el.toggleAttribute('inert', !shown);
	el.setAttribute('aria-hidden', shown ? 'false' : 'true');
}

/** Reads the scroll once and updates every bar and button. */
function update() {
	const max = document.documentElement.scrollHeight - window.innerHeight;
	const y = window.scrollY;
	const progress = max > 0 ? Math.min(y / max, 1) : 0;
	document.querySelectorAll('[data-effect-scroll-progress]').forEach((bar) => {
		if (bar instanceof HTMLElement) bar.style.setProperty('--progress', progress.toFixed(4));
	});
	document.querySelectorAll('[data-effect-back-to-top]').forEach((button) => {
		if (!(button instanceof HTMLElement)) return;
		const after = Number(button.dataset.after ?? 0.4);
		// Near the bottom the footer is on screen: the button would cover it.
		setShown(button, y > window.innerHeight * after && !(max > 0 && y > max - 120));
	});
}

/** Starts following the scroll; once is enough. */
export function scrollChrome() {
	if (installed || typeof window === 'undefined') return;
	installed = true;
	window.addEventListener('scroll', update, { passive: true });
	window.addEventListener('resize', update, { passive: true });
	document.addEventListener('astro:page-load', update);
	// Delegated, so it works for buttons added later and after navigation.
	document.addEventListener('click', (e) => {
		if (!/** @type {Element | null} */ (e.target)?.closest?.('[data-effect-back-to-top]')) return;
		window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
	});
	update();
}
