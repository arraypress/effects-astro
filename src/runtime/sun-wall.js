/**
 * @module @arraypress/effects-astro/sun-wall
 *
 * Low sunlight on a plaster wall, in one of two ways a room makes it:
 *
 * - `blinds`: the window's shape thrown on the wall through venetian blinds,
 *   a skewed patch of hard bright bars with dark gaps. The bars sharpen
 *   nearest the window and soften with distance (the penumbra grows with the
 *   throw, as the sun is not a point), and they breathe slightly as the slats
 *   tilt; the whole patch creeps as the sun moves.
 * - `prism`: a patch of sunlight with a sliver of spectrum laid across the
 *   wall, as a glass edge or a crystal throws one: red on one side to violet
 *   on the other, brightest in the yellow-green, its edges soft with
 *   dispersion, slightly bowed, sliding slowly.
 *
 * The light is multiplied into the wall's own colour (paint takes light, it
 * doesn't glow), the wall has a fine plaster grain and a soft fall-off from
 * the light, and a filmic shoulder lets the brightest bars burn without
 * clipping.
 *
 * Every clock is in seconds and nothing is kept between frames; the light is
 * here in plain JavaScript too (`blindsAt`, `spectrumRgb`).
 *
 * Opaque: it paints the wall everywhere. Without WebGL nothing is drawn; with
 * prefers-reduced-motion it is one still frame.
 */

import { createStage, SLOW_FPS } from './stage.js';
import { GLSL_HASH33, GLSL_GRADIENT_NOISE } from './hash-noise.js';
import { parseColor, toHex, mixOklab } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { frameNow } from './loop.js';

/**
 * @typedef {'blinds' | 'prism'} SunWallMode
 *
 * @typedef {object} SunWallConfig
 * @property {SunWallMode} [mode='blinds'] Blinds or a prism's spectrum.
 * @property {string} [wall='#cdb89d'] The wall's paint.
 * @property {string} [sun='#ffe2b0'] The sunlight's colour.
 * @property {number} [exposure=1] How strong the sun is.
 * @property {number} [ambient=0.34] How lit the wall is in shade, 0–1.
 * @property {number} [angle=-24] Which way the light falls across the wall, degrees from upright.
 * @property {number} [slats=11] How many bars in the patch (blinds).
 * @property {number} [open=0.55] How much of each bar's pitch lets light through, 0–1 (blinds).
 * @property {number} [soft=0.6] How much the bars soften with distance, 0–1 (blinds).
 * @property {[number, number]} [patch=[0.5, 0.48]] The light patch's centre, 0–1 from the top left.
 * @property {[number, number]} [size=[0.62, 0.72]] The patch's width and height, shares of the card's.
 * @property {number} [band=0.065] The spectrum's width, a share of the height (prism).
 * @property {number} [bow=0.05] How much the spectrum bows (prism).
 * @property {number} [drift=0.05] How far the light creeps, a share of the height.
 * @property {number} [rate=0.06] How fast it creeps, cycles a second.
 * @property {number} [grain=0.03] Fine grain; 0 for none.
 * @property {number} [seed=0] Where its creeping starts.
 * @property {number} [speed=1] Plays every clock faster or slower; 0 for one still frame.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null] An area dimmed (see `quietUniform`).
 */

/** The modes, in the order the shader numbers them. */
export const SUN_MODES = /** @type {const} */ (['blinds', 'prism']);

/** The settings' defaults, shared by the shader and the JS twin. */
export const SUN_DEFAULTS = {
	mode: /** @type {SunWallMode} */ ('blinds'),
	wall: '#cdb89d',
	sun: '#ffe2b0',
	exposure: 1,
	ambient: 0.34,
	angle: -24,
	slats: 11,
	open: 0.55,
	soft: 0.6,
	patch: /** @type {[number, number]} */ ([0.5, 0.48]),
	size: /** @type {[number, number]} */ ([0.62, 0.72]),
	band: 0.065,
	bow: 0.05,
	drift: 0.05,
	rate: 0.06,
	grain: 0.03,
	seed: 0,
};

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uMode;
uniform vec3 uWall;
uniform vec3 uSun;
uniform float uExposure;
uniform float uAmbient;
uniform float uAngle;
uniform float uSlats;
uniform float uOpen;
uniform float uSoft;
uniform vec2 uPatch;
uniform vec2 uSize;
uniform float uBand;
uniform float uBow;
uniform float uDrift;
uniform float uRate;
uniform float uGrain;
uniform float uSeed;
${GLSL_QUIET}
${GLSL_HASH33}
${GLSL_GRADIENT_NOISE}

