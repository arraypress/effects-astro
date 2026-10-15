/**
 * @module @arraypress/effects-astro/carousel
 *
 * A horizontal strip that scrolls natively (touch, trackpad, keyboard,
 * snap points) and, with a mouse, by dragging: it follows the hand, then
 * glides on with the throw and settles on a snap point. A click that ends
 * a drag is swallowed, so dragging across a card does not open it. The
 * strip carries `data-start` / `data-end` while it can scroll back or on,
 * for the edge fades, and its `[data-carousel-prev]` / `[data-carousel-next]`
 * buttons are disabled at the ends.
 *
 * From the Pure Papers site.
 */

import { prefersReducedMotion } from './device.js';

/** CSS px a mouse must move before a press becomes a drag. */
const DRAG_FROM = 6;

/**
 * Makes a carousel of an element holding a `[data-carousel-track]`.
 *
 * @param {HTMLElement} el The carousel.
 * @returns {() => void} Stops it.
 */
export function carousel(el) {
	const track = /** @type {HTMLElement | null} */ (el.querySelector('[data-carousel-track]'));
	if (!track) return () => {};
	const prev = /** @type {HTMLButtonElement | null} */ (el.querySelector('[data-carousel-prev]'));
	const next = /** @type {HTMLButtonElement | null} */ (el.querySelector('[data-carousel-next]'));
	const behavior = prefersReducedMotion() ? 'auto' : 'smooth';

	/** @type {{ id: number, x: number, left: number, last: number, at: number, speed: number, dragging: boolean } | null} */
	let press = null;
	let swallow = false;

	/** Marks the ends: whether there is more to scroll back to and on to. */
	const edges = () => {
		const end = track.scrollWidth - track.clientWidth;
		const start = track.scrollLeft > 1;
		const more = track.scrollLeft < end - 1;
		el.toggleAttribute('data-start', start);
		el.toggleAttribute('data-end', more);
		if (prev) prev.disabled = !start;
		if (next) next.disabled = !more;
	};

	/**
	 * Scrolls by most of a screenful, back (-1) or on (1).
	 *
	 * @param {number} way The direction.
	 */
	const page = (way) => track.scrollBy({ left: way * track.clientWidth * 0.8, behavior });

	/**
	 * Notes a mouse press; touch and pens scroll natively.
	 *
	 * @param {PointerEvent} e The press.
	 */
	const down = (e) => {
		if (e.pointerType !== 'mouse' || e.button !== 0) return;
		press = { id: e.pointerId, x: e.clientX, left: track.scrollLeft, last: e.clientX, at: e.timeStamp, speed: 0, dragging: false };
	};

	/**
	 * Drags the strip with the mouse once it has moved far enough.
	 *
	 * @param {PointerEvent} e The move.
	 */
	const move = (e) => {
		if (!press || e.pointerId !== press.id) return;
		if (!press.dragging) {
			if (Math.abs(e.clientX - press.x) < DRAG_FROM) return;
			press.dragging = true;
			track.setPointerCapture(e.pointerId);
			el.toggleAttribute('data-dragging', true);
		}
		const dt = Math.max(1, e.timeStamp - press.at);
		press.speed = press.speed * 0.6 + ((e.clientX - press.last) / dt) * 0.4;
		press.last = e.clientX;
		press.at = e.timeStamp;
		track.scrollLeft = press.left - (e.clientX - press.x);
	};

	/**
	 * Lets go: throws the strip on by the drag's speed, and snapping takes over.
	 *
	 * @param {PointerEvent} e The release.
	 */
	const up = (e) => {
		if (!press || e.pointerId !== press.id) return;
		const { dragging, speed } = press;
		press = null;
		if (!dragging) return;
		swallow = true;
		el.removeAttribute('data-dragging');
		track.scrollBy({ left: -speed * 180, behavior });
	};

	/**
	 * Swallows the click that ends a drag.
	 *
	 * @param {MouseEvent} e The click.
	 */
	const click = (e) => {
		if (!swallow) return;
		swallow = false;
		e.preventDefault();
		e.stopPropagation();
	};

	/**
	 * Stops links and images inside being dragged out as files.
	 *
	 * @param {DragEvent} e The drag.
	 */
	const nativeDrag = (e) => e.preventDefault();
	/** Scrolls back a page. */
	const back = () => page(-1);
	/** Scrolls on a page. */
	const on = () => page(1);

	const resize = new ResizeObserver(edges);
	resize.observe(track);
	track.addEventListener('scroll', edges, { passive: true });
	track.addEventListener('pointerdown', down);
	track.addEventListener('pointermove', move);
	track.addEventListener('pointerup', up);
	track.addEventListener('pointercancel', up);
	track.addEventListener('click', click, true);
	track.addEventListener('dragstart', nativeDrag);
	prev?.addEventListener('click', back);
	next?.addEventListener('click', on);
	edges();
	return () => {
		resize.disconnect();
		track.removeEventListener('scroll', edges);
		track.removeEventListener('pointerdown', down);
		track.removeEventListener('pointermove', move);
		track.removeEventListener('pointerup', up);
		track.removeEventListener('pointercancel', up);
		track.removeEventListener('click', click, true);
		track.removeEventListener('dragstart', nativeDrag);
		prev?.removeEventListener('click', back);
		next?.removeEventListener('click', on);
	};
}
