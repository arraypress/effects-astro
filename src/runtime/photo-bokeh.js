/**
 * @module @arraypress/effects-astro/photo-bokeh
 *
 * A photo seen through a lens racking its focus: the plane of focus sweeps
 * slowly from near to far and back, so one part of the picture sharpens while
 * the rest melts into soft blur, and out-of-focus lights (soft filled glows,
 * round or six-bladed, tinted from the photo's highlights and brighter where
 * they cross them) drift slowly upward through it. Made for flowers and close
 * portraits behind a mark: no pointer, the copy sharp in front.
 *
 * There is no depth map, so the depth is a guess from the picture itself:
 * its blurred brightness and colour (the bright, saturated subject nearer)
 * and where it sits (lower nearer), so the blur follows the picture's forms
 * rather than lying flat over it. The blur is a golden-angle disc of taps
 * read from the photo's mipmaps, so a wide blur stays smooth and cheap.
 *
 * The focus and the lights are here in plain JavaScript too (`focusAt`,
 * `blurAt`, `discAt`). Transparent until the photo has loaded (the element's
 * own still shows), then opaque; with prefers-reduced-motion (or `speed: 0`)
 * one still frame. Without WebGL nothing is drawn.
 */

import { createStage } from './stage.js';
import { GLSL_HASH33 } from './hash-noise.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { loadImage, imageTexture, coverScale, GLSL_COVER } from './image.js';

/**
 * @typedef {'round' | 'blades'} BokehShape
 *
 * @typedef {object} PhotoBokehConfig
 * @property {string} src The photo (same origin, or served for CORS).
 * @property {number} [blur=0.03] The widest blur, a share of the height.
 * @property {number} [rate=0.06] How fast the focus racks, cycles a second.
 * @property {number} [near=0.55] How much the depth guess leans on the picture (its brightness and colour) against its height in the frame, 0–1.
 * @property {number} [discs=6] Out-of-focus lights drifting through it, up to 12; 0 for none.
 * @property {number} [size=0.11] Their radius, a share of the height.
 * @property {number} [glow=0.35] How bright they are.
 * @property {BokehShape} [shape='round'] Round lights, or six-bladed ones.
 * @property {number} [drift=0.02] How fast they rise, heights a second.
 * @property {number} [vignette=0.35] Darkening toward the edges; 0 for none.
 * @property {number} [grain=0.04] Fine grain over all of it; 0 for none.
 * @property {number} [seed=0] Where the focus and the lights start, so two cards differ.
 * @property {number} [speed=1] Plays every clock faster or slower; 0 for one still frame.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area dimmed a little for copy: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 */

/** The settings' defaults, shared by the shader and the JS twin. */
export const BOKEH_DEFAULTS = {
	blur: 0.03,
	rate: 0.06,
	near: 0.55,
	discs: 6,
	size: 0.11,
	glow: 0.35,
	shape: /** @type {BokehShape} */ ('round'),
	drift: 0.02,
	vignette: 0.35,
	grain: 0.04,
	seed: 0,
};

/** The most lights the shader draws. */
export const MAX_DISCS = 12;

/**
 * The settings, filled with the defaults.
 *
 * @param {Partial<PhotoBokehConfig>} config The settings.
 * @returns {typeof BOKEH_DEFAULTS & { speed: number }} The settings.
 */
const settings = (config) => ({ ...BOKEH_DEFAULTS, speed: 1, ...config });

/**
 * Where the plane of focus is: a depth from 0 (far) to 1 (near), sweeping back and forth.
 *
 * @param {Partial<PhotoBokehConfig>} config The settings.
 * @param {number} t Seconds (already at its speed).
 * @returns {number} The depth in focus.
 */
export function focusAt(config, t) {
	const o = settings(config);
	return 0.5 + 0.45 * Math.sin(2 * Math.PI * t * o.rate + o.seed * 1.7);
}

/**
 * How soft a point is: nothing at the plane of focus, the widest blur well away from it.
 *
 * @param {Partial<PhotoBokehConfig>} config The settings.
 * @param {number} depth The point's depth, 0 (far) to 1 (near).
 * @param {number} t Seconds.
 * @returns {number} The blur's radius, a share of the height.
 */
export function blurAt(config, depth, t) {
	const o = settings(config);
	const d = Math.abs(depth - focusAt(config, t));
	const k = Math.min(1, Math.max(0, (d - 0.04) / 0.36));
	return o.blur * k * k * (3 - 2 * k);
}

/**
 * Where an out-of-focus light is: rising slowly, swaying, wrapping round from the bottom.
 *
 * @param {Partial<PhotoBokehConfig>} config The settings.
 * @param {number} i Which light.
 * @param {number} t Seconds.
 * @returns {{ x: number, y: number, r: number }} Its centre (0–1 from the top left of the frame) and radius (heights).
 */
