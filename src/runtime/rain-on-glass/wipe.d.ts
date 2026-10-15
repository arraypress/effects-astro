/** A coarse grid of where the pointer has wiped the fog off the glass. */
export interface Wipe {
	/** Cells across. */
	width: number;
	/** Cells up. */
	height: number;
	/** Wipes a soft spot at x, y (0–1, y up); `radius` a share of the height. */
	stamp(x: number, y: number, radius: number): void;
	/** Lets the fog return for `dt` seconds; true when `bytes` changed (upload them), false while the glass stays all fogged. */
	settle(dt: number): boolean;
	/** Clearness per cell, 0–255, bottom row first: for a LUMINANCE texture. */
	bytes: Uint8Array;
}

/** Makes a wipe grid of `width` × `height` cells, all fogged. */
export function createWipe(width: number, height: number): Wipe;
