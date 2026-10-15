export interface DotGridConfig {
	/** The dots' colour. Default `#ffffff`. */
	color?: string;
	/** Space between dots, CSS px. Default 26. */
	pitch?: number;
	/** A dot's size at rest, CSS px. Default 1.6. */
	dot?: number;
	/** Round dots rather than square. Default false. */
	round?: boolean;
	/** How strongly the noise current lights and nudges the dots; 0 for none. Default 1. */
	flow?: number;
	/** How fast a ripple travels, CSS px a second. Default 620. */
	speed?: number;
	/** Seconds before a ripple is spent. Default 2.6. */
	life?: number;
	/** How far a ripple displaces dots, CSS px. Default 9. */
	push?: number;
	/** The pointer's swell, CSS px; 0 for none. Default 210. */
	radius?: number;
	/** Drop one ripple from the middle soon after it first comes on screen. Default true. */
	greet?: boolean;
	/** Whether clicks drop ripples. Default true. */
	ripples?: boolean;
}

/** Starts the dot grid in `el`'s canvas. Returns a function that stops it. */
export function dotGrid(el: HTMLElement, config: DotGridConfig): () => void;
