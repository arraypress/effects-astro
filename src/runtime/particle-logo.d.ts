export interface ParticleLogoConfig {
	/** A word (or a character, an emoji) to draw in particles. */
	text?: string;
	/** Its CSS font, without the size. Default: the page's, bold. */
	font?: string;
	/** An image (an SVG logo, a PNG) to draw in particles instead. */
	src?: string;
	/** Where the shape sits, each 0–1 from the top left. Default the middle. */
	area?: { x: number; y: number; width: number; height: number };
	/** The dots' two colours, then the two blooms'. Default white, ice blue, deep teal, midnight blue. */
	colors?: string[];
	/** The ground. Default `#030305`. */
	background?: string;
	/** How many particles (half on phones). Default 16000. */
	count?: number;
	/** A particle's size, CSS px. Default 2.2. */
	size?: number;
	/** How strongly they scatter round the pointer; 0 for not at all. Default 1. */
	swarm?: number;
	/** How far the mark tilts towards the pointer. Default 1. */
	tilt?: number;
	/** How far red and blue part, CSS px; 0 for none. Default 1.5. */
	aberration?: number;
}

/** Starts a particle logo in `el`'s canvas. Returns a function that stops it. */
export function particleLogo(el: HTMLElement, config: ParticleLogoConfig): () => void;
