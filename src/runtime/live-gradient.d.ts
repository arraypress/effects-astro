import type { PaperConfig } from './paper.js';

export interface LiveGradientOptions {
	/** How fast it morphs (Paper's speed; 1 is Paper's own). Default 0.16. */
	speed?: number;
	/** How far the colours bend into each other, 0–1. Default 0.7. */
	distortion?: number;
	/** How much they turn, 0–1. Default 0.3. */
	swirl?: number;
	/** Share of the pixel ratio drawn at. Default 0.5. */
	scale?: number;
}

/** The Paper settings (`config`, for `paperShader`) and a still CSS `background` (`fallback`) for a live gradient. Throws with fewer than two colours. */
export function liveGradient(colors: string[], options?: LiveGradientOptions): { config: PaperConfig; fallback: string };
