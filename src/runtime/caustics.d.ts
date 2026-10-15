import type { PaletteName } from './palettes.js';

export interface CausticsConfig {
	/** The water and the light, in any order: the darkest is the deep water towards the edges, the lightest the light, the one between the floor. One or two colours work too. Default aqua `#2cc3d0`, deep teal `#0b7ea8`, sun `#f2fff9`. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** The ground the edges fall away into, and what shows without WebGL. Default: the deep water, darkened. */
	background?: string;
	/** How large the net of light is, 0.4–3: 2 doubles it. Default 1. */
	scale?: number;
	/** How fast the water moves, 0–3; 0 holds it still. Default 1. */
	speed?: number;
	/** How bright the light is, 0–2. Default 1. */
	intensity?: number;
	/** Faint pool tiles on the floor, bent by the water. Default false. */
	tiles?: boolean;
	/** Whether the pointer disturbs the water where it is. Default true. */
	interactive?: boolean;
	/** An area where the light is kept low behind copy: centre (0–1 from the top left), radius (a share of the height), depth (0–1). Default none; `{}` for the middle. */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The tones the water is drawn in, as hex. */
export interface CausticTones {
	/** The floor, seen through shallow water. */
	floor: string;
	/** The deep water towards the edges. */
	deep: string;
	/** The light. */
	light: string;
	/** What the edges fall away into. */
	background: string;
}

/** The tones from `colors` (or `palette`) in any order: darkest the deep water, lightest the light, the median the floor; `background` defaults to the deep, darkened. Throws a TypeError for a colour that is not hex. */
export function causticTones(config: CausticsConfig): CausticTones;

/** Starts the caustics in `el`'s canvas. Returns a function that stops it. */
export function caustics(el: HTMLElement, config: CausticsConfig): () => void;
