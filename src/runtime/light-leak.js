/**
 * @module @arraypress/effects-astro/light-leak
 *
 * A soft, slow colour field, a lava lamp or a light leak: value-noise fBm
 * (up to four octaves) under a gentle domain warp, sampled as three fields
 * that each drift on their own slow loop. The first mixes the two darkest
 * colours, the second the two brightest, the third mixes those two, all
 * in Oklab, so the ramp never passes through mud. Over it a very slow
 * breath, the whole frame 3% darker and back over three and a half
 * minutes; never a flash. `contrast` pushes each field toward the ramp's
 * ends so the brightest colour shows.
 *
 * One clock in seconds (`speed` plays it faster or slower; 0 is one still
 * frame). The field is measured in the canvas's shorter side, from its
 * centre, so a 330 px card and a 1280 px hero show blobs of the same
 * share; `offset` moves the sample window so two cards differ. A `quiet`
 * area flattens the field behind copy to one even tone of the ramp
 * (`quietTone`, 0 the darkest colour, 1 the brightest). Opaque by nature;
 * drawn at half the pixel ratio, as nothing in it is sharp, with a fixed
 * dither against banding. The same field is here in plain JavaScript
 * (`leakFields`, `leakColor`), and `lightLeakStill` makes a CSS background
 * from it to show before the shader starts or without WebGL.
 *
 * After `lavalamp_bg`, a Processing sketch shared with the owner
 * (2026-11-20): the noise, the warp, the three drifting fields, their
 * rates and the breath are its; here the colours mix in Oklab rather than
 * RGB, each field is rescaled to span 0–1 and pushed by `contrast` (the
 * sketch's never reached its brightest colour), the breath is half as
 * deep, the clock runs by the second, the units follow the canvas, and its
 * lattice hash is Dave Hoskins' Hash without Sine (MIT, © 2014 David
 * Hoskins), which stays stable at GPU precision and keeps the shader and
 * the JavaScript in step.
 */

import { createStage } from './stage.js';
import { GLSL_OKLAB, parseColor, toOklab, fromOklab, toHex } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {object} LightLeakConfig
 * @property {string[]} [colors] Four CSS hex colours, darkest first (fewer or more are resampled to four, in Oklab). Default the sketch's maroon ramp.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`: its three colours and glint, darkest first.
 * @property {number} [scale=1.5] How many blobs span the shorter side (higher is busier).
 * @property {number} [warp=0.3] How far the domain warp bends the field (0 for none).
 * @property {number} [octaves=2] Octaves of noise, 1–4: more adds finer detail.
 * @property {number} [contrast=1.6] How far each field is pushed from its middle toward the ramp's ends (1 is the noise as it is, 0.5–3).
 * @property {[number, number]} [offset=[0, 0]] Where the sample window sits, so two cards differ.
 * @property {number} [drift=0.3] How fast the blobs drift and the warp moves (the sketch's own, made for a long mix behind it,
 *   was 0.04: a loop took four and a half minutes, so a card looked still; 0.3 loops in about thirty-five seconds).
 * @property {number} [speed=1] Plays the clock faster or slower; 0 for one still frame.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area flattened to one tone behind copy: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 * @property {number} [quietTone=0] The tone the quiet area settles to: 0 the darkest colour, 1 the brightest (for dark copy).
 */

/** The settings' defaults, shared by the shader and the JavaScript twin. */
export const LEAK_DEFAULTS = {
	scale: 1.5,
	warp: 0.3,
	octaves: 2,
	contrast: 1.6,
	quietTone: 0,
	drift: 0.3,
};

/** The sketch's maroon ramp around #A40F27, darkest first. */
export const LEAK_COLORS = ['#0a0306', '#780c1c', '#a40f27', '#d65464'];

/** The breath: its depth (a share of the brightness) and its rate (radians a second). */
const BREATH = 0.03;
const BREATH_RATE = 0.03;
/** The share of the pixel ratio it draws at: the field has no hard edges. */
const RESOLUTION = 0.5;

/**
 * GLSL (ES 1.00): `leakHash`, `leakNoise` and `leakFbm(p, octaves)`, the
 * same as `leakHash`, `valueNoise` and `fbm` below.
 */
