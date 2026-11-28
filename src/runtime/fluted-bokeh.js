/**
 * @module @arraypress/effects-astro/fluted-bokeh
 *
 * Coloured lights out of focus, seen through reeded glass: soft discs of
 * colour drift slowly behind a pane of upright flutes (`mode: 'reeds'`) or
 * a wall of square glass blocks (`mode: 'blocks'`). Each flute shows a
 * narrow slice of what is behind it stretched across its width, red, green
 * and blue each squeezed by a little more or less, so every seam carries a
 * thin rainbow; what is behind is smeared a little upright, as light is
 * through reeds, and each flute has a faint highlight on one seam and a
 * shadow on the other. A block bends what is behind it toward its own
 * centre, both ways, between dark joints.
 *
 * A sibling of `<FlutedGlow>` (one ring, orb or rise behind upright flutes)
 * and `<FlutedGlass>` (slanted flutes over pointer-led blooms): several
 * lights, dispersion at the seams, glass blocks, and no pointer, made to
 * sit behind copy.
 *
 * Every clock is in seconds and nothing is kept between frames: the lights
 * and the glass's slicing are here in plain JavaScript too (`bokehLights`,
 * `bokehAt`, `reedSample`), so a still and a test see what the shader draws.
 *
 * Opaque: it paints its `background` (default near-black) everywhere.
 * Without WebGL nothing is drawn; with prefers-reduced-motion it is one
 * still frame.
 */

import { createStage, SLOW_FPS } from './stage.js';
import { GLSL_HASH33, hash33 } from './hash-noise.js';
import { parseColor, toHex, mixOklab } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';
import { frameNow } from './loop.js';

/**
 * @typedef {'reeds' | 'blocks'} BokehGlass
 *
 * @typedef {object} FlutedBokehConfig
 * @property {string[]} [colors] Two to four CSS hex colours for the lights. Default coral, amber and ice blue.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {string} [background='#050608'] The ground, painted everywhere.
 * @property {BokehGlass} [mode='reeds'] Upright flutes, or a wall of square glass blocks.
 * @property {number} [flutes=28] Flutes across the width (blocks across, for `blocks`).
 * @property {number} [squeeze=0.3] How much of what is behind a flute it shows across its width (lower stretches more).
 * @property {number} [dispersion=0.35] How far red and blue part at the seams; 0 for none.
 * @property {number} [streak=0.06] How far the light smears upright, a share of the height; 0 for none.
 * @property {number} [lights=5] Lights behind the glass (1–8).
 * @property {number} [size=0.22] The lights' radius, a share of the height.
 * @property {number} [glow=1] How bright the lights are.
 * @property {number} [drift=0.08] How far the lights wander, a share of the height.
 * @property {number} [rate=0.04] How fast they wander, cycles a second.
 * @property {number} [seams=0.3] How strong the seams' highlights and shadows (or the blocks' joints) are; 0 for none.
 * @property {number} [grain=0.04] Fine grain over all of it; 0 for none.
 * @property {number} [seed=0] Where the lights sit and start wandering, so two cards differ.
 * @property {number} [speed=1] Plays every clock faster or slower; 0 for one still frame.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area dimmed: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 */

/** The glass, in the order the shader numbers it. */
export const BOKEH_GLASS = /** @type {const} */ (['reeds', 'blocks']);

/** The most lights the shader draws. */
export const MAX_LIGHTS = 8;

/** The settings' defaults, shared by the shader and the JS twin. */
export const BOKEH_DEFAULTS = {
	background: '#050608',
	mode: /** @type {BokehGlass} */ ('reeds'),
	flutes: 28,
	squeeze: 0.3,
	dispersion: 0.35,
	streak: 0.06,
	lights: 5,
	size: 0.22,
	glow: 1,
	drift: 0.08,
	rate: 0.04,
	seams: 0.3,
	grain: 0.04,
	seed: 0,
};

/** The default colours: coral, amber and ice blue, after the owner's fluted-glass references. */
const STAGE = ['#ff4a2a', '#ffb347', '#4fc3ff'];

/**
 * The settings, filled with the defaults, with the glass's number.
 *
 * @param {FlutedBokehConfig} config The settings.
 * @returns {typeof BOKEH_DEFAULTS & { modeIndex: number, speed: number, count: number }} The settings.
 */
