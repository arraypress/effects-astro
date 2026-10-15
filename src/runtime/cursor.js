/**
 * @module @arraypress/effects-astro/cursor
 *
 * A custom cursor: a small dot exactly at the pointer and a ring that
 * trails it, easing behind. Over links and buttons (and anything with
 * `data-cursor`) the ring swells, and it shows that element's
 * `data-cursor` text as a label ("View", "Play"). The system cursor stays
 * (hiding it costs people their bearings); the dot and ring add to it.
 * Only with a hovering pointer, and still (no trailing) with reduced
 * motion.
 */

import { canHover, prefersReducedMotion } from './device.js';

/**
 * @typedef {object} CursorConfig
 * @property {number} [ease=0.18] How quickly the ring catches up, 0–1 (1 is no trail).
 * @property {string} [targets='a, button, [data-cursor]'] What makes the ring swell.
 */

/**
 * Starts the cursor.
 *
 * @param {HTMLElement} el The cursor's element (holds `.dot`, `.ring` and `.label`).
 * @param {CursorConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function cursor(el, config) {
	if (!canHover()) {
		el.remove();
		return () => {};
	}
	const ease = prefersReducedMotion() ? 1 : config.ease ?? 0.18;
	const targets = config.targets ?? 'a, button, [data-cursor]';
	const dot = el.querySelector('.dot');
	const ring = el.querySelector('.ring');
	const label = el.querySelector('.label');
	if (!(dot instanceof HTMLElement) || !(ring instanceof HTMLElement)) return () => {};
	const at = { x: -100, y: -100 };
	const trail = { x: -100, y: -100 };
	let raf = 0;

	/** Moves the ring a step closer to the pointer; carries on until it is there. */
	const tick = () => {
		trail.x += (at.x - trail.x) * ease;
		trail.y += (at.y - trail.y) * ease;
		ring.style.translate = `${trail.x}px ${trail.y}px`;
		raf = Math.abs(at.x - trail.x) + Math.abs(at.y - trail.y) > 0.3 ? requestAnimationFrame(tick) : 0;
	};

	/** @param {PointerEvent} e The pointer's move. */
	const move = (e) => {
		at.x = e.clientX;
		at.y = e.clientY;
		dot.style.translate = `${at.x}px ${at.y}px`;
		el.classList.add('is-active');
		const over = /** @type {Element | null} */ (e.target)?.closest?.(targets);
		el.classList.toggle('is-over', !!over);
		if (label) label.textContent = over instanceof HTMLElement ? over.dataset.cursor ?? '' : '';
		raf ||= requestAnimationFrame(tick);
	};
	/** The pointer left the window: hide. */
	const leave = () => el.classList.remove('is-active');
	/** Pressed: the ring tightens. */
	const down = () => el.classList.add('is-down');
	/** Let go. */
	const up = () => el.classList.remove('is-down');

	document.addEventListener('pointermove', move, { passive: true });
	document.documentElement.addEventListener('pointerleave', leave);
	document.addEventListener('pointerdown', down);
	document.addEventListener('pointerup', up);
	return () => {
		cancelAnimationFrame(raf);
		document.removeEventListener('pointermove', move);
		document.documentElement.removeEventListener('pointerleave', leave);
		document.removeEventListener('pointerdown', down);
		document.removeEventListener('pointerup', up);
	};
}