// red (0) to violet (1): the visible spectrum as a prism spreads it, brightest in the yellow-green
vec3 spectrum(float x) {
	vec3 c = mix(vec3(1.0, 0.08, 0.04), vec3(1.0, 0.55, 0.05), smoothstep(0.0, 0.2, x));
	c = mix(c, vec3(1.0, 0.95, 0.2), smoothstep(0.15, 0.35, x));
	c = mix(c, vec3(0.35, 1.0, 0.25), smoothstep(0.32, 0.5, x));
	c = mix(c, vec3(0.1, 0.8, 1.0), smoothstep(0.48, 0.66, x));
	c = mix(c, vec3(0.2, 0.3, 1.0), smoothstep(0.62, 0.82, x));
	c = mix(c, vec3(0.55, 0.15, 0.95), smoothstep(0.8, 1.0, x));
	float lum = 0.55 + 0.45 * exp(-pow((x - 0.36) / 0.3, 2.0));
	return c * lum;
}

void main() {
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	float aspect = uRes.x / uRes.y;
	vec2 p = px / uRes.y;
	float ph = 6.2831853 * uTime * uRate;
	vec2 creep = uDrift * vec2(sin(ph + uSeed), 0.6 * cos(ph * 0.8 + uSeed));
	vec2 c = uPatch + creep;
	// into the light's frame: v runs along the fall (downward, tilted by the angle), u across it
	float a = radians(uAngle);
	vec2 d = p - c;
	vec2 uv = vec2(cos(a) * d.x + sin(a) * d.y, -sin(a) * d.x + cos(a) * d.y);
	vec2 hs = 0.5 * uSize * vec2(aspect, 1.0);
	// the patch, skewed along the fall as a window thrown at a low sun
	vec2 s = vec2(uv.x - uv.y * 0.35, uv.y);
	float edgeSoft = 0.012 + uSoft * 0.05 * clamp(0.5 + 0.5 * s.y / max(hs.y, 0.01), 0.0, 1.0);
	float patch = smoothstep(hs.x + edgeSoft, hs.x - edgeSoft, abs(s.x)) * smoothstep(hs.y + edgeSoft, hs.y - edgeSoft, abs(s.y));

	vec3 light = vec3(0.0);
	if (uMode < 0.5) {
		// the bars: across the fall, their pitch from the slat count; penumbra growing with the thr (downward)
		float pitch = (2.0 * hs.y) / uSlats;
		float tilt = uOpen + 0.06 * sin(ph * 1.3 + uSeed * 2.0);
		float k = fract((s.y + hs.y) / pitch);
		float thr = clamp(0.5 + s.y / max(2.0 * hs.y, 0.01), 0.0, 1.0);
		float pen = 0.015 + uSoft * 0.11 * thr;
		float bar = smoothstep(0.0, pen, k) * smoothstep(tilt, tilt - pen, k);
		light = uSun * bar * patch * 1.9;
	} else {
		// a patch of sun, and beside it in the shade the spectrum a glass edge throws: a short bowed streak, red to violet
		// across its width, its colours blurred into each other, fading at both ends
		light = uSun * patch * 0.9;
		vec2 b = uv - vec2(hs.x * 1.25, 0.0);
		float bow = uBow * (b.y * b.y) / max(hs.y, 0.01);
		float across = (b.x - bow) / uBand + 0.5;
		float ends = smoothstep(hs.y * 0.75, hs.y * 0.1, abs(b.y + hs.y * 0.1));
		float inside = smoothstep(-0.25, 0.12, across) * smoothstep(1.25, 0.88, across);
		vec3 spec = spectrum(clamp(across, 0.0, 1.0));
		spec = mix(vec3(dot(spec, vec3(0.3, 0.55, 0.15))), spec, 1.25);
		light += max(spec, 0.0) * inside * ends * 2.6;
	}

	// the wall: plaster grain, darker toward the floor and the corners, lit by the light it gets
	float plaster = (gnoise(p * 60.0) - 0.5) * 0.5 + (gnoise(p * 190.0) - 0.5) * 0.35;
	float fall = 1.0 - 0.28 * smoothstep(0.2, 1.1, p.y) - 0.18 * smoothstep(0.35, 0.9, length(vec2(p.x - 0.5 * aspect, p.y - 0.45)));
	vec3 albedo = uWall * (1.0 + plaster * 0.06);
	vec2 qc = vec2(p.x - 0.5 * aspect, 0.5 - p.y);
	float open = mix(1.0 - uQuiet.w, 1.0, quietOpen(qc));
	vec3 col = albedo * (uAmbient * fall + light * uExposure * open);
	col = 1.0 - exp(-col * 1.35);
	col += (hash33(vec3(px, floor(uTime * 24.0))).x - 0.5) * uGrain;
	gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * The settings, filled with the defaults, with the mode's number.
 *
 * @param {SunWallConfig} config The settings.
 * @returns {typeof SUN_DEFAULTS & { modeIndex: number, speed: number }} The settings.
 */
function settings(config) {
	const o = { ...SUN_DEFAULTS, speed: 1, ...config };
	return { ...o, modeIndex: Math.max(0, SUN_MODES.indexOf(o.mode)) };
}

/**
 * The visible spectrum as the shader paints it (red at 0, violet at 1).
 *
 * @param {number} x 0–1 across the band.
 * @returns {[number, number, number]} Linear-ish RGB, about 0–1.15.
 */
export function spectrumRgb(x) {
	const ss = (a, b, t) => {
		const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
		return k * k * (3 - 2 * k);
	};
	const mix = (u, w, t) => u.map((v, i) => v + (w[i] - v) * t);
	let c = mix([1, 0.08, 0.04], [1, 0.55, 0.05], ss(0, 0.2, x));
	c = mix(c, [1, 0.95, 0.2], ss(0.15, 0.35, x));
	c = mix(c, [0.35, 1, 0.25], ss(0.32, 0.5, x));
	c = mix(c, [0.1, 0.8, 1], ss(0.48, 0.66, x));
	c = mix(c, [0.2, 0.3, 1], ss(0.62, 0.82, x));
	c = mix(c, [0.55, 0.15, 0.95], ss(0.8, 1, x));
	const lum = 0.55 + 0.45 * Math.exp(-(((x - 0.36) / 0.3) ** 2));
	return /** @type {[number, number, number]} */ (c.map((v) => v * lum));
}

/**
 * How lit a point on the wall is through the blinds (the shader's bars × patch), 0–1.
 *
 * @param {SunWallConfig} config The settings.
 * @param {number} x Heights from the left.
 * @param {number} y Heights from the top.
 * @param {number} aspect Width over height.
 * @param {number} [time=0] Seconds (already at its speed).
 * @returns {number} 0 in shade, 1 in a bar's full light.
 */
export function blindsAt(config, x, y, aspect, time = 0) {
	const o = settings(config);
	const ph = 2 * Math.PI * time * o.rate;
	const cx = o.patch[0] * aspect + o.drift * Math.sin(ph + o.seed);
	const cy = o.patch[1] + o.drift * 0.6 * Math.cos(ph * 0.8 + o.seed);
	const a = (o.angle * Math.PI) / 180;
	const dx = x - cx,
		dy = y - cy;
	const u = Math.cos(a) * dx + Math.sin(a) * dy,
		v = -Math.sin(a) * dx + Math.cos(a) * dy;
	const hx = 0.5 * o.size[0] * aspect,
		hy = 0.5 * o.size[1];
	const sx = u - v * 0.35;
	const ss = (e0, e1, t) => {
		const k = Math.min(1, Math.max(0, (t - e0) / (e1 - e0)));
		return k * k * (3 - 2 * k);
	};
	const es = 0.012 + o.soft * 0.05 * Math.min(1, Math.max(0, 0.5 + (0.5 * v) / Math.max(hy, 0.01)));
	const patch = ss(hx + es, hx - es, Math.abs(sx)) * ss(hy + es, hy - es, Math.abs(v));
	const pitch = (2 * hy) / o.slats;
	const tilt = o.open + 0.06 * Math.sin(ph * 1.3 + o.seed * 2);
	const k = (((v + hy) / pitch) % 1 + 1) % 1;
	const thr = Math.min(1, Math.max(0, 0.5 + v / Math.max(2 * hy, 0.01)));
	const pen = 0.015 + o.soft * 0.11 * thr;
	return ss(0, pen, k) * ss(tilt, tilt - pen, k) * patch;
}

/**
 * A CSS `background` that stands in for the light before the shader starts and
 * without WebGL: the wall, with skewed bars (blinds) or a spectrum band (prism).
 *
 * @param {SunWallConfig} config The settings.
 * @returns {string} The CSS background.
 */
export function sunWallStill(config) {
	const o = settings(config);
	const shade = toHex(mixOklab(parseColor('#000000'), parseColor(o.wall), 0.55));
	const lit = toHex(mixOklab(parseColor(o.wall), parseColor(o.sun), 0.55));
	const wall = `radial-gradient(ellipse at 50% 45%, ${toHex(mixOklab(parseColor(shade), parseColor(o.wall), 0.55))} 0%, ${shade} 100%)`;
	if (o.modeIndex === 0) {
		const pitch = (o.size[1] * 100) / o.slats;
		const bars = `repeating-linear-gradient(${180 + o.angle}deg, ${lit} 0 ${(pitch * o.open).toFixed(2)}%, transparent ${(pitch * o.open).toFixed(2)}% ${pitch.toFixed(2)}%)`;
		const mask = `radial-gradient(ellipse ${Math.round(o.size[0] * 60)}% ${Math.round(o.size[1] * 60)}% at ${Math.round(o.patch[0] * 100)}% ${Math.round(o.patch[1] * 100)}%, transparent 60%, ${shade} 100%)`;
		return [mask, bars, wall].join(', ');
	}
	const stops = [0, 0.2, 0.4, 0.6, 0.8, 1].map((x) => `${toHex(spectrumRgb(x).map((c) => Math.min(1, c * 0.9)))} ${(46 + x * 8).toFixed(1)}%`).join(', ');
	const band = `linear-gradient(${90 + o.angle}deg, transparent 44%, ${stops}, transparent 56%)`;
	return [band, `radial-gradient(ellipse at ${Math.round(o.patch[0] * 100)}% ${Math.round(o.patch[1] * 100)}%, ${lit} 0%, transparent 55%)`, wall].join(', ');
}

/**
 * Starts the light on an element: a canvas inside it (its first).
 *
 * @param {HTMLElement} el The element.
 * @param {SunWallConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function sunWall(el, config) {
	const o = settings(config);
	const start = frameNow();
	const { stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		still: o.speed <= 0,
		fps: SLOW_FPS, // slow motion: every other frame of a 60 Hz screen is as smooth to the eye
		setup({ gl, uniform }) {
			gl.uniform1f(uniform('uMode'), o.modeIndex);
			gl.uniform3fv(uniform('uWall'), parseColor(o.wall));
			gl.uniform3fv(uniform('uSun'), parseColor(o.sun));
			gl.uniform1f(uniform('uExposure'), o.exposure);
			gl.uniform1f(uniform('uAmbient'), o.ambient);
			gl.uniform1f(uniform('uAngle'), o.angle);
			gl.uniform1f(uniform('uSlats'), Math.max(2, o.slats));
			gl.uniform1f(uniform('uOpen'), o.open);
			gl.uniform1f(uniform('uSoft'), o.soft);
			gl.uniform2f(uniform('uSize'), o.size[0], o.size[1]);
			gl.uniform1f(uniform('uBand'), o.band);
			gl.uniform1f(uniform('uBow'), o.bow);
			gl.uniform1f(uniform('uDrift'), o.drift);
			gl.uniform1f(uniform('uRate'), o.rate);
			gl.uniform1f(uniform('uGrain'), o.grain);
			gl.uniform1f(uniform('uSeed'), o.seed);
		},
		resize({ gl, uniform }) {
			const w = Math.max(1, el.clientWidth);
			const h = Math.max(1, el.clientHeight);
			gl.uniform2f(uniform('uPatch'), o.patch[0] * (w / h), o.patch[1]);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, w / h));
		},
		uniforms({ gl, uniform }, now) {
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000) * Math.max(0, o.speed));
		},
	});
	return stop;
}
