/**
 * @module @arraypress/effects-astro/glsl
 *
 * Shader pieces more than one effect uses, with the JavaScript that feeds
 * their uniforms: value noise, a three-colour palette looped in Oklab, and
 * a quiet area where an effect dims behind copy.
 */

import { GLSL_OKLAB, parseColor, toOklab } from './color.js';

/** GLSL: `hash(vec2)`, smooth value `noise(vec2)` and five-octave `fbm(vec2)`, each 0–1. */
export const GLSL_NOISE = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
	float v = 0.0, a = 0.5;
	mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
	for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
	return v;
}
`;

/**
 * GLSL: `uniform vec3 uPal[3]` (three colours in Oklab, from
 * `paletteUniform`) and `vec3 pal(float t)`, the palette looped through its
 * colours and back, eased, in sRGB. Includes GLSL_OKLAB.
 */
export const GLSL_PALETTE = `${GLSL_OKLAB}
uniform vec3 uPal[3];
vec3 pal(float t) {
	float x = fract(t) * 3.0;
	float k = smoothstep(0.0, 1.0, fract(x));
	vec3 lab = x < 1.0 ? mix(uPal[0], uPal[1], k) : x < 2.0 ? mix(uPal[1], uPal[2], k) : mix(uPal[2], uPal[0], k);
	return fromOklab(lab);
}
`;

/**
 * GLSL: `uniform vec4 uQuiet` (from `quietUniform`) and
 * `float quietOpen(vec2 uv)`: 0 at the quiet area's centre rising to 1 at
 * its edge and beyond, with `uv` centred and in units of the height. Dim by
 * `mix(1.0 - uQuiet.w, 1.0, quietOpen(uv))`.
 */
export const GLSL_QUIET = `
uniform vec4 uQuiet;
float quietOpen(vec2 uv) {
	return uQuiet.z > 0.0 ? smoothstep(uQuiet.z * 0.06, uQuiet.z, length(uv - uQuiet.xy)) : 1.0;
}
`;

/**
 * Three colours as `uPal` takes them: in Oklab, so the shader mixes there.
 * Fewer than three repeat; more are cut to three.
 *
 * @param {string[]} colors CSS hex colours.
 * @returns {Float32Array} Nine channels.
 */
export function paletteUniform(colors) {
	return new Float32Array([0, 1, 2].flatMap((i) => toOklab(parseColor(colors[i % colors.length]))));
}

/**
 * A quiet area as `uQuiet` takes it.
 *
 * @param {{ x?: number, y?: number, radius?: number, depth?: number } | null | undefined} quiet
 *   Centre x/y (0–1 from the top left, default the middle), radius (a share
 *   of the height, default 0.8) and depth (0–1, default 0.72); none for no area.
 * @param {number} aspect The target's width over height.
 * @returns {[number, number, number, number]} Centre (centred uv), radius, depth; all 0 for none.
 */
export function quietUniform(quiet, aspect) {
	if (!quiet) return [0, 0, 0, 0];
	return [((quiet.x ?? 0.5) - 0.5) * aspect, 0.5 - (quiet.y ?? 0.5), quiet.radius ?? 0.8, quiet.depth ?? 0.72];
}
