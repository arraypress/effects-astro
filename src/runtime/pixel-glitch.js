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
 * The slip is each hot cell's own by default; with `tear: 'row'` a whole
 * row tears at once, now and then, by its hottest cell (the Logomarks
 * site's footer). With `ghost`, a copy of the blocks in that colour sits
 * nudged 3px right behind them, an accent under the break.
 *
 * With `stroke` set, the text at rest is a hollow outline of that width and
 * the pixels it breaks into fill the letters solid, so the pointer lights
 * the word up as it passes. The outline is one shape for the whole word
 * (the solid letters less themselves eroded by the width), so letters that
 * touch or overlap under tight tracking merge rather than each outline
 * crossing the next.
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
 * With `glitch: false` it never breaks: the text (with `stroke`, its merged
 * outline) is only drawn at rest, everywhere, for a wordmark that should
 * look the same but leave the pointer to something else.
 * Repainted when the text's own face has loaded (a face used only here can
 * arrive after `document.fonts.ready`).
 *
 * From the SampleGrid (WaveGrid) theme's footer; the merged outline and the
 * font reload from the Logomarks site's.
 */

import { canHover, prefersReducedMotion } from './device.js';
import { textNodes, paintGlyphs } from './text.js';

/**
 * @typedef {object} PixelGlitchConfig
 * @property {number} [cell=14] The heat grid's cell, CSS px.
 * @property {number} [reach=120] How far the pointer's heat reaches, CSS px.
 * @property {number} [decay=0.9] Heat kept each frame (0.9 is gone in about half a second).
 * @property {number} [block=22] The pixel block size at full heat, CSS px.
 * @property {number} [shift=16] How far the hottest rows slip sideways, CSS px.
 * @property {number} [stroke=0] With a width (CSS px), the text at rest is an outline that the pixels fill.
 * @property {'cell' | 'row'} [tear='cell'] What slips: each hot cell on its own, or a whole row at once.
 * @property {string} [ghost] A colour for a copy of the blocks, nudged right behind them (none by default).
 * @property {boolean} [glitch=true] Break into pixels under the pointer; false only draws the text at rest (the merged outline with `stroke`).
 */

/** How far the ghost sits right of its block, CSS px. */
const GHOST_OFFSET = 3;

/** The heat a block needs to cast its ghost. */
const GHOST_HEAT = 0.3;

/** A row's hottest cell must pass this for the row to tear… */
const TEAR_HEAT = 0.45;

/** …and then it tears on this share of frames. */
const TEAR_CHANCE = 0.35;

/** The heat a cell needs to slip on its own (`tear: 'cell'`). */
const SLIP_HEAT = 0.55;

/**
 * How far each row of a heat grid tears this frame: rows whose hottest
 * cell passes TEAR_HEAT tear on some frames, by up to half of `shift`
 * either way (scaled by that heat), and the rest stay put.
 *
 * @param {Float32Array} heat The grid, row by row.
 * @param {number} cols Cells a row.
 * @param {number} rows Rows.
 * @param {number} shift The most a row slips, at full heat, CSS px (end to end).
 * @param {() => number} [random=Math.random] Random values, 0–1.
 * @returns {Float32Array} Each row's slip, whole CSS px.
 */
export function rowTears(heat, cols, rows, shift, random = Math.random) {
	const tear = new Float32Array(rows);
	for (let row = 0; row < rows; row++) {
		let h = 0;
		for (let col = 0; col < cols; col++) h = Math.max(h, heat[row * cols + col]);
		tear[row] = h > TEAR_HEAT && random() < TEAR_CHANCE ? Math.round((random() - 0.5) * h * shift) : 0;
	}
	return tear;
}

/** The 16 directions the outline's erosion looks in, as unit vectors. */
const AROUND = Array.from({ length: 16 }, (_, k) => [Math.cos((k / 16) * Math.PI * 2), Math.sin((k / 16) * Math.PI * 2)]);

/**
 * The outline of a shape, from its coverage: each pixel's alpha less the
 * smallest alpha within `radius` of it (looked for in 16 directions), so
 * the line runs `radius` px inside the shape's edge and stays smooth where
 * the edge is antialiased. Shapes that touch or overlap give one outline
 * round the lot.
 *
 * @param {Uint8ClampedArray} rgba The shape, RGBA (only alpha is read).
 * @param {number} width Its width, px.
 * @param {number} height Its height, px.
 * @param {number} radius The outline's width, px (rounded, at least 1).
 * @returns {Uint8ClampedArray} The outline's alpha, one byte a pixel.
 */
