/**
 * @module @arraypress/effects-astro/waves
 *
 * Audio motifs drawn in Canvas 2D, quiet enough to sit behind copy:
 *
 *   - `signalLines`: layered waveform lines whose loudness is shaped by a
 *     slow drifting envelope (loud and quiet passages that move, as in a
 *     real track) over stacked frequencies, so it reads as audio, not
 *     smooth sweeps. Front lines taller, brighter and glowing; back lines
 *     flatter and fainter. Now and then a pulse of light runs along a line.
 *   - `waveBars`: a mirrored bar waveform whose bars ease to new heights
 *     every couple of seconds, as if being tuned, with a band of light
 *     drifting across.
 *
 * Grain is laid onto the strokes only, never the empty canvas. Still with
 * prefers-reduced-motion.
 *
 * From the waveform-player site's hero backgrounds.
 */

import { createCanvas2D, grainPattern, grainOnto } from './canvas2d.js';
import { parseColor } from './color.js';

/**
 * @typedef {object} SignalLinesConfig
 * @property {string} [color='#aeaeb8'] The lines' colour.
 * @property {string} [pulse='#fafafa'] The pulses' colour.
 * @property {number} [lines=7] How many lines.
 * @property {number} [amplitude=1] How tall the waves are.
 * @property {number} [speed=1] How fast they move.
 * @property {number} [pulses=1] How often pulses run; 0 for none.
 * @property {number} [grain=0.5] Grain on the strokes, 0–1.
 */

/**
 * @typedef {object} WaveBarsConfig
 * @property {string} [color='#aeaeb8'] The bars' colour.
 * @property {number} [step=8] Space between bars, CSS px.
 * @property {number} [bar=3] A bar's width, CSS px.
 * @property {number} [height=0.34] The tallest bar, a share of the height either side of the middle.
 * @property {number} [every=2] Seconds between retunes.
 * @property {boolean} [sweep=true] The band of light drifting across.
 * @property {number} [grain=0.4] Grain on the bars, 0–1.
 */

