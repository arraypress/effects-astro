/**
 * @module @arraypress/effects-astro/pixel-horizon
 *
 * A flat colour filling one side of the element and breaking up into
 * square blocks toward the other: solid near its `side`, then a band where
 * blocks show with a falling chance, then nothing. The frontier sways
 * slowly and wanders along its length, and each block in the band rolls
 * its chance again on its own clock, so blocks wink on and off a few at a
 * time. The blocks deepen from the `edge` colour at the frontier to the
 * `fill` colour on the solid side, blended in Oklab.
 *
 * Each block is one pixel of a small canvas, scaled up with square
 * pixels, so the work is done once a block. Every clock is in seconds and
 * nothing is kept between frames; the same blocks are worked out in plain
 * JavaScript (`horizonBlocks`), block for block.
 *
 * Clear where there are no blocks (or the `background` colour), so it lays
 * over any ground. A `quiet` area clears the blocks behind copy. Without
 * WebGL nothing is drawn; with prefers-reduced-motion it is one still frame.
 */

import { createStage } from './stage.js';
import { GLSL_GRADIENT_NOISE, GLSL_HASH33, gnoise, hash33 } from './hash-noise.js';
import { GLSL_OKLAB, parseColor, toOklab, toHex } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {'bottom' | 'left' | 'top' | 'right'} HorizonSide
 *
 * @typedef {object} PixelHorizonConfig
 * @property {string[]} [colors] Two CSS hex colours: the solid `fill` and the `edge` colour the blocks fade to at the frontier (one colour for both). Default an acid green.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`: its last and first colours.
 * @property {string} [background] A CSS hex colour to fill behind the blocks; none leaves the canvas clear there.
 * @property {HorizonSide} [side='bottom'] Which side the colour fills from.
 * @property {number} [block=14] A block's side, in CSS px (rounded to whole screen pixels).
 * @property {number} [level=0.3] Where the frontier's middle sits, a share of the way from the `side` across.
 * @property {number} [spread=0.3] How deep the broken band is, a share of the way across.
 * @property {number} [sway=0.06] How far the frontier swings, a share of the way across.
 * @property {number} [wander=0.08] How far the frontier wanders along its length, a share of the way across.
 * @property {number} [rate=0.6] How often a block in the band rolls again, times a second.
 * @property {number} [seed=0] Which random blocks, so two cards differ.
 * @property {number} [speed=1] Plays every clock faster or slower; 0 for one still frame.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area kept empty: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 */

/** The sides, in the order the shader numbers them. */
export const HORIZON_SIDES = /** @type {const} */ (['bottom', 'left', 'top', 'right']);

/** The settings' defaults, shared by the shader and `horizonBlocks`. */
export const HORIZON_DEFAULTS = {
	side: /** @type {HorizonSide} */ ('bottom'),
	block: 14,
	level: 0.3,
	spread: 0.3,
	sway: 0.06,
	wander: 0.08,
	rate: 0.6,
	seed: 0,
};

/** The default colours: an acid green. */
const ACID = ['#1aff00', '#1aff00'];

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uSize;
uniform float uTime;
uniform float uSide;
uniform float uLevel;
uniform float uSpread;
uniform float uSway;
uniform float uWander;
uniform float uRate;
uniform float uSeed;
uniform vec3 uFill;
uniform vec3 uEdge;
uniform vec4 uBg;
${GLSL_OKLAB}
${GLSL_QUIET}
${GLSL_HASH33}
${GLSL_GRADIENT_NOISE}

void main() {
	// One pixel a block, counted from the top left.
	vec2 cell = vec2(floor(gl_FragCoord.x), floor(uRes.y - gl_FragCoord.y));
	vec2 f = (cell + 0.5) / uSize;
	// across: 0 at the side the colour fills from, 1 at the far one; along: 0–1 down the frontier.
	float across = uSide < 0.5 ? 1.0 - f.y : uSide < 1.5 ? f.x : uSide < 2.5 ? f.y : 1.0 - f.x;
	float along = uSide < 0.5 || (uSide > 1.5 && uSide < 2.5) ? f.x : f.y;
	float t = uTime;
	float front = uLevel + uSway * sin(6.2831853 * t * 0.05 + uSeed) + uWander * (gnoise(vec2(along * 2.5 + uSeed, t * 0.08)) - 0.5) * 2.0;
	float chance = clamp((front + 0.5 * uSpread - across) / max(uSpread, 0.001), 0.0, 1.0);

	vec3 h = hash33(vec3(cell, uSeed));
	float tick = floor(t * uRate * (0.6 + 0.8 * h.x) + h.y * 11.0);
	float roll = hash33(vec3(cell + tick * 0.618, uSeed + 2.0)).x;
	float lit = step(roll, chance) * step(0.001, chance);

	vec2 q = vec2(f.x - 0.5, 0.5 - f.y) * vec2(uSize.x / uSize.y, 1.0);
	lit *= step(0.5, mix(1.0 - uQuiet.w, 1.0, quietOpen(q)));

	vec3 col = fromOklab(mix(uEdge, uFill, smoothstep(0.0, 1.0, chance)));
	gl_FragColor = vec4(col * lit + uBg.rgb * uBg.a * (1.0 - lit), lit + uBg.a * (1.0 - lit));
}
`;

