/**
 * @module @arraypress/effects-astro/nebula-logo
 *
 * A logo or a word filled with drifting nebula gas: domain-warped clouds
 * in the palette's colours, moving slowly inside the shape, brighter and
 * denser towards its edges and cut with dark dust lanes deeper in. A
 * glowing rim lines the edge, a soft halo of gas leaks a little past it,
 * and faint stars twinkle inside. The pointer brightens the gas near it,
 * and where it moves it stirs the gas round, a wake that settles again.
 *
 * The shape is a distance field (src/runtime/shape.js); the wake is a
 * small fading feedback buffer (src/runtime/feedback.js) the pointer's
 * path is drawn into. The gas is only worked out near the shape, so the
 * cost follows the logo's size, not the canvas's.
 *
 * Opaque: the effect is the whole background of what it fills. Without
 * WebGL it removes its canvas and the element's background shows.
 */

import { createStage } from './stage.js';
import { createPoints } from './points.js';
import { createFeedback } from './feedback.js';
import { drawShape, distanceField, blurField } from './shape.js';
import { GLSL_NOISE, GLSL_PALETTE, paletteUniform } from './glsl.js';
import { parseColor } from './color.js';
import { canHover } from './device.js';
import { pointerIn, trail } from './pointer.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {object} NebulaLogoConfig
 * @property {string} [text] A word to fill with gas.
 * @property {string} [font] Its CSS font, without the size (default: the page's, bold).
 * @property {string} [src] An image (an SVG logo) to fill instead.
 * @property {{ x: number, y: number, width: number, height: number }} [area]
 *   Where the shape sits, each 0–1 from the top left (default: the right half).
 * @property {string[]} [colors] The gas's palette, three colours; the first, darkened, is also the thin gas's (default teal, amber, rose).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {string} [background='#05070a'] The ground.
 * @property {number} [speed=1] How fast the gas drifts.
 * @property {number} [glow=1] The rim and the halo leaking past the edge; 0 for neither.
 * @property {number} [stars=1] How many stars twinkle inside; 0 for none.
 * @property {number} [stir=1] How much the pointer stirs and brightens the gas; 0 for not at all.
 * @property {number} [scale=0.6] Share of the pixel ratio the gas is drawn at: it is soft, so a little below full costs nothing visible and saves most of the work.
 */

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uRatio;
uniform sampler2D uSdf;
uniform float uSpread;
uniform sampler2D uStir;
uniform vec2 uStirTexel;
uniform vec3 uGround;
uniform vec3 uPtr;
uniform float uGlow;
uniform float uStars;
uniform float uStirAmount;
${GLSL_NOISE}
${GLSL_PALETTE}

// The distance field: 0.5 at the shape's edge, more inside.
float field(vec2 uv) { return texture2D(uSdf, vec2(uv.x, 1.0 - uv.y)).r; }

// The stirred wake at a point.
float wake(vec2 uv) { return texture2D(uStir, uv).r; }

void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	float aspect = uRes.x / uRes.y;
	// How far inside the edge, in heights; negative outside.
	float d = (field(uv) - 0.5) * 2.0 * uSpread;
	float out_ = max(-d, 0.0);
	// Far outside: only the ground, and a faint glow that fades into it.
	vec3 col = uGround;
	if (d < -uSpread * 0.97) { gl_FragColor = vec4(col, 1.0); return; }

	float px = 1.0 / uRes.y;
	vec2 p = vec2(uv.x * aspect, uv.y);
	vec2 toPtr = (uv - uPtr.xy) * vec2(aspect, 1.0);
	float near = exp(-dot(toPtr, toPtr) / 0.018) * uPtr.z;
	// The wake: the gas is pushed round the pointer's path, and lit by it.
	float s = min(wake(uv), 1.0);
	vec2 e = uStirTexel * 3.0;
	vec2 g = vec2(wake(uv + vec2(e.x, 0.0)) - wake(uv - vec2(e.x, 0.0)), wake(uv + vec2(0.0, e.y)) - wake(uv - vec2(0.0, e.y)));
	vec2 q0 = p * 2.6 + vec2(-g.y, g.x) * 1.8 * uStirAmount;

	// The gas: fbm warped by fbm warped by fbm, each layer drifting its own way.
	float t = uTime * 0.03;
	vec2 q = vec2(fbm(q0 + vec2(0.0, t)), fbm(q0 + vec2(5.2, 1.3) - t * 0.8));
	vec2 r = vec2(fbm(q0 + 3.4 * q + vec2(1.7, 9.2) + t * 1.4), fbm(q0 + 3.4 * q + vec2(8.3, 2.8) - t * 1.1));
	float f = fbm(q0 + 3.0 * r);
	float dens = smoothstep(0.22, 0.8, f);
	// Thin gas is the first colour, deep and dark; thick gas glows in the palette.
	vec3 bright = pal(f * 1.2 + q.x * 0.7 - r.y * 0.5 + t * 0.4);
	vec3 hue = mix(pal(0.0) * 0.32, bright, smoothstep(0.05, 0.6, dens));
	// What the pointer adds: its own light near it, and more where it has stirred.
	float lift = (s * 1.2 + near * 0.5) * uStirAmount;

	// Inside: densest at the edge, with dark lanes of dust deeper in.
	float inside = smoothstep(-px, px, d);
	float edge = exp(-max(d, 0.0) / 0.06);
	float dust = smoothstep(0.45, 0.72, fbm(q0 * 1.7 + r * 2.0 + 7.0)) * (1.0 - edge * 0.6);
	vec3 gas = hue * (dens * mix(0.4, 1.6, edge) + 0.1 + edge * 0.15);
	gas += vec3(1.0, 0.96, 0.9) * pow(dens, 5.0) * 0.45 * (0.4 + edge);
	gas *= 1.0 - dust * 0.7;
	gas += bright * lift * (0.25 + dens * 0.6);

	// Past the edge: wisps of gas leaking out, and a wide faint glow.
	float leak = exp(-out_ / 0.024) * smoothstep(0.45, 0.8, f) * 1.2 + exp(-out_ / 0.08) * 0.05 * smoothstep(-uSpread, -uSpread * 0.5, d);
	vec3 halo = hue * leak * uGlow * (1.0 + lift);

	// The rim: a thin line of light round the edge, lit where the gas is thick and
	// fading where it thins, in the gas's colour.
	float rim = (exp(-abs(d) / (px * 1.2 * uRatio)) * 0.7 + exp(-abs(d) / 0.006) * 0.3) * uGlow;
	vec3 lit = mix(pal(f * 1.2 + 0.2 + t * 0.4), vec3(1.0), 0.35) * rim * (0.1 + dens * dens * 1.4);

	// Stars: one at most in each small cell, a few cells in a hundred, twinkling.
	vec2 sp = gl_FragCoord.xy / (uRatio * 8.0);
	vec2 cell = floor(sp);
	float h = hash(cell);
	vec2 at = vec2(hash(cell + 3.1), hash(cell + 7.7)) * 0.7 + 0.15;
	float dist = length(fract(sp) - at) * 8.0;
	float twinkle = 0.45 + 0.55 * sin(uTime * (0.8 + h * 2.5) + h * 60.0);
	float star = step(1.0 - 0.06 * uStars, h) * exp(-dist * dist * 1.4) * twinkle * (inside * (1.0 - dust * 0.6) + exp(-out_ / 0.03) * 0.4);

	vec3 light = mix(halo, gas, inside) + lit + vec3(0.9, 0.95, 1.0) * star;
	col += 1.0 - exp(-light * 1.25);
	gl_FragColor = vec4(col, 1.0);
}
`;

/** The pointer's path, drawn into the wake: each point a soft dot. */
const STROKE = `
precision highp float;
attribute vec4 p;
uniform float uSize;
varying vec3 vColour;
varying float vAlpha;
void main() {
	gl_Position = vec4(p.xy * 2.0 - 1.0, 0.0, 1.0);
	gl_PointSize = uSize;
	vColour = vec3(1.0);
	vAlpha = p.z;
}
`;

/** A splat of the wake: a gaussian, so the push it gives the gas has no edge. */
const SPLAT = `
precision highp float;
varying vec3 vColour;
varying float vAlpha;
void main() {
	vec2 d = gl_PointCoord - 0.5;
	float r = dot(d, d) * 4.0;
	float a = exp(-r * 5.0) * max(1.0 - r, 0.0) * vAlpha;
	gl_FragColor = vec4(vColour * a, a);
}
`;

/** The defaults: teal, amber and rose. */
const COLORS = ['#13cbbd', '#ffb238', '#ff4f7e'];
/** Where the shape sits by default: the right half, so copy can sit on the left. */
const AREA = { x: 0.46, y: 0.08, width: 0.5, height: 0.84 };
/** The wake's size, a share of the canvas's: it is soft, so a quarter is plenty. */
const WAKE_SCALE = 0.25;

/**
 * Starts a nebula logo on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {NebulaLogoConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function nebulaLogo(el, config) {
	let palette = paletteUniform(pickColors(config, COLORS));
	const start = performance.now();
	const stir = config.stir ?? 1;
	const ptr = { x: 0.5, y: 0.5 };
	let active = 0;
	/** Bumped on each resize, so a slow shape drawn for an old size is dropped. */
	let generation = 0;
	/** @type {import('./points.js').Points | null} */
	let strokes = null;
	/** @type {import('./feedback.js').Feedback | null} */
	let wake = null;
	const path = trail(el, { step: 0.012 });

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		scale: config.scale ?? 0.6,
		setup({ gl, uniform }) {
			strokes = createPoints(gl, STROKE, SPLAT);
			wake = createFeedback(gl, { scale: WAKE_SCALE, precise: true });
			if (!strokes || !wake) return false;
			gl.uniform1i(uniform('uSdf'), 1);
			gl.uniform1i(uniform('uStir'), 2);
			gl.uniform1f(uniform('uGlow'), config.glow ?? 1);
			gl.uniform1f(uniform('uStars'), config.stars ?? 1);
			gl.uniform1f(uniform('uStirAmount'), stir);
			gl.uniform3fv(uniform('uGround'), parseColor(config.background ?? '#05070a'));
			const texture = gl.createTexture();
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			// Empty until the shape is drawn: all outside.
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([0]));
			gl.uniform1f(uniform('uSpread'), 0.1);
			return () => {
				wake?.dispose();
				gl.deleteTexture(texture);
			};
		},
		resize({ gl, uniform, canvas, program }) {
			wake?.resize(canvas.width, canvas.height);
			const size = wake?.size() ?? { width: 1, height: 1 };
			gl.uniform2f(uniform('uStirTexel'), 1 / size.width, 1 / size.height);
			const width = Math.min(1024, canvas.width);
			const height = Math.max(1, Math.round((width * canvas.height) / canvas.width));
			const mine = ++generation;
			drawShape({ text: config.text, font: config.font, src: config.src, area: config.area ?? AREA, padding: 0.06 }, width, height)
				.then((mask) => {
					if (mine !== generation) return;
					// Reaching far enough out for the halo; blurred a touch, so the rim is smooth.
					const spread = Math.round(height / 7);
					const sdf = blurField(distanceField(mask, spread), width, height, 1);
					gl.activeTexture(gl.TEXTURE1);
					gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, sdf);
					gl.useProgram(program);
					gl.uniform1f(uniform('uSpread'), spread / height);
					if (stage?.still) stage.redraw();
				})
				.catch((error) => console.warn('[effects-astro]', error));
		},
		update({ gl, still }, now, dt) {
			if (!strokes || !wake) return;
			const lines = still || stir <= 0 ? [] : path.read(dt);
			const marks = new Float32Array(lines.length * 4);
			lines.forEach((point, i) => marks.set([point.x, point.y, Math.min(1, Math.hypot(point.dx, point.dy) * 0.5) * 0.12, 0], i * 4));
			const { height } = wake.size();
			const dots = strokes;
			wake.draw(still ? 0 : 0.98 ** ((dt || 1 / 60) * 60), () => {
				if (!marks.length) return;
				dots.upload(marks);
				dots.passes(0, () => gl.uniform1f(dots.program.uniform('uSize'), height * 0.24));
			});
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, wake.texture());
		},
		uniforms({ gl, uniform, ratio, still }, now) {
			const p = !still && stir > 0 && canHover() ? pointerIn(el) : null;
			if (p?.inside) {
				ptr.x += (p.x - ptr.x) * 0.15;
				ptr.y += (p.y - ptr.y) * 0.15;
			}
			active += ((p?.inside ? 1 : 0) - active) * 0.05;
			// A still frame is taken a little way in, where the gas has some shape.
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000 + 40) * (config.speed ?? 1));
			gl.uniform1f(uniform('uRatio'), ratio);
			gl.uniform3f(uniform('uPtr'), ptr.x, ptr.y, active);
			gl.uniform3fv(uniform('uPal'), palette);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		palette = paletteUniform(next.colors);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
