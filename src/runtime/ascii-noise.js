/**
 * @module @arraypress/effects-astro/ascii-noise
 *
 * A field of slow noise drawn as a grid of monospace characters: each cell
 * samples a five-octave gradient noise (quintic fade, a domain warp) at its
 * centre, the value is pushed hard toward empty or full (`contrast`) and
 * picks a character from a ramp, quietest first, so the field reads as
 * soft-edged blobs of type drifting and morphing across the frame. The
 * quiet cells take one colour and the loud ones another, blended in Oklab.
 *
 * Two clocks, both in seconds: the sample window pans (`drift`) and the
 * shapes morph (`evolve`); the warp drifts on its own, more slowly. The
 * same field is here in plain JavaScript (`noiseField`, `asciiCells`), so a
 * page can lay its first frame as text before the shader starts, and the
 * two agree.
 *
 * Clear where the cells are empty (or the `background` colour), so it lays
 * over any ground. A `quiet` area thins the type behind copy. Without
 * WebGL nothing is drawn; with prefers-reduced-motion it is one still frame.
 *
 * After `ascii_noise_bg`, a Processing sketch shared with the owner
 * (2026-11-20): the noise, the warp, the tunings and the ramps are its;
 * here it runs on the GPU, by the second rather than by the frame, with
 * the width as its unit so a tall card and a wide hero sample alike, and
 * its lattice hash is Dave Hoskins' Hash without Sine (MIT, © 2014 David
 * Hoskins), which keeps the GPU and `asciiCells` in step.
 */

import { createStage } from './stage.js';
import { GLSL_OKLAB, parseColor, toOklab } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { GLSL_GLYPHS, GLYPH_SETS, createGlyphs } from './glyphs.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {object} AsciiNoiseConfig
 * @property {string[]} [colors] Two CSS hex colours: the quietest cells' and the loudest's. Default a dim grey and white.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`: its first and last colours.
 * @property {string} [background] A CSS hex colour to fill behind the type; none leaves the canvas clear there.
 * @property {string} [glyphs='ascii'] A ramp (`ascii`, `shade`, `digits`, `rise`, `quads`, `bars`, `arrows`,
 *   `letters`, `dense`; or a set of GLYPH_SETS) or the characters themselves, quietest first.
 * @property {number} [cell=14] A character cell's height in CSS px.
 * @property {number} [cols] Cells across instead, whatever the width (overrides `cell`).
 * @property {number} [aspect=0.6] A cell's width over its height.
 * @property {number} [scale=2.45] How many noise features span the width (higher is busier).
 * @property {number} [contrast=6] How hard the edges are: higher pushes cells to empty or full.
 * @property {number} [brightness=-0.1] Shifts the whole field; lower leaves more cells empty.
 * @property {[number, number]} [drift=[0.036, 0.012]] How fast the sample window pans, widths a second, x and y.
 * @property {number} [evolve=0.24] How fast the shapes morph.
 * @property {[number, number]} [offset=[0, 0]] Where the sample window starts, so two cards differ.
 * @property {number} [speed=1] Plays every clock faster or slower; 0 for one still frame.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area kept quiet: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 * @property {string} [font] The font family the glyphs are drawn in (a monospace stack by default); it is loaded first.
 */

/** The ramps, each quietest first. A ramp starting with a space leaves quiet cells empty. */
export const NOISE_RAMPS = {
	/** Punctuation building to `@`. */
	ascii: ' `^",:;!+*#%@',
	/** Shade blocks, never empty: the whole frame is type. */
	shade: '░▒▓█',
	/** Numerals, 1 to 9. */
	digits: ' 123456789',
	/** Blocks rising from the baseline. */
	rise: ' ▁▂▃▄▅▆▇█',
	/** Quadrant blocks, from one corner to all four. */
	quads: ' ▖▗▘▝▚▞▛▙▜▟█',
	/** Bars filling from the left. */
	bars: ' ▏▎▍▌▋▊▉█',
	/** Arrows (the font must have them). */
	arrows: ' ↑↗→↘↓↙←↖↕',
	/** Letters, light to heavy. */
	letters: ' iljtfrvxzcknyuUHPAOEGQDBMWR',
	/** The long classic ramp. */
	dense: " .'`^,:;I}{1)(|OZbkhao*#MW&8%B@$",
};

