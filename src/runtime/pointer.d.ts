/** A point on a stroke: where (0–1 across, 0–1 up the element) and the stroke's velocity (element sizes a second). */
export interface StrokePoint {
	x: number;
	y: number;
	dx: number;
	dy: number;
}

/** Where the pointer is over `el`: x 0–1 left to right, y 0–1 bottom to top; `inside` false outside it or the window. */
export function pointerIn(el: Element): { x: number; y: number; inside: boolean };

/**
 * Follows the pointer's strokes over `el`. `read(dt)` returns the points
 * along the path since the last read, spaced at most `step` apart (default
 * 0.01), at most `max` of them (default 16); a jump returns none.
 * `reset()` makes the next move start a new stroke.
 */
export function trail(el: Element, options?: { step?: number; max?: number }): {
	read(dt: number): StrokePoint[];
	reset(): void;
};

/** Links, buttons, form fields and `[data-effect-ignore]`: presses on these are not an effect's. */
export const CLICK_IGNORE: string;

/** Where a press landed on `el` (x 0–1 left to right, y 0–1 bottom to top), or null outside it or on an ignored target. */
export function pressAt(el: Element, e: PointerEvent, ignore?: string): { x: number; y: number } | null;