export function discAt(config, i, t) {
	const o = settings(config);
	const h = (n) => {
		const s = Math.sin((i + 1) * 12.9898 + n * 78.233 + o.seed * 3.1) * 43758.5453;
		return s - Math.floor(s);
	};
	const rise = o.drift * (0.6 + h(2) * 0.8);
	const y = 1.15 - ((h(1) * 1.3 + t * rise) % 1.3);
	const x = h(0) + 0.03 * Math.sin(t * 0.4 + i * 1.9);
	return { x, y, r: o.size * (0.6 + h(3) * 0.8) };
}

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uPhoto;
uniform vec2 uScale;
uniform float uTexH;
uniform float uReady;
uniform float uBlur;
uniform float uRate;
uniform float uNear;
uniform float uDiscs;
uniform float uSize;
uniform float uGlow;
uniform float uBlades;
uniform float uDrift;
uniform float uVignette;
uniform float uGrain;
uniform float uSeed;
uniform vec3 uTint[4];
${GLSL_COVER}
${GLSL_QUIET}
${GLSL_HASH33}

// the photo at a box point (0-1, y down), read at a softness (its mipmap bias)
vec3 photo(vec2 uv, float bias) {
	vec2 t = coverUv(uv, uScale);
	return texture2D(uPhoto, vec2(t.x, t.y), bias).rgb;
}

// a guess at how near a point is: its blurred brightness and colour (the lit, saturated subject nearer), and its height
float depthAt(vec2 uv) {
	vec3 c = photo(uv, 5.0);
	float l = dot(c, vec3(0.299, 0.587, 0.114));
	float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
	float picture = clamp(l * 0.85 + sat * 0.6, 0.0, 1.0);
	return clamp(mix(uv.y, picture, uNear), 0.0, 1.0);
}

float hash1(float n) { return fract(sin(n * 12.9898 + uSeed * 3.1) * 43758.5453); }

// one out-of-focus light: a soft, filled glow (brightest in its middle, no ring at its edge), round or six-bladed
float disc(vec2 p, vec2 c, float r) {
	vec2 d = p - c;
	float dist = length(d);
	if (uBlades > 0.5) {
		float a = atan(d.y, d.x);
		float k = 3.14159265 / 6.0;
		dist *= cos(k) / cos(mod(a, 2.0 * k) - k);
	}
	float x = dist / r;
	return exp(-x * x * 1.6) * (1.0 - smoothstep(0.9, 1.3, x));
}

