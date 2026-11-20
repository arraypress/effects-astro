import type { PaletteName } from './palettes.js';

export interface DitherFieldConfig {
	/** Two CSS hex colours: the dim edge's and the bright core's. Default a grey and amber. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`: its first and last colours. */
	palette?: PaletteName | (string & {});
	/** A CSS hex colour to fill behind the dots; none leaves the canvas clear there. */
	background?: string;
	/** A dot's size in CSS px (rounded to whole screen pixels). Default 3. */
	dot?: number;
	/** How many noise features span the width (higher is busier). Default 1.1. */
	scale?: number;
	/** How hard the edges are: higher thins the dithered band. Default 6. */
	contrast?: number;
	/** Shifts the whole field; lower leaves more of it empty. Default -0.15. */
	brightness?: number;
	/** Colour bands across the field; 0 blends smoothly. Default 24. */
	steps?: number;
	/** How fast the field pans, noise features a second, x and y. Default [0.02, 0.007]. */
	drift?: [number, number];
	/** How fast the shapes morph. Default 0.35. */
	evolve?: number;
	/** How strongly the rings lift the field; 0 for none. Default 1. */
	ripple?: number;
	/** Rings across the width, roughly (higher is tighter). Default 3. */
	rings?: number;
	/** How fast the rings travel, widths a second. Default 0.08. */
	rippleSpeed?: number;
	/** Where the rings start, 0–1 from the top left. Default [0.04, 0.3]. */
	origin?: [number, number];
	/** Where the field and the rings start, so two cards differ. Default [0, 0]. */
	offset?: [number, number];
	/** Plays every clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** An area kept empty: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The settings' defaults, shared by the shader and `ditherDots`. */
export declare const DITHER_DEFAULTS: {
	dot: number;
	scale: number;
	contrast: number;
	brightness: number;
	steps: number;
	drift: [number, number];
	evolve: number;
	ripple: number;
	rings: number;
	rippleSpeed: number;
	origin: [number, number];
};

/** The 8×8 Bayer threshold at a dot, 0–63/64 (it repeats every 8 dots). */
export declare function bayer(x: number, y: number): number;

/** The smooth 1-D noise the rings are cut from, 0–1; one lattice step is one ring's spacing. */
export declare function ripplePulse(s: number): number;

/** How strong the ring is `d` widths from the origin at `time` seconds, 0–1 before `ripple` scales it. */
export declare function rippleAt(d: number, time: number, config?: DitherFieldConfig): number;

/** One frame dot for dot, as the shader draws it on a target exactly `cols` by `rows` dots: −1 empty, or a tone 0 (edge) to 1 (core). */
export declare function ditherDots(config: DitherFieldConfig, cols: number, rows: number, time?: number): number[][];

/** The two colours as the shader takes them: the dim edge's and the bright core's. */
export declare function ditherColors(config: DitherFieldConfig): [string, string];

/** A CSS `background` that stands in for the field before the shader starts and without WebGL. */
export declare function ditherStill(config: DitherFieldConfig): string;

/** Starts the field on an element (its first canvas is drawn into, one pixel a dot). Returns a function that stops it. */
export declare function ditherField(el: HTMLElement, config: DitherFieldConfig): () => void;
