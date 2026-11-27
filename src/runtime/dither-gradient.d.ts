import type { PaletteName } from './palettes.js';

/** The gradient's shapes. */
export type GradientShape = 'wave' | 'band' | 'swirl' | 'pinwheel' | 'steps' | 'orb' | 'pill';

export interface DitherGradientConfig {
	/** Two CSS hex colours, the dim one where the tone is low and the bright one where it is full, or three with a middle colour between them. Default a plum and a hot pink. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`: its first and last colours. */
	palette?: PaletteName | (string & {});
	/** A CSS hex colour to fill behind the dots; none leaves the canvas clear there. */
	background?: string;
	/** The gradient's shape. Default 'wave'. */
	shape?: GradientShape;
	/** Square dots an ordered dither thins out, or round dots that shrink. Default 'bayer'. */
	mode?: 'bayer' | 'halftone';
	/** The dots' grid, in CSS px. Default 4. */
	dot?: number;
	/** Share of its cell a full dot covers (below 1 leaves a gap between dots). Default 1. */
	fill?: number;
	/** How soft the gradient is: the edge's width in widths (wave, band, steps), a share of a turn (swirl, pinwheel). Default 0.35. */
	soft?: number;
	/** Which way the wave, band and steps rise from, degrees: 0 from the bottom, 90 from the left. Default 0. */
	angle?: number;
	/** Where the wave's horizon, the band's middle and the steps' line sit, widths below the centre (along `angle`). Default 0.12. */
	level?: number;
	/** The swirl's and pinwheel's arms. Default 3. */
	arms?: number;
	/** How tightly the swirl winds and the pinwheel bends. Default 2. */
	twist?: number;
	/** How fast it moves, cycles a second. Default 0.03. */
	rate?: number;
	/** The steps' block, in dots. Default 6. */
	block?: number;
	/** The orb's radius, and the pill's thickness's share, in widths. Default 0.3. */
	size?: number;
	/** Colour bands from dim to bright; 0 blends smoothly. Default 0. */
	steps?: number;
	/** The swirl's and pinwheel's centre, and the wave's and band's pivot, 0–1 from the top left. Default [0.5, 0.5]. */
	centre?: [number, number];
	/** Where the shapes' noise starts, so two cards differ. Default [0, 0]. */
	offset?: [number, number];
	/** Plays the clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** An area kept empty: centre (0–1 from the top left), radius (share of the height), depth (0–1). Its opening is squared. */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The shapes, in the order the shader numbers them. */
export declare const GRADIENT_SHAPES: readonly ['wave', 'band', 'swirl', 'pinwheel', 'steps', 'orb', 'pill'];

/** The settings' defaults, shared by the shader and the JS twin. */
export declare const GRADIENT_DEFAULTS: {
	shape: GradientShape;
	mode: 'bayer' | 'halftone';
	dot: number;
	fill: number;
	soft: number;
	angle: number;
	level: number;
	arms: number;
	twist: number;
	rate: number;
	block: number;
	size: number;
	steps: number;
	centre: [number, number];
};

/** The settings filled with the defaults, as the shader takes them. */
export type GradientSettings = Required<Omit<DitherGradientConfig, 'colors' | 'palette' | 'background' | 'quiet'>> & {
	shapeIndex: number;
	modeIndex: number;
	rad: number;
	blockW: number;
};

/** The settings as the shader takes them, for a target `cols` dots wide (the steps' block is in dots). */
export declare function gradientSettings(config: DitherGradientConfig, cols: number): GradientSettings;

/** The tone 0–1 at a point (widths from the top left; `H` the height in widths), before the quiet area. */
export declare function gradientTone(s: GradientSettings, x: number, y: number, H: number, time?: number): number;

/** One frame dot for dot on a target exactly `cols` by `rows` dots: each dot's tone after the quiet area, and whether a bayer dot is lit. */
export declare function gradientDots(config: DitherGradientConfig, cols: number, rows: number, time?: number): { tone: number; lit: boolean }[][];

/** The three colours the dots blend through, low to high: a middle one of their own when three or more are given, else halfway in Oklab. */
export declare function gradientRamp(config: DitherGradientConfig): [string, string, string];

/** The two colours as the shader takes them: the dim one and the bright one. */
export declare function gradientColors(config: DitherGradientConfig): [string, string];

/** A CSS `background` that stands in for the gradient before the shader starts and without WebGL. */
export declare function gradientStill(config: DitherGradientConfig): string;

/** Starts the gradient on an element (its first canvas). Returns a function that stops it. */
export declare function ditherGradient(el: HTMLElement, config: DitherGradientConfig): () => void;