/**
 * Starts signal lines on an element (its first canvas is drawn into).
 *
 * @param {HTMLElement} el The element.
 * @param {SignalLinesConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function signalLines(el, config) {
	const LINES = Math.max(2, config.lines ?? 7);
	const color = config.color ?? '#aeaeb8';
	const [r, g, b] = parseColor(color).map((v) => Math.round(v * 255));
	const pulseColor = config.pulse ?? '#fafafa';
	const amplitude = config.amplitude ?? 1;
	const speed = config.speed ?? 1;
	/** @type {{ line: number, x: number, speed: number, len: number }[]} */
	const pulses = [];
	/** @type {CanvasPattern | null} */
	let grain = null;

	/**
	 * A line's height at a point.
	 *
	 * @param {number} L The line, 0 at the front.
	 * @param {number} x Across, CSS px.
	 * @param {number} t The time, seconds.
	 * @param {number} h The canvas's height.
	 * @returns {number} Down, CSS px.
	 */
	const lineY = (L, x, t, h) => {
		const k = L / (LINES - 1);
		const amp = h * (0.24 - 0.16 * k) * amplitude;
		const pace = 0.5 + L * 0.09;
		const phase = L * 1.1;
		// The envelope: loud and quiet passages drifting along.
		const env = 0.32 + 0.68 * Math.abs(Math.sin(x * 0.0032 - t * 0.45 + phase) * 0.7 + Math.sin(x * 0.0016 + t * 0.22) * 0.3);
		const shape =
			Math.sin(x * 0.006 + t * pace + phase) * 0.55 +
			Math.sin(x * 0.015 - t * pace * 0.8 + phase * 1.5) * 0.3 +
			Math.sin(x * 0.033 + t * pace * 1.4 + phase) * 0.16;
		return h / 2 + amp * env * shape;
	};

	const { c, stop } = createCanvas2D(el, {
		resize: ({ ctx }) => {
			grain ??= grainPattern(ctx);
		},
		draw: (c, now, dt) => {
			const { ctx, width: w, height: h } = c;
			const t = (now / 1000) * speed;
			ctx.clearRect(0, 0, w, h);
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			ctx.strokeStyle = color;
			for (let L = 0; L < LINES; L++) {
				const lead = 1 - L / (LINES - 1);
				// The glow strengthens towards the front, as well as the line.
				ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.25 + 0.4 * lead})`;
				ctx.beginPath();
				for (let x = 0; x <= w; x += 4) {
					const y = lineY(L, x, t, h);
					if (x === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.lineWidth = 1 + lead * 0.6;
				ctx.globalAlpha = 0.05 + 0.18 * lead;
				ctx.shadowBlur = 4 + 10 * lead;
				ctx.stroke();
			}
			ctx.shadowBlur = 0;
			ctx.globalAlpha = 1;
			grainOnto(c, grain, config.grain ?? 0.5);

			// Pulses: a bright head with a fading tail, running along a line.
			if (dt && Math.random() < 0.016 * (config.pulses ?? 1) && pulses.length < 5) {
				pulses.push({ line: (Math.random() * LINES) | 0, x: -40, speed: 220 + Math.random() * 260, len: 70 + Math.random() * 90 });
			}
			ctx.strokeStyle = pulseColor;
			ctx.shadowColor = pulseColor;
			ctx.fillStyle = pulseColor;
			for (let i = pulses.length - 1; i >= 0; i--) {
				const p = pulses[i];
				p.x += p.speed * dt;
				if (p.x - p.len > w) {
					pulses.splice(i, 1);
					continue;
				}
				const STEPS = 12;
				for (let s = 0; s < STEPS; s++) {
					const a = 1 - s / STEPS;
					const x1 = p.x - (s / STEPS) * p.len;
					if (x1 < 0) break;
					const x0 = Math.max(0, p.x - ((s + 1) / STEPS) * p.len);
					ctx.beginPath();
					ctx.moveTo(x0, lineY(p.line, x0, t, h));
					ctx.lineTo(x1, lineY(p.line, x1, t, h));
					ctx.globalAlpha = 0.85 * a * a;
					ctx.lineWidth = 0.8 + 2 * a;
					ctx.shadowBlur = 5 + 11 * a;
					ctx.stroke();
				}
				if (p.x <= w) {
					ctx.beginPath();
					ctx.arc(p.x, lineY(p.line, p.x, t, h), 1.8, 0, Math.PI * 2);
					ctx.globalAlpha = 1;
					ctx.shadowBlur = 14;
					ctx.fill();
				}
			}
			ctx.shadowBlur = 0;
			ctx.globalAlpha = 1;
		},
	});
	return c ? stop : () => {};
}

/**
 * Starts tuning wave bars on an element (its first canvas is drawn into).
 *
 * @param {HTMLElement} el The element.
 * @param {WaveBarsConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function waveBars(el, config) {
	const STEP = config.step ?? 8;
	const BW = config.bar ?? 3;
	const color = config.color ?? '#aeaeb8';
	/** @type {number[]} */
	let cur = [];
	/** @type {number[]} */
	let tgt = [];
	let lastTune = 0;
	/** @type {CanvasPattern | null} */
	let grain = null;

	/**
	 * A bar's resting height, 0–1: a fixed shape, so a still frame looks like audio.
	 *
	 * @param {number} i The bar.
	 * @returns {number} Its height.
	 */
	const rest = (i) => Math.max(0.14, Math.min(1, Math.abs(Math.sin(i * 0.5) * 0.6 + Math.sin(i * 0.17 + 1) * 0.4)));

	/**
	 * A bar with rounded ends.
	 *
	 * @param {CanvasRenderingContext2D} ctx The context.
	 * @param {number} x Left.
	 * @param {number} y Top.
	 * @param {number} bw Width.
	 * @param {number} bh Height.
	 */
	const bar = (ctx, x, y, bw, bh) => {
		ctx.beginPath();
		ctx.roundRect(x, y, bw, bh, Math.min(bw / 2, Math.abs(bh) / 2));
		ctx.fill();
	};

	const { c, stop } = createCanvas2D(el, {
		resize: ({ ctx, width }) => {
			grain ??= grainPattern(ctx);
			const count = Math.max(8, Math.floor(width / STEP));
			cur = Array.from({ length: count }, (_, i) => cur[i] ?? rest(i));
			tgt = Array.from({ length: count }, (_, i) => tgt[i] ?? rest(i));
		},
		draw: (c, now) => {
			const { ctx, width: w, height: h } = c;
			if (!c.still && now - lastTune > (config.every ?? 2) * 1000) {
				lastTune = now;
				for (let i = 0; i < tgt.length; i++) tgt[i] = 0.14 + Math.random() * 0.86;
			}
			for (let i = 0; i < cur.length; i++) cur[i] += (tgt[i] - cur[i]) * 0.06;
			const t = now / 1000;
			const cy = h / 2;
			const maxH = h * (config.height ?? 0.34);
			// A band drifting across, with a pause off-screen.
			const sweep = config.sweep === false ? -1e9 : ((t * 0.1) % 1.4) * w - w * 0.2;
			ctx.clearRect(0, 0, w, h);
			ctx.fillStyle = color;
			ctx.shadowColor = color;
			for (let i = 0; i < cur.length; i++) {
				const x = i * STEP + STEP / 2;
				const m = cur[i] * maxH;
				const near = Math.max(0, 1 - Math.abs(x - sweep) / (w * 0.06));
				ctx.globalAlpha = 0.13 + 0.32 * near;
				ctx.shadowBlur = 7 * near;
				bar(ctx, x - BW / 2, cy - m, BW, m * 2);
			}
			ctx.shadowBlur = 0;
			ctx.globalAlpha = 1;
			grainOnto(c, grain, config.grain ?? 0.4);
		},
	});
	return c ? stop : () => {};
}
