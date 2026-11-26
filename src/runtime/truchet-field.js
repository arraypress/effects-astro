/**
 * @module @arraypress/effects-astro/truchet-field
 *
 * A field of Truchet tiles: square tiles each holding two quarter-circle
 * arcs on opposite corners, set one way or the other at random, so the
 * arcs join across the tiles into a meander of loops and S-bends. Now and
 * then a tile turns a quarter (the arcs then join their neighbours the
 * other way), each on its own clock, so the pattern rearranges a few tiles
 * at a time and never all at once. A slow noise brightens and thickens
 * the lines in drifting patches; with `tube` each line is shaded across
 * its width like a rounded tube.
 *
 * Every clock is in seconds and nothing is kept between frames: a tile's
 * way and its turn are a hash of the tile and of how many turns its clock
 * has made, here in GLSL and in plain JavaScript (`truchetTile`) alike.
 * The tiles keep their size in CSS px.
 *
 * Clear where there are no lines (or the `background` colour), so it lays
 * over any ground. A `quiet` area thins the lines away behind copy. Without
 * WebGL nothing is drawn; with prefers-reduced-motion it is one still frame.
 */

import { createStage } from './stage.js';
import { GLSL_GRADIENT_NOISE, GLSL_HASH33, gnoise, hash33 } from './hash-noise.js';
import { GLSL_OKLAB, parseColor, toOklab, toHex, mixOklab } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {object} TruchetFieldConfig
 * @property {string[]} [colors] Two CSS hex colours: the lines' dim one and their bright one. Default a grey and white.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`: its first and last colours.
 * @property {string} [background] A CSS hex colour to fill behind the lines; none leaves the canvas clear there.
 * @property {number} [tile=26] A tile's side, in CSS px.
 * @property {number} [width=0.26] The lines' width at their brightest, a share of the tile.
 * @property {number} [thin=0.45] How thin the lines get where the noise is low, a share of `width`.
 * @property {boolean} [tube=true] Shade each line across its width, like a rounded tube.
 * @property {number} [period=8] Seconds between one tile's turns, on average.
 * @property {number} [turn=0.6] How long a turn takes, seconds.
 * @property {number} [scale=1.4] The brightness noise's features across the width.
 * @property {[number, number]} [drift=[0.03, 0.015]] How fast the bright patches pan, features a second.
 * @property {number} [seed=0] Which random tiling, so two cards differ.
 * @property {number} [speed=1] Plays every clock faster or slower; 0 for one still frame.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area kept empty: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 */

/** The settings' defaults, shared by the shader and the JS twin. */
export const TRUCHET_DEFAULTS = {
	tile: 26,
	width: 0.26,
	thin: 0.45,
	tube: true,
	period: 8,
	turn: 0.6,
	scale: 1.4,
	drift: /** @type {[number, number]} */ ([0.03, 0.015]),
	seed: 0,
};

/** The default colours: a grey and white. */
const GREYS = ['#5a5a5a', '#f4f3ef'];

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uSize;
uniform float uTile;
uniform float uTime;
uniform float uWidth;
uniform float uThin;
uniform float uTube;
uniform float uPeriod;
uniform float uTurn;
uniform float uScale;
uniform vec2 uDrift;
uniform float uSeed;
uniform vec3 uDim;
uniform vec3 uBright;
uniform vec4 uBg;
${GLSL_OKLAB}
${GLSL_QUIET}
${GLSL_HASH33}
${GLSL_GRADIENT_NOISE}

// A tile's way now (0 or 1) and how far through a quarter turn it is (0–1): its clock runs at its own rate and phase,
// and each tick picks a way from the hash of the tile and the tick.
vec2 tileState(vec2 cell, float t) {
	vec3 h = hash33(vec3(cell, uSeed));
	float clock = t / (uPeriod * (0.6 + 0.8 * h.x)) + h.y * 7.0;
	float tick = floor(clock);
	float now = step(0.5, hash33(vec3(cell + tick * 0.618, uSeed + 1.0)).x);
	float before = step(0.5, hash33(vec3(cell + (tick - 1.0) * 0.618, uSeed + 1.0)).x);
	float into = (clock - tick) * uPeriod * (0.6 + 0.8 * h.x) / max(uTurn, 0.001);
	float turning = (1.0 - step(1.0, into)) * abs(now - before);
	return vec2(mix(now, before, turning), turning * into);
}

