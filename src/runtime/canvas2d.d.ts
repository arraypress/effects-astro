/** A running Canvas 2D effect. */
export interface Canvas2D {
	/** Scaled so units are CSS px. */
	ctx: CanvasRenderingContext2D;
	canvas: HTMLCanvasElement;
	/** The element's size, CSS px. */
	width: number;
	height: number;
	/** The canvas's pixels per CSS px (the device's, up to 2). */
	dpr: number;
	/** True with prefers-reduced-motion. */
	still: boolean;
}

/**
 * The element's canvas, ready for 2D drawing: its first canvas, or a fresh one in its place (with its attributes)
 * when that one is already claimed for WebGL, or a fresh one added when it has none. `release` puts the element's
 * own canvas back (or takes the added one out).
 */
export function claimCanvas(el: HTMLElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null; release(): void };

/** Starts a Canvas 2D effect in `el`'s canvas (or one in its place: see claimCanvas): sized, looped while near the screen, still with reduced motion. */
export function createCanvas2D(
	el: HTMLElement,
	options: { draw(c: Canvas2D, now: number, dt: number): void; resize?(c: Canvas2D): void },
): { c: Canvas2D | null; stop(): void };

/** A repeating grey-noise tile. */
export function grainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null;

/** Lays grain over what has been drawn, and only there; with `shimmer`, shifted each call so it moves like film. */
export function grainOnto(c: Canvas2D, pattern: CanvasPattern | null, amount: number, shimmer?: boolean): void;
