/** A colour as hex and alpha. */
export interface HexColor {
	/** `#rrggbb`. */
	hex: string;
	/** Alpha, 0–1. */
	a: number;
}

/** A pixel (each channel 0–255) as hex and alpha, un-premultiplied; null for a clear pixel. */
export function pixelColor(r: number, g: number, b: number, a: number): HexColor | null;

/** Any CSS colour (`rgb()`, `color()`, `oklab()`, a `color-mix()` result) as hex and alpha, read back from a pixel; null for none or anything fully clear. */
export function cssColor(v: string): HexColor | null;

/** A font's ascent and descent at a size (a CSS `font` shorthand), CSS px, as the browser lays a line's content box. */
export function fontMetrics(font: string): { asc: number; desc: number };
