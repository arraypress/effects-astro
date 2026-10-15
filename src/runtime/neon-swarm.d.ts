import type { PaletteName } from './palettes.js';

export interface NeonSwarmConfig {
	/** A word (or a character) to gather the swarm into. */
	text?: string;
	/** Its CSS font, without the size. Default: the page's, bold. */
	font?: string;
	/** An image (an SVG logo, a PNG) to gather it into instead. */
	src?: string;
	/** Where the shape sits, each 0–1 from the top left. Default the right half. */
	area?: { x: number; y: number; width: number; height: number };
	/** The palette across the swarm, three colours. Default neon cyan, lime, magenta. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** The ground. Default `#030406`. */
	background?: string;
	/** How many particles (half on phones). Default 6000. */
	count?: number;
	/** A particle's glowing core, CSS px. Default 2.4. */
	size?: number;
	/** How long the trails are, 0 (none) to 0.95. Default 0.82. */
	trail?: number;
	/** How far the swarm drifts and breathes round the shape; 0 holds it still. Default 1. */
	flow?: number;
	/** How hard the pointer scatters them; 0 for not at all. Default 1. */
	scatter?: number;
}

/** Starts a neon swarm in `el`'s canvas. Returns a function that stops it. */
export function neonSwarm(el: HTMLElement, config: NeonSwarmConfig): () => void;
