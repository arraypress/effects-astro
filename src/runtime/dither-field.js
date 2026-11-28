/**
 * @module @arraypress/effects-astro/dither-field
 *
 * A field of slow noise drawn in square dots: five octaves of warped
 * gradient noise, pushed hard toward empty or full (`contrast`), its edges
 * an 8×8 Bayer ordered dither that packs tighter toward a solid core, the
 * colour stepped into bands (`steps`) from a dim edge colour to a bright
 * core one, blended in Oklab. Ripples run out from a corner (`origin`):
 * rings where the contrast rises, bent by a slow turbulence into
 * shore-wave shapes.
 *
 * Each dot is one pixel of a small canvas, scaled up with square pixels,
 * so the noise is worked out once a dot rather than once a screen pixel:
 * a card of 3 px dots costs about a fortieth of a full-resolution pass.
 * The field is measured in widths, so a 330 px card and a 1280 px hero
 * show the same shapes; the dots keep their size in CSS px.
 *
 * Every clock is in seconds. The ripple has no history to keep: a ring's
 * strength at distance d is a smooth noise of (t − d / travel), so it is
 * the same at any frame rate and needs nothing from the CPU. The same
 * field is here in plain JavaScript (`ditherDots`), dot for dot.
 *
 * Clear where there are no dots (or the `background` colour), so it lays
 * over any ground. A `quiet` area empties the field behind copy. Without
 * WebGL nothing is drawn; with prefers-reduced-motion it is one still frame.
 *
 * After `ripple_dither_bg`, a Processing sketch shared with the owner
 * (2026-11-20): the field, the dither zones, the ripple and the tunings are
 * its; here the Bayer matrix is worked out in the shader, the ring buffer of
 * past levels is an analytic signal, and the hashes are Dave Hoskins' Hash
 * without Sine (MIT, © 2014 David Hoskins), which keeps the GPU and
 * `ditherDots` in step.
 */

import { createStage } from './stage.js';
import { GLSL_GRADIENT_NOISE, GLSL_NOISE_FIELD, grad, gnoise, noiseField } from './hash-noise.js';
import { GLSL_OKLAB, parseColor, toOklab, mixOklab, toHex } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { watchColors } from './mount.js';
import { GLSL_BAYER, bayer } from './bayer.js';
import { pickColors } from './palettes.js';
import { frameNow } from './loop.js';

/**
 * @typedef {object} DitherFieldConfig
 * @property {string[]} [colors] Two CSS hex colours: the dim edge's and the bright core's. Default a grey and amber.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`: its first and last colours.
 * @property {string} [background] A CSS hex colour to fill behind the dots; none leaves the canvas clear there.
 * @property {number} [dot=3] A dot's size in CSS px (rounded to whole screen pixels).
 * @property {number} [scale=1.1] How many noise features span the width (higher is busier).
 * @property {number} [contrast=6] How hard the edges are: higher thins the dithered band.
 * @property {number} [brightness=-0.15] Shifts the whole field; lower leaves more of it empty.
 * @property {number} [steps=24] Colour bands across the field; 0 blends smoothly.
 * @property {[number, number]} [drift=[0.02, 0.007]] How fast the field pans, noise features a second, x and y.
 * @property {number} [evolve=0.35] How fast the shapes morph.
 * @property {number} [ripple=1] How strongly the rings lift the field; 0 for none.
 * @property {number} [rings=3] Rings across the width, roughly (higher is tighter).
 * @property {number} [rippleSpeed=0.08] How fast the rings travel, widths a second.
 * @property {[number, number]} [origin=[0.04, 0.3]] Where the rings start, 0–1 from the top left.
 * @property {[number, number]} [offset=[0, 0]] Where the field and the rings start, so two cards differ.
 * @property {number} [speed=1] Plays every clock faster or slower; 0 for one still frame.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area kept empty: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 */

