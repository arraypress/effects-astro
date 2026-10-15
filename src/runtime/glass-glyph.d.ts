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
	/** The light's colour, then the glass's tint. Default acid green, white. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** The ground. Default `#050505`. */
	background?: string;
	/** How hard the glass bends what is behind it at its edges. Default 1. */
	refraction?: number;
	/** How far in from the edge the bending reaches, a share of the height. Default 0.06. */
	thickness?: number;
	/** How much the glass magnifies what is behind its middle. Default 1.04. */
	zoom?: number;
	/** How far the colours part where it bends; 0 for none. Default 0.6. */
	aberration?: number;
	/** Frosted glass: how much what is behind is blurred, 0–1. Default 0. */
	frost?: number;
	/** How much the glass takes the tint colour, 0–1. Default 0.1. */
	tint?: number;
	/** The lit rim and the glint. Default 0.8. */
	highlight?: number;
	/** The soft glow just inside the edge. Default 0.5. */
	fresnel?: number;
	/** Where the light comes from, degrees (0 right, 90 top). Default 135. */
	lightAngle?: number;
	/** How strong the coloured light behind is. Default 1. */
	glow?: number;
	/** The patch of dots behind the light. Default true. */
	halftone?: boolean;
}

/** Starts glass in `el`'s canvas. Returns a function that stops it. */
export function glassGlyph(el: HTMLElement, config: GlassGlyphConfig): () => void;
