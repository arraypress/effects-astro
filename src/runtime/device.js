/**
 * @module @arraypress/effects-astro/device
 *
 * What the visitor's device can afford and what they have asked for: the
 * one place every effect reads it from, so the trade-offs are made the
 * same way everywhere.
 *
 * Fragment cost grows with the square of the pixel ratio, and phones
 * report 3 or more, so the ratio an effect draws at is capped: 2 on a
 * desktop, 1.5 on a phone or tablet. All of it is safe to call during
 * server rendering, where it answers as a desktop with motion allowed.
 */

/**
 * The longest side, in CSS px, of a touch screen still treated as a phone or
 * tablet. Larger touch screens (2-in-1s, tablets driving a display) get the
 * desktop budget.
 */
const MOBILE_LONG_SIDE = 1366;

/**
 * Does a media query match? False outside a browser.
 *
 * @param {string} query The media query.
 * @returns {boolean} Whether it matches.
 */
function matches(query) {
	return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

/**
 * Is this a phone or tablet: a coarse pointer on a screen no longer than
 * MOBILE_LONG_SIDE? Its GPU gets the lighter budget.
 *
 * @returns {boolean} True on a phone or tablet.
 */
export function isMobileGpu() {
	if (typeof window === 'undefined' || !matches('(pointer: coarse)')) return false;
	const longSide = Math.max(window.innerWidth || 0, window.innerHeight || 0);
	return longSide > 0 && longSide <= MOBILE_LONG_SIDE;
}

/**
 * The pixel ratio to draw at: the device's own, capped at 2 on a desktop and
 * 1.5 on a phone or tablet.
 *
 * @param {number} [scale=1] A further share of it, for effects soft enough to
 *   draw at less (0.5 draws at half and lets the browser scale up).
 * @returns {number} The ratio.
 */
export function pixelRatio(scale = 1) {
	const native = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
	return Math.min(native, isMobileGpu() ? 1.5 : 2) * scale;
}

/**
 * Has the visitor asked for less motion?
 *
 * @returns {boolean} True with prefers-reduced-motion: reduce.
 */
export function prefersReducedMotion() {
	return matches('(prefers-reduced-motion: reduce)');
}

/**
 * Does the device have a pointer that hovers (a mouse or trackpad)? Effects
 * that follow the pointer without a press only make sense with one.
 *
 * @returns {boolean} True with a fine, hovering pointer.
 */
export function canHover() {
	return matches('(hover: hover) and (pointer: fine)');
}