function settings(config) {
	const o = { ...BOKEH_DEFAULTS, speed: 1, ...config };
	return { ...o, modeIndex: Math.max(0, BOKEH_GLASS.indexOf(o.mode)), count: Math.max(1, Math.min(MAX_LIGHTS, Math.round(o.lights))) };
}

/**
 * The lights: where each sits (shares of the width and height), how big
 * it is (a share of `size`), its colour (an index into the colours) and
 * its own phase, all from the seed.
 *
 * @param {FlutedBokehConfig} config The settings.
 * @returns {{ x: number, y: number, r: number, color: number, phase: number }[]} The lights.
 */
export function bokehLights(config) {
	const o = settings(config);
	const n = pickColors(config, STAGE).length;
	return Array.from({ length: o.count }, (_, i) => {
		const h = hash33(i * 7.13 + o.seed, o.seed * 3.1 + 1.7, i * 1.31);
		const g = hash33(i * 2.71 + 4.2, o.seed + 9.3, i * 5.9 + o.seed);
		return { x: 0.08 + 0.84 * h[0], y: 0.1 + 0.8 * h[1], r: 0.55 + 0.9 * h[2], color: i % n, phase: g[0] * 6.2831853 };
	});
}

/**
 * GLSL for the lights: `vec3 bokehAt(vec2 s, float t)`, the light behind
 * the glass at a point (shares of the width and height), the same sum as
 * `bokehAt` below.
 */
