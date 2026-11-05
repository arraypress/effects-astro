export interface PixelGlitchConfig {
	/** The heat grid's cell, CSS px. Default 14. */
	cell?: number;
	/** How far the pointer's heat reaches, CSS px. Default 120. */
	reach?: number;
	/** Heat kept each frame (0.9 is gone in about half a second). Default 0.9. */
	decay?: number;
	/** The pixel block size at full heat, CSS px. Default 22. */
	block?: number;
	/** How far the hottest rows slip sideways, CSS px. Default 16. */
	shift?: number;
	/** With a width (CSS px), the text at rest is an outline that the pixels fill: one outline round the word, so overlapping letters merge. Default 0 (solid). */
	stroke?: number;
	/** What slips: `cell`, each hot cell on its own; `row`, a whole row at once, now and then, by its hottest cell (up to half of `shift` either way). Default `cell`. */
	tear?: 'cell' | 'row';
	/** A colour for a copy of the blocks, nudged 3px right behind them (an accent under the break). Default none. */
	ghost?: string;
}

/**
 * The outline of a shape from its RGBA coverage: each pixel's alpha less the
 * smallest within `radius` px of it, so the line runs inside the edge and
 * touching shapes share one outline. One alpha byte a pixel.
 */
export function outlineAlpha(rgba: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray;

/** How far each row of a heat grid tears this frame (whole CSS px): a row whose hottest cell is over 0.45 tears on about a third of frames, by up to half of `shift` either way, scaled by that heat. */
export function rowTears(heat: Float32Array, cols: number, rows: number, shift: number, random?: () => number): Float32Array;

/** Starts the pixel glitch on an element of text. Returns a function that stops it. */
export function pixelGlitch(el: HTMLElement, config: PixelGlitchConfig): () => void;
