/**
 * @module @arraypress/effects-astro/export/probe
 *
 * What the browser alone can say about a value, read back from a 1 × 1
 * canvas: any CSS colour (`rgb()`, `color()`, `oklab()`, a `color-mix()`
 * result) as hex and alpha, and a font's ascent and descent. Each answer
 * is kept, so asking again costs nothing.
 */

/** The canvas the values are read from, made on first use. */
/** @type {CanvasRenderingContext2D | null} */
let probe = null;

/** @type {Map<string, { hex: string, a: number } | null>} */
const colors = new Map();

/** @type {Map<string, { asc: number, desc: number }>} */
const metrics = new Map();

/**
 * The 1 × 1 canvas's context.
 *
 * @returns {CanvasRenderingContext2D} The context.
 */
function context() {
	probe ??= /** @type {CanvasRenderingContext2D} */ (Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true }));
	return probe;
}

/**
 * A pixel as hex and alpha, un-premultiplied (exact for an opaque colour,
 * which is nearly all of them; approximate at low alpha).
 *
 * @param {number} r Red, 0–255.
 * @param {number} g Green, 0–255.
 * @param {number} b Blue, 0–255.
 * @param {number} a Alpha, 0–255.
 * @returns {{ hex: string, a: number } | null} `#rrggbb` and alpha 0–1, or null for a clear pixel.
 */
export function pixelColor(r, g, b, a) {
	if (!a) return null;
	/**
	 * A channel as two hex digits.
	 *
	 * @param {number} x The channel, 0–255.
	 * @returns {string} Its digits.
	 */
	const hex = (x) => x.toString(16).padStart(2, '0');
	if (a === 255) return { hex: `#${[r, g, b].map(hex).join('')}`, a: 1 };
	return { hex: `#${[r, g, b].map((x) => hex(Math.round(x * (255 / a)))).join('').slice(0, 6)}`, a: a / 255 };
}

/**
 * Any CSS colour as hex and alpha.
 *
 * @param {string} v The colour, as a computed style gives it.
 * @returns {{ hex: string, a: number } | null} `#rrggbb` and alpha 0–1, or null for none, `transparent` or anything fully clear.
 */
export function cssColor(v) {
	if (!v || v === 'none' || v === 'transparent') return null;
	if (colors.has(v)) return /** @type {{ hex: string, a: number } | null} */ (colors.get(v));
	const ctx = context();
	ctx.clearRect(0, 0, 1, 1);
	ctx.fillStyle = '#000';
	ctx.fillStyle = v;
	ctx.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
	const out = pixelColor(r, g, b, a);
	colors.set(v, out);
	return out;
}

/**
 * A font's ascent and descent at a size, as the browser lays a line's
 * content box.
 *
 * @param {string} font A CSS `font` shorthand (style, weight, size and family).
 * @returns {{ asc: number, desc: number }} Ascent and descent, CSS px.
 */
export function fontMetrics(font) {
	const known = metrics.get(font);
	if (known) return known;
	const ctx = context();
	ctx.font = font;
	const m = ctx.measureText('Hg');
	const out = { asc: m.fontBoundingBoxAscent, desc: m.fontBoundingBoxDescent };
	metrics.set(font, out);
	return out;
}
