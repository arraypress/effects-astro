/**
 * @module @arraypress/effects-astro/caustics
 *
 * Sunlight through rippling water onto a pool floor: a bright, shifting
 * net of light over an aqua ground. Two layers of drifting cells, bent by
 * a slow swell of noise, each give their thin bright seams; where the two
 * nets cross the light pools hotter, and the hottest spots run to white.
 * Red, green and blue are traced from points a hair apart, so each line
 * carries a faint rainbow at its edges. The floor dims and deepens towards
 * the sides, as if the pool fell away there, and faint tiles can lie under
 * it, bent by the same water.
 *
 * The pointer disturbs the surface where it is: rings run out from it,
 * warping the net and brightening it, more while it moves.
 *
 * One fragment pass, nine cells a layer, no textures. Opaque: the effect
 * is the whole background of what it fills. With prefers-reduced-motion,
 * one still frame. Without WebGL it removes its canvas and the element's
 * background (the floor fading into `background`) shows.
 */

import { createStage } from './stage.js';
import { GLSL_OKLAB, fromOklab, parseColor, toHex, toOklab } from './color.js';
import { GLSL_NOISE, GLSL_QUIET, quietUniform } from './glsl.js';
import { canHover, isMobileGpu } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {object} CausticsConfig
 * @property {string[]} [colors] The water and the light, in any order: the darkest is the deep water towards the edges, the lightest the light, the one between the floor (default aqua `#2cc3d0`, deep teal `#0b7ea8`, sun `#f2fff9`). One or two colours work too.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {string} [background] The ground the edges fall away into, and what shows without WebGL. Default: the deep water, darkened.
 * @property {number} [scale=1] How large the net of light is, 0.4–3: 2 doubles it.
 * @property {number} [speed=1] How fast the water moves, 0–3; 0 holds it still.
 * @property {number} [intensity=1] How bright the light is, 0–2.
 * @property {boolean} [tiles=false] Faint pool tiles on the floor, bent by the water.
 * @property {boolean} [interactive=true] Whether the pointer disturbs the water where it is.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area where the light is kept low behind copy: centre (0–1 from the top
 *   left), radius (a share of the height) and depth (0–1). The middle with `{}`.
 */

/**
 * @typedef {object} CausticTones
 * @property {string} floor The floor, seen through shallow water.
 * @property {string} deep The deep water towards the edges.
 * @property {string} light The light.
 * @property {string} background What the edges fall away into.
 */

/** The default water and light: aqua, deep teal, sun. */
const COLORS = ['#2cc3d0', '#0b7ea8', '#f2fff9'];
/** Cells of the first layer across the height, at `scale` 1. */
const DENSITY = 3.4;
/** Tiles across the height, at `scale` 1. */
const TILES = 7;
/** Where the water's clock starts, seconds: the still frame shows this moment. */
const START = 24;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uDensity;
uniform float uTiles;
uniform float uIntensity;
uniform vec4 uPtr;
uniform vec3 uFloor;
uniform vec3 uDeep;
uniform vec3 uBack;
uniform vec3 uLight;
${GLSL_NOISE}
${GLSL_QUIET}
${GLSL_OKLAB}

// One net of light: the gap between the nearest and second-nearest of a
// field of drifting points (0 on a seam), measured from three points
// \`split\` apart, for red, green and blue.
vec3 seams(vec2 p, vec2 split, float t) {
	vec2 i = floor(p), f = fract(p);
	vec3 f1 = vec3(8.0), f2 = vec3(8.0);
	for (int y = -1; y <= 1; y++) {
		for (int x = -1; x <= 1; x++) {
			vec2 o = vec2(float(x), float(y));
			vec2 h = vec2(hash(i + o), hash(i + o + 19.19));
			vec2 c = o + 0.5 + 0.42 * sin(t * (0.6 + 0.5 * h.yx) + 6.2831 * h) - f;
			vec2 r = c + split, b = c - split;
			vec3 d = vec3(dot(r, r), dot(c, c), dot(b, b));
			f2 = min(f2, max(f1, d));
			f1 = min(f1, d);
		}
	}
	return sqrt(f2) - sqrt(f1);
}

