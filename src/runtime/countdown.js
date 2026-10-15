/**
 * @module @arraypress/effects-astro/countdown
 *
 * Keeps a `<Countdown>` ticking to its target once a second, and swaps to
 * its ended message when the target passes. The component renders the
 * right numbers at build time; this keeps them true. With reduced motion
 * the ticking tiles are hidden for a still end date (CSS), so there is no
 * interval, only one tick in case the target has already passed.
 *
 * From the WaveGrid (SampleGrid) theme.
 */

import { prefersReducedMotion } from './device.js';

/**
 * A number as two digits.
 *
 * @param {number} n The number.
 * @returns {string} Zero-padded to two digits.
 */
const pad = (n) => String(n).padStart(2, '0');

/**
 * Starts a countdown.
 *
 * @param {HTMLElement} el The countdown (`data-target` is the end, epoch ms).
 * @returns {() => void} Stops it.
 */
export function countdown(el) {
	const target = Number(el.dataset.target);
	/**
	 * A unit's number.
	 *
	 * @param {string} unit `days`, `hours`, `minutes` or `seconds`.
	 * @returns {HTMLElement | null} Its element.
	 */
	const part = (unit) => el.querySelector(`[data-cd="${unit}"]`);
	const units = el.querySelector('.units');
	const still = el.querySelector('.still');
	const ended = el.querySelector('.ended');
	let handle = 0;

	/** Updates the numbers, or ends. */
	const tick = () => {
		const left = target - Date.now();
		if (!(left > 0)) {
			if (units instanceof HTMLElement) units.hidden = true;
			if (still instanceof HTMLElement) still.hidden = true;
			if (ended instanceof HTMLElement) ended.hidden = false;
			clearInterval(handle);
			return;
		}
		/**
		 * Writes one unit.
		 *
		 * @param {string} unit The unit.
		 * @param {number} value Its number.
		 */
		const set = (unit, value) => {
			const node = part(unit);
			if (node) node.textContent = pad(value);
		};
		set('days', Math.floor(left / 86400000));
		set('hours', Math.floor((left % 86400000) / 3600000));
		set('minutes', Math.floor((left % 3600000) / 60000));
		set('seconds', Math.floor((left % 60000) / 1000));
	};

	tick();
	if (!prefersReducedMotion()) handle = window.setInterval(tick, 1000);
	return () => clearInterval(handle);
}
