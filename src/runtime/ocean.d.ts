import type { PaletteName } from './palettes.js';

export interface OceanConfig {
	/** The time of day: the sun, the sky's colours and the water's (`night` has a moon and stars). Default `sunset`. */
	time?: 'dawn' | 'noon' | 'sunset' | 'night';
	/** The sea state: 0 glassy, 1 a fresh breeze, 2 rough with whitecaps. Default 1. */
	waves?: number;
	/** Where the waves run, degrees 0–360: 0 straight towards the viewer, 90 from left to right. Default 30. */
	wind?: number;
	/** How fast the sea moves; 0 holds it still. Default 1. */
	speed?: number;
	/** How high the camera is above the water, metres, 1–20 (raised as far as the waves need). Default 4. */
	height?: number;
	/** Where the horizon sits, 0–1 up the frame. Default 0.3. */
	horizon?: number;
	/** Soft high cloud in the sky and its reflection. Default true. */
	clouds?: boolean;
	/** Where the sun (or moon) sits instead of the time's place: 0–1 across and up the frame. Default none. */
	sun?: { x?: number; y?: number } | null;
	/** Tints, kept to each part's lightness: the sky, the water and the light. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case) to tint with, when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** Whether the camera drifts with the pointer. Default true. */
	interactive?: boolean;
	/** An area dimmed behind copy: centre (0–1 from the top left), radius (a share of the height), depth (0–1). Default none; `{}` for the middle. */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** Starts the ocean in `el`'s canvas. Returns a function that stops it. */
export function ocean(el: HTMLElement, config: OceanConfig): () => void;
