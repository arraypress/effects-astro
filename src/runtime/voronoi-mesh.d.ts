import type { PaletteName } from './palettes.js';

export interface VoronoiMeshConfig {
	/** Two CSS hex colours: the macro lines' and the inner lines'. Default a pale stone and a dusty rose (`#c1c2bc`, `#a67676`). */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`: its glint for the macro lines, its first colour for the inner. */
	palette?: PaletteName | (string & {});
	/** The ground, a CSS hex colour (opaque, so the canvas covers what is behind it); `transparent` draws the lines alone. Default `#350f0e`. */
	background?: string;
	/** Macro cells across the width. Default 9. */
	cells?: number;
	/** Inner seeds per macro cell, 0–8; 0 for the macro tier alone. Default 5. */
	inner?: number;
	/** The macro lines' width in CSS px; the inner lines are 0.7 of it. Default 1. */
	width?: number;
	/** The macro and inner lines' opacity, each 0–1. Default [0.4, 0.22]. */
	opacity?: [number, number];
	/** How far the inner seeds pulse, 0–1: 1 draws them in to the macro seed and out again, 0 holds them still. Default 1. */
	pulse?: number;
	/** How far out the inner seeds push, a share of a cell. Default 0.6. */
	spread?: number;
	/** How far each macro seed rests off its square's centre, 0–1. Default 0.75. */
	jitter?: number;
	/** How wide the macro seeds orbit, 0–1. Default 1. */
	orbit?: number;
	/** The slow driver, 0–1: how much it speeds the clocks, thickens the lines and lifts the macro tier. Default 0.35. */
	breathe?: number;
	/** Plays every clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** Where the grid starts, in cells, so two cards differ. Default [0, 0]. */
	offset?: [number, number];
	/** An area kept quiet: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The settings as the seeds take them, each in cells. */
export interface SeedOptions {
	/** The furthest a seed rests off its square's centre, along each axis. */
	jitter: number;
	/** The widest it orbits. */
	orbit: number;
	/** Inner seeds per cell. */
	inner: number;
	/** How far out the inner seeds push. */
	spread: number;
	/** How far they pulse, 0–1. */
	pulse: number;
}

/** The settings' defaults, shared by the shader and the JavaScript twins. */
export declare const MESH_DEFAULTS: {
	background: string;
	cells: number;
	inner: number;
	width: number;
	opacity: [number, number];
	pulse: number;
	spread: number;
	jitter: number;
	orbit: number;
	breathe: number;
};

/** Dave Hoskins' Hash without Sine, three in and three out (the shader's `hash33`); each 0–1. */
export declare function hash33(x: number, y: number, z: number): [number, number, number];

/** The slow driver at a time (seconds, at the effect's speed): 0 to `breathe`. */
export declare function driveAt(t: number, breathe?: number): number;

/** The seeds' clock at a time: the integral of `1 + 2 · driveAt`, in closed form; 0 at 0. */
export declare function clockAt(t: number, breathe?: number): number;

/** The pulse's shape over one cycle (0–1): at rest through the dead zone, a squared sine out to 1 halfway and back. */
export declare function pulseWave(t: number): number;

/** The settings, with defaults, as the seeds take them (in cells). */
export declare function seedOptions(config?: VoronoiMeshConfig): SeedOptions;

/** The macro seed for the grid square at (cx, cy), at a clock (`clockAt`), in cells. */
export declare function macroSeed(cx: number, cy: number, clock: number, options?: SeedOptions): [number, number];

/** A macro cell's inner seeds at a clock, in cells. */
export declare function innerSeeds(cx: number, cy: number, clock: number, options?: SeedOptions): [number, number][];

/** The macro tier at a point (in cells), as the shader finds it: the nearest seed's square, the seed, and the distance to its cell's border. */
export declare function macroAt(x: number, y: number, clock: number, options?: SeedOptions): { cell: [number, number]; seed: [number, number]; edge: number };

/** One frame's macro and inner cells as polygons, in CSS px from the top left. */
export declare function meshPolygons(config: VoronoiMeshConfig, width: number, height: number, time?: number): { macro: [number, number][][]; inner: [number, number][][] };

/** The two line colours as the shader takes them: the macro lines' and the inner lines'. */
export declare function meshColors(config: VoronoiMeshConfig): [string, string];

/** One frame as an SVG's markup: the ground, both tiers' lines and the quiet area. */
export declare function meshSvg(config: VoronoiMeshConfig, width: number, height: number, time?: number): string;

/** One frame as a CSS `background` value (the SVG as a data URL over the ground), for the still shown before the shader starts and without WebGL. */
export declare function meshStill(config: VoronoiMeshConfig, width: number, height: number, time?: number): string;

/** Starts the mesh on an element (its first canvas is drawn into). Returns a function that stops it. */
export declare function voronoiMesh(el: HTMLElement, config: VoronoiMeshConfig): () => void;