void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	float aspect = uRes.x / uRes.y;
	// Centred, in units of the height.
	vec2 q = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
	float t = uTime;

	// The pointer: rings running out from it, strongest close by.
	vec2 dp = q - uPtr.xy;
	float r = length(dp);
	float near = exp(-r * r * 16.0) * uPtr.z;
	vec2 bend = dp / max(r, 0.05) * sin(r * 36.0 - t * 5.0) * near * (0.4 + uPtr.w) * 0.022;

	// The swell: a slow warp of noise that bends the light and the floor alike.
	vec2 p = q * uDensity;
	vec2 swell = vec2(noise(p * 0.5 + vec2(t * 0.11, -t * 0.07)), noise(p * 0.5 + vec2(4.7 - t * 0.09, 1.3 + t * 0.1))) - 0.5;
	// A finer ripple on it curves each seam.
	vec2 ripple = vec2(noise(p * 1.7 + vec2(-t * 0.23, t * 0.17)), noise(p * 1.7 + vec2(9.2 + t * 0.19, 5.1 - t * 0.21))) - 0.5;
	vec2 w = p + swell * 1.2 + ripple * 0.42 + bend * uDensity;

	// Two nets, the second finer, turned and drifting the other way.
	vec2 split = vec2(0.016, 0.008) * (1.0 + near * 0.5);
	vec3 e1 = seams(w, split, t);
	vec2 w2 = mat2(0.8, -0.6, 0.6, 0.8) * w * 1.45 + vec2(t * 0.04, 3.1);
	vec3 e2 = seams(w2, split * 1.45, 1.7 - t * 0.8);
	// Lines thicken and thin across the floor.
	float width = 0.6 + 0.7 * noise(p * 0.35 - t * 0.03);
	vec3 l1 = exp(-e1 * 24.0 / width), l2 = exp(-e2 * 30.0 / width);
	vec3 light = (l1 + l2) * 0.5 + l1 * l2 * 1.8;

	// The floor deepens and darkens towards the edges.
	vec2 edge = (uv - 0.5) * vec2(1.0, 1.15) * 2.0;
	float depth = smoothstep(0.25, 1.5, length(edge));
	float shade = clamp(0.05 + 0.55 * noise(q * 1.1 + t * 0.015) + depth * 0.9, 0.0, 1.0);
	vec3 lab = mix(uFloor, uDeep, shade);
	// The light takes from the floor around the lines, as a lens would.
	lab.x *= 0.9 + 0.16 * light.g;
	if (uTiles > 0.0) {
		vec2 g = fract((q + swell * 0.05 + bend * 0.6) * uTiles + 0.5);
		vec2 m = min(g, 1.0 - g);
		float px = uTiles / uRes.y;
		float grout = 1.0 - smoothstep(0.018, 0.018 + px * 1.5, min(m.x, m.y));
		lab.x -= grout * 0.07;
	}
	lab = mix(lab, uBack, depth * depth * 0.85);
	vec3 col = fromOklab(lab);

	float glow = uIntensity * (1.0 - depth * 0.7) * mix(1.0 - uQuiet.w, 1.0, quietOpen(q)) * (1.0 + near * (0.9 + uPtr.w));
	vec3 lit = light * glow;
	col += uLight * lit * 0.8;
	// The hottest light runs to white.
	col += max(lit - 0.9, 0.0) * mix(uLight, vec3(1.0), 0.6) * 0.5;
	col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) * 0.01;
	gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Oklab lightness of a hex colour.
 *
 * @param {string} hex The colour.
 * @returns {number} Its lightness, 0–1.
 */
const lightness = (hex) => toOklab(parseColor(hex))[0];

/**
 * A colour's Oklab lightness moved by `by`, its hue and chroma scaled with it.
 *
 * @param {string} hex The colour.
 * @param {number} by The share to scale lightness and chroma by (0.6 darkens).
 * @returns {string} The new colour, as hex.
 */
const shadeOf = (hex, by) => {
	const [L, a, b] = toOklab(parseColor(hex));
	return toHex(fromOklab([L * by, a * by, b * by]));
};