/**
 * The settings, filled with the defaults, with the side's number.
 *
 * @param {PixelHorizonConfig} config The settings.
 * @returns {typeof HORIZON_DEFAULTS & { sideIndex: number }} The settings.
 */
function settings(config) {
	const o = { ...HORIZON_DEFAULTS, ...config };
	return { ...o, sideIndex: Math.max(0, HORIZON_SIDES.indexOf(o.side)) };
}

/**
 * One frame block for block, as the shader draws it on a target exactly
 * `cols` by `rows` blocks: each block's chance (0 beyond the band, 1 on
 * the solid side) and whether it shows.
 *
 * @param {PixelHorizonConfig} config The settings (the same as the shader's).
 * @param {number} cols Blocks across.
 * @param {number} rows Blocks down.
 * @param {number} [time=0] Seconds, as the shader's clock (already at its speed).
 * @returns {{ chance: number, lit: boolean }[][]} Each row's blocks.
 */
export function horizonBlocks(config, cols, rows, time = 0) {
	const o = settings(config);
	const [qx, qy, radius, depth] = quietUniform(config.quiet, cols / rows);
	const smooth = (/** @type {number} */ e0, /** @type {number} */ e1, /** @type {number} */ x) => {
		const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
		return t * t * (3 - 2 * t);
	};
	return Array.from({ length: rows }, (_, r) =>
		Array.from({ length: cols }, (_, k) => {
			const fx = (k + 0.5) / cols;
			const fy = (r + 0.5) / rows;
			const s = o.sideIndex;
			const across = s === 0 ? 1 - fy : s === 1 ? fx : s === 2 ? fy : 1 - fx;
			const along = s === 0 || s === 2 ? fx : fy;
			const front = o.level + o.sway * Math.sin(2 * Math.PI * time * 0.05 + o.seed) + o.wander * (gnoise(along * 2.5 + o.seed, time * 0.08) - 0.5) * 2;
			const chance = Math.min(1, Math.max(0, (front + 0.5 * o.spread - across) / Math.max(o.spread, 0.001)));
			const h = hash33(k, r, o.seed);
			const tick = Math.floor(time * o.rate * (0.6 + 0.8 * h[0]) + h[1] * 11);
			const roll = hash33(k + tick * 0.618, r + tick * 0.618, o.seed + 2)[0];
			let lit = chance >= roll && chance >= 0.001;
			if (radius > 0) {
				const qd = Math.hypot((fx - 0.5) * (cols / rows) - qx, 0.5 - fy - qy);
				if (1 - depth + depth * smooth(radius * 0.06, radius, qd) < 0.5) lit = false;
			}
			return { chance, lit };
		}),
	);
}

/**
 * The two colours as the shader takes them.
 *
 * @param {PixelHorizonConfig} config The settings.
 * @returns {[string, string]} The fill colour and the edge's.
 */
export function horizonColors(config) {
	if (config.colors?.length) return [config.colors[0], config.colors[1] ?? config.colors[0]];
	const colors = pickColors(config, ACID);
	return [colors[colors.length - 1], colors[0]];
}

/**
 * A CSS `background` that stands in for the horizon before the shader
 * starts and without WebGL: the solid colour up to the frontier, a
 * two-block checker along it, and the quiet area left to the ground.
 *
 * @param {PixelHorizonConfig} config The settings (`colors`/`palette`, `background`, `side`, `block`, `level`, `spread`, `quiet`).
 * @returns {string} The CSS background.
 */
