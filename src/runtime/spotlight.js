/**
 * @module @arraypress/effects-astro/spotlight
 *
 * Text as a hollow outline that a soft light under the pointer fills in.
 * The fill is the element's own `::before` and `::after`: the word again,
 * solid, masked to a radial gradient at `--spot-x` / `--spot-y`,
 * `--spot-r` wide. This only moves those; the look is CSS
 * (SpotlightText.astro).
 *
 * The light trails the pointer a little, swells in as it arrives over the
 * text and shrinks away when it leaves. The pointer is read from the
 * document, so the text can keep `pointer-events: none` (a big wordmark's
 * line box often overlaps links). Animates only while the light is moving.
 * Without a hovering pointer the text stays an outline; with
 * prefers-reduced-motion the light follows without easing.
 */

import { canHover, prefersReducedMotion } from './device.js';

/**
 * @typedef {object} SpotlightConfig
 * @property {number} [radius=0.85] The light's radius, a share of the font size.
 * @property {number} [reach=40] How far outside the text (CSS px) the pointer still lights it.
 */

/**
 * Starts the spotlight on an element.
 *
 * @param {HTMLElement} el The text.
 * @param {SpotlightConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function spotlight(el, config) {
	// The pseudo-elements copy the text from here.
	el.dataset.text = el.textContent?.trim() ?? '';
	if (!canHover()) return () => {};
	const radius = config.radius ?? 0.85;
	const reach = config.reach ?? 40;
	const ease = prefersReducedMotion() ? 1 : 0.2;
	const spot = { x: 0, y: 0, r: 0, tx: 0, ty: 0, tr: 0 };
	let raf = 0;

	/** Writes the light's position and size to the element. */
	const apply = () => {
		el.style.setProperty('--spot-x', `${spot.x.toFixed(1)}px`);
		el.style.setProperty('--spot-y', `${spot.y.toFixed(1)}px`);
		el.style.setProperty('--spot-r', `${spot.r.toFixed(1)}px`);
	};

	/** One frame: close part of the gap to the target; carry on until there. */
	const tick = () => {
		spot.x += (spot.tx - spot.x) * ease;
		spot.y += (spot.ty - spot.y) * ease;
		spot.r += (spot.tr - spot.r) * ease * 0.6;
		const settled = Math.abs(spot.tx - spot.x) < 0.5 && Math.abs(spot.ty - spot.y) < 0.5 && Math.abs(spot.tr - spot.r) < 0.5;
		if (settled) Object.assign(spot, { x: spot.tx, y: spot.ty, r: spot.tr });
		apply();
		raf = settled ? 0 : requestAnimationFrame(tick);
	};

	/**
	 * Heads the light for the pointer while it is over the text (or near),
	 * and shrinks it away where it is when it leaves.
	 *
	 * @param {number | null} cx Pointer x in the viewport, or null when it has left the window.
	 * @param {number} [cy] Pointer y in the viewport.
	 */
	const follow = (cx, cy = 0) => {
		const box = el.getBoundingClientRect();
		const over = cx !== null && cx > box.left - reach && cx < box.right + reach && cy > box.top - reach && cy < box.bottom + reach;
		if (over) {
			const x = cx - box.left;
			const y = cy - box.top;
			// Arriving: start the light where the pointer is, not where it went out.
			if (spot.r < 1) Object.assign(spot, { x, y });
			Object.assign(spot, { tx: x, ty: y, tr: parseFloat(getComputedStyle(el).fontSize) * radius });
		} else if (spot.tr) {
			spot.tr = 0;
		} else {
			return;
		}
		raf ||= requestAnimationFrame(tick);
	};

	/** @param {PointerEvent} e The move. */
	const move = (e) => follow(e.clientX, e.clientY);
	/** The pointer has left the window. */
	const leave = () => follow(null);
	document.addEventListener('pointermove', move, { passive: true });
	document.documentElement.addEventListener('pointerleave', leave);

	return () => {
		cancelAnimationFrame(raf);
		document.removeEventListener('pointermove', move);
		document.documentElement.removeEventListener('pointerleave', leave);
	};
}
