import type { PaletteName } from './palettes.js';

export interface InkConfig {
	/** The ink's colours, as CSS hex, looped through as it is laid. Default the palette's, or Peacock's. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** How much ink a stroke leaves, 0 for none (strokes still push). Default 0.35. */
	trail?: number;
	/** Whether a click or tap drops a bloom of ink. Default true. */
	drops?: boolean;
	/** How hard the pointer pushes. Default 1. */
	force?: number;
	/** Swirl kept alive between strokes. Default 28. */
	curl?: number;
	/** How fast the ink fades, per second. Default 0.55. */
	fade?: number;
	/** How much the ink spreads and softens as it moves, 0–1. Default 0.35. */
	diffusion?: number;
	/** The size of a stroke's splats and of a drop, 1 as standard. */
	radius?: number;
	/** How fast the motion dies away, per second (lower flows on longer). Default 0.25. */
	momentum?: number;
	/** The ink's strongest cover, 0–1. Default 1. */
	opacity?: number;
	/** Seconds between drops of ink on their own, so it moves before anyone touches it; 0 for none. They wait while it's off screen or the tab is hidden. Default 0. */
	idle?: number;
	/** Ink for a light ground: the colours given are laid dark on light (dark dye alone would barely show). Default false. */
	dark?: boolean;
	/** Run only while near the screen (true, or a CSS length; default `200px`), handled by `mount`. Default false. */
	lazy?: boolean | string;
	/** Clicks on these are theirs, not the ink's. Default: links, buttons, form fields and `[data-effect-ignore]`. */
	ignore?: string;
}

/** Starts ink in `el`'s canvas (transparent where there is none). Returns a function that stops it. */
export function ink(el: HTMLElement, config: InkConfig): () => void;
