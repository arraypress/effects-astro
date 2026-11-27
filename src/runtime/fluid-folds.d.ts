import type { PaletteName } from './palettes.js';

/** The folds' styles: bending every way, or lying across the frame. */
export type FoldStyle = 'liquid' | 'dunes';

export interface FluidFoldsConfig {
	/** Three CSS hex colours along the folds: deep, mid and hot. Default cobalt, violet and coral. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** The ground, painted everywhere (the folds' deepest shadow). Default '#050409'. */
	background?: string;
	/** Folds bending every way like poured enamel, or long folds lying across the frame like silk dunes. Default 'liquid'. */
	style?: FoldStyle;
	/** How many folds across the height. Default 1.6. */
	scale?: number;
	/** How far the noise bends the folds. Default 0.9. */
	warp?: number;
	/** How bright and tight the highlight along each crest is; 0 for none. Default 0.8. */
	gloss?: number;
	/** Where the light comes from, degrees from straight above (negative from the left). Default -30. */
	light?: number;
	/** How fast the colour runs across the folds (higher shows more of the ramp at once). Default 0.5. */
	hue?: number;
	/** How fast the folds move, cycles a second. Default 0.03. */
	rate?: number;
	/** For dunes, where the folds sit, a share of the height from the top (above it, the dark sky). Default 0.55. */
	level?: number;
	/** Fine grain over all of it; 0 for none. Default 0.03. */
	grain?: number;
	/** Where its noise starts, so two cards differ. Default 0. */
	seed?: number;
	/** Plays every clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** An area dimmed: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The styles, in the order the shader numbers them. */
export declare const FOLD_STYLES: readonly ['liquid', 'dunes'];

/** The settings' defaults, shared by the shader and the JS twin. */
export declare const FOLD_DEFAULTS: Required<Omit<FluidFoldsConfig, 'colors' | 'palette' | 'speed' | 'quiet'>>;

/** The folds' height at a point (heights from the top left), 0–1: a crest near 1, the hollow behind it near 0. */
export declare function foldHeight(config: FluidFoldsConfig, x: number, y: number, time?: number): number;

/** Where on the colour ramp a point is, 0–1 round deep, mid, hot and back. */
export declare function foldHue(config: FluidFoldsConfig, x: number, y: number, time?: number): number;

/** The three colours as the shader takes them: deep, mid and hot (fewer repeat). */
export declare function foldColors(config: FluidFoldsConfig): [string, string, string];

/** A CSS `background` that stands in for the folds before the shader starts and without WebGL. */
export declare function foldsStill(config: FluidFoldsConfig): string;

/** Starts the folds on an element (its first canvas). Returns a function that stops it. */
export declare function fluidFolds(el: HTMLElement, config: FluidFoldsConfig): () => void;
