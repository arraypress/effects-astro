/**
 * @module @arraypress/effects-astro/rain-on-glass/backdrop
 *
 * The photo as it looks through fogged glass, made once at load: a small
 * blurred copy, with the photo's brightest lights opened out into bokeh
 * discs the way a lens out of focus draws them.
 */

import { boxBlur } from '../blur.js';
import { parseColor } from '../color.js';

/** Pixels across the copy the lights are found in, the copy that is blurred, and the copy the discs are drawn on. */
const FIND = 256;
const BLUR = 128;
const LARGE = 640;

/**
 * @typedef {object} Light
 * @property {number} x Across the picture, 0–1 from the left.
 * @property {number} y Down the picture, 0–1 from the top.
 * @property {number} level How bright, 0–1.
 * @property {[number, number, number]} rgb Its colour around it, each 0–1, brightest channel 1.
 */

/**
 * Finds the brightest points in a picture: local peaks over `threshold`,
 * brightest first, none closer than `spacing` to a brighter one.
 *
 * @param {Uint8ClampedArray} data The pixels, RGBA, row by row.
 * @param {number} width Pixels across.
 * @param {number} height Pixels down.
 * @param {{ count?: number, threshold?: number, spacing?: number }} [options] At most `count` (default 22),
 *   at least `threshold` bright (0–1, default 0.6), at least `spacing` pixels apart (default 10).
 * @returns {Light[]} The lights.
 */
export function findLights(data, width, height, { count = 22, threshold = 0.6, spacing = 10 } = {}) {
	const level = new Float32Array(width * height);
	for (let i = 0; i < level.length; i++) {
		level[i] = (data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722) / 255;
	}
	/** @type {number[]} */
	const peaks = [];
	for (let y = 1; y < height - 1; y++) {
		for (let x = 1; x < width - 1; x++) {
			const i = y * width + x;
			const v = level[i];
			if (v < threshold) continue;
			let top = true;
			for (let dy = -1; dy <= 1 && top; dy++) for (let dx = -1; dx <= 1; dx++) if (level[i + dy * width + dx] > v) top = false;
			if (top) peaks.push(i);
		}
	}
	peaks.sort((a, b) => level[b] - level[a]);
	/** @type {Light[]} */
	const lights = [];
	for (const i of peaks) {
		if (lights.length >= count) break;
		const x = i % width;
		const y = (i - x) / width;
		if (lights.some((l) => Math.hypot(l.x * width - x, l.y * height - y) < spacing)) continue;
		lights.push({ x: x / width, y: y / height, level: level[i], rgb: around(data, width, height, x, y) });
	}
	return lights;
}

/**
 * The colour around a pixel, brightened until its strongest channel is
 * full and pushed away from grey: a light's own hue, which its blown-out
 * centre often loses.
 *
 * @param {Uint8ClampedArray} data The pixels, RGBA, row by row.
 * @param {number} width Pixels across.
 * @param {number} height Pixels down.
 * @param {number} x The pixel's column.
 * @param {number} y The pixel's row.
 * @returns {[number, number, number]} The colour, each channel 0–1.
 */
function around(data, width, height, x, y) {
	const sum = [0, 0, 0];
	for (let dy = -3; dy <= 3; dy++) {
		for (let dx = -3; dx <= 3; dx++) {
			const px = Math.min(width - 1, Math.max(0, x + dx));
			const py = Math.min(height - 1, Math.max(0, y + dy));
			for (let c = 0; c < 3; c++) sum[c] += data[(py * width + px) * 4 + c];
		}
	}
	const top = Math.max(1, ...sum);
	const rgb = sum.map((c) => c / top);
	const mean = (rgb[0] + rgb[1] + rgb[2]) / 3;
	const [r, g, b] = rgb.map((c) => Math.min(1, Math.max(0, mean + (c - mean) * 1.8)));
	return [r, g, b];
}

/**
 * A small, blurred copy of a photo with bokeh discs over its lights.
 *
 * @param {CanvasImageSource & { width: number, height: number }} img The photo.
 * @param {{ blur: number, bokeh: number, colors: string[] }} options `blur` and `bokeh` 0–1;
 *   `colors` for the discs (empty: each light's own colour).
 * @returns {HTMLCanvasElement} The copy, `LARGE` pixels across.
 * @throws {Error} When the browser gives no 2D canvas.
 */
export function backdrop(img, { blur, bokeh, colors }) {
	const aspect = img.width / img.height;
	// Scaled down once from the photo; the blurred copy is halved from that.
	const find = canvas(FIND, Math.max(1, Math.round(FIND / aspect)));
	const fc = context(find);
	fc.drawImage(img, 0, 0, find.width, find.height);
	const lights = bokeh > 0 ? findLights(fc.getImageData(0, 0, find.width, find.height).data, find.width, find.height) : [];
	const small = canvas(BLUR, Math.max(1, Math.round(BLUR / aspect)));
	const sc = context(small);
	sc.drawImage(find, 0, 0, small.width, small.height);
	const pixels = sc.getImageData(0, 0, small.width, small.height);
	boxBlur(pixels.data, small.width, small.height, 0.5 + blur * 3.5);
	sc.putImageData(pixels, 0, 0);

	const out = canvas(LARGE, Math.max(1, Math.round(LARGE / aspect)));
	const ctx = context(out);
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(small, 0, 0, out.width, out.height);
	ctx.globalCompositeOperation = 'screen';
	const tints = colors.map(parseColor);
	const size = out.width * (0.008 + blur * 0.022);
	lights.forEach((light, i) => {
		// A steady spread of sizes and strengths, the same on every load.
		const jitter = fract(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
		const r = size * (0.6 + jitter * 0.9);
		const [cr, cg, cb] = (tints.length ? tints[i % tints.length] : light.rgb).map((c) => Math.round(c * 255));
		const a = bokeh * (0.5 + 0.6 * light.level) * (1.1 - jitter * 0.4);
		/**
		 * The disc's colour at a share of its strength.
		 *
		 * @param {number} k The share, 0–1.
		 * @returns {string} A CSS colour.
		 */
		const tone = (k) => `rgb(${cr} ${cg} ${cb} / ${Math.min(1, a * k)})`;
		const x = light.x * out.width;
		const y = light.y * out.height;
		const disc = ctx.createRadialGradient(x, y, 0, x, y, r);
		disc.addColorStop(0, tone(0.4));
		disc.addColorStop(0.75, tone(0.55));
		disc.addColorStop(0.92, tone(0.95));
		disc.addColorStop(1, tone(0));
		ctx.fillStyle = disc;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	});
	return out;
}

/**
 * A detached canvas.
 *
 * @param {number} width Pixels across.
 * @param {number} height Pixels down.
 * @returns {HTMLCanvasElement} The canvas.
 */
function canvas(width, height) {
	const c = document.createElement('canvas');
	c.width = width;
	c.height = height;
	return c;
}

/**
 * A canvas's 2D context, read back often.
 *
 * @param {HTMLCanvasElement} c The canvas.
 * @returns {CanvasRenderingContext2D} Its context.
 * @throws {Error} When the browser gives none.
 */
function context(c) {
	const ctx = c.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('No 2D canvas');
	return ctx;
}

/**
 * The fractional part of a number.
 *
 * @param {number} n The number.
 * @returns {number} It, less its floor.
 */
const fract = (n) => n - Math.floor(n);
