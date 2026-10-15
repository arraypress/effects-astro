/** A box in CSS px from the element's top left. */
export interface TrackerBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * Makes `count` tracker boxes (`kind` 'box', bracketed, or 'marker', a
 * crosshair) in an effect's element. `place(i, box, label?)` eases box `i`
 * towards `box` (null fades it out); `destroy` removes them.
 */
export function createTrackers(
	el: HTMLElement,
	count: number,
	options?: { kind?: 'box' | 'marker' },
): {
	place(i: number, box: TrackerBox | null, label?: string): void;
	destroy(): void;
};
