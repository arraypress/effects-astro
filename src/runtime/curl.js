/**
 * @module @arraypress/effects-astro/curl
 *
 * A flow field for particles stepped in JavaScript: the curl of smooth
 * noise, so it swirls without sources or sinks (nothing piles up or thins
 * out as it moves along it), changing slowly over time.
 *
 * The noise is value noise with its gradient worked out exactly alongside
 * it, so a sample of the flow costs two noise lookups, not the four or
 * more a finite difference would.
 */

/** Scratch for one noise sample: the value, then its gradient across and up. */
const sample = new Float64Array(3);

/**
 * Hashes a lattice point to a number 0–1, the same every time.
 *
 * @param {number} ix The point's column.
 * @param {number} iy The point's row.
 * @returns {number} 0 (inclusive) to 1 (exclusive).
 */
function hash(ix, iy) {
	let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1);
	h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Value noise at a point, with its gradient: smooth, 0–1, varying over a
 * lattice cell of 1.
 *
 * @param {number} x Across.
 * @param {number} y Up.
 * @param {Float64Array} [out] Where to write the value and gradient.
 * @returns {Float64Array} `[value, d/dx, d/dy]`.
 */
export function noiseGrad(x, y, out = new Float64Array(3)) {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const fx = x - ix;
	const fy = y - iy;
	const ux = fx * fx * (3 - 2 * fx);
	const uy = fy * fy * (3 - 2 * fy);
	const a = hash(ix, iy);
	const b = hash(ix + 1, iy);
	const c = hash(ix, iy + 1);
	const d = hash(ix + 1, iy + 1);
	const k1 = b - a;
	const k2 = c - a;
	const k3 = a - b - c + d;
	out[0] = a + k1 * ux + k2 * uy + k3 * ux * uy;
	out[1] = 6 * fx * (1 - fx) * (k1 + k3 * uy);
	out[2] = 6 * fy * (1 - fy) * (k2 + k3 * ux);
	return out;
}

/**
 * The flow at a point and time: the curl of two octaves of noise, each
 * drifting its own way, so the swirls change shape as well as move. Its
 * speed is mostly under 1, in units of the noise's cell a second.
 *
 * @param {number} x Across, in noise cells.
 * @param {number} y Up, in noise cells.
 * @param {number} t The time, seconds (scale it for a faster or slower field).
 * @param {Float64Array | number[]} [out] Where to write the flow.
 * @returns {Float64Array | number[]} `[across, up]`.
 */
export function curl(x, y, t, out = [0, 0]) {
	noiseGrad(x + t * 0.31, y - t * 0.17, sample);
	let dx = sample[1];
	let dy = sample[2];
	noiseGrad(x * 2.1 - t * 0.23 + 17.3, y * 2.1 + t * 0.29 + 5.1, sample);
	dx += sample[1] * 0.5 * 2.1;
	dy += sample[2] * 0.5 * 2.1;
	// The curl of a scalar field: its gradient turned a quarter.
	out[0] = dy * 0.5;
	out[1] = -dx * 0.5;
	return out;
}
