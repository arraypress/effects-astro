/** A bright point in a picture. */
export interface Light {
	/** Across the picture, 0–1 from the left. */
	x: number;
	/** Down the picture, 0–1 from the top. */
	y: number;
	/** How bright, 0–1. */
	level: number;
	/** Its colour around it, each channel 0–1, the brightest 1. */
	rgb: [number, number, number];
}

/** The brightest local peaks in RGBA pixels, brightest first, at most `count` (28), over `threshold` (0.6), `spacing` (10) pixels apart. */
export function findLights(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	options?: { count?: number; threshold?: number; spacing?: number },
): Light[];

/** A small, blurred copy of a photo with bokeh discs over its lights (`colors` for them, or each light's own). Throws without a 2D canvas. */
export function backdrop(img: CanvasImageSource & { width: number; height: number }, options: { blur: number; bokeh: number; colors: string[] }): HTMLCanvasElement;