/** The settings' defaults, shared by the shader and `ditherDots`. */
export const DITHER_DEFAULTS = {
	dot: 3,
	scale: 1.1,
	contrast: 6,
	brightness: -0.15,
	steps: 24,
	drift: /** @type {[number, number]} */ ([0.02, 0.007]),
	evolve: 0.35,
	ripple: 1,
	rings: 3,
	rippleSpeed: 0.08,
	origin: /** @type {[number, number]} */ ([0.04, 0.3]),
};

/**
 * The sketch's dither zones, on the field's 0–1 value: dots begin at
 * `edge`, pack tighter toward `core`, solid from there. `bias` thickens the
 * dots everywhere and `inner` more so near the core; `fuzz` moves the edge a
 * little per dot so it is not a hard contour. `gain` is how far a full ring
 * lifts the contrast and `lift` the level (so a ring brings dots up even
 * out of the empty ground), `warp` how far the turbulence bends the rings (widths)
 * and `warpScale` its features across the width; rings fade out between
 * `fadeFrom` and `fadeTo` widths from the origin.
 */
const ZONES = { edge: 0.1, core: 0.3, bias: 0.2, inner: 0.8, fuzz: 0.02, gain: 8, lift: 0.12, warp: 1, warpScale: 3, fadeFrom: 1, fadeTo: 1.6 };

/** The default colours: the sketch's grey edge and amber core. */
const AMBER = ['#b4b4b4', '#ffbe50'];

/**
 * GLSL (ES 1.00): `float ripplePulse(float s)`, a smooth 1-D noise, 0–1,
 * that the rings are cut from (`ripplePulse` below is the same in
 * JavaScript). The Bayer threshold is `./bayer.js`'s.
 */
const GLSL_DITHER = `
${GLSL_BAYER}
float hash11(float p) {
	p = fract(p * 0.1031);
	p *= p + 33.33;
	p *= p + p;
	return fract(p);
}
float ripplePulse(float s) {
	float i = floor(s);
	float f = s - i;
	float u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
	return smoothstep(0.2, 0.8, mix(hash11(i), hash11(i + 1.0), u));
}
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uSize;
uniform float uTime;
uniform float uScale;
uniform float uContrast;
uniform float uBrightness;
uniform float uSteps;
uniform vec2 uDrift;
uniform float uEvolve;
uniform vec2 uOffset;
uniform vec2 uOrigin;
uniform vec3 uRipple;
uniform float uPhase;
uniform vec3 uEdge;
uniform vec3 uCore;
uniform vec4 uBg;
${GLSL_OKLAB}
${GLSL_QUIET}
${GLSL_GRADIENT_NOISE}
${GLSL_NOISE_FIELD}
${GLSL_DITHER}

void main() {
	// One pixel a dot, counted from the top left (the canvas may run a dot past the element).
	vec2 cell = vec2(floor(gl_FragCoord.x), floor(uRes.y - gl_FragCoord.y));
	// In widths, so the shapes keep their size whatever the shape of the target.
	vec2 c = (cell + 0.5) / uSize.x;
	float t = uTime;
	float v = noiseField(c * uScale + uOffset + uDrift * t, uEvolve * t, t);

	// The rings: a smooth noise of (t - d / travel), d bent by a slow turbulence.
	float ws = gnoise(c * ${ZONES.warpScale.toFixed(1)} + uOffset.yx + uDrift * 0.4 * t) - 0.5;
	float d = distance(c + ws * ${ZONES.warp.toFixed(1)}, uOrigin);
	float s = (t * uRipple.z - d) * uRipple.y + uPhase;
	float band = 0.5 + 0.5 * cos(6.2831853 * s);
	float ring = ripplePulse(s) * band * band * (1.0 - smoothstep(${ZONES.fadeFrom.toFixed(1)}, ${ZONES.fadeTo.toFixed(1)}, d));
	v = clamp((v - 0.5) * (uContrast + ring * uRipple.x) + 0.5 + uBrightness + ring * uRipple.x * ${(ZONES.lift / ZONES.gain).toFixed(4)}, 0.0, 1.0);

	vec2 q = vec2(c.x - 0.5, (0.5 * uSize.y - (cell.y + 0.5)) / uSize.x) * uSize.x / uSize.y;
	v *= mix(1.0 - uQuiet.w, 1.0, quietOpen(q));

	// Dots from the edge in, packing tighter toward the core; solid from the core on.
	float near = smoothstep(${ZONES.edge}, ${ZONES.core}, v);
	float dots = step(bayer8(cell), v + ${ZONES.bias} + near * ${ZONES.inner});
	float fuzz = grad(cell + 17.0).x * ${ZONES.fuzz};
	float lit = mix(dots, 1.0, step(${ZONES.core}, v)) * step(${ZONES.edge} + fuzz, v);

	float tone = uSteps > 0.5 ? floor(v * uSteps + 0.5) / uSteps : v;
	vec3 col = fromOklab(mix(uEdge, uCore, smoothstep(0.35, 0.75, tone)));
	gl_FragColor = vec4(col * lit + uBg.rgb * uBg.a * (1.0 - lit), lit + uBg.a * (1.0 - lit));
}
`;

