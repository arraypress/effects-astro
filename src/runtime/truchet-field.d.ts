import type { PaletteName } from './palettes.js';

export interface TruchetFieldConfig {
	/** Two CSS hex colours: the lines' dim one and their bright one. Default a grey and white. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`: its first and last colours. */
	palette?: PaletteName | (string & {});
	/** A CSS hex colour to fill behind the lines; none leaves the canvas clear there. */
	background?: string;
	/** A tile's side, in CSS px. Default 26. */
	tile?: number;
	/** The lines' width at their brightest, a share of the tile. Default 0.26. */
	width?: number;
	/** How thin the lines get where the noise is low, a share of `width`. Default 0.45. */
	thin?: number;
	/** Shade each line across its width, like a rounded tube. Default true. */
	tube?: boolean;
	/** Seconds between one tile's turns, on average. Default 8. */
	period?: number;
	/** How long a turn takes, seconds. Default 0.6. */
	turn?: number;
	/** The brightness noise's features across the width. Default 1.4. */
	scale?: number;
	/** How fast the bright patches pan, features a second. Default [0.03, 0.015]. */
	drift?: [number, number];
	/** Which random tiling, so two cards differ. Default 0. */
	seed?: number;
	/** Plays every clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** An area kept empty: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The settings' defaults, shared by the shader and the JS twin. */
export declare const TRUCHET_DEFAULTS: {
	tile: number;
	width: number;
	thin: number;
	tube: boolean;
	period: number;
	turn: number;
	scale: number;
	drift: [number, number];
	seed: number;
};

/** A tile's way (which corners its arcs hug) and how far through a quarter turn to it, 0 when still. */
export declare function truchetTile(config: TruchetFieldConfig, col: number, row: number, time?: number): { way: 0 | 1; turning: number };

/** How bright a tile's lines are, 0–1, before the quiet area (its centre in widths from the top left). */
export declare function truchetTone(config: TruchetFieldConfig, x: number, y: number, time?: number): number;

/** The two colours as the shader takes them: the dim one and the bright one. */
export declare function truchetColors(config: TruchetFieldConfig): [string, string];

/** A CSS `background` that stands in for the field before the shader starts and without WebGL. */
export declare function truchetStill(config: TruchetFieldConfig): string;

/** Starts the field on an element (its first canvas). Returns a function that stops it. */
export declare function truchetField(el: HTMLElement, config: TruchetFieldConfig): () => void;
