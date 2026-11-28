/**
 * @module @arraypress/effects-astro/fluted-glow
 *
 * A soft light seen through reeded glass: behind upright flutes, a glowing
 * ring, a round orb or a light rising from the bottom, ramped from the
 * ground through a deep and a mid colour to a hot one (in Oklab), breathing
 * and drifting slowly. Each flute shows a narrow slice of what is behind it
 * stretched across its width, so the light breaks into vertical strips,
 * with a faint shadow and highlight at each flute's seams and a fine grain
 * over all of it. Unlike `<FlutedGlass>` (slanted flutes over pointer-led
 * blooms) it is made to sit behind copy: no pointer, the light framing a
 * quiet middle, the copy sharp in front of the glass.
 *
 * Every clock is in seconds and nothing is kept between frames; the light
 * and the flutes' slicing are here in plain JavaScript too (`glowAt`,
 * `fluteSample`).
 *
 * Opaque: it paints its `background` (default near-black) everywhere.
 * Without WebGL nothing is drawn; with prefers-reduced-motion it is one
 * still frame.
 */

import { createStage } from './stage.js';
import { GLSL_HASH33 } from './hash-noise.js';
import { GLSL_OKLAB, parseColor, toOklab, toHex, mixOklab } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';
import { frameNow } from './loop.js';

/**
 * @typedef {'ring' | 'orb' | 'rise'} GlowShape
 *
 * @typedef {object} FlutedGlowConfig
 * @property {string[]} [colors] Three CSS hex colours, the light from its edge in: deep, mid and hot. Default a violet ring's.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {string} [background='#08070c'] The ground, painted everywhere.
 * @property {GlowShape} [shape='ring'] The light behind the glass.
 * @property {number} [flutes=14] Flutes across the width.
 * @property {number} [squeeze=0.35] How much of what is behind a flute it shows across its width (lower stretches more).
 * @property {number} [size=0.3] The ring's radius or the orb's, a share of the height; how high the rise reaches.
 * @property {number} [thickness=0.09] The ring's soft width, a share of the height.
 * @property {number} [glow=1] How bright the light is.
 * @property {number} [breathe=0.06] How far the light swells and shrinks, a share of its size.
 * @property {number} [drift=0.04] How far its centre wanders, a share of the height.
 * @property {number} [rate=0.05] How fast it breathes and wanders, cycles a second.
 * @property {number} [seams=0.35] How strong the flutes' shadows and highlights are; 0 for none.
 * @property {number} [grain=0.05] Fine grain over all of it; 0 for none.
 * @property {[number, number]} [centre=[0.5, 0.5]] The ring's or orb's centre, 0–1 from the top left.
 * @property {number} [seed=0] Where its wandering starts, so two cards differ.
 * @property {number} [speed=1] Plays every clock faster or slower; 0 for one still frame.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area dimmed: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 */

/** The shapes, in the order the shader numbers them. */
export const GLOW_SHAPES = /** @type {const} */ (['ring', 'orb', 'rise']);

/** The settings' defaults, shared by the shader and the JS twin. */
export const GLOW_DEFAULTS = {
	background: '#08070c',
	shape: /** @type {GlowShape} */ ('ring'),
	flutes: 14,
	squeeze: 0.35,
	size: 0.3,
	thickness: 0.09,
	glow: 1,
	breathe: 0.06,
	drift: 0.04,
	rate: 0.05,
	seams: 0.35,
	grain: 0.05,
	centre: /** @type {[number, number]} */ ([0.5, 0.5]),
	seed: 0,
};

/** The default colours: a violet ring's. */
const VIOLET = ['#3a1a7a', '#8f7cff', '#f2eeff'];

/**
 * GLSL: `float glowAt(vec2 p, float t)`, how bright the light behind the
 * glass is at a point (heights from the top left), 0–1 and beyond at its
 * hottest. `glowAt` below is the same in JavaScript.
 */