/**
 * The fractional part.
 *
 * @param {number} n A number.
 * @returns {number} Its part after the point, 0–1.
 */
const fract = (n) => n - Math.floor(n);

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
 * The quintic fade between lattice points.
 *
 * @param {number} f 0–1.
 * @returns {number} 0–1, flat at both ends.
 */
const quintic = (f) => f * f * f * (f * (f * 6 - 15) + 10);

/** The 8×8 Bayer threshold at a dot (`./bayer.js`), exported here as before. */
export { bayer };

/**
 * A hash of one number (the shader's `hash11`): Dave Hoskins' Hash without
 * Sine, small multipliers so 32-bit and 64-bit floats agree.
 *
 * @param {number} p The number.
 * @returns {number} 0–1.
 */
function hash11(p) {
	let h = fract(p * 0.1031);
	h *= h + 33.33;
	h *= h + h;
	return fract(h);
}

/**
 * The signal the rings are cut from (the shader's `ripplePulse`): a smooth
 * 1-D noise, pushed toward 0 and 1 so the rings come as swells and calms.
 *
 * @param {number} s Where along it (one lattice step is one ring's spacing).
 * @returns {number} 0–1.
 */
export function ripplePulse(s) {
	const i = Math.floor(s);
	const a = hash11(i);
	return smooth(0.2, 0.8, a + (hash11(i + 1) - a) * quintic(s - i));
}

/**
 * How strong the ring is at a distance from the origin at a time: what a
 * ring buffer of past levels would hold, worked out instead, so it costs
 * nothing a frame and is the same at any frame rate. A ring at distance d
 * now is what left the origin d / rippleSpeed seconds ago: one ring a
 * lattice step of `ripplePulse`, as strong as the pulse is there.
 *
 * @param {number} d Widths from the origin.
 * @param {number} time Seconds (already at its speed).
 * @param {DitherFieldConfig} [config] The settings (`rings`, `rippleSpeed`, `offset`).
 * @returns {number} 0–1, before `ripple` scales it; fading to 0 far out.
 */
export function rippleAt(d, time, config = {}) {
	const rings = config.rings ?? DITHER_DEFAULTS.rings;
	const travel = config.rippleSpeed ?? DITHER_DEFAULTS.rippleSpeed;
	const s = (time * travel - d) * rings + phaseOf(config.offset);
	const band = 0.5 + 0.5 * Math.cos(2 * Math.PI * s);
	return ripplePulse(s) * band * band * (1 - smooth(ZONES.fadeFrom, ZONES.fadeTo, d));
}

/**
 * Where on the ring signal an offset starts it, so two cards ripple apart.
 *
 * @param {[number, number] | undefined} offset The field's offset.
 * @returns {number} A phase.
 */
function phaseOf(offset) {
	const [x, y] = offset ?? [0, 0];
	return x * 7.31 + y * 3.17;
}

