/**
 * @module @arraypress/effects-astro/bayer
 *
 * The 8×8 Bayer ordered-dither threshold, as GLSL and as a JS function of
 * the same values, built from the 2×2 matrix at three scales so neither
 * side needs a texture. Shared by DitherField and DitherGradient.
 */

/**
 * The fractional part.
 *
 * @param {number} n A number.
 * @returns {number} `n − floor(n)`, 0–1.
 */
const fract = (n) => n - Math.floor(n);

/** GLSL (ES 1.00): `float bayer8(vec2 cell)`, the threshold 0–63/64 at a dot (it repeats every 8 dots). */
export const GLSL_BAYER = `
float bayer2(vec2 a) { return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float bayer8(vec2 cell) {
	vec2 a = mod(floor(cell), 8.0);
	vec2 b = floor(a * 0.5);
	vec2 c = floor(a * 0.25);
	return bayer2(a) + bayer2(b) * 0.25 + bayer2(c) * 0.0625;
}
`;

/**
 * The 8×8 Bayer threshold at a dot (the shader's `bayer8`): the classic
 * ordered-dither matrix, 0/64 to 63/64.
 *
 * @param {number} x The dot's column (any integer; it repeats every 8).
 * @param {number} y The dot's row.
 * @returns {number} The threshold, 0–63/64.
 */
export function bayer(x, y) {
	/**
	 * The 2×2 matrix (0, 2 / 3, 1 over 4) by a cell's parity.
	 *
	 * @param {number} a Column.
	 * @param {number} b Row.
	 * @returns {number} 0, 0.25, 0.5 or 0.75.
	 */
	const two = (a, b) => fract(a * 0.5 + b * b * 0.75);
	const ax = ((Math.floor(x) % 8) + 8) % 8;
	const ay = ((Math.floor(y) % 8) + 8) % 8;
	return two(ax, ay) + two(Math.floor(ax / 2), Math.floor(ay / 2)) * 0.25 + two(Math.floor(ax / 4), Math.floor(ay / 4)) * 0.0625;
}
