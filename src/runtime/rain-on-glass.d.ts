import type { PaletteName } from './palettes.js';

export interface RainOnGlassConfig {
	/** The photo behind the glass (same origin, or served with CORS). */
	src: string;
	/** How much rain, 0–1: beads on the glass and drops running down it. Default 0.6. */
	rain?: number;
	/** How soft the photo is behind the glass, 0–1. Default 0.6. */
	blur?: number;
	/** How thick the condensation is, 0–1. Default 0.5. */
	fog?: number;
	/** How fast the drops run and the beads come and go, 0–3. Default 1. */
	speed?: number;
	/** The pointer wipes a clear patch that fogs back over. Default true. */
	interactive?: boolean;
	/** The colour of the fog. Default `#a3b8cc`. */
	tint?: string;
	/** How strongly the photo's lights open into bokeh discs, 0–1. Default 0.6. */
	bokeh?: number;
	/** Colours for the bokeh discs. Default: each light's own colour. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
}

/** Starts rain on glass in `el`'s canvas. Returns a function that stops it. */
export function rainOnGlass(el: HTMLElement, config: RainOnGlassConfig): () => void;
