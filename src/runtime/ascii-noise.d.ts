import type { PaletteName } from './palettes.js';

export interface AsciiNoiseConfig {
	/** Two CSS hex colours: the quietest cells' and the loudest's. Default a dim grey and white. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`: its first and last colours. */
	palette?: PaletteName | (string & {});
	/** A CSS hex colour to fill behind the type; none leaves the canvas clear there. */
	background?: string;
	/** A ramp (`ascii`, `shade`, `digits`, `rise`, `quads`, `bars`, `arrows`, `letters`, `dense`, or a set of `GLYPH_SETS`) or the characters, quietest first. Default `ascii`. */
	glyphs?: keyof typeof NOISE_RAMPS | (string & {});
	/** A character cell's height in CSS px. Default 14. */
	cell?: number;
	/** Cells across instead, whatever the width (overrides `cell`). */
	cols?: number;
	/** A cell's width over its height. Default 0.6. */
	aspect?: number;
	/** How many noise features span the width (higher is busier). Default 2.45. */
	scale?: number;
	/** How hard the edges are: higher pushes cells to empty or full. Default 6. */
	contrast?: number;
	/** Shifts the whole field; lower leaves more cells empty. Default -0.1. */
	brightness?: number;
	/** How fast the sample window pans, widths a second, x and y. Default [0.036, 0.012]. */
	drift?: [number, number];
	/** How fast the shapes morph. Default 0.24. */
	evolve?: number;
	/** Where the sample window starts, so two cards differ. Default [0, 0]. */
	offset?: [number, number];
	/** Plays every clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** An area kept quiet: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
	/** The font family the glyphs are drawn in (a monospace stack by default); it is loaded first. */
	font?: string;
}

/** The ramps, each quietest first. A ramp starting with a space leaves quiet cells empty. */
export declare const NOISE_RAMPS: {
	readonly ascii: string;
	readonly shade: string;
	readonly digits: string;
	readonly rise: string;
	readonly quads: string;
	readonly bars: string;
	readonly arrows: string;
	readonly letters: string;
	readonly dense: string;
};

/** The settings' defaults, shared by the shader and `asciiCells`. */
export declare const NOISE_DEFAULTS: {
	glyphs: string;
	scale: number;
	contrast: number;
	brightness: number;
	drift: [number, number];
	evolve: number;
	aspect: number;
};

/** A ramp's characters, quietest first (at least two). */
export declare function rampOf(glyphs?: string): string[];

/** The field: five octaves of gradient noise, each warped by the sum so far; 0–1. */
export declare function noiseField(x: number, y: number, evo: number, wt: number): number;

/** One frame as ramp indices: what the shader draws, cell for cell, on a target exactly `cols` by `rows` cells. */
export declare function asciiCells(config: AsciiNoiseConfig, cols: number, rows: number, time?: number): number[][];

/** The two colours as the shader takes them: the quietest cells' and the loudest's. */
export declare function noiseColors(config: AsciiNoiseConfig): [string, string];

/** Starts the noise on an element (its first canvas is drawn into). Returns a function that stops it. */
export declare function asciiNoise(el: HTMLElement, config: AsciiNoiseConfig): () => void;