/** The settings' defaults, shared by the shader and `asciiCells`. */
export const NOISE_DEFAULTS = {
	glyphs: 'ascii',
	scale: 2.45,
	contrast: 6,
	brightness: -0.1,
	drift: /** @type {[number, number]} */ ([0.036, 0.012]),
	evolve: 0.24,
	aspect: 0.6,
};

/** The default colours: a dim grey for the quiet cells, white for the loud. */
const GREY = ['#3a3a3a', '#ffffff'];

/**
 * A ramp's characters.
 *
 * @param {string} [glyphs] A ramp's name (NOISE_RAMPS, then GLYPH_SETS) or the characters.
 * @returns {string[]} The characters, quietest first (at least two).
 */
export function rampOf(glyphs = NOISE_DEFAULTS.glyphs) {
	const chars = [
		...(NOISE_RAMPS[/** @type {keyof typeof NOISE_RAMPS} */ (glyphs)] ??
			GLYPH_SETS[/** @type {keyof typeof GLYPH_SETS} */ (glyphs)] ??
			glyphs),
	];
	return chars.length > 1 ? chars : [...NOISE_RAMPS.ascii];
}

/**
 * GLSL (ES 1.00): `float noiseField(vec2 p, float evo, float wt)`, the
 * warped five-octave gradient noise, 0–1. `noiseField` below is the same
 * in JavaScript.
 */
const GLSL_FIELD = `
vec2 grad(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
	p3 += dot(p3, p3.yzx + 33.33);
	return -1.0 + 2.0 * fract((p3.xx + p3.yz) * p3.zy);
}
float gnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = p - i;
	vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
	float a = dot(grad(i), f);
	float b = dot(grad(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
	float c = dot(grad(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
	float d = dot(grad(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
	return 0.5 + 0.5 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float noiseField(vec2 p, float evo, float wt) {
	float warp = gnoise(p + wt * 0.04);
	float v = 0.0;
	float amp = 0.5;
	float freq = 1.0;
	for (int i = 0; i < 5; i++) {
		v += amp * gnoise(p * freq + vec2(warp * 0.3, warp * 0.25) + evo * 0.06);
		amp *= 0.5;
		freq *= 2.07;
		warp = v;
	}
	return v;
}
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uCell;
uniform float uTime;
uniform float uScale;
uniform float uContrast;
uniform float uBrightness;
uniform vec2 uDrift;
uniform float uEvolve;
uniform vec2 uOffset;
uniform vec3 uLo;
uniform vec3 uHi;
uniform vec4 uBg;
${GLSL_OKLAB}
${GLSL_QUIET}
${GLSL_GLYPHS}
${GLSL_FIELD}

void main() {
	// Cells counted from the top left, as the text still lays them.
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	vec2 cell = floor(px / uCell);
	vec2 centre = (cell + 0.5) * uCell;
	// The field in widths, so its features keep their size whatever the shape.
	vec2 p = (centre / uRes.x) * uScale + uOffset + uDrift * uTime;
	float v = noiseField(p, uEvolve * uTime, uTime);
	v = clamp((v - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0);
	vec2 q = vec2(centre.x - 0.5 * uRes.x, 0.5 * uRes.y - centre.y) / uRes.y;
	v *= mix(1.0 - uQuiet.w, 1.0, quietOpen(q));
	float last = uGlyphCount - 1.0;
	float index = min(floor(v * uGlyphCount), last);
	float k = index / last;
	float a = glyph(vec2(fract(px.x / uCell.x), 1.0 - fract(px.y / uCell.y)), k);
	vec3 col = fromOklab(mix(uLo, uHi, k));
	gl_FragColor = vec4(col * a + uBg.rgb * uBg.a * (1.0 - a), a + uBg.a * (1.0 - a));
}
`;

