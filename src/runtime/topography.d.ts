import type { PaletteName } from './palettes.js';

export interface TopographyConfig {
	/** The lines' colour, or a gradient by elevation from the valleys to the peaks (up to five), blended in Oklab. Default a pale blue. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), as a gradient by elevation, when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** The ground the lines are drawn on. Default `#0c1a2b`. */
	background?: string;
	/** About how many lines cross the screen from top to bottom, 6–60. Default 24. */
	density?: number;
	/** The lines' width, CSS px, 0.5–3; index lines are twice as wide. Default 1. */
	thickness?: number;
	/** Every n-th line is an index line, drawn heavier, 0–10; 0 for none. Default 5. */
	major?: number;
	/** How large the hills are, 0.4–3. Default 1. */
	scale?: number;
	/** How fast the land drifts, 0–4; 0 holds it still. Default 1. */
	speed?: number;
	/** How strongly the lines glow under the pointer, 0–2; 0 for none. Default 1. */
	glow?: number;
	/** Whether the pointer raises the ground and lights its lines. Default true. */
	interactive?: boolean;
	/** Small elevation numbers on a few index lines. Default false. */
	labels?: boolean;
	/** An area kept dim behind copy: centre (0–1 from the top left), radius (a share of the height), depth (0–1). Default none; `{}` for the middle. */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The lattice's size: random values on a square this many cells a side, repeating. */
export const LATTICE: number;

/** Most elevation numbers on screen. */
export const MAX_LABELS: number;

/** The octaves: amplitude, the rows of the matrix that scales and turns the plane for it, its offset and its drift a second. */
export const OCTAVES: { amp: number; rows: [number, number, number, number]; offset: [number, number]; drift: [number, number] }[];

/** The height's working range, valleys to peaks: the gradient runs across it. */
export const LOW: number;
export const HIGH: number;

/** The field's mean steepness up the screen, height a uv unit at zoom 1. */
export const MEAN_SLOPE: number;

/** The lattice as the shader reads it: RGBA texels, each a cell's value and its right, up and up-right neighbours'. */
export function latticeData(seed?: number): Uint8Array;

/** Each octave's offset at a moment (the land's clock, seconds), two floats an octave. */
export function driftAt(time: number): Float32Array;

/** The land's height (about 0–1) and its slope along x and y at a point (uv: the screen's height is 1, 0 its middle). */
export function fieldAt(lattice: Uint8Array, drift: Float32Array | number[], zoom: number, x: number, y: number): [number, number, number];

/** Walks a point onto the contour at `level` with Newton steps (default 3); null on flat ground. `miss` is how far off it still is, uv. */
export function onContour(
	height: (x: number, y: number) => [number, number, number],
	x: number,
	y: number,
	level: number,
	steps?: number,
): { x: number; y: number; gx: number; gy: number; miss: number } | null;

/** A number's digits (0–9999, clamped), left to right, padded with -1 to four. */
export function digitsOf(value: number): [number, number, number, number];

/** Point `i` (from 1) of the Halton sequence in bases 2 and 3, in a 0–1 square. */
export function halton(i: number): [number, number];

/** Starts the topography in `el`'s canvas. Returns a function that stops it. */
export function topography(el: HTMLElement, config: TopographyConfig): () => void;
