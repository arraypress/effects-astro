/** A running Canvas 2D effect. */
export interface Canvas2D {
	/** Scaled so units are CSS px. */
	ctx: CanvasRenderingContext2D;
	canvas: HTMLCanvasElement;
	/** The element's size, CSS px. */
	width: number;
	height: number;
	/** True with prefers-reduced-motion. */
	still: boolean;
}

/** Starts a Canvas 2D effect in `el`'s canvas: sized, looped while near the screen, still with reduced motion. */
export function createCanvas2D(
	el: HTMLElement,
	options: { draw(c: Canvas2D, now: number, dt: number): void; resize?(c: Canvas2D): void },
): { c: Canvas2D | null; stop(): void };

/** A repeating grey-noise tile. */
export function grainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null;

/** Lays grain over what has been drawn, and only there. */
export function grainOnto(c: Canvas2D, pattern: CanvasPattern | null, amount: number): void;
