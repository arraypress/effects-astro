export interface TiltConfig {
	/** The most it leans, degrees. Default 8. */
	max?: number;
	/** A selector for the region the pointer is followed over. Default the element. */
	within?: string;
}

export interface ParallaxConfig {
	/** How far it drifts at the region's edge, CSS px; negative moves against the pointer. Default 18. */
	depth?: number;
	/** A selector for the region. Default the nearest `[data-parallax-root]`, or the parent. */
	within?: string;
}

/** Makes `el` lean towards the pointer (`--tilt-x`, `--tilt-y`, `--glare-x`, `--glare-y`). Returns a function that stops it. */
export function tilt(el: HTMLElement, config: TiltConfig): () => void;

/** Makes `el` drift with the pointer over its region (`--parallax-x`, `--parallax-y`). Returns a function that stops it. */
export function parallax(el: HTMLElement, config: ParallaxConfig): () => void;
