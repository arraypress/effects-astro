import type { PaletteName } from './palettes.js';

/** Which side the colour fills from. */
export type HorizonSide = 'bottom' | 'left' | 'top' | 'right';

export interface PixelHorizonConfig {
	/** Two CSS hex colours: the solid fill and the edge colour the blocks fade to at the frontier (one colour for both). Default an acid green. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`: its last and first colours. */
	palette?: PaletteName | (string & {});
	/** A CSS hex colour to fill behind the blocks; none leaves the canvas clear there. */
	background?: string;
	/** Which side the colour fills from. Default 'bottom'. */
	side?: HorizonSide;
	/** A block's side, in CSS px (rounded to whole screen pixels). Default 14. */
	block?: number;
	/** Where the frontier's middle sits, a share of the way from the side across. Default 0.3. */
	level?: number;
	/** How deep the broken band is, a share of the way across. Default 0.3. */
	spread?: number;
	/** How far the frontier swings, a share of the way across. Default 0.06. */
	sway?: number;
	/** How far the frontier wanders along its length, a share of the way across. Default 0.08. */
	wander?: number;
	/** How often a block in the band rolls again, times a second. Default 0.6. */
	rate?: number;
	/** Which random blocks, so two cards differ. Default 0. */
	seed?: number;
	/** Plays every clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** An area kept empty: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The sides, in the order the shader numbers them. */
export declare const HORIZON_SIDES: readonly ['bottom', 'left', 'top', 'right'];

/** The settings' defaults, shared by the shader and `horizonBlocks`. */
export declare const HORIZON_DEFAULTS: {
	side: HorizonSide;
	block: number;
	level: number;
	spread: number;
	sway: number;
	wander: number;
	rate: number;
	seed: number;
};

/** One frame block for block on a target exactly `cols` by `rows` blocks: each block's chance and whether it shows. */
export declare function horizonBlocks(config: PixelHorizonConfig, cols: number, rows: number, time?: number): { chance: number; lit: boolean }[][];

/** The two colours as the shader takes them: the fill and the edge's. */
export declare function horizonColors(config: PixelHorizonConfig): [string, string];

/** A CSS `background` that stands in for the horizon before the shader starts and without WebGL. */
export declare function horizonStill(config: PixelHorizonConfig): string;

/** Starts the horizon on an element (its first canvas, one pixel a block). Returns a function that stops it. */
export declare function pixelHorizon(el: HTMLElement, config: PixelHorizonConfig): () => void;
