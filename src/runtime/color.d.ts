/** An RGB colour, each channel 0–1, in sRGB (as CSS writes it). */
export type Rgb = [number, number, number];

/** Reads `#rgb` or `#rrggbb` (the `#` optional). Throws a TypeError for anything else. */
export function parseColor(hex: string): Rgb;

/** Writes a colour as `#rrggbb`, clamping each channel to 0–1. */
export function toHex(rgb: Rgb): string;

/** sRGB to Oklab: L, a, b. */
export function toOklab(rgb: Rgb): [number, number, number];

/** Oklab back to sRGB, out-of-gamut channels clamped. */
export function fromOklab(lab: [number, number, number]): Rgb;

/** Blends two colours in Oklab; `t` 0 is `from`, 1 is `to`. */
export function mixOklab(from: Rgb, to: Rgb, t: number): Rgb;

/**
 * A point on a palette looped through its colours and back to the first,
 * eased and blended in Oklab. `t` wraps. Throws a RangeError for an empty palette.
 */
export function paletteAt(colors: Rgb[], t: number): Rgb;

/** GLSL (ES 1.00) defining `vec3 oklabMix(vec3 a, vec3 b, float t)`, sRGB in and out. */
export const GLSL_OKLAB: string;
