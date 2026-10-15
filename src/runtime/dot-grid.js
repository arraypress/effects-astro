/**
 * @module @arraypress/effects-astro/dot-grid
 *
 * A sea of dots you can drop stones into. The dots sit on a fixed grid,
 * and a slow noise current moves across it, brightening and nudging them
 * a little; a soft swell sits under the pointer. A click sends a wavefront
 * out from that point across the grid, lifting and pushing the dots as it
 * passes, and ripples sum where they cross.
 *
 * Three details make it read as water: the wave leaves its source (what
 * reaches the far corner is the click from a second and a half ago), the
 * front widens as it travels (a ring that keeps its width reads as a
 * shockwave), and the dots are displaced along the surface's tilt, not
 * only lit.
 *
 * Canvas 2D: about 1,600 squares a frame at the default pitch, which needs
 * no GPU. With prefers-reduced-motion, one still frame.
 *
 * From the ArrayPress holding page, as refined for FilterSpark.
 */

import { parseColor } from './color.js';
import { createCanvas2D } from './canvas2d.js';
import { pressAt } from './pointer.js';

/**
 * @typedef {object} DotGridConfig
 * @property {string} [color='#ffffff'] The dots' colour.
 * @property {number} [pitch=26] Space between dots, CSS px.
 * @property {number} [dot=1.6] A dot's size at rest, CSS px.
 * @property {boolean} [round=false] Round dots rather than square.
 * @property {number} [flow=1] How strongly the noise current lights and nudges the dots; 0 for none.
 * @property {number} [speed=620] How fast a ripple travels, CSS px a second.
 * @property {number} [life=2.6] Seconds before a ripple is spent.
 * @property {number} [push=9] How far a ripple displaces dots, CSS px (keep under half the pitch).
 * @property {number} [radius=210] The pointer's swell, CSS px; 0 for none.
 * @property {boolean} [greet=true] Drop one ripple from the middle soon after it first comes on screen, so it is clear it can be touched.
 * @property {boolean} [ripples=true] Whether clicks drop ripples.
 */

/** Most ripples alive at once: someone will hold the button and mash it. */
const MAX_RIPPLES = 14;

/**
 * Value noise, 0–1.
 *
 * @param {number} x Across.
 * @param {number} y Down.
 * @returns {number} The noise there.
 */
function noise(x, y) {
	/**
	 * A hash of a lattice point, 0–1.
	 *
	 * @param {number} a Across.
	 * @param {number} b Down.
	 * @returns {number} Its hash.
	 */
	const hash = (a, b) => {
		const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
		return n - Math.floor(n);
	};
	const xi = Math.floor(x);
	const yi = Math.floor(y);
	const xf = x - xi;
	const yf = y - yi;
	const u = xf * xf * (3 - 2 * xf);
	const v = yf * yf * (3 - 2 * yf);
	return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v;
}

