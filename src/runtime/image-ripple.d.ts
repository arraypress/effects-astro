export interface ImageRippleConfig {
	/** The photo's URL (same origin, or served with CORS). */
	src: string;
	/** How far the ripples bend the photo, 0–3. Default 1. */
	strength?: number;
	/** How wide the ripples the pointer makes are, 0.3–3. Default 1. */
	size?: number;
	/** How thick the water is: more settles sooner, with smaller ripples, 0.25–4. Default 1. */
	viscosity?: number;
	/** How far the colours part at the wave fronts, 0–3; 0 for none. Default 1. */
	fringe?: number;
	/** Whether the pointer ripples it; false leaves the plain photo. Default true. */
	interactive?: boolean;
	/** How the photo fills the element, as CSS `object-fit`. Default `cover`. */
	fit?: 'cover' | 'contain';
}

/** The texture-coordinate scale that fits a picture to a box like CSS `object-fit` (`cover` or `contain`), for `coverUv`. */
export function fitScale(fit: 'cover' | 'contain' | string | undefined, imageAspect: number, boxAspect: number): [number, number];

/** How the water moves for a viscosity, and how long (ms) its waves take to settle. */
export function waterMotion(viscosity: number): { motion: import('./height-field.js').WaveMotion; settle: number };

/** Starts the ripples in `el`'s canvas, over the photo under it. Returns a function that stops it. */
export function imageRipple(el: HTMLElement, config: ImageRippleConfig): () => void;
