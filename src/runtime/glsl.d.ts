/** GLSL: `hash`, `noise` and `fbm` over vec2, each 0–1. */
export const GLSL_NOISE: string;

/** GLSL: `uniform vec3 uPal[3]` and `vec3 pal(float t)`, a palette looped in Oklab. Includes GLSL_OKLAB. */
export const GLSL_PALETTE: string;

/** GLSL: `uniform vec4 uQuiet` and `float quietOpen(vec2 uv)`, 0 at a quiet area's centre, 1 outside it. */
export const GLSL_QUIET: string;

/** Three hex colours in Oklab, nine channels, for `uPal`. */
export function paletteUniform(colors: string[]): Float32Array;

/** A quiet area for `uQuiet`: centre (centred uv), radius, depth; zeros for none. */
export function quietUniform(
	quiet: { x?: number; y?: number; radius?: number; depth?: number } | null | undefined,
	aspect: number,
): [number, number, number, number];