/**
 * Starts the dot grid on an element (its first canvas is drawn into).
 *
 * @param {HTMLElement} el The element.
 * @param {DotGridConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function dotGrid(el, config) {
	const PITCH = config.pitch ?? 26;
	const DOT = config.dot ?? 1.6;
	const FLOW = config.flow ?? 1;
	const SPEED = config.speed ?? 620;
	const LIFE = config.life ?? 2.6;
	const PUSH = config.push ?? 9;
	const RADIUS = config.radius ?? 210;
	const [cr, cg, cb] = parseColor(config.color ?? '#ffffff');

	/** @type {{ x: number, y: number, t0: number, amp: number }[]} */
	const ripples = [];
	// Scratch for the ripples alive this frame, so the inner loop allocates nothing.
	const rx = new Float64Array(16);
	const ry = new Float64Array(16);
	const rr = new Float64Array(16);
	const rb = new Float64Array(16);
	const rg = new Float64Array(16);
	let cols = 0;
	let rows = 0;
	let greeted = config.greet === false;
	/** When the first frame was drawn, seconds: the greeting waits for the grid to be seen, not merely set up. */
	let shown = -1;
	const start = performance.now();
	/** The pointer, where it is (t) and eased towards it (m), in CSS px over the element. */
	const ptr = { tx: -9999, ty: -9999, mx: -9999, my: -9999 };

	/**
	 * Drops a ripple.
	 *
	 * @param {number} x Across the element, CSS px.
	 * @param {number} y Down it, CSS px.
	 * @param {number} amp Its strength, 1 for a click.
	 * @param {number} now The time, seconds.
	 */
	const drop = (x, y, amp, now) => {
		ripples.push({ x, y, t0: now, amp });
		while (ripples.length > MAX_RIPPLES) ripples.shift();
	};

	/**
	 * One frame.
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 * @param {number} ms The time, ms.
	 */
	const draw = (c, ms) => {
		const { ctx, width: w, height: h } = c;
		const moving = !c.still;
		const now = (ms - start) / 1000;
		const t = now * 0.16;
		ptr.mx += (ptr.tx - ptr.mx) * 0.06;
		ptr.my += (ptr.ty - ptr.my) * 0.06;
		if (shown < 0) shown = now;
		if (moving && !greeted && now - shown > 0.9) {
			greeted = true;
			drop(w * 0.5, h * 0.42, 0.85, now);
		}
		// Each live ripple resolved once a frame, not once a dot.
		let n = 0;
		for (let i = 0; i < ripples.length && n < 16; i++) {
			const r = ripples[i];
			const age = now - r.t0;
			if (age < 0 || age > LIFE) continue;
			const rad = age * SPEED;
			const k = 1 - age / LIFE;
			rx[n] = r.x;
			ry[n] = r.y;
			rr[n] = rad;
			// The front widens as it travels: water losing coherence.
			rb[n] = 44 + age * 46;
			// Energy spreading round a growing ring, and the ripple running out of life.
			rg[n] = r.amp * k * k * (1 / (1 + rad / 260));
			n++;
		}
		if (ripples.length && now - ripples[0].t0 > LIFE) ripples.shift();

		ctx.clearRect(0, 0, w, h);
		for (let iy = 0; iy < rows; iy++) {
			for (let ix = 0; ix < cols; ix++) {
				const px = ix * PITCH;
				const py = iy * PITCH;
				// The current scrolls diagonally, so bands move across the grid.
				const f = (noise(ix * 0.14 + t * 1.7, iy * 0.14 - t * 1.1) * 0.65 + noise(ix * 0.29 + t * 3.6, iy * 0.29 - t * 2.3) * 0.35) * FLOW;
				const wob = (f - 0.5 * FLOW) * 3.2;
				// The ripples: height lifts the dot, the slope pushes it along the radius.
				let wave = 0;
				let sx = 0;
				let sy = 0;
				for (let i = 0; i < n; i++) {
					const dx = px - rx[i];
					const dy = py - ry[i];
					const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
					const off = (d - rr[i]) / rb[i];
					if (off < -2.6 || off > 2.6) continue;
					const g = Math.exp(-off * off);
					wave += g * rg[i];
					const tilt = -2 * off * g * rg[i];
					sx += (dx / d) * tilt;
					sy += (dy / d) * tilt;
				}
				// A soft presence under the pointer.
				let near = 0;
				if (RADIUS > 0 && ptr.mx > -9000) {
					const d = Math.hypot(px - ptr.mx, py - ptr.my);
					if (d < RADIUS) {
						const k = 1 - d / RADIUS;
						near = k * k * (3 - 2 * k) * 0.22;
					}
				}
				const flow = Math.pow(Math.max(f, 0), 2.2);
				const lift = Math.min(1, flow * 0.7 + wave * 0.9 + near);
				const v = (150 + 105 * lift) / 255;
				const alpha = 0.045 + flow * 0.16 + Math.min(0.62, wave * 0.62) + near * 0.5;
				const size = DOT + Math.min(1.9, wave * 1.9) + flow * 0.5 + near;
				const x = px + wob + sx * PUSH;
				const y = py + wob * 0.7 + sy * PUSH;
				ctx.fillStyle = `rgba(${Math.round(cr * 255 * v)},${Math.round(cg * 255 * v)},${Math.round(cb * 255 * v)},${alpha})`;
				if (config.round) {
					ctx.beginPath();
					ctx.arc(x, y, size / 2, 0, Math.PI * 2);
					ctx.fill();
				} else {
					ctx.fillRect(x - size / 2, y - size / 2, size, size);
				}
			}
		}
	};

	/** @param {PointerEvent} e The move. */
	const move = (e) => {
		const box = el.getBoundingClientRect();
		ptr.tx = e.clientX - box.left;
		ptr.ty = e.clientY - box.top;
		if (ptr.mx < -9000) Object.assign(ptr, { mx: ptr.tx, my: ptr.ty });
	};
	/** @param {PointerEvent} e The press: a ripple where it landed (on press, not release). */
	const press = (e) => {
		const at = pressAt(el, e);
		if (!at) return;
		move(e);
		drop(at.x * el.clientWidth, (1 - at.y) * el.clientHeight, 1, (performance.now() - start) / 1000);
	};

	const { c, stop } = createCanvas2D(el, {
		draw,
		resize: ({ width, height }) => {
			cols = Math.ceil(width / PITCH) + 1;
			rows = Math.ceil(height / PITCH) + 1;
		},
	});
	if (!c || c.still) return stop;
	document.addEventListener('pointermove', move, { passive: true });
	if (config.ripples !== false) document.addEventListener('pointerdown', press, { passive: true });
	return () => {
		stop();
		document.removeEventListener('pointermove', move);
		document.removeEventListener('pointerdown', press);
	};
}
