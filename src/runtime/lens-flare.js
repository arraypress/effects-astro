/**
 * @module @arraypress/effects-astro/lens-flare
 *
 * An anamorphic lens flare, built the way the lens makes one rather than as a
 * sticker: a small hot source with its glow, the long thin horizontal streak a
 * cylindrical (anamorphic) element smears it into (blue from the coatings,
 * white at its core, falling off along its length), a fainter second streak,
 * a veil of scattered light round the source, and the ghosts: soft internal
 * reflections lying on the line from the source through the frame's centre
 * (on the far side too), each a tinted oval squeezed upright as anamorphic
 * ghosts are, brighter at the rim than the middle. The source drifts slowly as
 * if the light or the camera moved, and the ghosts travel the other way
 * through the centre, as real ones do. A faint flicker and grain.
 *
 * Every clock is in seconds and nothing is kept between frames; where the
 * source and the ghosts are, and how bright the streak is, are here in plain
 * JavaScript too (`flareSource`, `flareGhosts`, `streakAt`).
 *
 * Opaque: it paints its `background` (default near-black) everywhere.
 * Without WebGL nothing is drawn; with prefers-reduced-motion it is one
 * still frame.
 */

import { createStage } from './stage.js';
import { GLSL_HASH33 } from './hash-noise.js';
import { parseColor, toHex, mixOklab } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';

/**
 * @typedef {object} LensFlareConfig
 * @property {string} [background='#030406'] The ground, painted everywhere.
 * @property {string} [streak='#4f8dff'] The streak's colour (the coating's): blue for the classic, amber or teal for others.
 * @property {string} [ghost='#ffb36b'] The ghosts' main tint; they also take the streak's and a green one.
 * @property {string} [haze] The ground's glow round the source; default the streak's, deep.
 * @property {[number, number]} [source=[0.24, 0.32]] Where the light is, 0–1 from the top left.
 * @property {number} [length=1.6] How long the streak reaches each way, in widths.
 * @property {number} [width=0.006] The streak's half-height, a share of the height.
 * @property {number} [power=1] How bright it all is.
 * @property {number} [ghosts=5] How many ghosts (0–6).
 * @property {number} [drift=0.06] How far the source wanders, a share of the height.
 * @property {number} [rate=0.05] How fast it wanders, cycles a second.
 * @property {number} [flicker=0.04] How much the source's brightness flickers.
 * @property {number} [grain=0.035] Fine grain; 0 for none.
 * @property {number} [seed=0] Where its wandering starts.
 * @property {number} [speed=1] Plays every clock faster or slower; 0 for one still frame.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null] An area dimmed (see `quietUniform`).
 */

/** The settings' defaults, shared by the shader and the JS twin. */
export const FLARE_DEFAULTS = {
	background: '#030406',
	streak: '#4f8dff',
	ghost: '#ffb36b',
	source: /** @type {[number, number]} */ ([0.24, 0.32]),
	length: 1.6,
	width: 0.006,
	power: 1,
	ghosts: 5,
	drift: 0.06,
	rate: 0.05,
	flicker: 0.04,
	grain: 0.035,
	seed: 0,
};

/** The most ghosts the shader draws. */
export const MAX_GHOSTS = 6;

/** Each ghost: where it lies on the line from the source through the centre (0 the source, 1 the centre, 2 the mirror),
 * its radius (a share of the height), how bright, and which tint (0 the main, 1 the streak's, 2 green). */
const GHOSTS = [
	[1.35, 0.05, 0.22, 0],
	[1.75, 0.11, 0.1, 1],
	[0.55, 0.022, 0.3, 2],
	[2.15, 0.17, 0.06, 0],
	[1.12, 0.012, 0.5, 1],
	[0.8, 0.07, 0.08, 0],
];

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uBg;
uniform vec3 uStreakC;
uniform vec3 uHazeC;
uniform vec3 uTint[3];
uniform vec2 uSrc;
uniform float uLen;
uniform float uWidth;
uniform float uPower;
uniform float uGhosts;
uniform float uDrift;
uniform float uRate;
uniform float uFlicker;
uniform float uGrain;
uniform float uSeed;
uniform vec4 uGhost[${MAX_GHOSTS}];
${GLSL_QUIET}
${GLSL_HASH33}

