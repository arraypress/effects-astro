/**
 * @module @arraypress/effects-astro/count-up
 *
 * A number that counts up to its value as it scrolls into view, easing
 * in to land, and after that glides to any new value set on its
 * `data-value` (a calculator's result following its sliders). The final
 * number is in the page from the start; with prefers-reduced-motion it
 * changes without counting.
 */

import { prefersReducedMotion } from './device.js';
import { inView } from './in-view.js';
import { animate } from './loop.js';
import { numberFormat } from './number-format.js';

/**
 * @typedef {import('./number-format.js').NumberStyle & {
 *   from?: number,
 *   duration?: number,
 * }} CountUpConfig
 * `from` is where the first count starts (default 0); `duration` the
 * seconds a count takes (default 1.6).
 */

/**
 * Starts counting an element's `data-value`.
 *
 * @param {HTMLElement} el The number.
 * @param {CountUpConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function countUp(el, config) {
	const write = numberFormat(config);
	const duration = (config.duration ?? 1.6) * 1000;
	const still = prefersReducedMotion();
	/** Reads the value it should show. */
	const target = () => Number(el.dataset.value) || 0;
	let shown = target();
	let from = shown;
	let to = shown;
	let began = 0;
	/** @type {(() => void) | null} */
	let stopFrame = null;

	/**
	 * One frame of a count.
	 *
	 * @param {number} now The time, ms.
	 */
	const frame = (now) => {
		const t = Math.min(1, (now - began) / duration);
		shown = from + (to - from) * (1 - (1 - t) ** 4);
		el.textContent = write(shown);
		if (t === 1) {
			stopFrame?.();
			stopFrame = null;
		}
	};

	/**
	 * Counts from a number to another.
	 *
	 * @param {number} start Where it starts.
	 * @param {number} end Where it lands.
	 */
	const count = (start, end) => {
		from = start;
		to = end;
		if (still || start === end) {
			shown = end;
			el.textContent = write(end);
			return;
		}
		began = performance.now();
		stopFrame ??= animate(el, frame);
	};

	const unwatch = inView(el, () => count(config.from ?? 0, target()));
	const changes = new MutationObserver(() => count(shown, target()));
	changes.observe(el, { attributes: true, attributeFilter: ['data-value'] });
	return () => {
		unwatch();
		changes.disconnect();
		stopFrame?.();
	};
}
