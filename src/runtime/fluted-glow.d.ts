import type { PaletteName } from './palettes.js';

/** The light behind the glass. */
export type GlowShape = 'ring' | 'orb' | 'rise';

export interface FlutedGlowConfig {
	/** Three CSS hex colours, the light from its edge in: deep, mid and hot. Default a violet ring's. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** The ground, painted everywhere. Default '#08070c'. */
	background?: string;
	/** The light behind the glass. Default 'ring'. */
	shape?: GlowShape;
	/** Flutes across the width. Default 14. */
	flutes?: number;
	/** How much of what is behind a flute it shows across its width (lower stretches more). Default 0.35. */
	squeeze?: number;
	/** The ring's radius or the orb's, a share of the height; how high the rise reaches. Default 0.3. */
	size?: number;
	/** The ring's soft width, a share of the height. Default 0.09. */
	thickness?: number;
	/** How bright the light is. Default 1. */
	glow?: number;
	/** How far the light swells and shrinks, a share of its size. Default 0.06. */
	breathe?: number;
	/** How far its centre wanders, a share of the height. Default 0.04. */
	drift?: number;
	/** How fast it breathes and wanders, cycles a second. Default 0.05. */
	rate?: number;
	/** How strong the flutes' shadows and highlights are; 0 for none. Default 0.35. */
	seams?: number;
	/** Fine grain over all of it; 0 for none. Default 0.05. */
	grain?: number;
	/** The ring's or orb's centre, 0–1 from the top left. Default [0.5, 0.5]. */
	centre?: [number, number];
	/** Where its wandering starts, so two cards differ. Default 0. */
	seed?: number;
	/** Plays every clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** An area dimmed: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The shapes, in the order the shader numbers them. */
export declare const GLOW_SHAPES: readonly ['ring', 'orb', 'rise'];

/** The settings' defaults, shared by the shader and the JS twin. */
export declare const GLOW_DEFAULTS: {
	background: string;
	shape: GlowShape;
	flutes: number;
	squeeze: number;
	size: number;
	thickness: number;
	glow: number;
	breathe: number;
	drift: number;
	rate: number;
	seams: number;
	grain: number;
	centre: [number, number];
	seed: number;
};

/** How bright the light behind the glass is at a point (heights from the top left; `aspect` width over height), before the flutes and the quiet area. */
export declare function glowAt(config: FlutedGlowConfig, x: number, y: number, aspect: number, time?: number): number;

/** Where behind the glass a point looks: the share of the width it shows, and where in its flute it is (−1 to 1). */
export declare function fluteSample(fx: number, flutes: number, squeeze: number): { x: number; local: number };

/** The light's three colours as the shader takes them: deep, mid and hot. */
export declare function glowColors(config: FlutedGlowConfig): [string, string, string];

/** A CSS `background` that stands in for the light before the shader starts and without WebGL (`aspect`, width over height, default 0.8). */
export declare function glowStill(config: FlutedGlowConfig, aspect?: number): string;

/** Starts the light on an element (its first canvas). Returns a function that stops it. */
export declare function flutedGlow(el: HTMLElement, config: FlutedGlowConfig): () => void;
