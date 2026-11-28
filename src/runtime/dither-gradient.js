/**
 * @module @arraypress/effects-astro/dither-gradient
 *
 * A soft colour gradient drawn only in dots: the tone of a slow, smooth
 * shape (a wavy horizon, a glowing band, a swirl, a pinwheel, stepped
 * columns falling, a soft orb or a glowing pill) decides at each dot of a fixed grid whether it shows
 * (`mode: 'bayer'`, an 8×8 ordered dither: square dots that thin out as the
 * tone falls) or how big it is (`mode: 'halftone'`: round dots that shrink),
 * its colour blended from a dim one to a bright one in Oklab (through a
 * middle colour when three are given). The dots keep
 * their size in CSS px; the shapes are measured in widths, so a 330 px card
 * and a 1280 px hero show the same picture.
 *
 * Every clock is in seconds and nothing is kept between frames: each shape
 * is a function of where and when, here in GLSL and in plain JavaScript
 * (`gradientTone`, `gradientDots`) alike, so a still and a test see what the
 * shader draws.
 *
 * Clear where there are no dots (or the `background` colour), so it lays
 * over any ground. A `quiet` area empties it behind copy. Without WebGL
 * nothing is drawn; with prefers-reduced-motion it is one still frame.
 */

import { createStage } from './stage.js';
import { GLSL_GRADIENT_NOISE, GLSL_HASH33, gnoise, hash33 } from './hash-noise.js';
import { GLSL_BAYER, bayer } from './bayer.js';
import { GLSL_OKLAB, parseColor, toOklab, mixOklab, toHex } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';
import { frameNow } from './loop.js';

/**
 * @typedef {'wave' | 'band' | 'swirl' | 'pinwheel' | 'steps' | 'orb' | 'pill'} GradientShape
 *
 * @typedef {object} DitherGradientConfig
 * @property {string[]} [colors] Two CSS hex colours, the dim one where the tone is low and the bright one where it is full, or three with a middle colour between them. Default a plum and a hot pink.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`: its first and last colours.
 * @property {string} [background] A CSS hex colour to fill behind the dots; none leaves the canvas clear there.
 * @property {GradientShape} [shape='wave'] The gradient's shape.
 * @property {'bayer' | 'halftone'} [mode='bayer'] Square dots an ordered dither thins out, or round dots that shrink.
 * @property {number} [dot=4] The dots' grid, in CSS px.
 * @property {number} [fill=1] Share of its cell a full dot covers (below 1 leaves a gap between dots).
 * @property {number} [soft=0.35] How soft the gradient is: the edge's width, in widths for the wave, band and steps, a share of a turn for the swirl and pinwheel.
 * @property {number} [angle=0] Which way the wave, band and steps rise from, degrees: 0 from the bottom, 90 from the left.
 * @property {number} [level=0.12] Where the wave's horizon, the band's middle and the steps' line sit, widths below the centre (along `angle`).
 * @property {number} [arms=3] The swirl's and pinwheel's arms.
 * @property {number} [twist=2] How tightly the swirl winds (per e-fold of radius) and the pinwheel bends (turns per width).
 * @property {number} [rate=0.03] How fast it moves, cycles a second.
 * @property {number} [block=6] The steps' block, in dots.
 * @property {number} [size=0.3] The orb's radius, and the pill's thickness's share, in widths.
 * @property {number} [steps=0] Colour bands from dim to bright; 0 blends smoothly.
 * @property {[number, number]} [centre=[0.5, 0.5]] The swirl's and pinwheel's centre, and the wave's and band's pivot, 0–1 from the top left.
 * @property {[number, number]} [offset=[0, 0]] Where the shapes' noise starts, so two cards differ.
 * @property {number} [speed=1] Plays the clock faster or slower; 0 for one still frame.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area kept empty: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 */

/** The shapes, in the order the shader numbers them. */
export const GRADIENT_SHAPES = /** @type {const} */ (['wave', 'band', 'swirl', 'pinwheel', 'steps', 'orb', 'pill']);

/** The settings' defaults, shared by the shader and the JS twin. */
export const GRADIENT_DEFAULTS = {
	shape: /** @type {GradientShape} */ ('wave'),
	mode: /** @type {'bayer' | 'halftone'} */ ('bayer'),
	dot: 4,
	fill: 1,
	soft: 0.35,
	angle: 0,
	level: 0.12,
	arms: 3,
	twist: 2,
	rate: 0.03,
	block: 6,
	size: 0.3,
	steps: 0,
	centre: /** @type {[number, number]} */ ([0.5, 0.5]),
};

