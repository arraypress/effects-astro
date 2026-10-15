/**
 * @module @arraypress/effects-astro/pointer
 *
 * The pointer as the effects read it: one listener for the page, and
 * positions given relative to an element, so an effect in a card and one
 * behind the whole page read the same pointer in their own terms.
 *
 * `trail` turns movement into a ribbon of points: a fast stroke moves the
 * pointer far between two frames, and an effect that only stamped where it
 * landed would leave dots. A jump (the pointer entering the window, or
 * coming back to the tab) is not a stroke, and lays nothing.
 */

/** What a click is not the effect's on: links, buttons, form fields, and anything marked `data-effect-ignore`. */
export const CLICK_IGNORE = 'a, button, input, select, textarea, label, [data-effect-ignore]';

/** Furthest a stroke may travel between two reads, as a share of the element's size, before it counts as a jump. */
const JUMP = 0.25;

/**
 * The pointer in the viewport, whether it is in the window, and counts of
 * its moves and of its exits (so a reader can tell it left between reads).
 */
const state = { x: 0, y: 0, inside: false, moved: 0, left: 0 };

if (typeof document !== 'undefined') {
	document.addEventListener(
		'pointermove',
		(e) => {
			state.x = e.clientX;
			state.y = e.clientY;
			state.inside = true;
			state.moved++;
		},
		{ passive: true },
	);
	document.documentElement.addEventListener('pointerleave', () => {
		state.inside = false;
		state.left++;
	});
}

/**
 * Where the pointer is over an element.
 *
 * @param {Element} el The element.
 * @returns {{ x: number, y: number, inside: boolean }} x 0 (left) to 1, y 0
 *   (bottom) to 1, as shaders count; `inside` false when the pointer has
 *   left the window or is outside the element.
 */
export function pointerIn(el) {
	const box = el.getBoundingClientRect();
	const x = (state.x - box.left) / (box.width || 1);
	const y = 1 - (state.y - box.top) / (box.height || 1);
	return { x, y, inside: state.inside && x >= 0 && x <= 1 && y >= 0 && y <= 1 };
}

/**
 * Follows the pointer's strokes over an element. Each `read` returns the
 * points along the path since the last read, spaced no further apart than
 * `step`, with the stroke's velocity.
 *
 * @param {Element} el The element.
 * @param {object} [options]
 * @param {number} [options.step=0.01] Spacing of the points, as a share of the element's height.
 * @param {number} [options.max=16] Most points laid in one read.
 * @returns {{ read: (dt: number) => Array<{ x: number, y: number, dx: number, dy: number }>, reset: () => void }}
 *   `read(dt)`: the points since the last read, with the stroke's velocity in
 *   element-widths/heights a second; `reset()`: forget the last position, so
 *   the next move starts a new stroke.
 */
export function trail(el, { step = 0.01, max = 16 } = {}) {
	/** @type {{ x: number, y: number } | null} */
	let last = null;
	let seen = state.moved;
	let exits = state.left;
	return {
		read(dt) {
			if (state.moved === seen) return [];
			seen = state.moved;
			const now = pointerIn(el);
			// Left the window since the last read: whatever came before was another stroke.
			if (exits !== state.left) {
				exits = state.left;
				last = null;
			}
			if (!state.inside) {
				last = null;
				return [];
			}
			const from = last;
			last = { x: now.x, y: now.y };
			if (!from) return [];
			const ddx = now.x - from.x;
			const ddy = now.y - from.y;
			const distance = Math.hypot(ddx, ddy);
			if (distance === 0 || distance > JUMP) return [];
			const time = dt || 1 / 60;
			const count = Math.min(max, Math.max(1, Math.ceil(distance / step)));
			const points = [];
			for (let i = 1; i <= count; i++) {
				points.push({ x: from.x + (ddx * i) / count, y: from.y + (ddy * i) / count, dx: ddx / time, dy: ddy / time });
			}
			return points;
		},
		reset() {
			last = null;
		},
	};
}

/**
 * Where a press landed on an element, unless it was on something whose
 * clicks are its own.
 *
 * @param {Element} el The element.
 * @param {PointerEvent} e The press.
 * @param {string} [ignore=CLICK_IGNORE] Presses on these are theirs.
 * @returns {{ x: number, y: number } | null} x 0 (left) to 1, y 0 (bottom)
 *   to 1; null outside the element or on an ignored target.
 */
export function pressAt(el, e, ignore = CLICK_IGNORE) {
	if (/** @type {Element | null} */ (e.target)?.closest?.(ignore)) return null;
	const box = el.getBoundingClientRect();
	const x = (e.clientX - box.left) / (box.width || 1);
	const y = 1 - (e.clientY - box.top) / (box.height || 1);
	return x < 0 || x > 1 || y < 0 || y > 1 ? null : { x, y };
}
