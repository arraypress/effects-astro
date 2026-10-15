/**
 * @module @arraypress/effects-astro/blur
 *
 * A Gaussian-like blur for small pictures on the CPU: three box blurs
 * across and three down, each a running sum, so its cost does not grow
 * with the radius. For a soft copy of a photo made once at load, where a
 * GPU pass would be more code than it saves.
 */

/**
 * Box-blurs one line of RGBA pixels into another, with a running sum,
 * repeating the edge pixels past the ends.
 *
 * @param {Float32Array} from The pixels read.
 * @param {Float32Array} to The pixels written.
 * @param {number} start Index of the line's first pixel (in pixels).
 * @param {number} stride Pixels from one pixel of the line to the next.
 * @param {number} length Pixels in the line.
 * @param {number} radius Pixels each side averaged in.
 */
function blurLine(from, to, start, stride, length, radius) {
	const span = radius * 2 + 1;
	const last = length - 1;
	const step = stride * 4;
	for (let c = 0; c < 4; c++) {
		const o = start * 4 + c;
		let sum = from[o] * (radius + 1);
		for (let i = 1; i <= radius; i++) sum += from[o + Math.min(i, last) * step];
		for (let i = 0; i < length; i++) {
			to[o + i * step] = sum / span;
			sum += from[o + Math.min(i + radius + 1, last) * step] - from[o + Math.max(i - radius, 0) * step];
		}
	}
}

/**
 * Blurs RGBA pixels in place: three box blurs each way, close to a
 * Gaussian with a standard deviation of about `radius`.
 *
 * @param {Uint8ClampedArray} data The pixels, RGBA, row by row (an ImageData's `data`).
 * @param {number} width Pixels across.
 * @param {number} height Pixels down.
 * @param {number} radius Pixels each side; 0 or less leaves them as they are.
 */
export function boxBlur(data, width, height, radius) {
	const r = Math.round(radius);
	if (r < 1) return;
	// In floats: rounding to bytes between passes is slow and would drift.
	const work = Float32Array.from(data);
	const spare = new Float32Array(data.length);
	for (let pass = 0; pass < 3; pass++) {
		for (let y = 0; y < height; y++) blurLine(work, spare, y * width, 1, width, r);
		for (let x = 0; x < width; x++) blurLine(spare, work, x, width, height, r);
	}
	data.set(work);
}