/** The default colours: a plum and a hot pink. */
const PINK = ['#3a0f3a', '#ff1f8f'];

/**
 * GLSL: `float gradientTone(vec2 c, float H, float t)`, the tone 0–1 at a
 * point (in widths from the top left; H the height in widths) at a time:
 * `gradientTone` below is the same in JavaScript.
 */
const GLSL_TONE = `
uniform float uShape;
uniform float uSoft;
uniform float uAngle;
uniform float uLevel;
uniform float uArms;
uniform float uTwist;
uniform float uRate;
uniform float uBlock;
uniform float uSizeW;
uniform vec2 uCentre;
uniform vec2 uOffset;
float gradientTone(vec2 c, float H, float t) {
	vec2 p = c - vec2(uCentre.x, uCentre.y * H);
	float s = sin(uAngle), k = cos(uAngle);
	float u = p.x * k + p.y * s;
	float v = p.y * k - p.x * s;
	float ph = t * uRate;
	if (uShape > 4.5) {
		// the orb and the pill: a soft glow wandering slowly about the centre
		vec2 w = vec2(gnoise(vec2(ph * 0.9 + uOffset.x, uOffset.y)), gnoise(vec2(uOffset.x, ph * 0.9 + uOffset.y))) - 0.5;
		vec2 d = vec2(u, v) - w * 0.24;
		if (uShape > 5.5) d.x = max(abs(d.x) - uSizeW * 1.1, 0.0);
		float r0 = max(uShape > 5.5 ? uSizeW * 0.55 : uSizeW, 0.02) * (1.0 + 0.08 * sin(6.2831853 * ph));
		float e = clamp(uSoft, 0.05, 1.0);
		return exp(-pow(length(d) / r0, 2.0) * (1.2 / e));
	}
	if (uShape < 0.5) {
		float h = uLevel + 0.07 * sin(6.2831853 * (u * 1.1 + ph)) + 0.22 * (gnoise(vec2(u * 2.2 + uOffset.x, ph * 0.8 + uOffset.y)) - 0.5);
		return smoothstep(-uSoft * 0.5, uSoft * 0.5, v - h);
	}
	if (uShape < 1.5) {
		float d = v - uLevel - 0.22 * sin(6.2831853 * ph) - 0.18 * (gnoise(vec2(u * 1.6 + uOffset.x, ph + uOffset.y)) - 0.5);
		float w = max(uSoft * 0.5, 0.02);
		return exp(-(d * d) / (w * w));
	}
	float r = length(p);
	float a = atan(p.y, p.x);
	if (uShape < 3.5) {
		float wind = uShape < 2.5 ? log(max(r, 0.001)) * uTwist : r * uTwist;
		float wave = 0.5 + 0.5 * cos(6.2831853 * (a / 6.2831853 * uArms + wind - ph));
		float e = clamp(uSoft, 0.02, 1.0) * 0.5;
		return smoothstep(0.6 - e, 0.6 + e, wave) * (0.5 + 0.5 * smoothstep(0.15, 0.8, r)) * smoothstep(0.08, 0.42, r);
	}
	float bw = uBlock;
	float col = floor(u / bw);
	vec3 hc = hash33(vec3(col, uOffset.x, uOffset.y));
	float line = uLevel + (hc.x - 0.5) * 0.16 + 0.06 * sin(6.2831853 * (ph + hc.y));
	float y = floor(v / bw) * bw;
	return clamp((y - line) / max(uSoft * 0.6, 0.02), 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uSize;
uniform float uPitch;
uniform float uTime;
uniform float uMode;
uniform float uFill;
uniform float uSteps;
uniform vec3 uLow;
uniform vec3 uMid;
uniform vec3 uHigh;
uniform vec4 uBg;
${GLSL_OKLAB}
${GLSL_QUIET}
${GLSL_HASH33}
${GLSL_GRADIENT_NOISE}
${GLSL_BAYER}
${GLSL_TONE}

void main() {
	// Canvas pixels from the top left, the dot under them, and where in it (−0.5 to 0.5).
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	vec2 cell = floor(px / uPitch);
	vec2 local = px / uPitch - cell - 0.5;
	vec2 c = (cell + 0.5) / uSize.x;
	float H = uSize.y / uSize.x;
	float tone = clamp(gradientTone(c, H, uTime), 0.0, 1.0);

	vec2 q = vec2(c.x - 0.5, (0.5 * uSize.y - (cell.y + 0.5)) / uSize.x) * uSize.x / uSize.y;
	// squared, so a smooth tone clears well inside the radius (a ramp alone leaves half-tone dots behind copy)
	float open = mix(1.0 - uQuiet.w, 1.0, quietOpen(q));
	tone *= open * open;

	float lit;
	if (uMode < 0.5) {
		float inside = step(max(abs(local.x), abs(local.y)), uFill * 0.5);
		lit = step(bayer8(cell), tone - 0.5 / 64.0) * inside;
	} else {
		float aa = 0.75 / uPitch;
		float r = 0.7071 * sqrt(tone) * uFill;
		lit = (1.0 - smoothstep(r - aa, r + aa, length(local))) * step(0.004, tone);
	}

	float tq = uSteps > 0.5 ? floor(tone * uSteps + 0.5) / uSteps : tone;
	vec3 col = fromOklab(tq < 0.5 ? mix(uLow, uMid, tq * 2.0) : mix(uMid, uHigh, tq * 2.0 - 1.0));
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

/** A clamp to 0–1. */
const unit = (/** @type {number} */ n) => Math.min(1, Math.max(0, n));

/**
 * The settings, filled with the defaults, as the shader takes them: the
 * shape's number, the angle in radians and the block in widths.
 *
 * @param {DitherGradientConfig} config The settings.
 * @param {number} cols The target's width in dots (the steps' block is in dots).
 * @returns {Required<Omit<DitherGradientConfig, 'colors' | 'palette' | 'background' | 'quiet' | 'shape' | 'mode'>> & { shapeIndex: number, modeIndex: number, rad: number, blockW: number }} The settings.
 */
export function gradientSettings(config, cols) {
	const o = { ...GRADIENT_DEFAULTS, offset: /** @type {[number, number]} */ ([0, 0]), speed: 1, ...config };
	const shapeIndex = Math.max(0, GRADIENT_SHAPES.indexOf(o.shape));
	return {
		...o,
		shapeIndex,
		modeIndex: o.mode === 'halftone' ? 1 : 0,
		rad: (o.angle * Math.PI) / 180,
		blockW: Math.max(1, o.block) / Math.max(1, cols),
	};
}

/**
 * The tone at a point (the shader's `gradientTone`), before the quiet area.
 *
 * @param {ReturnType<typeof gradientSettings>} s The settings, as `gradientSettings` gives them.
 * @param {number} x Widths from the left.
 * @param {number} y Widths from the top.
 * @param {number} H The height in widths.
 * @param {number} [time=0] Seconds (already at its speed).
 * @returns {number} 0–1.
 */
export function gradientTone(s, x, y, H, time = 0) {
	const px = x - s.centre[0];
	const py = y - s.centre[1] * H;
	const sn = Math.sin(s.rad);
	const k = Math.cos(s.rad);
	const u = px * k + py * sn;
	const v = py * k - px * sn;
	const ph = time * s.rate;
	const [ox, oy] = s.offset;
	if (s.shapeIndex >= 5) {
		const wx = gnoise(ph * 0.9 + ox, oy) - 0.5;
		const wy = gnoise(ox, ph * 0.9 + oy) - 0.5;
		let dx = u - wx * 0.24;
		const dy = v - wy * 0.24;
		if (s.shapeIndex === 6) dx = Math.max(Math.abs(dx) - s.size * 1.1, 0);
		const r0 = Math.max(s.shapeIndex === 6 ? s.size * 0.55 : s.size, 0.02) * (1 + 0.08 * Math.sin(2 * Math.PI * ph));
		const e = Math.min(1, Math.max(0.05, s.soft));
		return Math.exp(-((Math.hypot(dx, dy) / r0) ** 2) * (1.2 / e));
	}
	if (s.shapeIndex === 0) {
		const h = s.level + 0.07 * Math.sin(2 * Math.PI * (u * 1.1 + ph)) + 0.22 * (gnoise(u * 2.2 + ox, ph * 0.8 + oy) - 0.5);
		return smooth(-s.soft * 0.5, s.soft * 0.5, v - h);
	}
	if (s.shapeIndex === 1) {
		const d = v - s.level - 0.22 * Math.sin(2 * Math.PI * ph) - 0.18 * (gnoise(u * 1.6 + ox, ph + oy) - 0.5);
		const w = Math.max(s.soft * 0.5, 0.02);
		return Math.exp(-(d * d) / (w * w));
	}
	const r = Math.hypot(px, py);
	const a = Math.atan2(py, px);
	if (s.shapeIndex <= 3) {
		const wind = s.shapeIndex === 2 ? Math.log(Math.max(r, 0.001)) * s.twist : r * s.twist;
		const wave = 0.5 + 0.5 * Math.cos(2 * Math.PI * ((a / (2 * Math.PI)) * s.arms + wind - ph));
		const e = Math.min(1, Math.max(0.02, s.soft)) * 0.5;
		return smooth(0.6 - e, 0.6 + e, wave) * (0.5 + 0.5 * smooth(0.15, 0.8, r)) * smooth(0.08, 0.42, r);
	}
	const col = Math.floor(u / s.blockW);
	const hc = hash33(col, ox, oy);
	const line = s.level + (hc[0] - 0.5) * 0.16 + 0.06 * Math.sin(2 * Math.PI * (ph + hc[1]));
	const yq = Math.floor(v / s.blockW) * s.blockW;
	return unit((yq - line) / Math.max(s.soft * 0.6, 0.02));
}

/**
 * One frame dot for dot, as the shader draws it on a target exactly `cols`
 * by `rows` dots: each dot's tone after the quiet area (0 where none
 * shows), and whether a bayer dot is lit there.
 *
 * @param {DitherGradientConfig} config The settings (the same as the shader's).
 * @param {number} cols Dots across.
 * @param {number} rows Dots down.
 * @param {number} [time=0] Seconds, as the shader's clock (already at its speed).
 * @returns {{ tone: number, lit: boolean }[][]} Each row's dots.
 */
export function gradientDots(config, cols, rows, time = 0) {
	const s = gradientSettings(config, cols);
	const H = rows / cols;
	const [qx, qy, radius, depth] = quietUniform(config.quiet, cols / rows);
	return Array.from({ length: rows }, (_, r) =>
		Array.from({ length: cols }, (_, k) => {
			let tone = unit(gradientTone(s, (k + 0.5) / cols, (r + 0.5) / cols, H, time));
			if (radius > 0) {
				const qd = Math.hypot(((k + 0.5) / cols - 0.5) * (cols / rows) - qx, (0.5 * rows - (r + 0.5)) / rows - qy);
				const open = 1 - depth + depth * smooth(radius * 0.06, radius, qd);
				tone *= open * open;
			}
			return { tone, lit: tone - 0.5 / 64 > bayer(k, r) };
		}),
	);
}

/**
 * The three colours the dots are blended through, low to high: a middle
 * colour of their own when three or more are given, else halfway in Oklab
 * (so two colours blend exactly as before).
 *
 * @param {DitherGradientConfig} config The settings.
 * @returns {[string, string, string]} The dim colour, the middle and the bright one.
 */
export function gradientRamp(config) {
	const colors = pickColors(config, PINK);
	const low = colors[0];
	const high = colors[colors.length - 1];
	const mid = colors.length >= 3 ? colors[Math.floor(colors.length / 2)] : toHex(mixOklab(parseColor(low), parseColor(high), 0.5));
	return [low, mid, high];
}

/**
 * The two colours as the shader takes them.
 *
 * @param {DitherGradientConfig} config The settings.
 * @returns {[string, string]} The dim colour and the bright one.
 */
export function gradientColors(config) {
	const colors = pickColors(config, PINK);
	return [colors[0], colors[colors.length - 1]];
}

/**
 * The shape as a CSS gradient layer (under the dot screen of the still).
 *
 * @param {DitherGradientConfig} config The settings.
 * @param {string} low The dim colour.
 * @param {string} mid Halfway, in Oklab.
 * @param {string} high The bright colour.
 * @returns {string} One CSS background layer.
 */
function shapeLayer(config, low, mid, high) {
	const o = { ...GRADIENT_DEFAULTS, ...config };
	const [cx, cy] = o.centre;
	const at = `${Math.round(cx * 100)}% ${Math.round(cy * 100)}%`;
	// CSS angles point where a gradient runs to: 0deg starts at the bottom, as `angle` 0 rises from it
	const to = Math.round(o.angle);
	if (o.shape === 'orb') return `radial-gradient(circle at ${at}, ${high} 0%, ${mid} ${Math.round(o.size * 55)}%, ${low} ${Math.round(o.size * 95)}%, transparent ${Math.round(o.size * 150)}%)`;
	if (o.shape === 'pill') return `radial-gradient(ellipse ${Math.round(o.size * 160)}% ${Math.round(o.size * 60)}% at ${at}, ${high} 0%, ${mid} 40%, ${low} 70%, transparent 100%)`;
	if (o.shape === 'band') return `linear-gradient(${to}deg, transparent 22%, ${low} 36%, ${high} 50%, ${low} 64%, transparent 78%)`;
	if (o.shape === 'swirl' || o.shape === 'pinwheel') {
		const arm = 360 / Math.max(1, Math.round(o.arms));
		return `repeating-conic-gradient(from 0deg at ${at}, ${high} 0deg, ${low} ${(arm * 0.3).toFixed(1)}deg, transparent ${(arm * 0.5).toFixed(1)}deg, transparent ${arm.toFixed(1)}deg)`;
	}
	return `linear-gradient(${to}deg, ${high} 0%, ${mid} 22%, ${low} 36%, transparent 52%)`;
}

/**
 * A CSS `background` that stands in for the gradient before the shader
 * starts and without WebGL: the shape as a CSS gradient seen through a
 * screen of the ground (a dot checker for bayer, round holes for
 * halftone), and the quiet area left to the ground.
 *
 * @param {DitherGradientConfig} config The settings (`colors`/`palette`, `background`, `shape`, `mode`, `dot`, `angle`, `arms`, `centre`, `quiet`).
 * @returns {string} The CSS background.
 */
export function gradientStill(config) {
	const [low, mid, high] = gradientRamp(config);
	const ground = config.background ?? '#000000';
	const dot = Math.max(1, config.dot ?? GRADIENT_DEFAULTS.dot);
	const pc = (/** @type {number} */ n) => `${Math.round(n * 100)}%`;
	const quiet = config.quiet;
	const r = pc((quiet?.radius ?? 0.8) * 0.55);
	const screen =
		config.mode === 'halftone'
			? `radial-gradient(circle, transparent 34%, ${ground} 38%) 0 0 / ${dot}px ${dot}px`
			: `repeating-conic-gradient(${ground} 0 25%, transparent 0 50%) 0 0 / ${dot * 2}px ${dot * 2}px`;
	return [
		quiet ? `radial-gradient(${r} ${r} at ${pc(quiet.x ?? 0.5)} ${pc(quiet.y ?? 0.5)}, ${ground} 55%, transparent 100%)` : '',
		screen,
		shapeLayer(config, toHex(parseColor(low)), toHex(parseColor(mid)), toHex(parseColor(high))),
		ground,
	]
		.filter(Boolean)
		.join(', ');
}

/**
 * Starts the gradient on an element: a canvas inside it (its first), at
 * the stage's capped pixel ratio, the dots worked out a pixel at a time.
 *
 * @param {HTMLElement} el The element.
 * @param {DitherGradientConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function ditherGradient(el, config) {
	const speed = config.speed ?? 1;
	const lab = (/** @type {string} */ c) => toOklab(parseColor(c));
	let [low, mid, high] = gradientRamp(config).map(lab);
	const bg = config.background ? [...parseColor(config.background), 1] : [0, 0, 0, 0];
	const dot = Math.max(1, config.dot ?? GRADIENT_DEFAULTS.dot);
	const start = frameNow();

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		still: speed <= 0,
		// The dots are drawn at the canvas's own pixels: a lower resolution would blur them.
		adaptive: false,
		setup({ gl, uniform }) {
			gl.uniform4f(uniform('uBg'), bg[0], bg[1], bg[2], bg[3]);
		},
		resize({ gl, uniform, ratio }) {
			const cols = Math.max(1, el.clientWidth / dot);
			const rows = Math.max(1, el.clientHeight / dot);
			const s = gradientSettings(config, cols);
			gl.uniform2f(uniform('uSize'), cols, rows);
			gl.uniform1f(uniform('uPitch'), dot * ratio);
			gl.uniform1f(uniform('uShape'), s.shapeIndex);
			gl.uniform1f(uniform('uMode'), s.modeIndex);
			gl.uniform1f(uniform('uFill'), s.fill);
			gl.uniform1f(uniform('uSteps'), s.steps);
			gl.uniform1f(uniform('uSoft'), s.soft);
			gl.uniform1f(uniform('uAngle'), s.rad);
			gl.uniform1f(uniform('uLevel'), s.level);
			gl.uniform1f(uniform('uArms'), s.arms);
			gl.uniform1f(uniform('uTwist'), s.twist);
			gl.uniform1f(uniform('uRate'), s.rate);
			gl.uniform1f(uniform('uBlock'), s.blockW);
			gl.uniform1f(uniform('uSizeW'), s.size);
			gl.uniform2f(uniform('uCentre'), s.centre[0], s.centre[1]);
			gl.uniform2f(uniform('uOffset'), s.offset[0], s.offset[1]);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, cols / rows));
		},
		uniforms({ gl, uniform }, now) {
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000) * Math.max(0, speed));
			gl.uniform3f(uniform('uLow'), low[0], low[1], low[2]);
			gl.uniform3f(uniform('uMid'), mid[0], mid[1], mid[2]);
			gl.uniform3f(uniform('uHigh'), high[0], high[1], high[2]);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		[low, mid, high] = gradientRamp({ colors: next.colors }).map(lab);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
