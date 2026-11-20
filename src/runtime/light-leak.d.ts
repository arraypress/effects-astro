import type { PaletteName } from './palettes.js';

export interface LightLeakConfig {
	/** Four CSS hex colours, darkest first (fewer or more are resampled to four, in Oklab). Default the sketch's maroon ramp. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`: its three colours and glint, darkest first. */
	palette?: PaletteName | (string & {});
	/** How many blobs span the shorter side (higher is busier). Default 1.5. */
	scale?: number;
	/** How far the domain warp bends the field (0 for none). Default 0.3. */
	warp?: number;
	/** Octaves of noise, 1–4: more adds finer detail. Default 2. */
	octaves?: number;
	/** How far each field is pushed from its middle toward the ramp's ends (1 is the noise as it is), 0.5–3. Default 1.6. */
	contrast?: number;
	/** Where the sample window sits, so two cards differ. Default [0, 0]. */
	offset?: [number, number];
	/** Plays the clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** How fast the blobs drift and the warp moves (the sketch's own was 0.04, a four-and-a-half-minute loop). Default 0.3. */
	drift?: number;
	/** An area flattened to one tone behind copy: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
	/** The tone the quiet area settles to: 0 the darkest colour, 1 the brightest (for dark copy). Default 0. */
	quietTone?: number;
}

/** The settings' defaults, shared by the shader and the JavaScript twin. */
export declare const LEAK_DEFAULTS: {
	scale: number;
	warp: number;
	octaves: number;
	contrast: number;
	quietTone: number;
	drift: number;
};

/** The sketch's maroon ramp around #A40F27, darkest first. */
export declare const LEAK_COLORS: string[];

/** The lattice hash (Dave Hoskins' Hash without Sine), 0–1; the shader's own. */
export declare function leakHash(x: number, y: number): number;

/** Value noise with a cubic Hermite fade, 0–1. */
export declare function valueNoise(x: number, y: number): number;

/** Fractal value noise as the sketch sums it, divided by the weights' total so it spans 0–1 at any octave count. */
export declare function fbm(x: number, y: number, octaves?: number): number;

/** A field pushed from its middle toward 0 and 1; `contrast` 1 leaves it as it is. Default 1.6. */
export declare function leakShape(n: number, contrast?: number): number;

/** An octave count as the shader takes it: a whole number, 1–4. */
export declare function clampOctaves(octaves: number | undefined): number;

/** The four colours as the shader takes them, darkest first. */
export declare function leakColors(config: LightLeakConfig): [string, string, string, string];

/** The three fields at a point (u, v 0–1 from the top left), as the shader samples them, quiet area and all. */
export declare function leakFields(config: LightLeakConfig, u: number, v: number, aspect?: number, time?: number): [number, number, number];

/** The four colours mixed by the three fields, in Oklab: CSS hex. */
export declare function leakMix(colors: string[], fields: [number, number, number]): string;

/** The field's colour at a point (u, v 0–1 from the top left): what the shader draws there, bar the breath and dither. */
export declare function leakColor(config: LightLeakConfig, u: number, v: number, aspect?: number, time?: number): string;

/** A CSS background close to the field's first frame, for before the shader starts and where there is no WebGL. */
export declare function lightLeakStill(config: LightLeakConfig, aspect?: number): string;

/** Starts the light leak on an element (its first canvas is drawn into, opaque). Returns a function that stops it. */
export declare function lightLeak(el: HTMLElement, config: LightLeakConfig): () => void;
