/**
 * @module @arraypress/effects-astro/scroll-reveal
 *
 * Scroll reveal for a whole page from one IntersectionObserver: every
 * element matching the selector gets a class (`is-visible`) as it scrolls
 * into view, and the stylesheet (reveal.css, or your own) animates it
 * there. Elements already on screen are shown at once, so nothing
 * flashes. Marks the page `.fx-reveal` so that, until it runs, nothing is
 * hidden. With prefers-reduced-motion it does nothing, and all shows.
 *
 * Runs again after each Astro view transition, picking up only the
 * elements not yet shown.
 */

import { prefersReducedMotion } from './device.js';

/** The classes reveal.css styles. */
export const REVEAL_CLASSES =
	'.fade-in, .fade-in-up, .fade-in-down, .fade-in-left, .fade-in-right, .slide-in-up, .slide-in-down, .slide-in-left, .slide-in-right, .zoom-in, .zoom-out, .flip-up, .flip-down, .flip-left, .flip-right, .blur-in';

/**
 * @typedef {object} ScrollRevealConfig
 * @property {string} [selector] What to reveal. Default the reveal.css classes.
 * @property {string} [visibleClass='is-visible'] The class added on arrival.
 * @property {number} [threshold=0.08] How much must be in view, 0–1.
 * @property {string} [rootMargin='0px 0px -10% 0px'] The observer's margin.
 * @property {boolean} [once=true] Reveal once; false hides it again when it leaves, to replay.
 */

/** @type {IntersectionObserver | null} */
let observer = null;

/**
 * Starts revealing the page's matching elements (again, after a view
 * transition: the previous observer is let go).
 *
 * @param {ScrollRevealConfig} [config] The settings.
 * @returns {() => void} Stops it.
 */
export function scrollReveal(config = {}) {
	const visible = config.visibleClass ?? 'is-visible';
	const once = config.once !== false;
	observer?.disconnect();
	observer = null;
	if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return () => {};
	document.documentElement.classList.add('fx-reveal');

	const watcher = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					entry.target.classList.add(visible);
					if (once) watcher.unobserve(entry.target);
				} else if (!once) {
					entry.target.classList.remove(visible);
				}
			}
		},
		{ threshold: config.threshold ?? 0.08, rootMargin: config.rootMargin ?? '0px 0px -10% 0px' },
	);
	observer = watcher;

	const pending = (config.selector ?? REVEAL_CLASSES)
		.split(',')
		.map((part) => `${part.trim()}:not(.${visible})`)
		.join(',');
	document.querySelectorAll(pending).forEach((el) => {
		const box = el.getBoundingClientRect();
		if (box.top < innerHeight && box.bottom > 0) el.classList.add(visible);
		else watcher.observe(el);
	});
	return () => watcher.disconnect();
}
