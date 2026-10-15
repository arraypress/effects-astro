/**
 * @module @arraypress/effects-astro/canvas2d
 *
 * The set-up every Canvas 2D effect shares (the GPU ones have stage.js):
 * the element's canvas kept its size at up to twice the pixel ratio,
 * frames from the page's one loop while it is near the screen, one still
 * frame with prefers-reduced-motion (redrawn on resize), and a grain tile
 * for texturing strokes.
 */

import { prefersReducedMotion } from './device.js';
import { animate } from './loop.js';

/**
 * @typedef {object} Canvas2D
 * @property {CanvasRenderingContext2D} ctx The context, scaled so units are CSS px.
 * @property {HTMLCanvasElement} canvas The canvas.
 * @property {number} width The element's width, CSS px.
 * @property {number} height The element's height, CSS px.
 * @property {boolean} still True with prefers-reduced-motion.
 */

/**
 * Starts a Canvas 2D effect on an element (its first canvas is drawn into).
 *
 * @param {HTMLElement} el The element.
 * @param {object} options The effect.
 * @param {(c: Canvas2D, now: number, dt: number) => void} options.draw Draws a frame (`now` ms, `dt` seconds).
 * @param {(c: Canvas2D) => void} [options.resize] After the canvas is resized.
 * @returns {{ c: Canvas2D | null, stop: () => void }} The canvas (null without a 2D context) and a function that stops it.
 */
export function createCanvas2D(el, options) {
	const canvas = el.querySelector('canvas');
	const ctx = canvas?.getContext('2d', { alpha: true });
	if (!canvas || !ctx) return { c: null, stop: () => {} };
	/** @type {Canvas2D} */
	const c = { ctx, canvas, width: 0, height: 0, still: prefersReducedMotion() };

	/** Sizes the canvas to the element. */
	const size = () => {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		c.width = Math.max(1, el.clientWidth);
		c.height = Math.max(1, el.clientHeight);
		canvas.width = Math.floor(c.width * dpr);
		canvas.height = Math.floor(c.height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		options.resize?.(c);
		if (c.still) options.draw(c, performance.now(), 0);
	};
	const resizer = new ResizeObserver(size);
	resizer.observe(el);
	size();
	const stopLoop = c.still ? () => {} : animate(el, (now, dt) => options.draw(c, now, dt));
	return {
		c,
		stop: () => {
			stopLoop();
			resizer.disconnect();
		},
	};
}

/**
 * A repeating tile of grey noise, for laying grain over what has been drawn.
 *
 * @param {CanvasRenderingContext2D} ctx The context the pattern is for.
 * @returns {CanvasPattern | null} The pattern.
 */
export function grainPattern(ctx) {
	const size = 128;
	const tile = document.createElement('canvas');
	tile.width = size;
	tile.height = size;
	const t = tile.getContext('2d');
	if (!t) return null;
	const img = t.createImageData(size, size);
	for (let i = 0; i < img.data.length; i += 4) {
		const v = (Math.random() * 255) | 0;
		img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
		img.data[i + 3] = 255;
	}
	t.putImageData(img, 0, 0);
	return ctx.createPattern(tile, 'repeat');
}

/**
 * Lays grain over what has been drawn, and only there (source-atop): the
 * strokes get texture, the empty canvas stays empty.
 *
 * @param {Canvas2D} c The canvas.
 * @param {CanvasPattern | null} pattern From grainPattern.
 * @param {number} amount How strong, 0–1.
 * @param {boolean} [shimmer=false] Shift the grain each call, so it moves like film rather than sitting still.
 */
export function grainOnto(c, pattern, amount, shimmer = false) {
	if (!pattern || amount <= 0) return;
	const { ctx } = c;
	ctx.save();
	ctx.globalCompositeOperation = 'source-atop';
	ctx.globalAlpha = amount;
	ctx.fillStyle = pattern;
	if (shimmer) ctx.translate(Math.random() * 128, Math.random() * 128);
	ctx.fillRect(-128, -128, c.width + 128, c.height + 128);
	ctx.restore();
}
