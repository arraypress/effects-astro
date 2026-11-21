export interface PixelFountainConfig {
	/** The pixels' colour when they fire; the darker steps they fade through are made from it. With `source="pointer"`, the one ink every block is drawn in. Default `#c8ff00` (from the pointer, the text's colour, `currentColor`). */
	color?: string;
	/** The steps a pixel fades through, first to last (overrides `color`; from the pointer, only the first is used). Default made from `color`. */
	colors?: string[];
	/** A shared palette by name, its colours as the steps, when there are no `colors`. Default none. */
	palette?: string;
	/** A pixel's size, CSS px (a power-up's biggest blocks are two). Default 8. */
	cell?: number;
	/** How far above the edge the pixels can fly, CSS px (from the pointer: how far above the host the canvas reaches). Default 240 (160 from the pointer). */
	rise?: number;
	/** Pixels a second trickling up on their own, per 1,000 CSS px of edge; 0 for none (always none from the pointer). Default 14. */
	rate?: number;
	/** Pixels a click or tap fires. Default 40 (24 from the pointer). */
	burst?: number;
	/** From the pointer: blocks fired for every 100 CSS px it moves, at most 12 a move. Default 10. */
	trail?: number;
	/** Whether a mouse click fires a burst (a tap always does). Default true (false from the pointer). */
	press?: boolean;
	/** How hard they are pulled back, 0–2. Default 1. */
	gravity?: number;
	/** How widely they fan out, 0–1. Default 0.5. */
	spread?: number;
	/** How much a wind pushes them sideways, 0–1. Default 0.3. */
	drift?: number;
	/** The longest a pixel lives, seconds. Default 1.4 (0.9 from the pointer). */
	life?: number;
	/** The chance a pixel splits into smaller ones rather than shrinking, 0–1. Default 0.4 (0.2 from the pointer). */
	split?: number;
	/** The chance a pixel flickers out on and off before it goes, 0–1. Default 0.35 (0.5 from the pointer). */
	flicker?: number;
	/** Fire from the host's top edge; from the filled pixels of its text; or only from the pointer, where it moves over the host (a block-dust trail in one ink, nothing on its own). Default `edge`. */
	source?: 'edge' | 'text' | 'pointer';
	/** A selector for the element the pixels fire from and the pointer is followed over: the nearest ancestor that matches, else the first on the page. Default the element's positioned parent. */
	host?: string;
	/** Seeds the randomness. Default 1. */
	seed?: number;
}

/** One pixel of a fountain. */
export interface Pixel {
	/** Centre, CSS px from the canvas's left and top. */
	x: number;
	y: number;
	/** Velocity, CSS px/s (negative `vy` rises). */
	vx: number;
	vy: number;
	/** Seconds lived, and seconds it lives. */
	age: number;
	life: number;
	/** Its size: 0 a double block, 1 a block, 2 a half, 3 a quarter. */
	tier: number;
	/** The share of its life at which it next breaks down, and the share between breaks. */
	next: number;
	gap: number;
	/** A power-up's pixel: its first frames burn white. */
	hot: boolean;
	/** The share of life from which it flickers (over 1 for never). */
	flicker: number;
	/** Whether it shows this frame. */
	on: boolean;
	/** Steps until it next flickers. */
	blink: number;
	/** Its own sideways push, CSS px/s². */
	wobble: number;
}

/** What fired a pixel: the ambient trickle, the pointer moving over the edge or letters, or a press (a power-up); from the pointer, its trail and a tap. */
export type EmitKind = 'ambient' | 'move' | 'burst' | 'trail' | 'tap';

/** A fountain's settings: the canvas's size and the effect's physics. */
export interface FountainOptions {
	/** The canvas's size, CSS px. */
	width: number;
	height: number;
	/** Where the edge is, CSS px down the canvas. Default its bottom. */
	floor?: number;
	cell?: number;
	rise?: number;
	rate?: number;
	gravity?: number;
	spread?: number;
	drift?: number;
	life?: number;
	split?: number;
	flicker?: number;
	/** Blocks a pointer's move fires for every 100 CSS px it travels. Default 10. */
	trail?: number;
	seed?: number;
}

/** A seeded pool of pixels, stepped at a fixed rate: `pixels[0…count)` are alive. */
export interface Fountain {
	pixels: Pixel[];
	readonly count: number;
	/** Seconds stepped. */
	readonly time: number;
	resize(width: number, height: number, floor?: number): void;
	/** Points (x, y pairs, tops first) the ambient pixels fire from instead of the edge, as `inkedCells` gives them. */
	setOrigins(points: Float32Array | null, tops?: number): void;
	/** Fires `n` pixels from a point; returns how many the pool had room for. */
	emit(x: number, y: number, n: number, kind?: EmitKind): number;
	/** Fires `n` pixels from the origins within `radius` of a point (a press with none near fires from the point). */
	emitNear(x: number, y: number, n: number, kind?: EmitKind, radius?: number): number;
	/** Fires `n` pixels from the edge, from the cell under `x`. */
	emitEdge(x: number, n: number, kind?: EmitKind): number;
	/** Fires `n` pixels from where the ambient ones fire. */
	emitAmbient(n: number, kind?: EmitKind): number;
	/** The pointer moved to a point: fires `trail` blocks per 100 px travelled (at most `TRAIL_CAP`), spaced along the way it came and ending there; none on the first point after a lift or for no move. Returns how many fired. */
	moveTo(x: number, y: number): number;
	/** Forgets where the pointer was (it left, or lifted). */
	lift(): void;
	/** One step (default 1/60 s): the trickle, then every pixel ages, breaks down, moves and flickers. */
	step(dt?: number): void;
	/** Empties the pool. */
	clear(): void;
}

/** The most pixels alive at once (400). */
export const MAX_PIXELS: number;

/** The simulation's fixed step, seconds (1/60). */
export const STEP: number;

/** The most blocks one pointer move fires (12). */
export const TRAIL_CAP: number;

/** The settings that change with `source: 'pointer'`. */
export const POINTER_DEFAULTS: { rate: number; life: number; split: number; flicker: number; rise: number; burst: number; trail: number };

/** The steps a pixel fades through, made from one colour in Oklab: darker and less saturated each step, turning a little towards olive. */
export function fadeSteps(color: string, count?: number): string[];

/** The colour step for a share of a pixel's life (one step per equal share), or -1 for a power-up's hot first frames. */
export function shadeAt(t: number, count: number, hot?: boolean): number;

/** Each tier's size in whole device pixels: the double block's, the block's, the half's and the quarter's. */
export function tierSizes(cell: number, dpr: number): number[];

/** Where a pixel is drawn (device px): its centre snapped to the grid of its own size, columns from the left and rows up from the floor. Returns its left and top. */
export function pixelRect(x: number, y: number, size: number, floor: number): [number, number];

/** The grid cells a picture of text fills (centre and most of four points round it inked), rows up from `floor`: centres as x, y pairs, tops first, and how many are tops. */
export function inkedCells(rgba: Uint8ClampedArray, width: number, height: number, cell: number, floor?: number): { points: Float32Array; tops: number };

/** Makes a seeded fountain of pixels. */
export function createFountain(options: FountainOptions): Fountain;

/** Starts the pixel fountain on an element placed over its host's top edge (over the host and above it, from the text or the pointer). Returns a function that stops it. */
export function pixelFountain(el: HTMLElement, config: PixelFountainConfig): () => void;
