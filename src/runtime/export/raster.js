/**
 * @module @arraypress/effects-astro/export/raster
 *
 * Pictures out of SVG: an SVG (as text or by URL) drawn to a canvas at any
 * size, and a canvas as a PNG or JPEG. SVG text is loaded as a `data:`
 * URL, never a `blob:` one, so a page whose Content Security Policy
 * allows `img-src data:` (and not `blob:`) can use it.
 */

/**
 * An SVG document's text as a `data:` URL.
 *
 * @param {string} svg The document.
 * @returns {string} Its `data:` URL.
 */
export const svgDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/**
 * Loads a picture and waits until it can be drawn.
 *
 * @param {string} src Its URL (a `data:` URL, or same-origin).
 * @param {number} [settle] Milliseconds more to wait after it decodes. An SVG's own web fonts load after its first paint (its words are blank until then), so an SVG that carries fonts wants a moment the first time; a font it has loaded once is kept for the page. Default 0.
 * @returns {Promise<HTMLImageElement>} The picture, decoded.
 */
export async function decodeImage(src, settle = 0) {
	const img = new Image();
	img.decoding = 'sync';
	img.src = src;
	await img.decode();
	if (settle) await new Promise((r) => setTimeout(r, settle));
	return img;
}

/**
 * Draws an SVG onto a canvas, filling it.
 *
 * @template {HTMLCanvasElement | OffscreenCanvas} C
 * @param {string} svg The SVG document's text, or a URL to it.
 * @param {number} width Pixels.
 * @param {number} height Pixels.
 * @param {C} [canvas] A canvas to draw on (cleared first; its size is set to `width` × `height`). Default a new one.
 * @param {number} [settle] Milliseconds to wait after it decodes (see `decodeImage`). Default 250.
 * @returns {Promise<C>} The canvas.
 */
export async function drawSvg(svg, width, height, canvas = /** @type {C} */ (document.createElement('canvas')), settle = 250) {
	const img = await decodeImage(svg.trimStart().startsWith('<') ? svgDataUrl(svg) : svg, settle);
	if (canvas.width !== width) canvas.width = width;
	if (canvas.height !== height) canvas.height = height;
	const ctx = /** @type {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));
	ctx.clearRect(0, 0, width, height);
	ctx.drawImage(img, 0, 0, width, height);
	return canvas;
}

/**
 * A canvas as an image file.
 *
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas The canvas.
 * @param {string} [type] Its media type: `image/png`, or `image/jpeg` or `image/webp` at a quality. Default `image/png`.
 * @param {number} [quality] For JPEG and WebP, 0–1. Default the browser's.
 * @returns {Promise<Blob>} The file.
 * @throws {Error} When the browser cannot encode it.
 */
export function imageOf(canvas, type = 'image/png', quality) {
	if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
	return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`export: ${type} failed`))), type, quality));
}

/**
 * A canvas as a PNG.
 *
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas The canvas.
 * @returns {Promise<Blob>} The PNG.
 */
export const pngOf = (canvas) => imageOf(canvas);

/**
 * An SVG drawn to an image file's bytes, on a canvas of its own: a PNG,
 * or a JPEG (or WebP) at a quality.
 *
 * @param {string} svg The SVG document's text, or a URL to it.
 * @param {{ width: number, height: number, settle?: number }} size Pixels, and milliseconds to wait after it decodes for its fonts (see `decodeImage`; default 0).
 * @param {string} [type] The file's media type. Default `image/png`.
 * @param {number} [quality] For JPEG and WebP, 0–1. Default the browser's.
 * @returns {Promise<Uint8Array>} The file's bytes.
 */
export async function rasterize(svg, { width, height, settle = 0 }, type = 'image/png', quality) {
	const canvas = await drawSvg(svg, width, height, document.createElement('canvas'), settle);
	const blob = await imageOf(canvas, type, quality);
	return new Uint8Array(await blob.arrayBuffer());
}
