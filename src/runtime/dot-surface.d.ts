import type { PaletteName } from './palettes.js';

export interface DotSurfaceConfig {
	/** The dots' colour. Default `#ff8a1f`. */
	color?: string;
	/** A gradient instead (up to five), blended in Oklab, from near to far or left to right (see `gradient`). */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors` or `color`. */
	palette?: PaletteName | (string & {});
	/** Which way `colors` runs: near to far, or left to right. Default `depth`. */
	gradient?: 'depth' | 'width';
	/** Space between dots, CSS px, at the middle of the sheet (nearer is wider, further closer). Default 10. */
	pitch?: number;
	/** The largest dot, CSS px, at the middle of the sheet. Default 6. */
	dot?: number;
	/** How tall the swells are: 1 a gentle roll, 2 a heavy sea, 0 flat. Default 1. */
	amplitude?: number;
	/** How fast the sheet rolls; 0 holds it still. Default 1. */
	speed?: number;
	/** The camera's angle above the sheet, degrees (10 grazing, 70 nearly overhead). Default 42. */
	tilt?: number;
	/** Where the light comes from: x right, y up, z into the distance. Default `[-0.5, 0.6, -0.6]`. */
	light?: [number, number, number];
	/** Whether the pointer raises a swell and a click sends a ring. Default true. */
	interactive?: boolean;
	/** An area kept dim behind copy: centre (0–1 from the top left), radius (a share of the height), depth (0–1). Default none; `{}` for the middle. */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** Most colours a gradient takes. */
export const MAX_COLORS: number;

/** How far into the distance the flat sheet lies at clip-space height `y` (-1 bottom to 1); Infinity at or above the horizon. */
export function sheetDepth(y: number, tilt: number): number;

/** Where a point on screen (x 0–1 from the left, y 0–1 from the bottom) lies on the flat sheet; null above the horizon. */
export function sheetAt(x: number, y: number, tilt: number, aspect: number): { x: number; z: number } | null;

/** The sheet's grid as particle data, four floats a dot: x, z, depth (0 near, 1 far) and across (0 left, 1 right). */
export function sheetGrid(aspect: number, spacing: number, tilt: number): Float32Array;

/** A gradient as the shader takes it: each colour in Oklab, padded to MAX_COLORS. Throws a TypeError for a colour that is not hex. */
export function gradientUniform(colors: string[]): Float32Array;

/** Starts the dot surface in `el`'s canvas. Returns a function that stops it. */
export function dotSurface(el: HTMLElement, config: DotSurfaceConfig): () => void;
