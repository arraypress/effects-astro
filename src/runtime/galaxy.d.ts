import type { PaletteName } from './palettes.js';
import type { RandomName } from './random.js';

export interface GalaxyConfig {
	/** The nebula's colours, deep to bright (two to five read best), blended in Oklab from near-black up to a pale highlight. Default indigo, cornflower, violet and cyan. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** How fast it drifts and twinkles, 0–4; 0 holds it still. Default 1. */
	speed?: number;
	/** How many stars, as a share of the usual, 0–3; 0 for none. Default 1. */
	stars?: number;
	/** How bright the fine glitter is, as a share of the usual, 0–2; 0 for none. Default 1. */
	glitter?: number;
	/** Which sky, 1–999: the same seed draws the same nebula and stars. Default 7. */
	seed?: number;
	/** The glitter and stars' own seed. Default `seed × 31 + 1`. */
	starSeed?: number;
	/**
	 * The generator. `mulberry32` scatters the glitter and stars afresh from `starSeed` on each resize;
	 * `park-miller` (the Logomarks studio's first galaxy) scatters them from one stream that runs on across
	 * resizes. With `seed: 7`, `starSeed: 31` and `blend: 'srgb'`, `park-miller` draws that sky to the pixel.
	 * Default `mulberry32`.
	 */
	rng?: RandomName;
	/** How the ramp blends its colours: in Oklab, or plainly in sRGB (painted exactly along its stops, the first colour's bytes × 0.18 for its near-black). Default `oklab`. */
	blend?: 'oklab' | 'srgb';
	/** Run only while near the screen (true, or a CSS length; default `200px`), handled by `mount`. Default false. */
	lazy?: boolean | string;
}

/** The colours without `colors` or `palette`: indigo, cornflower, violet and cyan. */
export const COLORS: string[];

/** The worked-out nebula's size, px (drawn scaled up to cover). */
export const NEBULA_WIDTH: number;
export const NEBULA_HEIGHT: number;

/** The nebula as places on the colour ramp, 0–1, one a pixel row by row: layered noise clouds cut by ridged dust lanes. Tileable; the same seed and generator (default `mulberry32`) give the same field. */
export function nebulaField(width: number, height: number, seed?: number, rng?: RandomName): Float64Array;

/** The ramp's stops (the first colour darkened to near-black, the colours, the pale top) as RGB triples, 0–255, unrounded. Darkened in Oklab, or for `srgb` by scaling its bytes by 0.18. Throws a TypeError for a colour that is not hex. */
export function galaxyStops(colors: string[], blend?: 'oklab' | 'srgb'): Float64Array;

/** The ramp the nebula is painted along (the first colour darkened to near-black, the colours, a pale top), blended in Oklab (default) or sRGB: `steps` (default 256) RGB triples. Throws a TypeError for a colour that is not hex. */
export function galaxyRamp(colors: string[], steps?: number, blend?: 'oklab' | 'srgb'): Uint8ClampedArray;

/** Paints a nebula field along a ramp: opaque RGBA, a pixel per value. Each value takes the nearest entry, or with `smooth` the linear blend of the two either side (for galaxyStops with `srgb`, which it paints exactly). */
export function nebulaPixels(field: ArrayLike<number>, ramp: ArrayLike<number>, smooth?: boolean): Uint8ClampedArray;

/** Starts the galaxy on an element (its first canvas is drawn into, or a 2D one in its place when the host made it for WebGL). Returns a function that stops it. */
export function galaxy(el: HTMLElement, config: GalaxyConfig): () => void;
