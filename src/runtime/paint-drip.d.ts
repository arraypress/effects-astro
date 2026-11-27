export interface PaintDripConfig {
	/** The mark, as an image URL (a white SVG works; only its alpha is used). */
	src?: string;
	/** The paint. Default '#C8FF00'. */
	color?: string;
	/** The ground, painted everywhere. Default '#85857F'. */
	background?: string;
	/** Where the mark sits: its centre (0–1 from the top left) and its edge (a share of the height). Default { x: 0.5, y: 0.42, size: 0.5 }. */
	box?: { x: number; y: number; size: number };
	/** How many drips run. Default 3. */
	drips?: number;
	/** How much paint each drip carries (longer runs). Default 1. */
	volume?: number;
	/** No drip runs past this, a share of the height from the top (the name's room). Default 0.84. */
	floor?: number;
	/** How much the paint glows; 0 for none. Default 0.55. */
	glow?: number;
	/** How rough the sprayed edge is; 0 for a clean edge. Default 0.6. */
	spray?: number;
	/** Grain over the ground and the paint; 0 for none. Default 0.12. */
	grain?: number;
	/** Seconds the finished drips hold before they fade and run again. Default 2.6. */
	hold?: number;
	/** Which drips (where, how big, when), so two cards differ. Default 0. */
	seed?: number;
	/** Plays the clock faster or slower; 0 for one still frame (every drip at full length). Default 1. */
	speed?: number;
}

/** The settings' defaults. */
export declare const DRIP_DEFAULTS: Required<Omit<PaintDripConfig, 'src'>>;

/** The body's widths are kept this far apart, heights. */
export declare const DEPTH_STEP: number;

/** One drip from pooling to drying: its head's depth, bead radius and speed at each step (1/60 s), and its body's width along its path. */
export interface DripRun {
	t0: number;
	duration: number;
	y: Float32Array;
	r: Float32Array;
	v: Float32Array;
	w: Float32Array;
	length: number;
}

/** Runs one drip: `paint` is its volume (about 0.5–1.6), `room` how far it can fall before it meets something (heights). */
export declare function dripRun(drip: { paint: number; room: number; t0?: number }): DripRun;

/** A drip's head at a time, seconds into the loop. */
export declare function dripAt(run: DripRun, t: number): { y: number; r: number; v: number; started: boolean; done: boolean };

/** A place paint drips from, in shares of the mark's box. */
export interface DripAnchor {
	x: number;
	y: number;
	room: number;
	open: boolean;
}

/** The places paint drips from, read off the mark's coverage (0–1, row by row): its lower edges, lower and gentler likelier. */
export declare function dripAnchors(alpha: ArrayLike<number>, w: number, h: number, count: number, seed: number): DripAnchor[];

/** Every drip's run for a mark, and the loop around them. */
export interface DripPlan {
	drips: { x: number; y: number; room: number; run: DripRun }[];
	cycle: number;
	settled: number;
}

/** Plans the drips: where each hangs (the box in heights), how much paint it carries, when it starts. */
export declare function dripPlan(anchors: DripAnchor[], at: { left: number; top: number; size: number }, config: PaintDripConfig): DripPlan;

/** Seconds into the loop, and the drips' opacity (they fade at its end). */
export declare function dripClock(plan: DripPlan, time: number): { t: number; fade: number };

/** A CSS `background` that stands in for the ground before the canvas draws. */
export declare function dripStill(config: PaintDripConfig): string;

/** Starts the paint running on an element (its first canvas, or one in its place). Returns a function that stops it. */
export declare function paintDrip(el: HTMLElement, config: PaintDripConfig): () => void;