void main() {
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	vec2 cell = floor(px / uTile);
	vec2 l = px / uTile - cell - 0.5;
	vec2 st = tileState(cell, uTime);
	// Mid-turn, the old way turned by the eased share of a quarter.
	float e = st.y * st.y * (3.0 - 2.0 * st.y) * 1.5707963;
	l = mat2(cos(e), sin(e), -sin(e), cos(e)) * l;
	vec2 k = st.x > 0.5 ? vec2(1.0, -1.0) : vec2(1.0, 1.0);
	float d = min(abs(length(l - 0.5 * k) - 0.5), abs(length(l + 0.5 * k) - 0.5));

	vec2 c = (cell + 0.5) * uTile / uRes.x;
	float tone = smoothstep(0.32, 0.72, gnoise(c * uScale + vec2(uSeed * 3.1, uSeed * 1.7) + uDrift * uTime));
	vec2 q = vec2(c.x - 0.5, 0.5 * uSize.y / uSize.x - c.y) * uSize.x / uSize.y;
	float open = mix(1.0 - uQuiet.w, 1.0, quietOpen(q));
	float half_ = 0.5 * uWidth * mix(uThin, 1.0, tone) * open;
	float aa = 1.0 / uTile;
	float lit = (1.0 - smoothstep(half_ - aa, half_ + aa, d)) * step(0.004, half_);
	float across = clamp(d / max(half_, 0.001), 0.0, 1.0);
	float shade = mix(1.0, 0.35 + 0.65 * sqrt(1.0 - across * across), uTube);
	vec3 col = fromOklab(mix(uDim, uBright, tone * open)) * shade;
	gl_FragColor = vec4(col * lit + uBg.rgb * uBg.a * (1.0 - lit), lit + uBg.a * (1.0 - lit));
}
`;

/**
 * Hermite smoothing between two edges (GLSL's `smoothstep`).
 *
 * @param {number} e0 Where it starts rising.
 * @param {number} e1 Where it reaches 1.
 * @param {number} x The value.
 * @returns {number} 0–1.
 */
const smooth = (e0, e1, x) => {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
	return t * t * (3 - 2 * t);
};

/**
 * A tile's way and turn at a time (the shader's `tileState`).
 *
 * @param {TruchetFieldConfig} config The settings (`period`, `turn`, `seed`).
 * @param {number} col The tile's column.
 * @param {number} row The tile's row.
 * @param {number} [time=0] Seconds (already at its speed).
 * @returns {{ way: 0 | 1, turning: number }} Its way (which corners its arcs hug) and how far through a quarter turn to it, 0 when still.
 */
export function truchetTile(config, col, row, time = 0) {
	const period = config.period ?? TRUCHET_DEFAULTS.period;
	const turn = config.turn ?? TRUCHET_DEFAULTS.turn;
	const seed = config.seed ?? TRUCHET_DEFAULTS.seed;
	const h = hash33(col, row, seed);
	const rate = period * (0.6 + 0.8 * h[0]);
	const clock = time / rate + h[1] * 7;
	const tick = Math.floor(clock);
	const way = (/** @type {number} */ n) => (hash33(col + n * 0.618, row + n * 0.618, seed + 1)[0] >= 0.5 ? 1 : 0);
	const now = way(tick);
	const before = way(tick - 1);
	const into = ((clock - tick) * rate) / Math.max(turn, 0.001);
	const mid = into < 1 && now !== before;
	return { way: /** @type {0 | 1} */ (mid ? before : now), turning: mid ? into : 0 };
}

/**
 * How bright a tile's lines are (the shader's tone), before the quiet area.
 *
 * @param {TruchetFieldConfig} config The settings (`scale`, `drift`, `seed`).
 * @param {number} x The tile's centre, widths from the left.
 * @param {number} y The tile's centre, widths from the top.
 * @param {number} [time=0] Seconds (already at its speed).
 * @returns {number} 0–1.
 */
export function truchetTone(config, x, y, time = 0) {
	const o = { ...TRUCHET_DEFAULTS, ...config };
	return smooth(0.32, 0.72, gnoise(x * o.scale + o.seed * 3.1 + o.drift[0] * time, y * o.scale + o.seed * 1.7 + o.drift[1] * time));
}

/**
 * The two colours as the shader takes them.
 *
 * @param {TruchetFieldConfig} config The settings.
 * @returns {[string, string]} The dim colour and the bright one.
 */
export function truchetColors(config) {
	const colors = pickColors(config, GREYS);
	return [colors[0], colors[colors.length - 1]];
}

/**
 * A CSS `background` that stands in for the field before the shader starts
 * and without WebGL: every tile one way (the arcs then run as rows of
 * S-bends), in the colour halfway from dim to bright, and the quiet area
 * left to the ground.
 *
 * @param {TruchetFieldConfig} config The settings (`colors`/`palette`, `background`, `tile`, `width`, `quiet`).
 * @returns {string} The CSS background.
 */
export function truchetStill(config) {
	const [dim, bright] = truchetColors(config).map(parseColor);
	const ground = config.background ?? '#000000';
	const tile = Math.max(4, config.tile ?? TRUCHET_DEFAULTS.tile);
	const w = Math.max(1, ((config.width ?? TRUCHET_DEFAULTS.width) * tile) / 2);
	const r = tile / 2;
	const ink = toHex(mixOklab(dim, bright, 0.5));
	const ring = (/** @type {string} */ at) =>
		`radial-gradient(circle at ${at}, transparent ${(r - w).toFixed(1)}px, ${ink} ${(r - w).toFixed(1)}px ${(r + w).toFixed(1)}px, transparent ${(r + w).toFixed(1)}px) 0 0 / ${tile}px ${tile}px`;
	const pc = (/** @type {number} */ n) => `${Math.round(n * 100)}%`;
	const quiet = config.quiet;
	const qr = pc((quiet?.radius ?? 0.8) * 0.55);
	return [
		quiet ? `radial-gradient(${qr} ${qr} at ${pc(quiet.x ?? 0.5)} ${pc(quiet.y ?? 0.5)}, ${ground} 55%, transparent 100%)` : '',
		ring('0 0'),
		ring('100% 100%'),
		ground,
	]
		.filter(Boolean)
		.join(', ');
}

/**
 * Starts the field on an element: a canvas inside it (its first), at the
 * stage's capped pixel ratio.
 *
 * @param {HTMLElement} el The element.
 * @param {TruchetFieldConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function truchetField(el, config) {
	const o = { ...TRUCHET_DEFAULTS, ...config };
	const speed = config.speed ?? 1;
	const lab = (/** @type {string} */ c) => toOklab(parseColor(c));
	let [dim, bright] = truchetColors(config).map(lab);
	const bg = config.background ? [...parseColor(config.background), 1] : [0, 0, 0, 0];
	const start = performance.now();

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		still: speed <= 0,
		setup({ gl, uniform }) {
			gl.uniform1f(uniform('uWidth'), o.width);
			gl.uniform1f(uniform('uThin'), o.thin);
			gl.uniform1f(uniform('uTube'), o.tube ? 1 : 0);
			gl.uniform1f(uniform('uPeriod'), Math.max(0.1, o.period));
			gl.uniform1f(uniform('uTurn'), o.turn);
			gl.uniform1f(uniform('uScale'), o.scale);
			gl.uniform2f(uniform('uDrift'), o.drift[0], o.drift[1]);
			gl.uniform1f(uniform('uSeed'), o.seed);
			gl.uniform4f(uniform('uBg'), bg[0], bg[1], bg[2], bg[3]);
		},
		resize({ gl, uniform, ratio }) {
			const w = Math.max(1, el.clientWidth);
			const h = Math.max(1, el.clientHeight);
			gl.uniform2f(uniform('uSize'), w, h);
			gl.uniform1f(uniform('uTile'), Math.max(4, o.tile) * ratio);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, w / h));
		},
		uniforms({ gl, uniform }, now) {
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000) * Math.max(0, speed));
			gl.uniform3f(uniform('uDim'), dim[0], dim[1], dim[2]);
			gl.uniform3f(uniform('uBright'), bright[0], bright[1], bright[2]);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		[dim, bright] = truchetColors({ colors: next.colors }).map(lab);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
