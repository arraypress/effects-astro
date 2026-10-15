import type { PaletteName } from './palettes.js';

/** The ring's outline. */
export type HaloShape = 'morph' | 'hexagon' | 'rect' | 'circle';

export interface HaloRingConfig {
	/** Three colours looped around the ring, blended in Oklab. Default amber, coral, electric blue (`['#ffb020', '#ff5a6e', '#2f7bff']`). */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** The outline: a rounded hexagon, a rounded rectangle fitted to the element, a circle, or a slow drift between the hexagon and a squarer rectangle. Default `morph`. */
	shape?: HaloShape;
	/** How round the corners are: 0 sharp, 1 as round as they go. Default 0.3. */
	corner?: number;
	/** Space between the ring and the element's edge, a share of its shorter side. Default 0.05. */
	margin?: number;
	/** The bright core line, CSS px. Default 10. */
	thickness?: number;
	/** How far and how strongly the light spreads; 0 for the bare line. Default 1. */
	glow?: number;
	/** How fast the colour travels and the shape drifts; 0 holds it still. Default 1. */
	speed?: number;
	/** The ground. Default `#0d0c10`. */
	background?: string;
	/** Whether the ring leans towards the pointer and lights up near it. Default true. */
	interactive?: boolean;
	/** An area kept dim behind copy: centre (0–1 from the top left), radius (a share of the height), depth (0–1). Default none; `{}` for the middle. */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The ring's sizes in pixels for a canvas: hexagon inradius and half length (`reach`), rectangle half size, circle radius and corner radius; `upright` when the shape is measured on its side for a tall canvas and turned a quarter (the hexagon and rectangle then stretch along the longer side). */
export function ringSize(
	width: number,
	height: number,
	shape: HaloShape,
	margin: number,
	corner: number,
): { hex: number; reach: number; box: [number, number]; circle: number; corner: number; upright: boolean };

/** How far the outline is from the hexagon (0) to the rectangle (1) at `time`; only `morph` changes. */
export function shapeBlend(shape: HaloShape, time: number): number;

/** The outline's six corners before rounding, counter-clockwise from the right, two floats a corner, px from the centre: the hexagon's and the rectangle's blended by `blend`, pulled in by the corner radius. */
export function outline(size: { hex: number; reach: number; box: [number, number]; corner: number }, blend: number): Float32Array;

/** Starts a halo ring in `el`'s canvas. Returns a function that stops it. */
export function haloRing(el: HTMLElement, config: HaloRingConfig): () => void;
