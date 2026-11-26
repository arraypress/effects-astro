export interface GlassDropConfig {
	/** An image (an SVG logo) to make the glass of. */
	src?: string;
	/** A character or word instead of an image. */
	text?: string;
	/** Its CSS font, without the size. Default: the page's, bold. */
	font?: string;
	/** Where the glass sits, each 0–1 from the top left. Default all of the element. */
	area?: { x: number; y: number; width: number; height: number };
	/** What the drop becomes: `tile`, a glass tile with the logo under it, or `mark`, the logo's own shape in glass. Default `tile`. */
	form?: 'tile' | 'mark';
	/** The tile's edge, a share of the area's shorter side, 0.2–1. Default 0.7. */
	size?: number;
	/** The logo's size under the glass, a share of the tile, 0.2–1. Default 0.62. */
	markScale?: number;
	/** The logo's size once the glass has melted, times its size under the glass, 0.5–2. Default 1. */
	restScale?: number;
	/** The tile's corner radius, a share of its edge, 0–0.5. Default 0.24. */
	radius?: number;
	/** The ground. Default `#000000`. */
	background?: string;
	/** The logo's colour. Default `#ffffff`. */
	color?: string;
	/** The tile's surface under the logo. Default `#0a1020`. */
	plate?: string;
	/** The studio light the glass mirrors. Default `#ffffff`. */
	light?: string;
	/** How hard the glass bends what is under it, 0–2. Default 1. */
	depth?: number;
	/** How far the colours part at the rim, 0–2; 0 for none. Default 1. */
	dispersion?: number;
	/** How wide the rounded rim is, a share of the tile (or the logo), 0.02–0.3. Default 0.1. */
	bevel?: number;
	/** The lip and the studio's reflections, 0–2. Default 1. */
	highlights?: number;
	/** Light focused at the glass's edge and onto the ground, 0–2. Default 1. */
	caustics?: number;
	/** A soft glow round the glass, 0–1. Default 0.5. */
	bloom?: number;
	/** The rings the drop sends across the ground, 0–2; 0 for none. Default 1. */
	ripples?: number;
	/** With `form: 'mark'`: how strongly the glass takes the logo's colour, 0–1. Default 0.88. */
	tint?: number;
	/** Where the light comes from, degrees, 0–360 (0 right, 90 top). Default 125. */
	lightAngle?: number;
	/** How fast the sequence plays, 0.25–3. Default 1. */
	speed?: number;
	/** Seconds to wait before it starts, 0–10. Default 0. */
	delay?: number;
	/** Seconds the glass holds before it melts, 0–10. Default 2.4. */
	hold?: number;
	/** Play it again after a rest; each round starts from the resting logo, which fades as the new drop forms. Default false. */
	loop?: boolean;
	/** With `loop`: seconds the logo rests before the next drop, 0–10. Default 1.6. */
	loopDelay?: number;
	/** How it ends: `flat`, the glass melted and the logo left on the ground, or `glass`, the glass held. Default `flat`. */
	rest?: 'flat' | 'glass';
}

/** Starts the glass drop on an element (its first canvas). Returns a function that stops it. */
export declare function glassDrop(el: HTMLElement, config: GlassDropConfig): () => void;
