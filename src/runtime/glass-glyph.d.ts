import type { PaletteName } from './palettes.js';

export interface GlassGlyphConfig {
	/** The character or word to make of glass. */
	text?: string;
	/** Its CSS font, without the size. Default: the page's, bold. */
	font?: string;
	/** An image (an SVG logo) to make of glass instead. */
	src?: string;
	/** Where the shape sits, each 0–1 from the top left. Default the right half. */
	area?: { x: number; y: number; width: number; height: number };
	/** Where the beams of light cross, each 0–1 from the top left. Default two fifths of the way into the shape's area, a little below its middle. */
	light?: { x: number; y: number };
	/** The light's colour, then the glass's tint. Default acid green, white. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** The ground. Default `#050505`. */
	background?: string;
	/** How hard the glass bends what is behind it, most of all across its bevels. Default 1. */
	refraction?: number;
	/** How wide the bevel round the edge is, a share of the height. Default 0.035. */
	thickness?: number;
	/** How much the glass magnifies what is behind it. Default 1.04. */
	zoom?: number;
	/** How far the colours part where it bends; 0 for none. Default 0.6. */
	aberration?: number;
	/** Frosted glass: how much more what is behind is blurred, 0–1. Default 0. */
	frost?: number;
	/** How much the glass takes the tint colour, 0–1. Default 0.1. */
	tint?: number;
	/** The lit rims and the glints. Default 0.8. */
	highlight?: number;
	/** How much the bevels mirror the light. Default 0.5. */
	fresnel?: number;
	/** Where the light on the rims comes from, degrees (0 right, 90 top). Default 135. */
	lightAngle?: number;
	/** How strong the coloured light behind is. Default 1. */
	glow?: number;
	/** Dither the light's fading edges into dots. Default true. */
	halftone?: boolean;
	/** How far the slab turns on its own and away from the pointer; 0 holds it still. Default 1. */
	sway?: number;
}

/** Starts glass in `el`'s canvas. Returns a function that stops it. */
export function glassGlyph(el: HTMLElement, config: GlassGlyphConfig): () => void;