/**
 * The tones the water is drawn in, from the colours given in any order:
 * the darkest the deep water, the lightest the light, the median the floor.
 * One colour is the floor, deepened for the deep water, under a white sun;
 * two are the floor (the darker, deepened for the deep) and the light.
 *
 * @param {CausticsConfig} config The settings (`colors`, `palette`, `background`).
 * @returns {CausticTones} The tones, as hex.
 * @throws {TypeError} When a colour is not hex.
 */
export function causticTones(config) {
	const colors = pickColors(config, COLORS);
	const sorted = [...colors].sort((a, b) => lightness(a) - lightness(b));
	const one = sorted.length === 1;
	const floor = one || sorted.length === 2 ? sorted[0] : sorted[Math.floor(sorted.length / 2)];
	const deep = one || sorted.length === 2 ? shadeOf(floor, 0.75) : sorted[0];
	const light = one ? '#ffffff' : sorted[sorted.length - 1];
	return { floor, deep, light, background: config.background ?? shadeOf(deep, 0.62) };
}

/**
 * Starts the caustics on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {CausticsConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function caustics(el, config) {
	let tones = causticTones(config);
	const speed = config.speed ?? 1;
	const interactive = config.interactive !== false;
	let time = START;
	/** The pointer's disturbance: where it is heading, where it is (centred, height units), how present (0–1) and how stirred (0–1). */
	const ptr = { tx: 0, ty: 0, x: 0, y: 0, on: 0, stir: 0 };

	/**
	 * Follows the pointer: the disturbance eases towards it, swells while it
	 * moves, and fades when it leaves.
	 *
	 * @param {number} aspect The canvas's width over height.
	 * @param {number} dt Seconds since the last frame.
	 */
	const follow = (aspect, dt) => {
		const p = pointerIn(el);
		let moved = 0;
		if (p.inside) {
			const x = (p.x - 0.5) * aspect;
			const y = p.y - 0.5;
			if (ptr.on < 0.01) Object.assign(ptr, { x, y, tx: x, ty: y });
			moved = Math.hypot(x - ptr.tx, y - ptr.ty);
			ptr.tx = x;
			ptr.ty = y;
		}
		const k = 1 - Math.exp(-dt * 6);
		ptr.x += (ptr.tx - ptr.x) * k;
		ptr.y += (ptr.ty - ptr.y) * k;
		ptr.on += ((p.inside ? 1 : 0) - ptr.on) * (1 - Math.exp(-dt * 2.5));
		const goal = dt > 0 ? Math.min(1, moved / dt / 1.5) : 0;
		ptr.stir += (goal - ptr.stir) * (1 - Math.exp(-dt * (goal > ptr.stir ? 8 : 1.5)));
	};

	/**
	 * Sets the colour uniforms from the current tones.
	 *
	 * @param {import('./stage.js').Stage} stage The stage.
	 */
	const paint = ({ gl, uniform }) => {
		gl.uniform3fv(uniform('uFloor'), toOklab(parseColor(tones.floor)));
		gl.uniform3fv(uniform('uDeep'), toOklab(parseColor(tones.deep)));
		gl.uniform3fv(uniform('uBack'), toOklab(parseColor(tones.background)));
		gl.uniform3fv(uniform('uLight'), parseColor(tones.light));
	};

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		scale: isMobileGpu() ? 0.7 : 1,
		still: speed === 0 && !interactive,
		setup(stage) {
			const { gl, uniform } = stage;
			const scale = Math.max(0.1, config.scale ?? 1);
			gl.uniform1f(uniform('uDensity'), DENSITY / scale);
			gl.uniform1f(uniform('uTiles'), config.tiles ? TILES / scale : 0);
			gl.uniform1f(uniform('uIntensity'), config.intensity ?? 1);
			paint(stage);
		},
		resize({ gl, uniform, canvas }) {
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, canvas.width / canvas.height));
		},
		uniforms(stage, _now, dt) {
			const { gl, uniform, canvas, still } = stage;
			if (!still) {
				time += dt * speed;
				if (interactive && canHover()) follow(canvas.width / canvas.height, dt);
			}
			gl.uniform1f(uniform('uTime'), time);
			gl.uniform4f(uniform('uPtr'), ptr.x, ptr.y, ptr.on, ptr.stir);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		tones = causticTones({ colors: next.colors, background: config.background });
		stage.gl.useProgram(stage.program);
		paint(stage);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
