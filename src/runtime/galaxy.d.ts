import type { PaletteName } from './palettes.js';

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
	/** Run only while near the screen (true, or a CSS length; default `200px`), handled by `mount`. Default false. */
	lazy?: boolean | string;
}

/** The colours without `colors` or `palette`: indigo, cornflower, violet and cyan. */
export const COLORS: string[];

/** The worked-out nebula's size, px (drawn scaled up to cover). */
export const NEBULA_WIDTH: number;
export const NEBULA_HEIGHT: number;

/** The nebula as places on the colour ramp, 0–1, one a pixel row by row: layered noise clouds cut by ridged dust lanes. Tileable; the same seed gives the same field. */
export function nebulaField(width: number, height: number, seed?: number): Float32Array;

/** The ramp the nebula is painted along (the first colour darkened to near-black, the colours, a pale top), blended in Oklab: `steps` (default 256) RGB triples. Throws a TypeError for a colour that is not hex. */
export function galaxyRamp(colors: string[], steps?: number): Uint8ClampedArray;

/** Paints a nebula field along a ramp: opaque RGBA, a pixel per value. */
export function nebulaPixels(field: Float32Array, ramp: Uint8ClampedArray): Uint8ClampedArray;

/** Starts the galaxy on an element (its first canvas is drawn into). Returns a function that stops it. */
export function galaxy(el: HTMLElement, config: GalaxyConfig): () => void;
