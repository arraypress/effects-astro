export interface GlassStackConfig {
	/** An image (an SVG logo) to make the stack of. */
	src?: string;
	/** A character or word instead of an image. */
	text?: string;
	/** Its CSS font, without the size. Default: the page's, bold. */
	font?: string;
	/** Where the stack sits, each 0–1 from the top left. Default all of the element. */
	area?: { x: number; y: number; width: number; height: number };
	/** The logo's size, a share of the area's shorter side, 0.2–1. Default 0.73. */
	logoScale?: number;
	/** The glass's tints from the top slice to the bottom, 2–6 colours. Default aqua to deep blue. */
	colors?: string[];
	/** The ground. Default `#ffffff`. */
	background?: string;
	/** The lit card behind the stack, and the studio the glass mirrors. Default `#ffffff`. */
	light?: string;
	/** How many slices the logo is cut into, 4–64. Default 22. */
	slabs?: number;
	/** Where in its slice each disc samples the logo, 0 the top to 1 the bottom. Default 0.5. */
	phase?: number;
	/** How much of its slice each disc samples, 0 a line to 1 all of it; more keeps small parts. Default 0.35. */
	band?: number;
	/** How open each disc is from below (the camera's height), a share of the slice, 0.05–1.4. Default 0.55. */
	depth?: number;
	/** How much of each disc's front edge shows, a share of the slice, 0–1. Default 0.35. */
	thickness?: number;
	/** The glass's refractive index: how hard its rims bend the card, 1–2. Default 1.45. */
	ior?: number;
	/** How strongly the glass mirrors the studio, 0–1. Default 0.3. */
	reflectivity?: number;
	/** How deeply the glass is tinted, 0–3. Default 0.9. */
	density?: number;
	/** How much the discs hide the discs behind them, 0–1. Default 0.92. */
	opacity?: number;
	/** The card's brightness, 0–2. Default 1.1. */
	exposure?: number;
	/** How far the card's light spills onto the ground, 0–1. Default 0.05. */
	ambient?: number;
	/** The card's size, times the logo's box, 0 for none to 3. Default 1.15. */
	cardSize?: number;
	/** Where the light comes from, degrees, 0–360 (0 right, 90 top). Default 115. */
	lightAngle?: number;
	/** How far the stack leans toward the pointer, 0–2; 0 for not at all. Default 1. */
	tilt?: number;
	/** How far it leans on its own, slowly, 0–2; 0 holds it still. Default 0.5. */
	sway?: number;
	/** Grow the discs from the bottom up when it first shows. Default true. */
	intro?: boolean;
	/** Seconds until the top disc has grown, 0.2–6. Default 1.6. */
	introDuration?: number;
	/** Seconds before the intro starts, 0–10. Default 0. */
	delay?: number;
	/** How fast the intro plays, 0.25–3. Default 1. */
	speed?: number;
	/** A photo behind the stack (same origin), covering the element; each disc then refracts it as a thick lens. */
	backdrop?: string;
	/** How bright the backdrop shows, 0–1. Default 0.78. */
	dim?: number;
	/** With a backdrop: how far the colours part where the discs bend it, 0–1. Default 0.35. */
	dispersion?: number;
}

/** The tint of each slice: the colours as a gradient from the top slice to the bottom one, blended in Oklab (RGB 0–1). */
export declare function sliceTints(colors: string[], slices: number): Array<[number, number, number]>;

/** Where the stack sits in an element (`aspect`, its width over its height): its middle (0–1 from the top left) and its square box's edge, a share of the height. */
export declare function stackLayout(config: Pick<GlassStackConfig, 'area' | 'logoScale'>, aspect: number): { centre: { x: number; y: number }; edge: number };

/** Starts the glass stack on an element (its first canvas). Returns a function that stops it. */
export declare function glassStack(el: HTMLElement, config: GlassStackConfig): () => void;
