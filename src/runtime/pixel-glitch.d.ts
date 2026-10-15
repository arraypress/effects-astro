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
	/** With a width (CSS px), the text at rest is an outline that the pixels fill. Default 0 (solid). */
	stroke?: number;
}

/** Starts the pixel glitch on an element of text. Returns a function that stops it. */
export function pixelGlitch(el: HTMLElement, config: PixelGlitchConfig): () => void;
