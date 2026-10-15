import type { PaletteName } from './palettes.js';

export interface RadiantGlassConfig {
	/** The lights' colours, the last the hot colour where they gather. Default amber, blue, white. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. Its colours light the glass; its glint is the hot colour. */
	palette?: PaletteName | (string & {});
	/** The ground. Default `#060818`. */
	background?: string;
	/** The tiles: four in a plus, three on a slant, or one large. Default `cross`. */
	layout?: 'cross' | 'diagonal' | 'single';
	/** Each tile's shape: a rounded square on its corner, square on, or round. Default `diamond`. */
	shape?: 'diamond' | 'square' | 'circle';
	/** Which side the cluster sits on, leaving the other for the copy. Default `left`. */
	side?: 'left' | 'right';
	/** The cluster's size; 1 fills the height. Default 1. */
	size?: number;
	/** How blurred the light through the glass is; 0 for clear. Default 1. */
	frost?: number;
	/** How strong the halo round each tile is; 0 for none. Default 1. */
	glow?: number;
	/** How bright the rim line is; 0 for none. Default 1. */
	rim?: number;
	/** How fast the lights drift. Default 1. */
	speed?: number;
}

/** Starts radiant glass in `el`'s canvas. Returns a function that stops it. */
export function radiantGlass(el: HTMLElement, config: RadiantGlassConfig): () => void;
