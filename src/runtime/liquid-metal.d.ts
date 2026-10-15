import type { PaletteName } from './palettes.js';

/** A metal by name. */
export type MetalName = 'chrome' | 'gold' | 'rose-gold' | 'copper' | 'black-chrome';

export interface LiquidMetalConfig {
	/** A word to make of metal. */
	text?: string;
	/** Its CSS font, without the size. Default: the page's, bold. */
	font?: string;
	/** An image (an SVG logo) to make of metal instead. */
	src?: string;
	/** Where the logo sits, each 0–1 from the top left. Default the right half. */
	area?: { x: number; y: number; width: number; height: number };
	/** How much of its area the logo fills: 1 fits it, less shrinks it about the area's middle. Default 1. */
	size?: number;
	/** The metal: a name, or a CSS hex colour (its colour face on). Default `chrome`. */
	tint?: MetalName | (string & {});
	/** The studio's colours, reflected in the metal: the sky, the horizon, the floor. Default a neutral studio. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`: it tints the studio. */
	palette?: PaletteName | (string & {});
	/** How wide its rounded edges are. Default 1. */
	bevel?: number;
	/** How thick the metal is: more settles sooner, with smaller ripples. Default 1. */
	viscosity?: number;
	/** How hard it pulls back into shape: more reforms sooner, with a quicker wobble. Default 1. */
	tension?: number;
	/** How hard the pointer pushes into it. Default 1. */
	ripple?: number;
	/** Whether it reacts to the pointer at all. Default true. */
	interactive?: boolean;
	/** The soft shadow under it; 0 for none. Default 1. */
	shadow?: number;
}

/** The logo's box (its area scaled by `size`, grown by a margin, kept on the canvas) in canvas pixels, and the logo's area as a share of the box. */
export function logoBox(
	area: { x: number; y: number; width: number; height: number },
	size: number,
	width: number,
	height: number,
): { left: number; top: number; width: number; height: number; shape: { x: number; y: number; width: number; height: number } };

/** Starts liquid metal in `el`'s canvas. Returns a function that stops it. */
export function liquidMetal(el: HTMLElement, config: LiquidMetalConfig): () => void;
