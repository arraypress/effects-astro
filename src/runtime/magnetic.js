/**
 * @module @arraypress/effects-astro/magnetic
 *
 * Elements the pointer pulls on: as the pointer comes near, the element
 * leans a little towards it (`--magnet-x` / `--magnet-y`, px), and its
 * contents a little further (`--magnet-inner-x` / `--magnet-inner-y`), so
 * a button reads as a soft object; it springs back when the pointer
 * leaves. Off with prefers-reduced-motion and without a hovering pointer.
 */

import { canHover, prefersReducedMotion } from './device.js';

/**
 * @typedef {object} MagneticConfig
 * @property {number} [strength=0.3] How far it follows the pointer, as a share of the pointer's distance from its centre.
 * @property {number} [reach=40] How far outside the element the pull starts, CSS px.
 */

/**
 * Makes an element magnetic.
 *
 * @param {HTMLElement} el The element.
 * @param {MagneticConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function magnetic(el, config) {
	if (prefersReducedMotion() || !canHover()) return () => {};
	const strength = config.strength ?? 0.3;
	const reach = config.reach ?? 40;

	/** @param {PointerEvent} e The pointer's move anywhere on the page. */
	const move = (e) => {
		const box = el.getBoundingClientRect();
		const near =
			e.clientX > box.left - reach && e.clientX < box.right + reach && e.clientY > box.top - reach && e.clientY < box.bottom + reach;
		const dx = near ? (e.clientX - (box.left + box.width / 2)) * strength : 0;
		const dy = near ? (e.clientY - (box.top + box.height / 2)) * strength : 0;
		el.style.setProperty('--magnet-x', `${dx.toFixed(1)}px`);
		el.style.setProperty('--magnet-y', `${dy.toFixed(1)}px`);
		el.style.setProperty('--magnet-inner-x', `${(dx * 0.5).toFixed(1)}px`);
		el.style.setProperty('--magnet-inner-y', `${(dy * 0.5).toFixed(1)}px`);
		el.classList.toggle('is-pulled', near);
	};
	document.addEventListener('pointermove', move, { passive: true });
	return () => document.removeEventListener('pointermove', move);
}