void main() {
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	float aspect = uRes.x / uRes.y;
	vec2 p = px / uRes.y;                 // heights from the top left
	vec2 mid = vec2(0.5 * aspect, 0.5);
	float ph = 6.2831853 * uTime * uRate;
	vec2 s = uSrc + uDrift * vec2(sin(ph + uSeed), 0.55 * sin(ph * 0.71 + uSeed * 1.7));
	float flick = 1.0 + uFlicker * (sin(uTime * 7.3 + uSeed) * 0.6 + sin(uTime * 12.9) * 0.4);
	float pw = uPower * flick;
	vec2 d = p - s;

	vec3 col = uBg;
	// the veil: light scattered in the glass, wide and dim round the source
	float veil = exp(-dot(d, d) * 6.0) * 0.22 + exp(-length(d) * 3.2) * 0.12;
	col += uHazeC * veil * pw;

	// the streak: thin and long; its core whiter, its body the coating's colour, falling off along its length
	float along = abs(d.x) / (uLen * aspect);
	float fall = 1.0 / (1.0 + along * along * 7.0) * smoothstep(1.0, 0.15, along);
	float thin = exp(-abs(d.y) / uWidth);
	float body = exp(-abs(d.y) / (uWidth * 3.5));
	col += uStreakC * (body * 0.55 + thin * 0.8) * fall * pw;
	col += vec3(1.0) * thin * fall * fall * 0.9 * pw;
	// a second, fainter streak just off the first (the lens's other elements)
	float th2 = exp(-abs(d.y - uWidth * 9.0) / (uWidth * 1.2));
	col += uStreakC * th2 * fall * 0.18 * pw;

	// the source: a small hot core and its glow
	float r = length(d);
	col += vec3(1.0, 0.97, 0.92) * (exp(-r * r / 0.00012) * 1.6 + exp(-r * r / 0.0018) * 0.55) * pw;
	col += uStreakC * exp(-r * r / 0.012) * 0.35 * pw;

	// the ghosts: on the line through the centre, squeezed upright, brighter at the rim, a little chromatic
	vec2 axis = mid - s;
	for (int i = 0; i < ${MAX_GHOSTS}; i++) {
		if (float(i) >= uGhosts) break;
		vec4 g = uGhost[i];
		vec2 c = s + axis * g.x;
		vec2 q = (p - c) / vec2(0.78, 1.0);
		float rr = length(q) / g.y;
		vec3 tint = g.w < 0.5 ? uTint[0] : (g.w < 1.5 ? uTint[1] : uTint[2]);
		float disc = smoothstep(1.0, 0.82, rr);
		float rim = smoothstep(0.7, 0.97, rr) * smoothstep(1.06, 0.97, rr);
		// red reaches a hair further than blue, as in a real ghost's edge
		float fringe = smoothstep(1.06, 0.99, rr) - smoothstep(1.0, 0.93, rr);
		col += tint * (disc * 0.5 + rim * 0.45) * g.z * pw;
		col += vec3(0.45, 0.08, -0.15) * fringe * g.z * 0.3 * pw;
	}

	vec2 qc = vec2(p.x - 0.5 * aspect, 0.5 - p.y);
	col = mix(uBg, col, mix(1.0 - uQuiet.w, 1.0, quietOpen(qc)));
	// a soft filmic shoulder, so the hot parts burn to white rather than clip
	col = 1.0 - exp(-col * 1.25);
	col += (hash33(vec3(px, floor(uTime * 24.0))).x - 0.5) * uGrain;
	gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * The settings, filled with the defaults.
 *
 * @param {LensFlareConfig} config The settings.
 * @returns {typeof FLARE_DEFAULTS & { haze: string, speed: number }} The settings.
 */
function settings(config) {
	const o = { ...FLARE_DEFAULTS, speed: 1, ...config };
	const haze = o.haze ?? toHex(mixOklab(parseColor(o.background), parseColor(o.streak), 0.55));
	return { ...o, haze };
}

/**
 * Where the source is at a time (the shader's), in heights from the top left.
 *
 * @param {LensFlareConfig} config The settings.
 * @param {number} aspect Width over height.
 * @param {number} [time=0] Seconds (already at its speed).
 * @returns {[number, number]} The source.
 */
export function flareSource(config, aspect, time = 0) {
	const o = settings(config);
	const ph = 2 * Math.PI * time * o.rate;
	return [o.source[0] * aspect + o.drift * Math.sin(ph + o.seed), o.source[1] + o.drift * 0.55 * Math.sin(ph * 0.71 + o.seed * 1.7)];
}

/**
 * Where the ghosts are at a time: on the line from the source through the centre.
 *
 * @param {LensFlareConfig} config The settings.
 * @param {number} aspect Width over height.
 * @param {number} [time=0] Seconds.
 * @returns {{ x: number, y: number, radius: number }[]} Each ghost's centre (heights) and radius.
 */
export function flareGhosts(config, aspect, time = 0) {
	const o = settings(config);
	const [sx, sy] = flareSource(config, aspect, time);
	const ax = 0.5 * aspect - sx,
		ay = 0.5 - sy;
	return GHOSTS.slice(0, Math.max(0, Math.min(MAX_GHOSTS, o.ghosts))).map(([t, radius]) => ({ x: sx + ax * t, y: sy + ay * t, radius }));
}

/**
 * How bright the streak is at a point, before the colours (the shader's `fall × thin`).
 *
 * @param {LensFlareConfig} config The settings.
 * @param {number} x Heights from the left.
 * @param {number} y Heights from the top.
 * @param {number} aspect Width over height.
 * @param {number} [time=0] Seconds.
 * @returns {number} 0–1.
 */
export function streakAt(config, x, y, aspect, time = 0) {
	const o = settings(config);
	const [sx, sy] = flareSource(config, aspect, time);
	const along = Math.abs(x - sx) / (o.length * aspect);
	const t = Math.min(1, Math.max(0, (1 - along) / 0.85));
	const fall = (1 / (1 + along * along * 7)) * t * t * (3 - 2 * t);
	return fall * Math.exp(-Math.abs(y - sy) / o.width);
}

/**
 * A CSS `background` that stands in for the flare before the shader starts
 * and without WebGL: the source's glow, the streak as a thin horizontal band,
 * the ground.
 *
 * @param {LensFlareConfig} config The settings.
 * @returns {string} The CSS background.
 */
export function flareStill(config) {
	const o = settings(config);
	const [x, y] = o.source.map((v) => Math.round(v * 100));
	const streak = toHex(parseColor(o.streak));
	const band = `linear-gradient(180deg, transparent ${y - 1.2}%, ${streak}66 ${y - 0.4}%, #ffffffcc ${y}%, ${streak}66 ${y + 0.4}%, transparent ${y + 1.2}%)`;
	const glow = `radial-gradient(circle at ${x}% ${y}%, #ffffff 0, ${streak}aa 1.5%, ${o.haze} 12%, transparent 45%)`;
	return [glow, band, o.background].join(', ');
}

/**
 * Starts the flare on an element: a canvas inside it (its first).
 *
 * @param {HTMLElement} el The element.
 * @param {LensFlareConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function lensFlare(el, config) {
	const o = settings(config);
	const rgb = (/** @type {string} */ c) => parseColor(c);
	const start = performance.now();
	const ghostTints = [rgb(o.ghost), rgb(o.streak), [0.35, 0.95, 0.6]];
	const ghosts = new Float32Array(GHOSTS.flat());

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		still: o.speed <= 0,
		setup({ gl, uniform }) {
			gl.uniform3fv(uniform('uBg'), rgb(o.background));
			gl.uniform3fv(uniform('uStreakC'), rgb(o.streak));
			gl.uniform3fv(uniform('uHazeC'), rgb(o.haze));
			gl.uniform3fv(uniform('uTint[0]'), new Float32Array(ghostTints.flat()));
			gl.uniform1f(uniform('uLen'), o.length);
			gl.uniform1f(uniform('uWidth'), o.width);
			gl.uniform1f(uniform('uPower'), o.power);
			gl.uniform1f(uniform('uGhosts'), Math.min(MAX_GHOSTS, Math.max(0, o.ghosts)));
			gl.uniform1f(uniform('uDrift'), o.drift);
			gl.uniform1f(uniform('uRate'), o.rate);
			gl.uniform1f(uniform('uFlicker'), o.flicker);
			gl.uniform1f(uniform('uGrain'), o.grain);
			gl.uniform1f(uniform('uSeed'), o.seed);
			gl.uniform4fv(uniform('uGhost[0]'), ghosts);
		},
		resize({ gl, uniform }) {
			const w = Math.max(1, el.clientWidth);
			const h = Math.max(1, el.clientHeight);
			gl.uniform2f(uniform('uSrc'), o.source[0] * (w / h), o.source[1]);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, w / h));
		},
		uniforms({ gl, uniform }, now) {
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000) * Math.max(0, o.speed));
		},
	});
	return stop;
}
