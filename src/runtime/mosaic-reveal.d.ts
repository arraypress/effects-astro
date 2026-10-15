import type { PaletteName } from './palettes.js';

/** How one picture becomes the next. */
export type MosaicTransition = 'tiles' | 'pixel-sort' | 'pixelate' | 'dissolve';

export interface MosaicRevealConfig {
	/** How one picture becomes the next: tiles flipping in a diagonal wave, melting into sorted streaks, blocks coarsening and refining, or a noise dissolve with a glowing edge. Default `'tiles'`. */
	transition?: MosaicTransition;
	/** Seconds each picture stays, 2–12. Default 5. */
	interval?: number;
	/** Seconds a change takes, 0.4–3. Default 1.6. */
	duration?: number;
	/** Tiles across the longer side, 3–24; also the coarsest blocks for `pixelate`. Default 9. */
	tiles?: number;
	/** Move on by itself (held while hovered, focused or off screen). Default true. */
	autoplay?: boolean;
	/** The dissolve's glowing edge: its outer colour, then its core. Default amber, cream. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`: its first colour round its glint. */
	palette?: PaletteName | (string & {});
	/** What shows between the tiles as they flip. Default `#0c0b0a`. */
	background?: string;
	/** With prefers-reduced-motion: a short crossfade, or a swap at once. Default `'fade'`. */
	reducedMotion?: 'fade' | 'swap';
}

/** The tile grid for a box: `tiles` across its longer side, square tiles along the shorter, at least one. */
export function tileGrid(tiles: number, aspect: number): [number, number];

/** The dissolve's outer and core colours in Oklab, six channels for `uGlow`; one colour serves as both. */
export function glowUniform(colors: string[]): Float32Array;

/** Starts a mosaic slideshow on `el`'s `img[data-slide]` pictures. Returns a function that stops it. */
export function mosaicReveal(el: HTMLElement, config: MosaicRevealConfig): () => void;
