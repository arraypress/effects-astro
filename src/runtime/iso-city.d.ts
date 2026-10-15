import type { PaletteName } from './palettes.js';

export interface IsoCityConfig {
	/** Buildings, parks, roads. Default warm off-white, sage and graphite (at night slate, deep green and near-black). */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), softened into a city, when there are no `colors`; its first colour becomes the taxis'. */
	palette?: PaletteName | (string & {});
	/** The taxis' colour. Default `#f2a53a` (amber; `#ffb547` at night). */
	accent?: string;
	/** The ground the city fades into. Default `#e9e3d8` (`#0d1219` at night). */
	background?: string;
	/** How many cars, 0–60. Default 24. */
	cars?: number;
	/** How many of them are taxis: a share, 0–1, or a count, 1–60. Default 0.3. */
	taxis?: number;
	/** How fast they drive, 0–3; 0 holds them still. Default 1. */
	speed?: number;
	/** Which city, 1–9999: the same seed always builds the same streets and buildings. Default 7. */
	seed?: number;
	/** Blocks across, 3–10. Default 6. */
	size?: number;
	/** Night: lit windows, street lamps, headlight beams and glowing roof signs. Default false. */
	night?: boolean;
	/** A click or tap on a street calls the nearest taxi by road, which drives there and picks up. Default true. */
	interactive?: boolean;
	/** Let the view drift very slowly. Default true. */
	drift?: boolean;
	/** How close the camera is, 0.5–2. Default 1. */
	zoom?: number;
	/** Where the city sits on a wide screen (centred on a narrow one). Default `center`. */
	side?: 'center' | 'left' | 'right';
	/** An area faded towards the background behind copy: centre (0–1 from the top left), radius (a share of the height), depth (0–1). Default none; `{}` for the middle. */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** Starts the city in `el`'s canvas. Returns a function that stops it. Without WebGL, `el` gets `is-flat` and the `--iso-*` colours. */
export function isoCity(el: HTMLElement, config: IsoCityConfig): () => void;
