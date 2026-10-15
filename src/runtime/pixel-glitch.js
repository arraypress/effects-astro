/**
 * @module @arraypress/effects-astro/pixel-glitch
 *
 * Text that breaks into pixels under the pointer: a canvas over the text
 * redraws it, and the cells the pointer passes heat up and are drawn as
 * blocks (bigger the hotter), with the hottest rows slipping sideways.
 * Heat fades in about half a second, so a trail of pixels follows the
 * pointer and the text knits back together behind it. Faster movement adds
 * more heat.
 *
 * With `stroke` set, the text at rest is a hollow outline of that width and
 * the pixels it breaks into fill the letters solid, so the pointer lights
 * the word up as it passes.
 *
 * The element keeps its text (it only turns transparent once the canvas
 * has drawn), so fit-text, selection and the no-JS look are unchanged.
 * Each glyph is drawn where the browser laid it out (one Range per
 * character), so letter-spacing and kerning match the CSS.
 *
 * The pointer is read from the document, so the text can keep
 * `pointer-events: none` (a big wordmark's line box often overlaps links).
 * Animates only while some cell is hot, and only while the text is on
 * screen. Off with prefers-reduced-motion and without a hovering pointer.
 *
 * From the SampleGrid (WaveGrid) theme's footer.
 */

import { canHover, prefersReducedMotion } from './device.js';
import { textNodes } from './text.js';

/**
 * @typedef {object} PixelGlitchConfig
 * @property {number} [cell=14] The heat grid's cell, CSS px.
 * @property {number} [reach=120] How far the pointer's heat reaches, CSS px.
 * @property {number} [decay=0.9] Heat kept each frame (0.9 is gone in about half a second).
 * @property {number} [block=22] The pixel block size at full heat, CSS px.
 * @property {number} [shift=16] How far the hottest rows slip sideways, CSS px.
 * @property {number} [stroke=0] With a width (CSS px), the text at rest is an outline that the pixels fill.
 */