/**
 * One octave's gradient at a lattice point (the shader's `grad`): Dave
 * Hoskins' Hash without Sine, which brings its input under 1 before it
 * multiplies, so the GPU's 32-bit floats and these 64-bit ones agree.
 * (The sketch's own hash multiplied values in the thousands, where the
 * two drift apart and the text still would not be the shader's frame.)
 *
 * @param {number} x The point's x.
 * @param {number} y The point's y.
 * @returns {[number, number]} A gradient, each part −1 to 1.
 */
function grad(x, y) {
	const fract = (/** @type {number} */ n) => n - Math.floor(n);
	let a = fract(x * 0.1031);
	let b = fract(y * 0.103);
	let c = fract(x * 0.0973);
	const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
	a += d;
	b += d;
	c += d;
	return [-1 + 2 * fract((a + b) * c), -1 + 2 * fract((a + c) * b)];
}

/**
 * Gradient noise with a quintic fade (the shader's `gnoise`).
 *
 * @param {number} x Where, x.
 * @param {number} y Where, y.
 * @returns {number} 0–1.
 */
function gnoise(x, y) {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const fx = x - ix;
	const fy = y - iy;
	const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
	const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
	const dot = (/** @type {[number, number]} */ g, /** @type {number} */ dx, /** @type {number} */ dy) => g[0] * dx + g[1] * dy;
	const a = dot(grad(ix, iy), fx, fy);
	const b = dot(grad(ix + 1, iy), fx - 1, fy);
	const c = dot(grad(ix, iy + 1), fx, fy - 1);
	const d = dot(grad(ix + 1, iy + 1), fx - 1, fy - 1);
	const ab = a + (b - a) * ux;
	const cd = c + (d - c) * ux;
	return 0.5 + 0.5 * (ab + (cd - ab) * uy);
}

/**
 * The field: five octaves of gradient noise, each warped by the sum so far.
 *
 * @param {number} x Where, x.
 * @param {number} y Where, y.
 * @param {number} evo The morphing clock.
 * @param {number} wt The warp's clock (seconds).
 * @returns {number} 0–1, near 0.5 on average.
 */
export function noiseField(x, y, evo, wt) {
	let warp = gnoise(x + wt * 0.04, y + wt * 0.04);
	let v = 0;
	let amp = 0.5;
	let freq = 1;
	for (let i = 0; i < 5; i++) {
		v += amp * gnoise(x * freq + warp * 0.3 + evo * 0.06, y * freq + warp * 0.25 + evo * 0.06);
		amp *= 0.5;
		freq *= 2.07;
		warp = v;
	}
	return v;
}

/**
 * One frame as ramp indices: what the shader draws, cell for cell, on a
 * target exactly `cols` by `rows` cells.
 *
 * @param {AsciiNoiseConfig} config The settings (the same as the shader's).
 * @param {number} cols Cells across.
 * @param {number} rows Cells down.
 * @param {number} [time=0] Seconds, as the shader's clock (already at its speed).
 * @returns {number[][]} Each row's indices into `rampOf(config.glyphs)`.
 */
