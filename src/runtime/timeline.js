/**
 * @module @arraypress/effects-astro/timeline
 *
 * A timeline drawn by scrolling: as the page scrolls, the line fills down
 * to a point a little below the middle of the screen (`--progress`, 0–1,
 * on the element) and each `[data-timeline-item]` it reaches is marked
 * `is-reached`. With prefers-reduced-motion it is drawn in full.
 */

import { prefersReducedMotion } from './device.js';

/** Where the fill reaches, as a share of the viewport's height from the top. */
const READ_LINE = 0.6;

/**
 * Starts filling a timeline as it scrolls.
 *
 * @param {HTMLElement} el The timeline.
 * @returns {() => void} Stops it.
 */
export function timeline(el) {
	const items = /** @type {HTMLElement[]} */ ([...el.querySelectorAll('[data-timeline-item]')]);
	if (prefersReducedMotion()) {
		el.style.setProperty('--progress', '1');
		items.forEach((item) => item.classList.add('is-reached'));
		return () => {};
	}
	let queued = false;

	/** Measures and marks, once a frame at most. */
	const update = () => {
		queued = false;
		const line = innerHeight * READ_LINE;
		const box = el.getBoundingClientRect();
		const progress = Math.min(1, Math.max(0, (line - box.top) / box.height));
		el.style.setProperty('--progress', progress.toFixed(4));
		items.forEach((item) => item.classList.toggle('is-reached', item.getBoundingClientRect().top + 12 < line));
	};
	/** Queues an update for the next frame. */
	const queue = () => {
		if (queued) return;
		queued = true;
		requestAnimationFrame(update);
	};

	addEventListener('scroll', queue, { passive: true });
	addEventListener('resize', queue);
	update();
	return () => {
		removeEventListener('scroll', queue);
		removeEventListener('resize', queue);
	};
}