/**
 * Starts the pixel glitch on an element of text.
 *
 * @param {HTMLElement} el The text.
 * @param {PixelGlitchConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function pixelGlitch(el, config) {
	if (prefersReducedMotion() || !canHover()) return () => {};
	const CELL = config.cell ?? 14;
	const REACH = config.reach ?? 120;
	const DECAY = config.decay ?? 0.9;
	const MAX_BLOCK = config.block ?? 22;
	const SHIFT = config.shift ?? 16;
	const STROKE = config.stroke ?? 0;

	const canvas = document.createElement('canvas');
	canvas.className = 'effect-pixel-glitch-canvas';
	canvas.setAttribute('aria-hidden', 'true');
	el.append(canvas);
	const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
	const crisp = document.createElement('canvas');
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const g = {
		/** Coverage of the filled text, for choosing which blocks to draw. */
		alpha: new Uint8ClampedArray(0),
		w: 0,
		h: 0,
		/** Where the canvas sits in the element (the glyphs overflow a tight line-height). */
		ox: 0,
		oy: 0,
		cols: 0,
		rows: 0,
		heat: new Float32Array(0),
		ink: '',
		visible: false,
		running: false,
		/** @type {{ x: number, y: number } | undefined} */
		last: undefined,
	};

	/**
	 * Is the filled text inked at (x, y), CSS px?
	 *
	 * @param {number} x Across the canvas.
	 * @param {number} y Down the canvas.
	 * @returns {boolean} Whether that pixel is inside a glyph.
	 */
	const inked = (x, y) => {
		const px = Math.min(crisp.width - 1, Math.max(0, Math.round(x * dpr)));
		const py = Math.min(crisp.height - 1, Math.max(0, Math.round(y * dpr)));
		return g.alpha[(py * crisp.width + px) * 4 + 3] > 110;
	};

	/**
	 * One frame: the text at rest, with every hot cell redrawn as blocks.
	 *
	 * @returns {boolean} Whether any cell is still hot.
	 */
	const draw = () => {
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(crisp, 0, 0);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.fillStyle = g.ink;
		let hot = false;
		for (let row = 0; row < g.rows; row++) {
			for (let col = 0; col < g.cols; col++) {
				const i = row * g.cols + col;
				const heat = g.heat[i];
				if (heat < 0.02) {
					g.heat[i] = 0;
					continue;
				}
				hot = true;
				const x0 = col * CELL;
				const y0 = row * CELL;
				// Wipe the cell, then fill it with blocks sampled from the filled text.
				ctx.clearRect(x0, y0, CELL, CELL);
				const block = Math.max(3, Math.round(3 + heat * (MAX_BLOCK - 3)));
				// The hottest cells also slip sideways: the glitch.
				const shift = heat > 0.55 ? Math.round((Math.random() - 0.5) * heat * SHIFT) : 0;
				const bx0 = Math.floor(x0 / block) * block;
				const by0 = Math.floor(y0 / block) * block;
				for (let by = by0; by < y0 + CELL; by += block) {
					for (let bx = bx0; bx < x0 + CELL; bx += block) {
						if (!inked(bx + block / 2, by + block / 2)) continue;
						// Clipped to the cell, so neighbours tile cleanly.
						const w = Math.min(bx + block, x0 + CELL) - Math.max(bx, x0);
						const h = Math.min(by + block, y0 + CELL) - Math.max(by, y0);
						ctx.fillRect(Math.max(bx, x0) + shift, Math.max(by, y0), w, h);
					}
				}
				g.heat[i] = heat * DECAY;
			}
		}
		return hot;
	};

	/** Animates while any cell is hot and the text is on screen. */
	const loop = () => {
		if (g.running) return;
		g.running = true;
		/** One frame, and the next if still needed. */
		const tick = () => {
			const hot = draw();
			if (hot && g.visible) requestAnimationFrame(tick);
			else g.running = false;
		};
		requestAnimationFrame(tick);
	};

	/**
	 * Draws the text at rest into `crisp`, each glyph where the browser put
	 * it: solid, or with `stroke` an outline (the stroke is centred on the
	 * glyph's edge, so it is drawn twice as wide and the inner half cut away).
	 */
	const paint = () => {
		const texts = textNodes(el);
		if (!texts.length) return;
		const box = el.getBoundingClientRect();
		const all = document.createRange();
		all.setStart(texts[0], 0);
		all.setEnd(texts[texts.length - 1], texts[texts.length - 1].length);
		const area = all.getBoundingClientRect();
		const pad = 4;
		g.ox = Math.floor(Math.min(0, area.left - box.left) - pad);
		g.oy = Math.floor(area.top - box.top - pad);
		g.w = Math.ceil(Math.max(box.right, area.right) - box.left - g.ox + pad);
		g.h = Math.ceil(area.height + pad * 2);
		const origin = { x: box.left + g.ox, y: box.top + g.oy };
		for (const c of [canvas, crisp]) {
			c.width = Math.max(1, Math.round(g.w * dpr));
			c.height = Math.max(1, Math.round(g.h * dpr));
		}
		Object.assign(canvas.style, { width: `${g.w}px`, height: `${g.h}px`, left: `${g.ox}px`, top: `${g.oy}px` });

		const cs = getComputedStyle(el);
		g.ink = cs.color;
		// Read back on every repaint (resizes, fonts loading): kept on the CPU.
		const c2 = /** @type {CanvasRenderingContext2D} */ (crisp.getContext('2d', { willReadFrequently: true }));
		c2.setTransform(dpr, 0, 0, dpr, 0, 0);
		c2.clearRect(0, 0, g.w, g.h);
		c2.fillStyle = g.ink;
		c2.strokeStyle = g.ink;
		c2.lineJoin = 'round';
		c2.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
		c2.textBaseline = 'alphabetic';
		const range = document.createRange();
		/**
		 * Draws every glyph where the browser laid it out.
		 *
		 * @param {(ch: string, x: number, y: number) => void} glyph Draws one glyph at a baseline position.
		 */
		const eachGlyph = (glyph) => {
			for (const text of texts) {
				const str = text.textContent ?? '';
				for (let i = 0; i < str.length; i++) {
					const ch = str[i];
					if (!ch.trim()) continue;
					range.setStart(text, i);
					range.setEnd(text, i + 1);
					const r = range.getBoundingClientRect();
					// The glyph's box starts at r.top; its baseline sits one font ascent below.
					glyph(ch, r.left - origin.x, r.top - origin.y + c2.measureText(ch).fontBoundingBoxAscent);
				}
			}
		};
		eachGlyph((ch, x, y) => c2.fillText(ch, x, y));
		g.alpha = c2.getImageData(0, 0, crisp.width, crisp.height).data;
		if (STROKE > 0) {
			c2.clearRect(0, 0, g.w, g.h);
			c2.lineWidth = STROKE * 2;
			eachGlyph((ch, x, y) => c2.strokeText(ch, x, y));
			c2.globalCompositeOperation = 'destination-out';
			eachGlyph((ch, x, y) => c2.fillText(ch, x, y));
			c2.globalCompositeOperation = 'source-over';
		}
		g.cols = Math.ceil(g.w / CELL);
		g.rows = Math.ceil(g.h / CELL);
		g.heat = new Float32Array(g.cols * g.rows);
		draw();
		el.classList.add('is-ready');
	};

	/**
	 * Warms the cells around (x, y), more for a faster move.
	 *
	 * @param {number} x Across the canvas, CSS px.
	 * @param {number} y Down the canvas, CSS px.
	 */
	const heatAt = (x, y) => {
		const speed = g.last ? Math.hypot(x - g.last.x, y - g.last.y) : 0;
		g.last = { x, y };
		const add = Math.min(1, 0.25 + speed / 40);
		const c0 = Math.max(0, Math.floor((x - REACH) / CELL));
		const c1 = Math.min(g.cols - 1, Math.floor((x + REACH) / CELL));
		const r0 = Math.max(0, Math.floor((y - REACH) / CELL));
		const r1 = Math.min(g.rows - 1, Math.floor((y + REACH) / CELL));
		for (let r = r0; r <= r1; r++) {
			for (let c = c0; c <= c1; c++) {
				const d = Math.hypot(c * CELL + CELL / 2 - x, r * CELL + CELL / 2 - y);
				if (d > REACH) continue;
				// A soft edge, with a little noise so the border is not a circle.
				const falloff = (1 - d / REACH) ** 1.6 * (0.75 + Math.random() * 0.5);
				g.heat[r * g.cols + c] = Math.min(1, g.heat[r * g.cols + c] + add * falloff);
			}
		}
		loop();
	};

	/** @param {PointerEvent} e The move. */
	const move = (e) => {
		if (!g.visible || !g.alpha.length) return;
		const box = el.getBoundingClientRect();
		const x = e.clientX - box.left - g.ox;
		const y = e.clientY - box.top - g.oy;
		if (x < -REACH / 2 || y < -REACH / 2 || x > g.w + REACH / 2 || y > g.h + REACH / 2) {
			g.last = undefined;
			return;
		}
		heatAt(x, y);
	};
	document.addEventListener('pointermove', move, { passive: true });

	// Repaint when the text changes size (fit-text, fonts loading).
	let pending = 0;
	const resizer = new ResizeObserver(() => {
		cancelAnimationFrame(pending);
		pending = requestAnimationFrame(paint);
	});
	resizer.observe(el);
	const watcher = new IntersectionObserver(([entry]) => {
		g.visible = entry.isIntersecting;
	});
	watcher.observe(el);
	document.fonts?.ready.then(paint).catch(() => {});
	paint();

	return () => {
		document.removeEventListener('pointermove', move);
		resizer.disconnect();
		watcher.disconnect();
		canvas.remove();
		el.classList.remove('is-ready');
	};
}
