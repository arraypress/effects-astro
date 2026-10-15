/** What a shape is drawn from: a word in a font, or an image. */
export interface ShapeSource {
	/** A word or short line to draw. */
	text?: string;
	/** The CSS font for `text`, without the size. Default: the page's body font, bold. */
	font?: string;
	/** An image URL (an SVG logo, a PNG) to draw instead of text. */
	src?: string;
	/** Space around the shape, a share of its area. Default 0.08. */
	padding?: number;
	/** Where in the canvas the shape goes, each 0–1 from the top left. Default all of it. */
	area?: { x: number; y: number; width: number; height: number };
}

/** A shape drawn white on transparent, and its coverage a byte a pixel. */
export interface Mask {
	canvas: HTMLCanvasElement;
	alpha: Uint8ClampedArray;
	width: number;
	height: number;
}

/** A CSS font at a size, style and weight words first: `fontAt('900 Anton, sans-serif', 120)` is `900 120px Anton, sans-serif`. */
export function fontAt(font: string, size: number): string;

/** Draws a shape into a mask, fitted with its aspect kept. Rejects when an image cannot be loaded. */
export function drawShape(source: ShapeSource, width: number, height: number): Promise<Mask>;

/** `count` points scattered evenly over a shape: x, y pairs, 0–1, y up. */
export function samplePoints(mask: Mask, count: number, random?: () => number): Float32Array;

/** `count` points scattered along a shape's edge (covered pixels beside uncovered ones): x, y pairs, 0–1, y up. */
export function edgePoints(mask: Mask, count: number, random?: () => number): Float32Array;

/** Points on a grid `columns` across, wherever a cell's centre is inside the shape: x, y pairs, 0–1, y up. */
export function gridPoints(mask: Mask, columns: number): Float32Array;

/** A signed distance field, a byte a pixel: 0.5 at the edge, 1 `spread` px inside, 0 `spread` px outside. */
export function distanceField(mask: Mask, spread?: number): Uint8Array;

/** Softens a one-byte field (rows from the top) with a near-gaussian blur of `radius` px; the input is left unchanged. */
export function blurField(field: Uint8Array, width: number, height: number, radius: number): Uint8Array;