const GLSL_LIGHTS = `
uniform vec4 uLightAt[${MAX_LIGHTS}];
uniform vec3 uLightCol[${MAX_LIGHTS}];
uniform float uCount;
uniform float uGlow;
uniform float uAspect;
// uLightAt is each light this frame: its centre (worked out once a frame, not at every pixel) and 1.4 over its radius
// squared
vec3 bokehAt(vec2 s, float t) {
	vec3 c = vec3(0.0);
	for (int i = 0; i < ${MAX_LIGHTS}; i++) {
		if (float(i) >= uCount) break;
		vec4 l = uLightAt[i];
		vec2 d = vec2((s.x - l.x) * uAspect, s.y - l.y);
		c += uLightCol[i] * exp(-dot(d, d) * l.z);
	}
	return c * uGlow;
}
// The same through upright reeds: red, green and blue seen at three places across (sx), each smeared upright over three
// taps (weights a half and two quarters). A light's glow is a product of one falloff across and one down, so six
// falloffs a light stand for the nine the taps would take.
vec3 reedsAt(vec3 sx, float y, float streak) {
	vec3 c = vec3(0.0);
	for (int i = 0; i < ${MAX_LIGHTS}; i++) {
		if (float(i) >= uCount) break;
		vec4 l = uLightAt[i];
		vec3 dx = (sx - l.x) * uAspect;
		vec3 dy = vec3(y, y + streak, y - streak) - l.y;
		vec3 across = exp(-dx * dx * l.z);
		vec3 down = exp(-dy * dy * l.z);
		c += uLightCol[i] * across * dot(down, vec3(0.5, 0.25, 0.25));
	}
	return c * uGlow;
}
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uMode;
uniform float uFlutes;
uniform float uSqueeze;
uniform float uDisp;
uniform float uStreak;
uniform float uSeams;
uniform float uGrain;
uniform vec3 uBg;
${GLSL_QUIET}
${GLSL_HASH33}
${GLSL_LIGHTS}

// Where in its cell a share sits (−1 to 1) and the cell's centre, for a cell count across.
vec2 cellOf(float x, float n) {
	float w = 1.0 / n;
	float i = floor(x / w);
	return vec2((x / w - i) * 2.0 - 1.0, (i + 0.5) * w);
}

vec3 seen(vec2 s, float t) {
	// the light smeared upright a little: three taps
	return (bokehAt(s, t) * 0.5 + bokehAt(s + vec2(0.0, uStreak), t) * 0.25 + bokehAt(s - vec2(0.0, uStreak), t) * 0.25);
}

void main() {
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	vec2 s = px / uRes;
	vec2 cx = cellOf(s.x, uFlutes);
	float hw = 0.5 / uFlutes;
	vec3 col;
	float seam;
	if (uMode < 0.5) {
		// each flute shows a squeezed slice about its centre; red and blue squeezed a little differently
		float sr = cx.y + cx.x * hw * uSqueeze * (1.0 + uDisp);
		float sg = cx.y + cx.x * hw * uSqueeze;
		float sb = cx.y + cx.x * hw * uSqueeze * (1.0 - uDisp);
		col = reedsAt(vec3(sr, sg, sb), s.y, uStreak);
		seam = 1.0 - uSeams * 0.35 * (1.0 - cos(cx.x * 1.5707963));
		seam += uSeams * 0.3 * smoothstep(-0.86, -1.0, cx.x);
		seam -= uSeams * 0.35 * smoothstep(0.86, 1.0, cx.x);
	} else {
		// a glass block bends what is behind it toward its own centre, both ways, between dark joints
		float rows = max(1.0, floor(uFlutes * uRes.y / uRes.x + 0.5));
		vec2 cy = cellOf(s.y, rows);
		float hy = 0.5 / rows;
		vec2 k = vec2(cx.x, cy.x);
		vec2 b = vec2(cx.y, cy.y) + k * vec2(hw, hy) * uSqueeze * 1.6;
		vec2 off = k * vec2(hw, hy) * uSqueeze * uDisp * 0.8;
		col = vec3(seen(b + off, uTime).r, seen(b, uTime).g, seen(b - off, uTime).b);
		float edge = max(abs(k.x), abs(k.y));
		seam = 1.0 - uSeams * 2.2 * smoothstep(0.82, 0.97, edge);
		seam += uSeams * 0.35 * smoothstep(0.7, 0.9, -k.x - k.y) * (1.0 - smoothstep(0.9, 0.97, edge));
	}
	col = uBg + col * max(seam, 0.0);
	vec2 q = vec2((s.x - 0.5) * uRes.x / uRes.y, 0.5 - s.y);
	col = mix(uBg, col, mix(1.0 - uQuiet.w, 1.0, quietOpen(q)));
	col += (hash33(vec3(px, floor(uTime * 24.0))).x - 0.5) * uGrain;
	gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * The light behind the glass at a point (the shader's `bokehAt`), before
 * the glass: red, green and blue, 0 and up.
 *
 * @param {FlutedBokehConfig} config The settings.
 * @param {number} x A share of the width.
 * @param {number} y A share of the height.
 * @param {number} aspect Width over height.
 * @param {number} [time=0] Seconds (already at its speed).
 * @returns {[number, number, number]} The light.
 */
export function bokehAt(config, x, y, aspect, time = 0) {
	const o = settings(config);
	const cols = bokehColors(config).map((c) => parseColor(c));
	const c = [0, 0, 0];
	for (const l of bokehLights(config)) {
		const ph = 2 * Math.PI * time * o.rate + l.phase;
		const ax = l.x + (o.drift * Math.sin(ph * 0.9)) / aspect;
		const ay = l.y + o.drift * Math.cos(ph * 0.71);
		const dx = (x - ax) * aspect;
		const dy = y - ay;
		const r = o.size * l.r;
		const k = Math.exp(((-(dx * dx + dy * dy)) / (r * r)) * 1.4) * o.glow;
		const col = cols[l.color];
		for (let j = 0; j < 3; j++) c[j] += col[j] * k;
	}
	return /** @type {[number, number, number]} */ (c);
}

/**
 * Where behind the reeds a point looks (the shader's slicing, the green
 * channel): each flute shows a slice `squeeze` of its own width, stretched
 * across it.
 *
 * @param {number} x The point, a share of the width (0–1).
 * @param {number} flutes Flutes across the width.
 * @param {number} squeeze The share of a flute's width it shows.
 * @returns {{ x: number, local: number }} The share of the width it shows, and where in its flute it is (−1 to 1).
 */
export function reedSample(x, flutes, squeeze) {
	const w = 1 / flutes;
	const i = Math.floor(x / w);
	const local = (x / w - i) * 2 - 1;
	return { x: (i + 0.5) * w + local * 0.5 * w * squeeze, local };
}

/**
 * The lights' colours as the shader takes them: two to four.
 *
 * @param {FlutedBokehConfig} config The settings.
 * @returns {string[]} The colours.
 */
export function bokehColors(config) {
	return pickColors(config, STAGE).slice(0, 4);
}

/**
 * A CSS `background` that stands in for the lights before the shader
 * starts and without WebGL: the lights as soft radial gradients, under
 * upright stripes for the reeds or a grid for the blocks.
 *
 * @param {FlutedBokehConfig} config The settings (`colors`/`palette`, `background`, `mode`, `flutes`, `lights`, `size`, `seed`).
 * @param {number} [aspect=0.8] The element's width over its height (a 4:5 card by default).
 * @returns {string} The CSS background.
 */
export function bokehStill(config, aspect = 0.8) {
	const o = settings(config);
	const cols = bokehColors(config);
	const ground = toHex(parseColor(o.background));
	const lights = bokehLights(config).map((l) => {
		const c = toHex(mixOklab(parseColor(ground), parseColor(cols[l.color]), 0.85));
		const rx = Math.round(((o.size * l.r) / aspect) * 100);
		const ry = Math.round(o.size * l.r * 100);
		return `radial-gradient(${rx}% ${ry}% at ${Math.round(l.x * 100)}% ${Math.round(l.y * 100)}%, ${c} 0%, transparent 100%)`;
	});
	const w = 100 / Math.max(1, o.flutes);
	const reeds = `repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0, transparent ${(w * 0.15).toFixed(2)}%, transparent ${(w * 0.8).toFixed(2)}%, rgba(0,0,0,0.3) ${w.toFixed(2)}%)`;
	const glass =
		o.modeIndex === 1
			? [reeds, `repeating-linear-gradient(180deg, transparent 0, transparent ${(w * aspect * 0.9).toFixed(2)}%, rgba(0,0,0,0.45) ${(w * aspect).toFixed(2)}%)`]
			: [reeds];
	return [...glass, ...lights, ground].join(', ');
}

/**
 * Starts the lights and the glass on an element: a canvas inside it (its
 * first), at the stage's capped pixel ratio.
 *
 * @param {HTMLElement} el The element.
 * @param {FlutedBokehConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function flutedBokeh(el, config) {
	const o = settings(config);
	const lights = bokehLights(config);
	const rgb = (/** @type {string[]} */ cs) => lights.map((l) => parseColor(cs[l.color % cs.length]));
	let colours = rgb(bokehColors(config));
	const ground = parseColor(o.background);
	const start = frameNow();
	const at = new Float32Array(MAX_LIGHTS * 4);
	const flat = new Float32Array(MAX_LIGHTS * 3);
	let aspect = 0.8;

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		still: o.speed <= 0,
		fps: SLOW_FPS, // slow motion: every other frame of a 60 Hz screen is as smooth to the eye
		setup({ gl, uniform }) {
			gl.uniform1f(uniform('uMode'), o.modeIndex);
			gl.uniform1f(uniform('uFlutes'), Math.max(1, o.flutes));
			gl.uniform1f(uniform('uSqueeze'), o.squeeze);
			gl.uniform1f(uniform('uDisp'), o.dispersion);
			gl.uniform1f(uniform('uStreak'), o.streak);
			gl.uniform1f(uniform('uSeams'), o.seams);
			gl.uniform1f(uniform('uGrain'), o.grain);
			gl.uniform1f(uniform('uCount'), lights.length);
			gl.uniform1f(uniform('uGlow'), o.glow);
			gl.uniform3f(uniform('uBg'), ground[0], ground[1], ground[2]);
		},
		resize({ gl, uniform }) {
			const w = Math.max(1, el.clientWidth);
			const h = Math.max(1, el.clientHeight);
			aspect = w / h;
			gl.uniform1f(uniform('uAspect'), aspect);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, w / h));
		},
		uniforms({ gl, uniform }, now) {
			const t = ((now - start) / 1000) * Math.max(0, o.speed);
			gl.uniform1f(uniform('uTime'), t);
			// where each light is this frame (it wanders on a slow loop), and how fast its glow falls off
			lights.forEach((l, i) => {
				const ph = 2 * Math.PI * t * o.rate + l.phase;
				const r = o.size * l.r;
				at[i * 4] = l.x + (o.drift * Math.sin(ph * 0.9)) / aspect;
				at[i * 4 + 1] = l.y + o.drift * Math.cos(ph * 0.71);
				at[i * 4 + 2] = 1.4 / (r * r);
			});
			gl.uniform4fv(uniform('uLightAt[0]'), at);
			colours.forEach((c, i) => flat.set(c, i * 3));
			gl.uniform3fv(uniform('uLightCol[0]'), flat);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		colours = rgb(bokehColors({ colors: next.colors }));
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
