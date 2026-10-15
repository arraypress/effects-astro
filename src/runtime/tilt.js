/**
 * @module @arraypress/effects-astro/tilt
 *
 * Things that answer the pointer with depth, by CSS custom properties the
 * components' styles turn into transforms:
 *
 *   - `tilt`: an element leans towards the pointer while it is over it
 *     (`--tilt-x` / `--tilt-y`, degrees), and a glare (`--glare-x` /
 *     `--glare-y`, %) follows it; it settles back when the pointer leaves.
 *   - `parallax`: an element drifts with the pointer over a region
 *     (`--parallax-x` / `--parallax-y`, px), by its depth: negative
 *     depths move against it, so layers at different depths separate.
 *
 * Kept small on purpose: a few degrees and a few pixels read as depth,
 * more reads as motion sickness. Off with prefers-reduced-motion and
 * without a hovering pointer.
 *
 * From the WaveGrid (SampleGrid) hero's tilting disc and parallax blobs.
 */

import { canHover, prefersReducedMotion } from './device.js';

/**
 * @typedef {object} TiltConfig
 * @property {number} [max=8] The most it leans, degrees.
 * @property {string} [within] A selector for the region the pointer is followed over (default: the element).
 */

/**
 * @typedef {object} ParallaxConfig
 * @property {number} [depth=18] How far it drifts at the region's edge, CSS px; negative moves against the pointer.
 * @property {string} [within] A selector for the region (default: the nearest `[data-parallax-root]`, or the parent).
 */

/**
 * Where the pointer is over a box, from -1 to 1 each way.
 *
 * @param {PointerEvent} e The pointer.
 * @param {DOMRect} box The box.
 * @returns {{ x: number, y: number }} -1 at the left and top edges, 1 at the right and bottom.
 */
function across(e, box) {
	return { x: ((e.clientX - box.left) / box.width - 0.5) * 2, y: ((e.clientY - box.top) / box.height - 0.5) * 2 };
}

/**
 * Follows the pointer over a region: `move` with its place while it is
 * over, `leave` when it goes.
 *
 * @param {Element} region The region.
 * @param {(at: { x: number, y: number }) => void} move Given the pointer's place, -1 to 1.
 * @param {() => void} leave Called when the pointer leaves.
 * @returns {() => void} Stops following.
 */
function follow(region, move, leave) {
	/** @param {PointerEvent} e The move. */
	const onMove = (e) => move(across(e, region.getBoundingClientRect()));
	region.addEventListener('pointermove', /** @type {EventListener} */ (onMove), { passive: true });
	region.addEventListener('pointerleave', leave);
	return () => {
		region.removeEventListener('pointermove', /** @type {EventListener} */ (onMove));
		region.removeEventListener('pointerleave', leave);
	};
}

/**
 * Makes an element lean towards the pointer.
 *
 * @param {HTMLElement} el The element.
 * @param {TiltConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function tilt(el, config) {
	if (prefersReducedMotion() || !canHover()) return () => {};
	const max = config.max ?? 8;
	const region = (config.within && el.closest(config.within)) || el;
	return follow(
		region,
		({ x, y }) => {
			el.style.setProperty('--tilt-x', `${(-y * max).toFixed(2)}deg`);
			el.style.setProperty('--tilt-y', `${(x * max).toFixed(2)}deg`);
			el.style.setProperty('--glare-x', `${((x + 1) * 50).toFixed(1)}%`);
			el.style.setProperty('--glare-y', `${((y + 1) * 50).toFixed(1)}%`);
			el.classList.add('is-tilting');
		},
		() => {
			el.style.setProperty('--tilt-x', '0deg');
			el.style.setProperty('--tilt-y', '0deg');
			el.classList.remove('is-tilting');
		},
	);
}

/**
 * Makes an element drift with the pointer over its region.
 *
 * @param {HTMLElement} el The element.
 * @param {ParallaxConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function parallax(el, config) {
	if (prefersReducedMotion() || !canHover()) return () => {};
	const depth = config.depth ?? 18;
	const region = (config.within && el.closest(config.within)) || el.closest('[data-parallax-root]') || el.parentElement || el;
	return follow(
		region,
		({ x, y }) => {
			el.style.setProperty('--parallax-x', `${(x * depth).toFixed(1)}px`);
			el.style.setProperty('--parallax-y', `${(y * depth).toFixed(1)}px`);
		},
		() => {
			el.style.setProperty('--parallax-x', '0px');
			el.style.setProperty('--parallax-y', '0px');
		},
	);
}