const GLSL_GLOW = `
uniform float uShape;
uniform float uSizeL;
uniform float uThick;
uniform float uGlow;
uniform float uBreathe;
uniform float uDrift;
uniform float uRate;
uniform vec2 uCentre;
uniform float uSeed;
float glowAt(vec2 p, float t) {
	float ph = 6.2831853 * t * uRate;
	float grow = 1.0 + uBreathe * sin(ph + uSeed);
	vec2 c = uCentre + uDrift * vec2(sin(ph * 0.7 + uSeed * 1.3), cos(ph * 0.53 + uSeed * 0.7));
	if (uShape < 0.5) {
		float d = (length(p - c) - uSizeL * grow) / max(uThick, 0.01);
		return uGlow * exp(-d * d);
	}
	if (uShape < 1.5) {
		float d = length(p - c) / max(uSizeL * grow, 0.01);
		return uGlow * exp(-d * d * 1.6);
	}
	float top = uCentre.y * 2.0 - uSizeL * grow;
	float sway = 0.06 * sin(p.x * 5.0 + ph + uSeed);
	return uGlow * smoothstep(top - 0.25, top + 0.55, p.y + sway);
}
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uFlutes;
uniform float uSqueeze;
uniform float uSeams;
uniform float uGrain;
uniform vec3 uBg;
uniform vec3 uRamp[3];
${GLSL_OKLAB}
${GLSL_QUIET}
${GLSL_HASH33}
${GLSL_GLOW}

void main() {
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	float aspect = uRes.x / uRes.y;
	// Heights from the top left; the flutes measured in widths.
	vec2 p = px / uRes.y;
	float fw = 1.0 / uFlutes;
	float fx = px.x / uRes.x;
	float idx = floor(fx / fw);
	float local = (fx / fw - idx) * 2.0 - 1.0;
	float sx = ((idx + 0.5) * fw + local * 0.5 * fw * uSqueeze) * aspect;
	float i = glowAt(vec2(sx, p.y), uTime);

	vec2 q = vec2(p.x - 0.5 * aspect, 0.5 - p.y);
	i *= mix(1.0 - uQuiet.w, 1.0, quietOpen(q));

	// The ramp: ground, deep, mid, hot, by how bright.
	vec3 lab = mix(uBg, uRamp[0], smoothstep(0.0, 0.35, i));
	lab = mix(lab, uRamp[1], smoothstep(0.3, 0.75, i));
	lab = mix(lab, uRamp[2], smoothstep(0.8, 1.2, i));
	vec3 col = fromOklab(lab);

	// Each flute a little darker toward its seams, a highlight on its left seam, a shadow on its right.
	float seam = 1.0 - uSeams * 0.35 * (1.0 - cos(local * 1.5707963));
	seam += uSeams * 0.25 * smoothstep(-0.86, -1.0, local) * (0.3 + i);
	seam -= uSeams * 0.3 * smoothstep(0.86, 1.0, local);
	col *= seam;
	col += (hash33(vec3(px, floor(uTime * 24.0))).x - 0.5) * uGrain;
	gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * The settings, filled with the defaults, with the shape's number.
 *
 * @param {FlutedGlowConfig} config The settings.
 * @returns {typeof GLOW_DEFAULTS & { shapeIndex: number, speed: number }} The settings.
 */
function settings(config) {
	const o = { ...GLOW_DEFAULTS, speed: 1, ...config };
	return { ...o, shapeIndex: Math.max(0, GLOW_SHAPES.indexOf(o.shape)) };
}

/**
 * How bright the light behind the glass is at a point (the shader's
 * `glowAt`), before the flutes and the quiet area.
 *
 * @param {FlutedGlowConfig} config The settings.
 * @param {number} x Heights from the left.
 * @param {number} y Heights from the top.
 * @param {number} aspect Width over height (the centre is a share of each).
 * @param {number} [time=0] Seconds (already at its speed).
 * @returns {number} 0 and up; about `glow` at its hottest.
 */
export function glowAt(config, x, y, aspect, time = 0) {
	const o = settings(config);
	const ph = 2 * Math.PI * time * o.rate;
	const grow = 1 + o.breathe * Math.sin(ph + o.seed);
	const cx = o.centre[0] * aspect + o.drift * Math.sin(ph * 0.7 + o.seed * 1.3);
	const cy = o.centre[1] + o.drift * Math.cos(ph * 0.53 + o.seed * 0.7);
	if (o.shapeIndex === 0) {
		const d = (Math.hypot(x - cx, y - cy) - o.size * grow) / Math.max(o.thickness, 0.01);
		return o.glow * Math.exp(-d * d);
	}
	if (o.shapeIndex === 1) {
		const d = Math.hypot(x - cx, y - cy) / Math.max(o.size * grow, 0.01);
		return o.glow * Math.exp(-d * d * 1.6);
	}
	const top = o.centre[1] * 2 - o.size * grow;
	const sway = 0.06 * Math.sin(x * 5 + ph + o.seed);
	const t = Math.min(1, Math.max(0, (y + sway - (top - 0.25)) / 0.8));
	return o.glow * t * t * (3 - 2 * t);
}

/**
 * Where behind the glass a point looks (the shader's slicing): each flute
 * shows a slice `squeeze` of its own width, stretched across it.
 *
 * @param {number} fx The point, a share of the width (0–1).
 * @param {number} flutes Flutes across the width.
 * @param {number} squeeze The share of a flute's width it shows.
 * @returns {{ x: number, local: number }} The share of the width it shows, and where in its flute it is (−1 to 1).
 */
export function fluteSample(fx, flutes, squeeze) {
	const fw = 1 / flutes;
	const idx = Math.floor(fx / fw);
	const local = (fx / fw - idx) * 2 - 1;
	return { x: (idx + 0.5) * fw + local * 0.5 * fw * squeeze, local };
}

/**
 * The light's three colours as the shader takes them (fewer repeat).
 *
 * @param {FlutedGlowConfig} config The settings.
 * @returns {[string, string, string]} Deep, mid and hot.
 */
export function glowColors(config) {
	const c = pickColors(config, VIOLET);
	return [c[0], c[Math.min(1, c.length - 1)], c[c.length - 1]];
}

/**
 * A CSS `background` that stands in for the light before the shader starts
 * and without WebGL: the ring, orb or rise as a CSS gradient, under upright
 * stripes for the flutes.
 *
 * @param {FlutedGlowConfig} config The settings (`colors`/`palette`, `background`, `shape`, `flutes`, `size`, `thickness`, `centre`).
 * @param {number} [aspect=0.8] The element's width over its height, to size the ring and orb as the shader does (a 4:5 card by default).
 * @returns {string} The CSS background.
 */
export function glowStill(config, aspect = 0.8) {
	const o = settings(config);
	// A circle's stops run along the ray to the farthest corner; the shader measures in heights.
	const [cx, cy] = o.centre;
	const ray = Math.hypot(Math.max(cx, 1 - cx) * aspect, Math.max(cy, 1 - cy));
	const [deep, mid, hot] = glowColors(config).map((c) => toHex(parseColor(c)));
	const ground = o.background;
	const fade = toHex(mixOklab(parseColor(ground), parseColor(deep), 0.5));
	const at = `${Math.round(o.centre[0] * 100)}% ${Math.round(o.centre[1] * 100)}%`;
	const r = Math.round((o.size / ray) * 100);
	const w = Math.round((o.thickness / ray) * 100);
	const flute = `repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0, transparent ${(100 / o.flutes) * 0.12}%, transparent ${(100 / o.flutes) * 0.8}%, rgba(0,0,0,0.25) ${100 / o.flutes}%)`;
	const light =
		o.shapeIndex === 0
			? `radial-gradient(circle at ${at}, ${ground} ${Math.max(0, r - 2 * w)}%, ${deep} ${r - w}%, ${hot} ${r}%, ${mid} ${r + w * 0.6}%, ${fade} ${r + w * 1.4}%, ${ground} ${r + w * 2.4}%)`
			: o.shapeIndex === 1
				? `radial-gradient(circle at ${at}, ${hot} 0%, ${mid} ${Math.round(r * 0.5)}%, ${deep} ${r}%, ${ground} ${Math.round(r * 1.6)}%)`
				: `linear-gradient(to top, ${hot} 0%, ${mid} ${Math.round(o.size * 60)}%, ${deep} ${Math.round(o.size * 100)}%, ${ground} ${Math.round(o.size * 160)}%)`;
	return [flute, light, ground].join(', ');
}

/**
 * Starts the light on an element: a canvas inside it (its first), at the
 * stage's capped pixel ratio.
 *
 * @param {HTMLElement} el The element.
 * @param {FlutedGlowConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function flutedGlow(el, config) {
	const o = settings(config);
	const lab = (/** @type {string} */ c) => toOklab(parseColor(c));
	let ramp = glowColors(config).map(lab);
	const ground = lab(o.background);
	const start = frameNow();

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		still: o.speed <= 0,
		setup({ gl, uniform }) {
			gl.uniform1f(uniform('uFlutes'), Math.max(1, o.flutes));
			gl.uniform1f(uniform('uSqueeze'), o.squeeze);
			gl.uniform1f(uniform('uSeams'), o.seams);
			gl.uniform1f(uniform('uGrain'), o.grain);
			gl.uniform3f(uniform('uBg'), ground[0], ground[1], ground[2]);
			gl.uniform1f(uniform('uShape'), o.shapeIndex);
			gl.uniform1f(uniform('uSizeL'), o.size);
			gl.uniform1f(uniform('uThick'), o.thickness);
			gl.uniform1f(uniform('uGlow'), o.glow);
			gl.uniform1f(uniform('uBreathe'), o.breathe);
			gl.uniform1f(uniform('uDrift'), o.drift);
			gl.uniform1f(uniform('uRate'), o.rate);
			gl.uniform1f(uniform('uSeed'), o.seed);
		},
		resize({ gl, uniform }) {
			const w = Math.max(1, el.clientWidth);
			const h = Math.max(1, el.clientHeight);
			gl.uniform2f(uniform('uCentre'), o.centre[0] * (w / h), o.centre[1]);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, w / h));
		},
		uniforms({ gl, uniform }, now) {
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000) * Math.max(0, o.speed));
			gl.uniform3fv(uniform('uRamp[0]'), new Float32Array(ramp.flat()));
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		ramp = glowColors({ colors: next.colors }).map(lab);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