/**
 * One frame dot for dot, as the shader draws it on a target exactly `cols`
 * by `rows` dots: each dot empty (−1) or lit with its tone, 0 the edge
 * colour to 1 the core's.
 *
 * @param {DitherFieldConfig} config The settings (the same as the shader's).
 * @param {number} cols Dots across.
 * @param {number} rows Dots down.
 * @param {number} [time=0] Seconds, as the shader's clock (already at its speed).
 * @returns {number[][]} Each row's dots: −1, or a tone 0–1.
 */
export function ditherDots(config, cols, rows, time = 0) {
	const o = { ...DITHER_DEFAULTS, ...config };
	const [ox, oy] = config.offset ?? [0, 0];
	const origin = [o.origin[0], (o.origin[1] * rows) / cols];
	const [qx, qy, radius, depth] = quietUniform(config.quiet, cols / rows);
	const gain = ZONES.gain * Math.max(0, o.ripple);
	return Array.from({ length: rows }, (_, r) =>
		Array.from({ length: cols }, (_, k) => {
			const cx = (k + 0.5) / cols;
			const cy = (r + 0.5) / cols;
			let v = noiseField(cx * o.scale + ox + o.drift[0] * time, cy * o.scale + oy + o.drift[1] * time, o.evolve * time, time);
			const ws = gnoise(cx * ZONES.warpScale + oy + o.drift[0] * 0.4 * time, cy * ZONES.warpScale + ox + o.drift[1] * 0.4 * time) - 0.5;
			const d = Math.hypot(cx + ws * ZONES.warp - origin[0], cy + ws * ZONES.warp - origin[1]);
			const ring = gain > 0 ? rippleAt(d, time, o) * gain : 0;
			v = Math.min(1, Math.max(0, (v - 0.5) * (o.contrast + ring) + 0.5 + o.brightness + ring * Number((ZONES.lift / ZONES.gain).toFixed(4))));
			if (radius > 0) {
				const qd = Math.hypot((cx - 0.5) * (cols / rows) - qx, (0.5 * rows - (r + 0.5)) / rows - qy);
				v *= 1 - depth + depth * smooth(radius * 0.06, radius, qd);
			}
			const near = smooth(ZONES.edge, ZONES.core, v);
			const dots = v + ZONES.bias + near * ZONES.inner >= bayer(k, r) ? 1 : 0;
			const fuzz = grad(k + 17, r + 17)[0] * ZONES.fuzz;
			const lit = (v >= ZONES.core ? 1 : dots) * (v >= ZONES.edge + fuzz ? 1 : 0);
			if (!lit) return -1;
			const tone = o.steps > 0.5 ? Math.floor(v * o.steps + 0.5) / o.steps : v;
			return smooth(0.35, 0.75, tone);
		}),
	);
}

/**
 * The two colours as the shader takes them.
 *
 * @param {DitherFieldConfig} config The settings.
 * @returns {[string, string]} The dim edge colour and the bright core's.
 */
export function ditherColors(config) {
	const colors = pickColors(config, AMBER);
	return [colors[0], colors[colors.length - 1]];
}

/**
 * A CSS `background` that stands in for the field before the shader starts
 * and without WebGL: the ground, a dim checker of dots (the dither at half
 * strength) under a glow of the core colour around the ring origin and a
 * pool of the edge colour across from it, and the quiet area left to the
 * ground.
 *
 * @param {DitherFieldConfig} config The settings (`colors`/`palette`, `background`, `dot`, `origin`, `quiet`).
 * @returns {string} The CSS background.
 */