export function horizonStill(config) {
	const o = settings(config);
	const [fill] = horizonColors(config).map((c) => toHex(parseColor(c)));
	const ground = config.background ?? '#000000';
	const b = Math.max(2, o.block);
	const solid = Math.round(Math.max(0, o.level - 0.25 * o.spread) * 100);
	const side = ['top', 'right', 'bottom', 'left'][o.sideIndex];
	// Where the checker row sits: the frontier, measured the way background-position runs.
	const at = o.sideIndex === 0 || o.sideIndex === 1 ? 100 - solid : solid;
	const pos = o.sideIndex % 2 === 0 ? `0 ${at}%` : `${at}% 0`;
	const size = `${b * 2}px ${b * 2}px`;
	const repeat = o.sideIndex % 2 === 0 ? 'repeat-x' : 'repeat-y';
	const pc = (/** @type {number} */ n) => `${Math.round(n * 100)}%`;
	const quiet = config.quiet;
	const r = pc((quiet?.radius ?? 0.8) * 0.55);
	return [
		quiet ? `radial-gradient(${r} ${r} at ${pc(quiet.x ?? 0.5)} ${pc(quiet.y ?? 0.5)}, ${ground} 55%, transparent 100%)` : '',
		`repeating-conic-gradient(${fill} 0 25%, transparent 0 50%) ${pos} / ${size} ${repeat}`,
		`linear-gradient(to ${side}, ${fill} ${solid}%, transparent ${solid}%)`,
		ground,
	]
		.filter(Boolean)
		.join(', ');
}

/**
 * Starts the horizon on an element: a canvas inside it (its first), one
 * pixel a block, scaled up to cover it with square pixels.
 *
 * @param {HTMLElement} el The element.
 * @param {PixelHorizonConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function pixelHorizon(el, config) {
	const o = settings(config);
	const speed = config.speed ?? 1;
	const lab = (/** @type {string} */ c) => toOklab(parseColor(c));
	let [fill, edge] = horizonColors(config).map(lab);
	const bg = config.background ? [...parseColor(config.background), 1] : [0, 0, 0, 0];
	const native = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
	// Whole screen pixels a block, so the scaled-up pixels are all the same size.
	const blockCss = Math.max(1, Math.round(Math.max(1, o.block) * native)) / native;
	const start = performance.now();
	const canvas = el.querySelector('canvas');

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		still: speed <= 0,
		// One pixel a block already: never lower it further.
		adaptive: false,
		scale: 1 / (blockCss * Math.min(native, 2)),
		setup({ gl, uniform, canvas }) {
			canvas.style.imageRendering = 'pixelated';
			gl.uniform1f(uniform('uSide'), o.sideIndex);
			gl.uniform1f(uniform('uLevel'), o.level);
			gl.uniform1f(uniform('uSpread'), o.spread);
			gl.uniform1f(uniform('uSway'), o.sway);
			gl.uniform1f(uniform('uWander'), o.wander);
			gl.uniform1f(uniform('uRate'), o.rate);
			gl.uniform1f(uniform('uSeed'), o.seed);
			gl.uniform4f(uniform('uBg'), bg[0], bg[1], bg[2], bg[3]);
		},
		resize({ gl, uniform, canvas }) {
			// The element in blocks; the canvas rounds up and runs past it (clipped), so every block is whole.
			const w = Math.max(1, el.clientWidth / blockCss);
			const h = Math.max(1, el.clientHeight / blockCss);
			canvas.width = Math.ceil(w);
			canvas.height = Math.ceil(h);
			canvas.style.width = `${canvas.width * blockCss}px`;
			canvas.style.height = `${canvas.height * blockCss}px`;
			gl.uniform2f(uniform('uSize'), w, h);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, w / h));
		},
		uniforms({ gl, uniform }, now) {
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000) * Math.max(0, speed));
			gl.uniform3f(uniform('uFill'), fill[0], fill[1], fill[2]);
			gl.uniform3f(uniform('uEdge'), edge[0], edge[1], edge[2]);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		[fill, edge] = horizonColors({ colors: next.colors }).map(lab);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
		canvas?.style.removeProperty('width');
		canvas?.style.removeProperty('height');
		canvas?.style.removeProperty('image-rendering');
	};
}
