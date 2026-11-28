export interface GlassPlatesConfig {
	/** An image (an SVG logo) to cut the plates from. */
	src?: string;
	/** A character or word instead of an image. */
	text?: string;
	/** Its CSS font, without the size. */
	font?: string;
	/** Where the stack sits, each 0–1 from the top left. Default all of the element. */
	area?: { x: number; y: number; width: number; height: number };
	/** The logo's box, a share of the area's shorter side. Default 0.7. */
	logoScale?: number;
	/** The plates' tints, back to front (blended between). Default pale blues. */
	colors?: string[];
	/** The colour of the glass seen through its edge. Default `#5FD6B8`. */
	edge?: string;
	/** How many plates, 2–4. Default 3. */
	plates?: number;
	/** The step between plates, a share of the box. Default 0.07. */
	spread?: number;
	/** How thick each plate's edge shows, a share of the box. Default 0.045. */
	thickness?: number;
	/** How wide each face's bevel is, a share of the box. Default 0.035. */
	bevel?: number;
	/** How deep the tints are (they deepen where plates overlap). Default 0.6. */
	density?: number;
	/** How hard a face bends the photo, in heights. Default 0.022. */
	bend?: number;
	/** How far the colours part where it bends, 0–1. Default 0.35. */
	dispersion?: number;
	/** The streak of reflected light across each face, 0–2. Default 1. */
	streak?: number;
	/** The stack's shadow on the photo, 0–2. Default 0.6. */
	shadow?: number;
	/** A photo behind (same origin), covering the element. */
	backdrop?: string;
	/** How bright the photo shows, 0–1. Default 0.75. */
	dim?: number;
	/** How soft the photo is round the plates (a mip bias, 0–5); through them it is sharp. Default 2. */
	soften?: number;
	/** The ground without a photo. Default `#0b0b0b`. */
	background?: string;
	/** The studio light. Default `#ffffff`. */
	light?: string;
	/** Where the light comes from, degrees (0 right, 90 top). Default 120. */
	lightAngle?: number;
	/** How much the plates and the light drift, 0–2; 0 holds them. Default 1. */
	drift?: number;
	/** Slide the plates apart when it first shows. Default true. */
	intro?: boolean;
	/** Seconds the plates take to slide apart. Default 1.4. */
	introDuration?: number;
	/** Seconds before it starts. Default 0. */
	delay?: number;
}

/** The plates' tints, back to front, blended in Oklab (RGB 0–1). */
export declare function plateTints(colors: string[], plates: number): Array<[number, number, number]>;

/** Where plate `k` of `n` sits: its offset from the stack's middle, a share of the box (x right, y down). */
export declare function plateOffset(k: number, n: number, spread: number): { x: number; y: number };

/** Starts the glass plates on an element (its first canvas). Returns a function that stops it. */
export declare function glassPlates(el: HTMLElement, config: GlassPlatesConfig): () => void;