export function ditherStill(config) {
	const [edge, core] = ditherColors(config).map(parseColor);
	const ground = config.background ?? '#000000';
	const g = parseColor(ground);
	const [x, y] = config.origin ?? DITHER_DEFAULTS.origin;
	const dot = Math.max(1, config.dot ?? DITHER_DEFAULTS.dot);
	const mid = toHex(mixOklab(edge, core, 0.5));
	const pool = toHex(mixOklab(g, edge, 0.85));
	const dots = toHex(mixOklab(g, edge, 0.6));
	const pc = (/** @type {number} */ n) => `${Math.round(n * 100)}%`;
	const quiet = config.quiet;
	const r = pc((quiet?.radius ?? 0.8) * 0.55);
	return [
		quiet ? `radial-gradient(${r} ${r} at ${pc(quiet.x ?? 0.5)} ${pc(quiet.y ?? 0.5)}, ${ground} 55%, transparent 100%)` : '',
		`radial-gradient(70% 55% at ${pc(x)} ${pc(y)}, ${toHex(core)} 0%, ${mid} 30%, transparent 72%)`,
		`radial-gradient(80% 65% at ${pc(1 - x)} ${pc(1 - y)}, ${pool} 0%, ${pool} 25%, transparent 75%)`,
		`repeating-conic-gradient(${dots} 0 25%, transparent 0 50%) 0 0 / ${dot * 2}px ${dot * 2}px`,
		ground,
	]
		.filter(Boolean)
		.join(', ');
}

/**
 * Starts the field on an element: a canvas inside it (its first), one
 * pixel a dot, scaled up to cover it with square pixels.
 *
 * @param {HTMLElement} el The element.
 * @param {DitherFieldConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function ditherField(el, config) {
	const o = { ...DITHER_DEFAULTS, ...config };
	const speed = config.speed ?? 1;
	const lab = (/** @type {string} */ c) => toOklab(parseColor(c));
	let [edge, core] = ditherColors(config).map(lab);
	const bg = config.background ? [...parseColor(config.background), 1] : [0, 0, 0, 0];
	const native = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
	// Whole screen pixels a dot, so the scaled-up pixels are all the same size.
	const dotCss = Math.max(1, Math.round(Math.max(0.5, o.dot) * native)) / native;
	const start = frameNow();
	const canvas = el.querySelector('canvas');

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		still: speed <= 0,
		// One pixel a dot already: never lower it further.
		adaptive: false,
		scale: 1 / (dotCss * Math.min(native, 2)),
		setup({ gl, uniform, canvas }) {
			canvas.style.imageRendering = 'pixelated';
			gl.uniform1f(uniform('uScale'), o.scale);
			gl.uniform1f(uniform('uContrast'), o.contrast);
			gl.uniform1f(uniform('uBrightness'), o.brightness);
			gl.uniform1f(uniform('uSteps'), o.steps);
			gl.uniform2f(uniform('uDrift'), o.drift[0], o.drift[1]);
			gl.uniform1f(uniform('uEvolve'), o.evolve);
			gl.uniform2f(uniform('uOffset'), ...(config.offset ?? [0, 0]));
			gl.uniform3f(uniform('uRipple'), ZONES.gain * Math.max(0, o.ripple), o.rings, o.rippleSpeed);
			gl.uniform1f(uniform('uPhase'), phaseOf(config.offset));
			gl.uniform4f(uniform('uBg'), bg[0], bg[1], bg[2], bg[3]);
		},
		resize({ gl, uniform, canvas }) {
			// The element in dots; the canvas rounds up and runs past it (clipped), so every dot is whole.
			const w = Math.max(1, el.clientWidth / dotCss);
			const h = Math.max(1, el.clientHeight / dotCss);
			canvas.width = Math.ceil(w);
			canvas.height = Math.ceil(h);
			canvas.style.width = `${canvas.width * dotCss}px`;
			canvas.style.height = `${canvas.height * dotCss}px`;
			gl.uniform2f(uniform('uSize'), w, h);
			gl.uniform2f(uniform('uOrigin'), o.origin[0], (o.origin[1] * h) / w);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, w / h));
		},
		uniforms({ gl, uniform }, now) {
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000) * Math.max(0, speed));
			gl.uniform3f(uniform('uEdge'), edge[0], edge[1], edge[2]);
			gl.uniform3f(uniform('uCore'), core[0], core[1], core[2]);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		[edge, core] = ditherColors({ colors: next.colors }).map(lab);
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