export function asciiCells(config, cols, rows, time = 0) {
	const { scale, contrast, brightness, drift, evolve, aspect } = { ...NOISE_DEFAULTS, ...config };
	const n = rampOf(config.glyphs).length;
	const [ox, oy] = config.offset ?? [0, 0];
	// a cell is 1 wide and 1 / aspect tall; the quiet area is measured as the shader measures it
	const height = rows / aspect;
	const [qx, qy, radius, depth] = quietUniform(config.quiet, cols / height);
	const smooth = (/** @type {number} */ e0, /** @type {number} */ e1, /** @type {number} */ x) => {
		const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
		return t * t * (3 - 2 * t);
	};
	return Array.from({ length: rows }, (_, r) =>
		Array.from({ length: cols }, (_, c) => {
			const cx = c + 0.5;
			const cy = (r + 0.5) / aspect;
			let v = noiseField((cx / cols) * scale + ox + drift[0] * time, (cy / cols) * scale + oy + drift[1] * time, evolve * time, time);
			v = Math.min(1, Math.max(0, (v - 0.5) * contrast + 0.5 + brightness));
			if (radius > 0) {
				const d = Math.hypot((cx - cols / 2) / height - qx, (height / 2 - cy) / height - qy);
				v *= 1 - depth + depth * smooth(radius * 0.06, radius, d);
			}
			return Math.min(Math.floor(v * n), n - 1);
		}),
	);
}

/**
 * The two colours as the shader takes them.
 *
 * @param {AsciiNoiseConfig} config The settings.
 * @returns {[string, string]} The quietest cells' colour and the loudest's.
 */
export function noiseColors(config) {
	const colors = pickColors(config, GREY);
	return [colors[0], colors[colors.length - 1]];
}

/**
 * Starts the noise on an element: a canvas inside it (its first), filling
 * it. With a `font`, the font is loaded before the glyphs are drawn.
 *
 * @param {HTMLElement} el The element.
 * @param {AsciiNoiseConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function asciiNoise(el, config) {
	let stop = () => {};
	let stopped = false;
	const ramp = rampOf(config.glyphs);
	/** Starts the stage, unless it was stopped while the font loaded. */
	const begin = () => {
		if (!stopped) stop = run(el, config, ramp);
	};
	if (config.font && typeof document !== 'undefined' && document.fonts) document.fonts.load(`48px ${config.font}`, ramp.join('')).then(begin, begin);
	else begin();
	return () => {
		stopped = true;
		stop();
	};
}

/**
 * The stage itself, once the font is ready.
 *
 * @param {HTMLElement} el The element.
 * @param {AsciiNoiseConfig} config The settings.
 * @param {string[]} ramp The characters.
 * @returns {() => void} Stops it.
 */
function run(el, config, ramp) {
	const o = { ...NOISE_DEFAULTS, ...config };
	const speed = config.speed ?? 1;
	const lab = (/** @type {string} */ c) => toOklab(parseColor(c));
	let [lo, hi] = noiseColors(config).map(lab);
	const bg = config.background ? [...parseColor(config.background), 1] : [0, 0, 0, 0];
	const start = performance.now();

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		still: speed <= 0,
		setup({ gl, uniform }) {
			const { count } = createGlyphs(gl, ramp.join(''), { unit: 0, font: config.font, aspect: o.aspect });
			gl.uniform1i(uniform('uGlyphs'), 0);
			gl.uniform1f(uniform('uGlyphCount'), count);
			gl.uniform1f(uniform('uScale'), o.scale);
			gl.uniform1f(uniform('uContrast'), o.contrast);
			gl.uniform1f(uniform('uBrightness'), o.brightness);
			gl.uniform2f(uniform('uDrift'), o.drift[0], o.drift[1]);
			gl.uniform1f(uniform('uEvolve'), o.evolve);
			gl.uniform2f(uniform('uOffset'), ...(config.offset ?? [0, 0]));
			gl.uniform4f(uniform('uBg'), bg[0], bg[1], bg[2], bg[3]);
		},
		resize({ gl, uniform, canvas, ratio }) {
			const w = config.cols ? canvas.width / config.cols : (config.cell ?? 14) * ratio * o.aspect;
			gl.uniform2f(uniform('uCell'), w, w / o.aspect);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, canvas.width / canvas.height));
		},
		uniforms({ gl, uniform }, now) {
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000) * Math.max(0, speed));
			gl.uniform3f(uniform('uLo'), lo[0], lo[1], lo[2]);
			gl.uniform3f(uniform('uHi'), hi[0], hi[1], hi[2]);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		[lo, hi] = noiseColors({ colors: next.colors }).map(lab);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
