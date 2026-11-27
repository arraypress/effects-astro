import type { PaletteName } from './palettes.js';

/** The glass: upright flutes, or a wall of square glass blocks. */
export type BokehGlass = 'reeds' | 'blocks';

export interface FlutedBokehConfig {
	/** Two to four CSS hex colours for the lights. Default coral, amber and ice blue. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** The ground, painted everywhere. Default '#050608'. */
	background?: string;
	/** Upright flutes, or a wall of square glass blocks. Default 'reeds'. */
	mode?: BokehGlass;
	/** Flutes across the width (blocks across, for `blocks`). Default 28. */
	flutes?: number;
	/** How much of what is behind a flute it shows across its width (lower stretches more). Default 0.3. */
	squeeze?: number;
	/** How far red and blue part at the seams; 0 for none. Default 0.35. */
	dispersion?: number;
	/** How far the light smears upright, a share of the height; 0 for none. Default 0.06. */
	streak?: number;
	/** Lights behind the glass (1–8). Default 5. */
	lights?: number;
	/** The lights' radius, a share of the height. Default 0.22. */
	size?: number;
	/** How bright the lights are. Default 1. */
	glow?: number;
	/** How far the lights wander, a share of the height. Default 0.08. */
	drift?: number;
	/** How fast they wander, cycles a second. Default 0.04. */
	rate?: number;
	/** How strong the seams' highlights and shadows (or the blocks' joints) are; 0 for none. Default 0.3. */
	seams?: number;
	/** Fine grain over all of it; 0 for none. Default 0.04. */
	grain?: number;
	/** Where the lights sit and start wandering, so two cards differ. Default 0. */
	seed?: number;
	/** Plays every clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** An area dimmed: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The glass, in the order the shader numbers it. */
export declare const BOKEH_GLASS: readonly ['reeds', 'blocks'];

/** The most lights the shader draws. */
export declare const MAX_LIGHTS: 8;

/** The settings' defaults, shared by the shader and the JS twin. */
export declare const BOKEH_DEFAULTS: Required<Omit<FlutedBokehConfig, 'colors' | 'palette' | 'speed' | 'quiet'>>;

/** The lights: where each sits (shares of the width and height), its size (a share of `size`), its colour's index and its phase. */
export declare function bokehLights(config: FlutedBokehConfig): { x: number; y: number; r: number; color: number; phase: number }[];

/** The light behind the glass at a point (shares of the width and height): red, green and blue, 0 and up. */
export declare function bokehAt(config: FlutedBokehConfig, x: number, y: number, aspect: number, time?: number): [number, number, number];

/** Where behind the reeds a point looks: the share of the width it shows, and where in its flute it is (−1 to 1). */
export declare function reedSample(x: number, flutes: number, squeeze: number): { x: number; local: number };

/** The lights' colours as the shader takes them: two to four. */
export declare function bokehColors(config: FlutedBokehConfig): string[];

/** A CSS `background` that stands in for the lights before the shader starts and without WebGL. */
export declare function bokehStill(config: FlutedBokehConfig, aspect?: number): string;

/** Starts the lights and the glass on an element (its first canvas). Returns a function that stops it. */
export declare function flutedBokeh(el: HTMLElement, config: FlutedBokehConfig): () => void;