const GLSL_FIELD = `
float leakHash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
float leakNoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = p - i;
	f = f * f * (3.0 - 2.0 * f);
	float a = leakHash(i);
	float b = leakHash(i + vec2(1.0, 0.0));
	float c = leakHash(i + vec2(0.0, 1.0));
	float d = leakHash(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float leakFbm(vec2 p, float octaves) {
	float v = 0.0;
	float amp = 0.5;
	float freq = 1.0;
	for (int i = 0; i < 4; i++) {
		if (float(i) >= octaves) break;
		v += amp * leakNoise(p * freq);
		freq *= 2.0;
		amp *= 0.5;
	}
	return v / (1.0 - amp * 2.0);
}
float leakShape(float n, float contrast) {
	return clamp((n - 0.5) * contrast + 0.5, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uDrift;
uniform float uScale;
uniform float uWarp;
uniform float uOctaves;
uniform float uContrast;
uniform vec2 uOffset;
uniform float uTone;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
${GLSL_OKLAB}
${GLSL_QUIET}
${GLSL_FIELD}

void main() {
	// From the top left, as the JavaScript twin measures it.
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	vec2 p = (px - 0.5 * uRes) / min(uRes.x, uRes.y) * uScale + uOffset;
	float t = uTime * uDrift;
	if (uWarp > 0.0) {
		float wx = leakNoise(p * 0.5 + vec2(t * 0.2, 0.0));
		float wy = leakNoise(p * 0.5 + vec2(0.0, t * 0.2));
		p += vec2(wx, wy) * uWarp;
	}
	float n1 = leakShape(leakFbm(p + vec2(0.0, 0.1) + vec2(sin(t * 0.57), cos(t * 0.47)), uOctaves), uContrast);
	float n2 = leakShape(leakFbm(p + vec2(0.1, 0.0) + vec2(cos(t * 0.42), sin(t * 0.72)), uOctaves), uContrast);
	float n3 = leakShape(leakFbm(p + vec2(0.6, 0.2) + vec2(sin(t * 0.27), cos(t * 0.32)), uOctaves), uContrast);
	vec2 q = vec2(px.x - 0.5 * uRes.x, 0.5 * uRes.y - px.y) / uRes.y;
	float open = mix(1.0 - uQuiet.w, 1.0, quietOpen(q));
	n1 = mix(uTone, n1, open);
	n2 = mix(uTone, n2, open);
	n3 = mix(uTone, n3, open);
	vec3 col = fromOklab(mix(mix(uC0, uC1, n1), mix(uC2, uC3, n2), n3));
	col *= 1.0 - ${BREATH.toFixed(3)} * (0.5 - 0.5 * sin(uTime * ${BREATH_RATE.toFixed(3)}));
	col += (leakHash(gl_FragCoord.xy) - 0.5) / 255.0;
	gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * The lattice hash (the shader's `leakHash`): Dave Hoskins' Hash without
 * Sine, which brings its input under 1 before it multiplies, so the GPU's
 * 32-bit floats and these 64-bit ones agree. (The sketch's own hash
 * multiplied values in the hundreds, where the two drift apart.)
 *
 * @param {number} x A lattice point's x.
 * @param {number} y Its y.
 * @returns {number} 0–1.
 */
export function leakHash(x, y) {
	const fract = (/** @type {number} */ n) => n - Math.floor(n);
	let a = fract(x * 0.1031);
	let b = fract(y * 0.1031);
	let c = fract(x * 0.1031);
	const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
	a += d;
	b += d;
	c += d;
	return fract((a + b) * c);
}

/**
 * Value noise with a cubic Hermite fade (the shader's `leakNoise`).
 *
 * @param {number} x Where, x.
 * @param {number} y Where, y.
 * @returns {number} 0–1.
 */
export function valueNoise(x, y) {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	let fx = x - ix;
	let fy = y - iy;
	fx = fx * fx * (3 - 2 * fx);
	fy = fy * fy * (3 - 2 * fy);
	const a = leakHash(ix, iy);
	const b = leakHash(ix + 1, iy);
	const c = leakHash(ix, iy + 1);
	const d = leakHash(ix + 1, iy + 1);
	const ab = a + (b - a) * fx;
	const cd = c + (d - c) * fx;
	return ab + (cd - ab) * fy;
}

/**
 * Fractal value noise (the shader's `leakFbm`): each octave twice the
 * frequency and half the weight of the last, as the sketch sums them,
 * then divided by the weights' total so it spans 0–1 (mean 0.5) whatever
 * the octaves; the sketch's two octaves reached only 0.75, which kept its
 * brightest colour from ever showing.
 *
 * @param {number} x Where, x.
 * @param {number} y Where, y.
 * @param {number} [octaves=2] How many, 1–4.
 * @returns {number} 0–1.
 */
export function fbm(x, y, octaves = LEAK_DEFAULTS.octaves) {
	const n = clampOctaves(octaves);
	let v = 0;
	let amp = 0.5;
	let freq = 1;
	for (let i = 0; i < n; i++) {
		v += amp * valueNoise(x * freq, y * freq);
		freq *= 2;
		amp *= 0.5;
	}
	return v / (1 - amp * 2);
}

/**
 * A field pushed from its middle toward 0 and 1 (the shader's `leakShape`).
 *
 * @param {number} n The field, 0–1.
 * @param {number} [contrast=1.6] How hard: 1 leaves it as it is.
 * @returns {number} 0–1.
 */
export function leakShape(n, contrast = LEAK_DEFAULTS.contrast) {
	return Math.min(1, Math.max(0, (n - 0.5) * contrast + 0.5));
}

/**
 * An octave count as the shader takes it: a whole number, 1–4.
 *
 * @param {number | undefined} octaves The setting.
 * @returns {number} 1–4.
 */
export function clampOctaves(octaves) {
	return Math.min(4, Math.max(1, Math.round(Number.isFinite(octaves) ? /** @type {number} */ (octaves) : LEAK_DEFAULTS.octaves)));
}

/**
 * The four colours as the shader takes them, darkest first: `colors`
 * resampled to four stops (in Oklab), or a palette's three and its glint
 * put in order of lightness, or the sketch's maroon ramp.
 *
 * @param {LightLeakConfig} config The settings.
 * @returns {[string, string, string, string]} CSS hex colours.
 */
export function leakColors(config) {
	const picked = pickColors(config, LEAK_COLORS, (palette) =>
		[...palette.colors, palette.glint].sort((a, b) => toOklab(parseColor(a))[0] - toOklab(parseColor(b))[0]),
	);
	if (picked.length === 4) return /** @type {[string, string, string, string]} */ ([...picked]);
	const labs = picked.map((c) => toOklab(parseColor(c)));
	return /** @type {[string, string, string, string]} */ (
		[0, 1, 2, 3].map((i) => {
			const x = (i / 3) * (labs.length - 1);
			const lo = Math.floor(x);
			const hi = Math.min(lo + 1, labs.length - 1);
			const f = x - lo;
			return toHex(fromOklab(/** @type {[number, number, number]} */ (labs[lo].map((v, k) => v + (labs[hi][k] - v) * f))));
		})
	);
}

/**
 * The three fields at a point, as the shader samples them (quiet area
 * and all): what mixes the ramp there.
 *
 * @param {LightLeakConfig} config The settings.
 * @param {number} u Across, 0–1 from the left.
 * @param {number} v Down, 0–1 from the top.
 * @param {number} [aspect=1] The canvas's width over its height.
 * @param {number} [time=0] Seconds, as the shader's clock (already at its speed).
 * @returns {[number, number, number]} n1 (darkest pair), n2 (brightest pair), n3 (between them), each 0–1.
 */
export function leakFields(config, u, v, aspect = 1, time = 0) {
	const { scale, warp, contrast, quietTone, drift } = { ...LEAK_DEFAULTS, ...config };
	const octaves = clampOctaves(config.octaves);
	const [ox, oy] = config.offset ?? [0, 0];
	const unit = Math.min(aspect, 1);
	let x = ((u - 0.5) * aspect) / unit * scale + ox;
	let y = (v - 0.5) / unit * scale + oy;
	const t = time * drift;
	if (warp > 0) {
		const wx = valueNoise(x * 0.5 + t * 0.2, y * 0.5);
		const wy = valueNoise(x * 0.5, y * 0.5 + t * 0.2);
		x += wx * warp;
		y += wy * warp;
	}
	const n = /** @type {[number, number, number]} */ ([
		fbm(x + Math.sin(t * 0.57), y + 0.1 + Math.cos(t * 0.47), octaves),
		fbm(x + 0.1 + Math.cos(t * 0.42), y + Math.sin(t * 0.72), octaves),
		fbm(x + 0.6 + Math.sin(t * 0.27), y + 0.2 + Math.cos(t * 0.32), octaves),
	].map((f) => leakShape(f, contrast)));
	const [qx, qy, radius, depth] = quietUniform(config.quiet, aspect);
	if (radius <= 0) return n;
	const d = Math.hypot((u - 0.5) * aspect - qx, 0.5 - v - qy);
	const e = Math.min(1, Math.max(0, (d - radius * 0.06) / (radius - radius * 0.06)));
	const open = 1 - depth + depth * e * e * (3 - 2 * e);
	return /** @type {[number, number, number]} */ (n.map((f) => quietTone + (f - quietTone) * open));
}

/**
 * The ramp mixed by the three fields, in Oklab (the shader's mix).
 *
 * @param {string[]} colors The four colours, darkest first (`leakColors`).
 * @param {[number, number, number]} fields n1, n2 and n3 (`leakFields`).
 * @returns {string} The colour, CSS hex.
 */
export function leakMix(colors, [n1, n2, n3]) {
	const [c0, c1, c2, c3] = colors.map((c) => toOklab(parseColor(c)));
	const mix = (/** @type {number[]} */ a, /** @type {number[]} */ b, /** @type {number} */ t) => a.map((v, i) => v + (b[i] - v) * t);
	return toHex(fromOklab(/** @type {[number, number, number]} */ (mix(mix(c0, c1, n1), mix(c2, c3, n2), n3))));
}

/**
 * The field's colour at a point: what the shader draws there (bar the
 * breath and the dither).
 *
 * @param {LightLeakConfig} config The settings.
 * @param {number} u Across, 0–1 from the left.
 * @param {number} v Down, 0–1 from the top.
 * @param {number} [aspect=1] The canvas's width over its height.
 * @param {number} [time=0] Seconds, as the shader's clock.
 * @returns {string} CSS hex.
 */
export function leakColor(config, u, v, aspect = 1, time = 0) {
	return leakMix(leakColors(config), leakFields(config, u, v, aspect, time));
}

/**
 * A CSS background close to the field's first frame: soft radial pools of
 * its colour at a three-by-three grid of points over the average of them.
 * For the element's `background`, shown before the shader starts and
 * where there is no WebGL.
 *
 * @param {LightLeakConfig} config The settings (quiet area included).
 * @param {number} [aspect=1] The element's width over its height.
 * @returns {string} A CSS `background` value.
 */
export function lightLeakStill(config, aspect = 1) {
	const colors = leakColors(config);
	/** @type {{ x: number, y: number, hex: string }[]} */
	const pools = [];
	for (const y of [1 / 6, 3 / 6, 5 / 6]) for (const x of [1 / 6, 3 / 6, 5 / 6]) pools.push({ x, y, hex: leakMix(colors, leakFields(config, x, y, aspect, 0)) });
	const labs = pools.map((p) => toOklab(parseColor(p.hex)));
	const mean = toHex(fromOklab(/** @type {[number, number, number]} */ ([0, 1, 2].map((k) => labs.reduce((s, l) => s + l[k], 0) / labs.length))));
	const pct = (/** @type {number} */ n) => `${Math.round(n * 1000) / 10}%`;
	return [...pools.map((p) => `radial-gradient(42% 42% at ${pct(p.x)} ${pct(p.y)}, ${p.hex} 0%, ${p.hex}00 100%)`), mean].join(', ');
}

/**
 * Starts the light leak on an element: a canvas inside it (its first),
 * filling it, opaque.
 *
 * @param {HTMLElement} el The element.
 * @param {LightLeakConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function lightLeak(el, config) {
	const o = { ...LEAK_DEFAULTS, ...config };
	const speed = Math.max(0, config.speed ?? 1);
	const labs = (/** @type {string[]} */ colors) => colors.map((c) => toOklab(parseColor(c)));
	let ramp = labs(leakColors(config));
	const start = performance.now();

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		scale: RESOLUTION,
		still: speed <= 0,
		setup({ gl, uniform }) {
			gl.uniform1f(uniform('uScale'), o.scale);
			gl.uniform1f(uniform('uWarp'), Math.max(0, o.warp));
			gl.uniform1f(uniform('uOctaves'), clampOctaves(config.octaves));
			gl.uniform1f(uniform('uContrast'), Math.max(0, o.contrast));
			gl.uniform2f(uniform('uOffset'), ...(config.offset ?? [0, 0]));
			gl.uniform1f(uniform('uTone'), Math.min(1, Math.max(0, o.quietTone)));
			gl.uniform1f(uniform('uDrift'), Math.max(0, o.drift));
		},
		resize({ gl, uniform, canvas }) {
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, canvas.width / canvas.height));
		},
		uniforms({ gl, uniform }, now) {
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000) * speed);
			ramp.forEach((lab, i) => gl.uniform3f(uniform(`uC${i}`), lab[0], lab[1], lab[2]));
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		ramp = labs(leakColors({ colors: next.colors }));
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