export function outlineAlpha(rgba, width, height, radius) {
	const r = Math.max(1, Math.round(radius));
	const steps = AROUND.map(([x, y]) => [Math.round(x * r), Math.round(y * r)]);
	const out = new Uint8ClampedArray(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const v = rgba[(y * width + x) * 4 + 3];
			if (!v) continue;
			let low = v;
			for (const [dx, dy] of steps) {
				const nx = x + dx;
				const ny = y + dy;
				const n = nx < 0 || ny < 0 || nx >= width || ny >= height ? 0 : rgba[(ny * width + nx) * 4 + 3];
				if (n < low) low = n;
				if (!low) break;
			}
			out[y * width + x] = v - low;
		}
	}
	return out;
}

/**
 * Starts the pixel glitch on an element of text.
 *
 * @param {HTMLElement} el The text.
 * @param {PixelGlitchConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function pixelGlitch(el, config) {
	const GLITCH = config.glitch !== false;
	// Drawing the text at rest only is not motion, and needs no hover.
	if (GLITCH && (prefersReducedMotion() || !canHover())) return () => {};
	const CELL = config.cell ?? 14;
	const REACH = config.reach ?? 120;
	const DECAY = config.decay ?? 0.9;
	const MAX_BLOCK = config.block ?? 22;
	const SHIFT = config.shift ?? 16;
	const STROKE = config.stroke ?? 0;
	const ROWS = config.tear === 'row';
	const GHOST = config.ghost || '';

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
		const tears = ROWS ? rowTears(g.heat, g.cols, g.rows, SHIFT) : null;
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
				// The hottest cells (or rows) also slip sideways: the glitch.
				const shift = tears ? tears[row] : heat > SLIP_HEAT ? Math.round((Math.random() - 0.5) * heat * SHIFT) : 0;
				const bx0 = Math.floor(x0 / block) * block;
				const by0 = Math.floor(y0 / block) * block;
				for (let by = by0; by < y0 + CELL; by += block) {
					for (let bx = bx0; bx < x0 + CELL; bx += block) {
						if (!inked(bx + block / 2, by + block / 2)) continue;
						// Clipped to the cell, so neighbours tile cleanly.
						const x = Math.max(bx, x0) + shift;
						const y = Math.max(by, y0);
						const w = Math.min(bx + block, x0 + CELL) - Math.max(bx, x0);
						const h = Math.min(by + block, y0 + CELL) - Math.max(by, y0);
						if (GHOST && heat > GHOST_HEAT) {
							ctx.fillStyle = GHOST;
							ctx.fillRect(x + GHOST_OFFSET, y, w, h);
							ctx.fillStyle = g.ink;
						}
						ctx.fillRect(x, y, w, h);
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
	 * it: solid, or with `stroke` one outline round the whole word (see
	 * outlineAlpha), so overlapping letters do not show their crossings.
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
		paintGlyphs(c2, texts, origin);
		g.alpha = c2.getImageData(0, 0, crisp.width, crisp.height).data;
		if (STROKE > 0) {
			// The pixels still sample the solid letters (g.alpha); what shows at rest is their outline, in the ink.
			const line = outlineAlpha(g.alpha, crisp.width, crisp.height, STROKE * dpr);
			const img = c2.createImageData(crisp.width, crisp.height);
			for (let i = 0; i < line.length; i++) img.data[i * 4 + 3] = line[i];
			c2.putImageData(img, 0, 0);
			c2.setTransform(1, 0, 0, 1, 0, 0);
			c2.globalCompositeOperation = 'source-in';
			c2.fillRect(0, 0, crisp.width, crisp.height);
			c2.globalCompositeOperation = 'source-over';
			c2.setTransform(dpr, 0, 0, dpr, 0, 0);
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
	if (GLITCH) document.addEventListener('pointermove', move, { passive: true });

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
	// Repaint once the fonts are in, and once the text's own face is (it may load after fonts.ready).
	let stopped = false;
	/** Repaints, unless stopped meanwhile. */
	const repaint = () => {
		if (!stopped) paint();
	};
	document.fonts?.ready.then(repaint).catch(() => {});
	const face = getComputedStyle(el);
	document.fonts
		?.load(`${face.fontStyle} ${face.fontWeight} ${face.fontSize} ${face.fontFamily}`, el.textContent ?? '')
		.then(repaint)
		.catch(() => {});
	paint();

	return () => {
		stopped = true;
		cancelAnimationFrame(pending);
		document.removeEventListener('pointermove', move);
		resizer.disconnect();
		watcher.disconnect();
		canvas.remove();
		el.classList.remove('is-ready');
	};
}
