/**
 * @module @arraypress/effects-astro/hash-noise
 *
 * Hashing and noise that the GPU and JavaScript compute alike, so an
 * effect's shader and its JS twin (a text still, a test, a frame worked
 * out on the CPU) agree: Dave Hoskins' Hash without Sine, which brings its
 * input under 1 before it multiplies (32-bit and 64-bit floats then stay in
 * step), gradient noise with a quintic fade on it, and the warped
 * five-octave field the friend's sketches share (ASCII noise, the dither
 * field). Each comes as GLSL (ES 1.00) and as a JS function of the same
 * name.
 *
 * Hash without Sine is MIT, © 2014 David Hoskins
 * (https://www.shadertoy.com/view/4djSRW).
 */

/**
 * The fractional part.
 *
 * @param {number} n A number.
 * @returns {number} `n − floor(n)`, 0–1.
 */
const fract = (n) => n - Math.floor(n);

/** GLSL: `vec3 hash33(vec3 p3)`, three values 0–1 from three inputs. */
export const GLSL_HASH33 = `
vec3 hash33(vec3 p3) {
	p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
	p3 += dot(p3, p3.yxz + 33.33);
	return fract((p3.xxy + p3.yxx) * p3.zyx);
}
`;

/**
 * Hash without Sine, three in and three out (the shader's `hash33`).
 *
 * @param {number} x The first input.
 * @param {number} y The second.
 * @param {number} z The third.
 * @returns {[number, number, number]} Three values, each 0–1.
 */
export function hash33(x, y, z) {
	let a = fract(x * 0.1031);
	let b = fract(y * 0.103);
	let c = fract(z * 0.0973);
	const d = a * (b + 33.33) + b * (a + 33.33) + c * (c + 33.33);
	a += d;
	b += d;
	c += d;
	return [fract((a + b) * c), fract((a + a) * b), fract((b + a) * a)];
}

/**
 * GLSL: `vec2 grad(vec2 p)`, a lattice point's gradient (Hash without
 * Sine, −1 to 1), and `float gnoise(vec2 p)`, gradient noise with a
 * quintic fade, 0–1.
 */
export const GLSL_GRADIENT_NOISE = `
vec2 grad(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
	p3 += dot(p3, p3.yzx + 33.33);
	return -1.0 + 2.0 * fract((p3.xx + p3.yz) * p3.zy);
}
float gnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = p - i;
	vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
	float a = dot(grad(i), f);
	float b = dot(grad(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
	float c = dot(grad(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
	float d = dot(grad(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
	return 0.5 + 0.5 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
`;

/**
 * A lattice point's gradient (the shader's `grad`).
 *
 * @param {number} x The point's x.
 * @param {number} y The point's y.
 * @returns {[number, number]} A gradient, each part −1 to 1.
 */
export function grad(x, y) {
	let a = fract(x * 0.1031);
	let b = fract(y * 0.103);
	let c = fract(x * 0.0973);
	const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
	a += d;
	b += d;
	c += d;
	return [-1 + 2 * fract((a + b) * c), -1 + 2 * fract((a + c) * b)];
}

/**
 * Gradient noise with a quintic fade (the shader's `gnoise`).
 *
 * @param {number} x Where, x.
 * @param {number} y Where, y.
 * @returns {number} 0–1.
 */
export function gnoise(x, y) {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const fx = x - ix;
	const fy = y - iy;
	const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
	const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
	/**
	 * A corner's gradient dotted with the offset to it.
	 *
	 * @param {[number, number]} g The gradient.
	 * @param {number} dx Offset x.
	 * @param {number} dy Offset y.
	 * @returns {number} The dot product.
	 */
	const dot = (g, dx, dy) => g[0] * dx + g[1] * dy;
	const a = dot(grad(ix, iy), fx, fy);
	const b = dot(grad(ix + 1, iy), fx - 1, fy);
	const c = dot(grad(ix, iy + 1), fx, fy - 1);
	const d = dot(grad(ix + 1, iy + 1), fx - 1, fy - 1);
	const ab = a + (b - a) * ux;
	const cd = c + (d - c) * ux;
	return 0.5 + 0.5 * (ab + (cd - ab) * uy);
}

/**
 * GLSL: `float noiseField(vec2 p, float evo, float wt)`, five octaves of
 * gradient noise each warped by the sum so far, 0–1. Needs
 * GLSL_GRADIENT_NOISE before it.
 */
export const GLSL_NOISE_FIELD = `
float noiseField(vec2 p, float evo, float wt) {
	float warp = gnoise(p + wt * 0.04);
	float v = 0.0;
	float amp = 0.5;
	float freq = 1.0;
	for (int i = 0; i < 5; i++) {
		v += amp * gnoise(p * freq + vec2(warp * 0.3, warp * 0.25) + evo * 0.06);
		amp *= 0.5;
		freq *= 2.07;
		warp = v;
	}
	return v;
}
`;

/**
 * The warped field (the shader's `noiseField`): five octaves of gradient
 * noise, each warped by the sum so far.
 *
 * @param {number} x Where, x.
 * @param {number} y Where, y.
 * @param {number} evo The morphing clock.
 * @param {number} wt The warp's clock (seconds).
 * @returns {number} 0–1, near 0.5 on average.
 */
export function noiseField(x, y, evo, wt) {
	let warp = gnoise(x + wt * 0.04, y + wt * 0.04);
	let v = 0;
	let amp = 0.5;
	let freq = 1;
	for (let i = 0; i < 5; i++) {
		v += amp * gnoise(x * freq + warp * 0.3 + evo * 0.06, y * freq + warp * 0.25 + evo * 0.06);
		amp *= 0.5;
		freq *= 2.07;
		warp = v;
	}
	return v;
}
