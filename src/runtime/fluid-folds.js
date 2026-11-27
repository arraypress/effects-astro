/**
 * @module @arraypress/effects-astro/fluid-folds
 *
 * Glossy folds of liquid colour on a dark ground: a height field of soft
 * folds, warped by slow noise, lit from one side, so each fold catches a
 * bright, glassy highlight along its crest and falls into shadow behind it.
 * Its colour runs along a ramp of three colours (in Oklab) that drifts
 * across the folds, so a fold turns from deep to hot as it bends. Two
 * styles: `liquid`, folds bending every way like poured enamel, and
 * `dunes`, long folds lying across the frame like silk dunes.
 *
 * Every clock is in seconds and nothing is kept between frames: the height
 * field is a function of where and when, here in GLSL and in plain
 * JavaScript too (`foldHeight`, `foldShade`), so a still and a test see
 * what the shader draws. It is made to sit behind copy: no pointer, and a
 * `quiet` area dims the folds behind a lockup.
 *
 * Opaque: it paints its `background` (default near-black) everywhere.
 * Without WebGL nothing is drawn; with prefers-reduced-motion it is one
 * still frame.
 */

import { createStage } from './stage.js';
import { GLSL_GRADIENT_NOISE, GLSL_HASH33, gnoise } from './hash-noise.js';
import { GLSL_OKLAB, parseColor, toOklab, toHex, mixOklab } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {'liquid' | 'dunes'} FoldStyle
 *
 * @typedef {object} FluidFoldsConfig
 * @property {string[]} [colors] Three CSS hex colours along the folds: deep, mid and hot. Default cobalt, violet and coral.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {string} [background='#050409'] The ground, painted everywhere (the folds' deepest shadow).
 * @property {FoldStyle} [style='liquid'] Folds bending every way, or long folds lying across the frame.
 * @property {number} [scale=1.6] How many folds across the height.
 * @property {number} [warp=0.9] How far the noise bends the folds.
 * @property {number} [gloss=0.8] How bright and tight the highlight along each crest is; 0 for none.
 * @property {number} [light=-30] Where the light comes from, degrees from straight above (negative from the left).
 * @property {number} [hue=0.5] How fast the colour runs across the folds (higher shows more of the ramp at once).
 * @property {number} [rate=0.03] How fast the folds move, cycles a second.
 * @property {number} [level=0.55] For dunes, where the folds sit, a share of the height from the top (above it, the dark sky).
 * @property {number} [grain=0.03] Fine grain over all of it; 0 for none.
 * @property {number} [seed=0] Where its noise starts, so two cards differ.
 * @property {number} [speed=1] Plays every clock faster or slower; 0 for one still frame.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area dimmed: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 */

/** The styles, in the order the shader numbers them. */
export const FOLD_STYLES = /** @type {const} */ (['liquid', 'dunes']);

/** The settings' defaults, shared by the shader and the JS twin. */
export const FOLD_DEFAULTS = {
	background: '#050409',
	style: /** @type {FoldStyle} */ ('liquid'),
	scale: 1.6,
	warp: 0.9,
	gloss: 0.8,
	light: -30,
	hue: 0.5,
	rate: 0.03,
	level: 0.55,
	grain: 0.03,
	seed: 0,
};

/** The default colours: cobalt, violet and coral, after the owner's fluid references. */
const ENAMEL = ['#1638ff', '#7b2cff', '#ff4a3d'];

/**
 * GLSL: `float foldHeight(vec2 p, float t)` (heights from the top left)
 * and `float foldHue(vec2 p, float t)`, the same as `foldHeight` and
 * `foldHue` below in JavaScript.
 */
const GLSL_FOLDS = `
uniform float uStyle;
uniform float uScale;
uniform float uWarp;
uniform float uRate;
uniform float uLevel;
uniform float uHueRate;
uniform float uSeed;
float fbm3(vec2 p) {
	return 0.55 * gnoise(p) + 0.3 * gnoise(p * 2.03 + 17.1) + 0.15 * gnoise(p * 4.01 + 41.7);
}
float foldHeight(vec2 p, float t) {
	float ph = t * uRate;
	vec2 q = p * uScale + vec2(uSeed, uSeed * 0.7);
	if (uStyle < 0.5) {
		vec2 w = vec2(fbm3(q * 0.8 + vec2(ph, 0.0)), fbm3(q * 0.8 + vec2(5.2, 1.3 - ph))) - 0.5;
		vec2 r = q + uWarp * 2.0 * w;
		return 0.5 + 0.5 * sin(6.2831853 * (fbm3(r) * 2.6 + ph * 0.5));
	}
	vec2 w = vec2(fbm3(vec2(q.x * 0.5 + ph, q.y * 0.3)), 0.0) - 0.5;
	float y = q.y * 2.2 + uWarp * 1.6 * (fbm3(vec2(q.x * 0.7 - ph * 0.6, q.y * 0.6)) - 0.5) + w.x;
	float ridge = 0.5 + 0.5 * sin(6.2831853 * y + 2.0 * sin(q.x * 1.3 + ph * 2.0));
	float sky = smoothstep(uLevel - 0.25, uLevel + 0.1, p.y);
	return ridge * sky;
}
float foldHue(vec2 p, float t) {
	return fract(gnoise(p * uHueRate * 1.7 + vec2(uSeed * 1.3 + t * uRate * 0.6, uSeed)) * 1.4 + p.x * 0.18);
}
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uGloss;
uniform vec2 uLight;
uniform float uGrain;
uniform vec3 uBg;
uniform vec3 uRamp[3];
${GLSL_OKLAB}
${GLSL_QUIET}
${GLSL_HASH33}
${GLSL_GRADIENT_NOISE}
${GLSL_FOLDS}

vec3 rampAt(float h) {
	// deep, mid, hot, and round again to deep, so the hue drifts without a seam
	float x = h * 3.0;
	if (x < 1.0) return mix(uRamp[0], uRamp[1], x);
	if (x < 2.0) return mix(uRamp[1], uRamp[2], x - 1.0);
	return mix(uRamp[2], uRamp[0], x - 2.0);
}

void main() {
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	vec2 p = px / uRes.y;
	float e = 1.5 / uRes.y;
	float h = foldHeight(p, uTime);
	float hx = foldHeight(p + vec2(e, 0.0), uTime);
	float hy = foldHeight(p + vec2(0.0, e), uTime);
	// the surface's slope, in heights of the frame
	vec3 n = normalize(vec3((h - hx) / e * 0.06, (h - hy) / e * 0.06, 1.0));
	vec3 L = normalize(vec3(uLight, 0.9));
	float diff = clamp(dot(n, L), 0.0, 1.0);
	float spec = pow(clamp(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0, 1.0), mix(8.0, 60.0, uGloss)) * uGloss;
	float body = smoothstep(0.08, 0.95, h);

	float hue = foldHue(p, uTime);
	vec3 lab = mix(uBg, rampAt(hue), body * (0.18 + 0.82 * diff));
	vec3 col = fromOklab(lab);
	// an iridescent rim where a fold turns away, in the next colour round the ramp, and the glossy highlight on top
	float rim = pow(clamp(1.0 - n.z, 0.0, 1.0), 1.5) * 2.2;
	col += fromOklab(rampAt(fract(hue + 0.33))) * rim * body * 0.6;
	col += spec * mix(vec3(1.0), fromOklab(rampAt(fract(hue + 0.66))), 0.4) * body * 1.3;

	vec2 q = vec2(p.x - 0.5 * uRes.x / uRes.y, 0.5 - p.y);
	col *= mix(1.0 - uQuiet.w, 1.0, quietOpen(q));
	col += (hash33(vec3(px, floor(uTime * 24.0))).x - 0.5) * uGrain;
	gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * The settings, filled with the defaults, with the style's number.
 *
 * @param {FluidFoldsConfig} config The settings.
 * @returns {typeof FOLD_DEFAULTS & { styleIndex: number, speed: number }} The settings.
 */
function settings(config) {
	const o = { ...FOLD_DEFAULTS, speed: 1, ...config };
	return { ...o, styleIndex: Math.max(0, FOLD_STYLES.indexOf(o.style)) };
}

/** Three octaves of the shared gradient noise (the shader's `fbm3`). */
const fbm3 = (/** @type {number} */ x, /** @type {number} */ y) =>
	0.55 * gnoise(x, y) + 0.3 * gnoise(x * 2.03 + 17.1, y * 2.03 + 17.1) + 0.15 * gnoise(x * 4.01 + 41.7, y * 4.01 + 41.7);

/** Hermite smoothing between two edges (GLSL's `smoothstep`). */
const smooth = (/** @type {number} */ e0, /** @type {number} */ e1, /** @type {number} */ x) => {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
	return t * t * (3 - 2 * t);
};

/**
 * The folds' height at a point (the shader's `foldHeight`), 0–1: a fold's
 * crest is near 1, the hollow behind it near 0.
 *
 * @param {FluidFoldsConfig} config The settings.
 * @param {number} x Heights from the left.
 * @param {number} y Heights from the top.
 * @param {number} [time=0] Seconds (already at its speed).
 * @returns {number} 0–1.
 */
export function foldHeight(config, x, y, time = 0) {
	const o = settings(config);
	const ph = time * o.rate;
	const qx = x * o.scale + o.seed;
	const qy = y * o.scale + o.seed * 0.7;
	if (o.styleIndex === 0) {
		const wx = fbm3(qx * 0.8 + ph, qy * 0.8) - 0.5;
		const wy = fbm3(qx * 0.8 + 5.2, qy * 0.8 + 1.3 - ph) - 0.5;
		return 0.5 + 0.5 * Math.sin(2 * Math.PI * (fbm3(qx + o.warp * 2 * wx, qy + o.warp * 2 * wy) * 2.6 + ph * 0.5));
	}
	const w = fbm3(qx * 0.5 + ph, qy * 0.3) - 0.5;
	const yy = qy * 2.2 + o.warp * 1.6 * (fbm3(qx * 0.7 - ph * 0.6, qy * 0.6) - 0.5) + w;
	const ridge = 0.5 + 0.5 * Math.sin(2 * Math.PI * yy + 2 * Math.sin(qx * 1.3 + ph * 2));
	return ridge * smooth(o.level - 0.25, o.level + 0.1, y);
}

/**
 * Where on the colour ramp a point is (the shader's `foldHue`), 0–1 round
 * deep, mid, hot and back to deep.
 *
 * @param {FluidFoldsConfig} config The settings.
 * @param {number} x Heights from the left.
 * @param {number} y Heights from the top.
 * @param {number} [time=0] Seconds (already at its speed).
 * @returns {number} 0–1.
 */
export function foldHue(config, x, y, time = 0) {
	const o = settings(config);
	const v = gnoise(x * o.hue * 1.7 + o.seed * 1.3 + time * o.rate * 0.6, y * o.hue * 1.7 + o.seed) * 1.4 + x * 0.18;
	return v - Math.floor(v);
}

/**
 * The three colours as the shader takes them (fewer repeat).
 *
 * @param {FluidFoldsConfig} config The settings.
 * @returns {[string, string, string]} Deep, mid and hot.
 */
export function foldColors(config) {
	const c = pickColors(config, ENAMEL);
	return [c[0], c[Math.min(1, c.length - 1)], c[c.length - 1]];
}

/**
 * A CSS `background` that stands in for the folds before the shader starts
 * and without WebGL: two soft swells of the ramp's colours and a glossy
 * streak across them, on the ground (dunes lie under a dark sky).
 *
 * @param {FluidFoldsConfig} config The settings (`colors`/`palette`, `background`, `style`, `level`).
 * @returns {string} The CSS background.
 */
export function foldsStill(config) {
	const o = settings(config);
	const [deep, mid, hot] = foldColors(config).map((c) => toHex(parseColor(c)));
	const ground = toHex(parseColor(o.background));
	const dim = (/** @type {string} */ c) => toHex(mixOklab(parseColor(ground), parseColor(c), 0.55));
	if (o.styleIndex === 1) {
		const top = Math.round(o.level * 100);
		return [
			`linear-gradient(172deg, transparent ${top + 8}%, ${dim(hot)}55 ${top + 14}%, transparent ${top + 22}%)`,
			`radial-gradient(120% 60% at 30% 100%, ${dim(mid)} 0%, ${dim(deep)} 40%, transparent 75%)`,
			`linear-gradient(to bottom, ${ground} ${Math.max(0, top - 10)}%, ${dim(deep)} 100%)`,
			ground,
		].join(', ');
	}
	return [
		`linear-gradient(125deg, transparent 38%, rgba(255,255,255,0.16) 46%, transparent 52%)`,
		`radial-gradient(70% 55% at 22% 78%, ${dim(hot)} 0%, transparent 70%)`,
		`radial-gradient(75% 60% at 78% 24%, ${dim(deep)} 0%, ${dim(mid)}88 35%, transparent 72%)`,
		ground,
	].join(', ');
}

/**
 * Starts the folds on an element: a canvas inside it (its first), at the
 * stage's capped pixel ratio.
 *
 * @param {HTMLElement} el The element.
 * @param {FluidFoldsConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function fluidFolds(el, config) {
	const o = settings(config);
	const lab = (/** @type {string} */ c) => toOklab(parseColor(c));
	let ramp = foldColors(config).map(lab);
	const ground = lab(o.background);
	const a = (o.light * Math.PI) / 180;
	const start = performance.now();

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		still: o.speed <= 0,
		setup({ gl, uniform }) {
			gl.uniform1f(uniform('uStyle'), o.styleIndex);
			gl.uniform1f(uniform('uScale'), o.scale);
			gl.uniform1f(uniform('uWarp'), o.warp);
			gl.uniform1f(uniform('uRate'), o.rate);
			gl.uniform1f(uniform('uLevel'), o.level);
			gl.uniform1f(uniform('uHueRate'), o.hue);
			gl.uniform1f(uniform('uSeed'), o.seed);
			gl.uniform1f(uniform('uGloss'), o.gloss);
			gl.uniform2f(uniform('uLight'), Math.sin(a), Math.cos(a));
			gl.uniform1f(uniform('uGrain'), o.grain);
			gl.uniform3f(uniform('uBg'), ground[0], ground[1], ground[2]);
		},
		resize({ gl, uniform }) {
			const w = Math.max(1, el.clientWidth);
			const h = Math.max(1, el.clientHeight);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, w / h));
		},
		uniforms({ gl, uniform }, now) {
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000) * Math.max(0, o.speed));
			gl.uniform3fv(uniform('uRamp[0]'), new Float32Array(ramp.flat()));
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		ramp = foldColors({ colors: next.colors }).map(lab);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