void main() {
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	vec2 uv = px / uRes;
	float aspect = uRes.x / uRes.y;
	if (uReady < 0.5) { gl_FragColor = vec4(0.0); return; }

	float focus = 0.5 + 0.45 * sin(6.2831853 * uTime * uRate + uSeed * 1.7);
	float depth = depthAt(uv);
	float k = smoothstep(0.04, 0.4, abs(depth - focus));
	float radius = uBlur * k; // heights
	// a golden-angle disc of taps, read from the mipmap whose texels match their spacing
	vec3 sum = vec3(0.0);
	float bias = clamp(log2(max(radius * uTexH / 3.0, 1.0)), 0.0, 6.0);
	const int TAPS = 20;
	for (int i = 0; i < TAPS; i++) {
		float f = (float(i) + 0.5) / float(TAPS);
		float a = float(i) * 2.39996323;
		vec2 off = vec2(cos(a), sin(a)) * sqrt(f) * radius;
		off.x /= aspect;
		sum += photo(uv + off, bias);
	}
	vec3 col = sum / float(TAPS);

	// the lights drift through, tinted from the photo's highlights, added like light
	vec2 p = vec2(uv.x * aspect, uv.y);
	vec3 lights = vec3(0.0);
	for (int i = 0; i < ${MAX_DISCS}; i++) {
		if (float(i) >= uDiscs) break;
		float fi = float(i) + 1.0;
		float rise = uDrift * (0.6 + hash1(fi * 7.0 + 2.0) * 0.8);
		float y = 1.15 - mod(hash1(fi * 7.0 + 1.0) * 1.3 + uTime * rise, 1.3);
		float x = hash1(fi * 7.0) + 0.03 * sin(uTime * 0.4 + float(i) * 1.9);
		float r = uSize * (0.6 + hash1(fi * 7.0 + 3.0) * 0.8);
		vec3 tint = uTint[0];
		if (mod(float(i), 4.0) > 0.5) tint = uTint[1];
		if (mod(float(i), 4.0) > 1.5) tint = uTint[2];
		if (mod(float(i), 4.0) > 2.5) tint = uTint[3];
		lights += tint * disc(p, vec2(x * aspect, y), r) * (0.5 + 0.5 * hash1(fi * 7.0 + 5.0));
	}
	// brighter where they pass over the photo's own highlights, as light out of focus would be
	float lum = dot(col, vec3(0.299, 0.587, 0.114));
	col = 1.0 - (1.0 - col) * (1.0 - clamp(lights * uGlow * (0.75 + lum * 1.6), 0.0, 1.0));

	// a little quieter where the copy sits, darker toward the edges, and grain
	vec2 q = vec2((uv.x - 0.5) * aspect, 0.5 - uv.y);
	col *= mix(1.0 - uQuiet.w * 0.45, 1.0, quietOpen(q));
	float v = length((uv - 0.5) * vec2(aspect, 1.0));
	col *= 1.0 - uVignette * smoothstep(0.35, 0.95, v);
	col += (hash33(vec3(px, floor(uTime * 24.0))).x - 0.5) * uGrain;
	gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * A CSS `background` that stands in before the shader starts and without WebGL: the photo itself, covering.
 *
 * @param {Pick<PhotoBokehConfig, 'src'>} config The settings.
 * @returns {string} The CSS background.
 */
export function photoBokehStill(config) {
	return `center / cover no-repeat url(${JSON.stringify(config.src)})`;
}

/**
 * The photo's brightest, most coloured pixels, for the lights' tints: four, from a small copy of it.
 *
 * @param {ArrayLike<number>} rgba The small copy's pixels, RGBA 0–255.
 * @returns {[number, number, number][]} Four colours, 0–1 (lightened, so a light reads as light).
 */
export function highlightTints(rgba) {
	const px = [];
	for (let i = 0; i < rgba.length; i += 4) {
		const r = rgba[i] / 255,
			g = rgba[i + 1] / 255,
			b = rgba[i + 2] / 255;
		const l = 0.299 * r + 0.587 * g + 0.114 * b;
		const sat = Math.max(r, g, b) - Math.min(r, g, b);
		px.push({ c: [r, g, b], score: l + sat * 0.6 });
	}
	px.sort((a, b) => b.score - a.score);
	const picks = [];
	for (const p of px) {
		if (picks.length === 4) break;
		if (picks.every((q) => Math.hypot(q[0] - p.c[0], q[1] - p.c[1], q[2] - p.c[2]) > 0.18)) picks.push(p.c);
	}
	while (picks.length < 4) picks.push(picks[0] ?? [1, 0.9, 0.8]);
	return picks.map((c) => /** @type {[number, number, number]} */ (c.map((v) => Math.min(1, v * 0.6 + 0.4))));
}

/**
 * Starts the rack focus on an element: a canvas inside it (its first), the photo loaded from `src`.
 *
 * @param {HTMLElement} el The element.
 * @param {PhotoBokehConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function photoBokeh(el, config) {
	const o = settings(config);
	const start = performance.now();
	let ready = false;
	let imageAspect = 1;
	let aspect = 0.8;
	let texH = 512;
	let tints = new Float32Array([1, 0.9, 0.85, 1, 0.8, 0.8, 0.9, 0.9, 1, 1, 1, 1]);
	/** @type {WebGLTexture | null} */
	let texture = null;

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: true,
		still: o.speed <= 0,
		setup({ gl, uniform }) {
			gl.uniform1i(uniform('uPhoto'), 0);
			gl.uniform1f(uniform('uBlur'), o.blur);
			gl.uniform1f(uniform('uRate'), o.rate);
			gl.uniform1f(uniform('uNear'), o.near);
			gl.uniform1f(uniform('uDiscs'), Math.min(MAX_DISCS, Math.max(0, o.discs)));
			gl.uniform1f(uniform('uSize'), o.size);
			gl.uniform1f(uniform('uGlow'), o.glow);
			gl.uniform1f(uniform('uBlades'), o.shape === 'blades' ? 1 : 0);
			gl.uniform1f(uniform('uDrift'), o.drift);
			gl.uniform1f(uniform('uVignette'), o.vignette);
			gl.uniform1f(uniform('uGrain'), o.grain);
			gl.uniform1f(uniform('uSeed'), o.seed);
			return () => gl.deleteTexture(texture);
		},
		resize({ gl, uniform, canvas }) {
			aspect = canvas.width / canvas.height;
			gl.uniform2fv(uniform('uScale'), coverScale(imageAspect, aspect));
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, aspect));
		},
		uniforms({ gl, uniform }, now) {
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000) * Math.max(0, o.speed));
			gl.uniform1f(uniform('uReady'), ready ? 1 : 0);
			gl.uniform1f(uniform('uTexH'), texH);
			gl.uniform3fv(uniform('uTint[0]'), tints);
			if (texture) {
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, texture);
			}
		},
	});
	if (!stage) return stop;

	let alive = true;
	loadImage(o.src)
		.then((image) => {
			if (!alive) return;
			const { gl, uniform, program } = stage;
			gl.activeTexture(gl.TEXTURE0);
			texture = imageTexture(gl, image, { mipmap: true });
			imageAspect = image.naturalWidth / image.naturalHeight;
			texH = image.naturalHeight;
			// the lights take the photo's highlights
			const small = document.createElement('canvas');
			small.width = 24;
			small.height = 24;
			const s = small.getContext('2d', { willReadFrequently: true });
			if (s) {
				s.drawImage(image, 0, 0, 24, 24);
				tints = new Float32Array(highlightTints(s.getImageData(0, 0, 24, 24).data).flat());
			}
			gl.useProgram(program);
			gl.uniform2fv(uniform('uScale'), coverScale(imageAspect, aspect));
			ready = true;
			stage.redraw();
		})
		.catch((error) => {
			// the still stays
			console.warn('[effects-astro]', error);
		});
	return () => {
		alive = false;
		stop();
	};
}
