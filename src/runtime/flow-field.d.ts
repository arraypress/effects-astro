import type { PaletteName } from './palettes.js';

export interface FlowFieldConfig {
	/** The trails' colours, CSS hex, blended in Oklab along each trail's life (or by its speed). Default white. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** The ground, CSS hex: filled every frame, so the canvas is opaque. Default `#000000`. */
	background?: string;
	/** What picks a trail's colour along `colors`: its age, how fast it travels, or one colour each at random. Default `life`. */
	colorBy?: 'life' | 'speed' | 'random';
	/** Trails per 100 × 100 CSS px, on average. Default 12. */
	density?: number;
	/** How much of its path a trail shows behind it, seconds. Default 0.5. */
	length?: number;
	/** Line width, CSS px. Default 0.7. */
	weight?: number;
	/** A trail head's opacity, 0–1; the tail fades from it. Default 0.75. */
	opacity?: number;
	/** How fast trails travel, CSS px a second, on average. Default 110. */
	pace?: number;
	/** How many noise features span the element (across √(width × height)); higher is busier. Default 2. */
	scale?: number;
	/** How fast the field changes, noise units a second. Default 0.15. */
	evolve?: number;
	/** A trail's average life, seconds (each lives half to one and a half times it). Default 4. */
	life?: number;
	/** How far the slow drives swing density, pace, weight and evolution, 0–1; 0 holds them. Default 0.7. */
	vary?: number;
	/** Plays every clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** Which field and which trails: the same seed draws the same. Default 1. */
	seed?: number;
	/** An area with fewer, fainter trails: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The settings' defaults. */
export declare const FLOW_DEFAULTS: Readonly<{
	background: string;
	colorBy: 'life' | 'speed' | 'random';
	density: number;
	length: number;
	weight: number;
	opacity: number;
	pace: number;
	scale: number;
	evolve: number;
	life: number;
	vary: number;
	speed: number;
	seed: number;
}>;

/** Simulation ticks a second. */
export declare const TICKS: number;

/** The field's noise in three dimensions (across, down, time), around 0–1. */
export declare function flowNoise(x: number, y: number, z: number): number;

/** The field's heading at a point: the noise times two whole turns, radians. */
export declare function flowAngle(x: number, y: number, z: number): number;

/** One of the slow drives at `t` seconds, 0–1. */
export declare function driveAt(t: number, channel: number): number;

/** How much a quiet area lets through at a point (CSS px): 1 − depth at its centre, 1 at its edge and beyond. */
export declare function quietFactor(x: number, y: number, width: number, height: number, quiet: FlowFieldConfig['quiet']): number;

/** How many trails an element holds on average. */
export declare function trailCount(width: number, height: number, density?: number): number;

/** The colours as strokes take them: steps along `colors`, blended in Oklab; `rgb(…)` strings. */
export declare function flowRamp(colors: string[], steps?: number): string[];

/** A trail's opacity from its age: fading in at birth, out at the end, 0–1. */
export declare function lifeAlpha(age: number, life: number): number;

export interface Trail {
	alive: boolean;
	x: number;
	y: number;
	/** Its last positions, a ring of x, y pairs. */
	path: Float32Array;
	/** The ring's newest pair. */
	head: number;
	age: number;
	life: number;
	/** Its speed, CSS px a second, set at birth. */
	pace: number;
	/** Where it sits along the colours for `colorBy: 'speed'` or `'random'`, 0–1. */
	tone: number;
}

export interface Flow {
	trails: Trail[];
	width: number;
	height: number;
	/** Positions a trail keeps. */
	steps: number;
	/** Seconds simulated. */
	time: number;
	/** How many trails it wants now. */
	target: number;
	/** The line width now, CSS px. */
	weight: number;
	/** Steps the simulation on by some seconds, at fixed ticks. */
	advance(seconds: number): void;
	/** Fills the buckets (colour × alpha) with each visible segment (its point count, then x, y pairs); returns how many segments. */
	segments(buckets: number[][]): number;
}

/** The simulation without a canvas, run on until settled (`warm` seconds, default 2.5). */
export declare function createFlow(config: FlowFieldConfig, width: number, height: number, options?: { warm?: number }): Flow;

/** Starts the flow field on an element (its first canvas is drawn into). Returns a function that stops it. */
export declare function flowField(el: HTMLElement, config: FlowFieldConfig): () => void;
