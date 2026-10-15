export interface NebulaLogoConfig {
	/** A word (or a character) to fill with gas. */
	text?: string;
	/** Its CSS font, without the size. Default: the page's, bold. */
	font?: string;
	/** An image (an SVG logo, a PNG) to fill instead. */
	src?: string;
	/** Where the shape sits, each 0–1 from the top left. Default the right half. */
	area?: { x: number; y: number; width: number; height: number };
	/** The gas's palette, three colours; the first, darkened, is also the thin gas's. Default teal, amber, rose. */
	colors?: string[];
	/** The ground. Default `#05070a`. */
	background?: string;
	/** How fast the gas drifts. Default 1. */
	speed?: number;
	/** The rim and the halo leaking past the edge; 0 for neither. Default 1. */
	glow?: number;
	/** How many stars twinkle inside; 0 for none. Default 1. */
	stars?: number;
	/** How much the pointer stirs and brightens the gas; 0 for not at all. Default 1. */
	stir?: number;
}

/** Starts a nebula logo in `el`'s canvas. Returns a function that stops it. */
export function nebulaLogo(el: HTMLElement, config: NebulaLogoConfig): () => void;
