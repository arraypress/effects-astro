/**
 * @module @arraypress/effects-astro/neon-swarm
 *
 * A logo or a word held by a swarm of glowing particles. Each has a home
 * on the shape and a spring to it, and drifts on a curl-noise flow, so the
 * mark shimmers and breathes; now and then two neighbours trade homes
 * and streak past each other. They leave short neon trails and glow where they crowd, in
 * bands of the palette across the mark. The pointer scatters them: they
 * flee it, swirling, and stream back behind it. On arrival they gather
 * from a loose cloud.
 *
 * The flock is stepped on the CPU (src/runtime/swarm.js) and drawn as
 * points into a fading feedback buffer (src/runtime/feedback.js), which
 * the final pass tone-maps over the ground with a little bloom.
 *
 * Opaque: the effect is the whole background of what it fills. Without
 * WebGL it removes its canvas and the element's background shows.
 */

import { createStage } from './stage.js';
import { createPoints } from './points.js';
import { createFeedback } from './feedback.js';
import { drawShape, samplePoints, edgePoints } from './shape.js';
import { createSwarm, disperse, setHomes, settle, stepSwarm } from './swarm.js';
import { GLSL_PALETTE, paletteUniform } from './glsl.js';
import { parseColor } from './color.js';
import { canHover, isMobileGpu } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {object} NeonSwarmConfig
 * @property {string} [text] A word to gather the swarm into.
 * @property {string} [font] Its CSS font, without the size (default: the page's, bold).
 * @property {string} [src] An image (an SVG logo) to gather it into instead.
 * @property {{ x: number, y: number, width: number, height: number }} [area]
 *   Where the shape sits, each 0–1 from the top left (default: the right half).
 * @property {string[]} [colors] The palette across the swarm, three colours (default neon cyan, lime, magenta).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {string} [background='#030406'] The ground.
 * @property {number} [count=6000] How many particles (half on phones).
 * @property {number} [size=2.4] A particle's glowing core, CSS px.
 * @property {number} [trail=0.82] How long the trails are, 0 (none) to 0.95.
 * @property {number} [flow=1] How far the swarm drifts and breathes round the shape; 0 holds it still.
 * @property {number} [scatter=1] How hard the pointer scatters them; 0 for not at all.
 */

/** The final pass: the trails, tone-mapped with a soft bloom, over the ground. */
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uRatio;
uniform sampler2D uTrails;
uniform vec3 uGround;
uniform vec3 uCentre;
${GLSL_PALETTE}
void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	float aspect = uRes.x / uRes.y;
	vec3 light = texture2D(uTrails, uv).rgb;
	// Bloom: two rings of taps round the pixel, so the swarm glows into the dark,
	// turned a different way at every pixel so the taps leave grain, not ghosts.
	vec2 px = uRatio / uRes;
	vec3 bloom = vec3(0.0);
	float spin = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;
	for (int i = 0; i < 6; i++) {
		float a = float(i) * 1.0472 + spin;
		vec2 o = vec2(cos(a), sin(a)) * px;
		bloom += texture2D(uTrails, uv + o * 7.0).rgb + texture2D(uTrails, uv - o.yx * 18.0).rgb * 0.7;
	}
	bloom /= 6.0;
	// A faint wash of the palette behind the shape.
	vec2 d = (uv - uCentre.xy) * vec2(aspect, 1.0);
	vec3 col = uGround + pal(uTime * 0.02 + 0.3) * exp(-dot(d, d) / (uCentre.z * uCentre.z)) * 0.045;
	col += 1.0 - exp(-(light * 1.5 + bloom * 0.7));
	gl_FragColor = vec4(col, 1.0);
}
`;

/** Each particle: where it is (in heights, y up), a seed, its speed. */
const VERTEX = `
precision highp float;
attribute vec4 p;
uniform vec2 uRes;
uniform float uTime;
uniform float uRatio;
uniform vec2 uShift;
uniform float uSize;
uniform float uGain;
varying vec3 vColour;
varying float vAlpha;
${GLSL_PALETTE}
void main() {
	float aspect = uRes.x / uRes.y;
	gl_Position = vec4(p.x / aspect * 2.0 - 1.0 + uShift.x, p.y * 2.0 - 1.0, 0.0, 1.0);
	float s = p.z;
	// Fast particles run hot: brighter, and whiter.
	float hot = clamp(p.w * 1.6, 0.0, 1.0);
	// Each particle is one of the palette's colours, never a blend (neon does not
	// come in muddy in-betweens): which one runs in bands across the mark, drifting
	// slowly, with the seed dithering the borders between them.
	float band = (p.x * 0.5 + p.y * 0.36) * 1.6 + uTime * 0.02;
	vec3 c = pal(floor(band * 3.0 + fract(s * 5.31) * 0.9) / 3.0);
	vColour = mix(c, vec3(1.0), hot * 0.5);
	float twinkle = 0.65 + 0.35 * sin(uTime * (1.5 + s * 3.0) + s * 50.0);
	vAlpha = uGain * twinkle * (1.2 + hot * 1.8);
	// The sprite is three times the core, for its halo.
	gl_PointSize = uSize * uRatio * 3.0 * (0.7 + 0.6 * fract(s * 7.13));
}
`;

/** A neon sprite: a hot core and a faint halo round it. */
const SPRITE = `
precision highp float;
varying vec3 vColour;
varying float vAlpha;
void main() {
	vec2 d = gl_PointCoord - 0.5;
	float r = dot(d, d) * 4.0;
	float a = (exp(-r * 16.0) + 0.16 * exp(-r * 4.0)) * (1.0 - r);
	gl_FragColor = vec4(vColour * max(a, 0.0) * vAlpha, 0.0);
}
`;

/** The defaults: neon cyan, lime and magenta. */
const COLORS = ['#00e5ff', '#b4ff1f', '#ff2bd1'];
/** Where the shape sits by default: the right half, so copy can sit on the left. */
const AREA = { x: 0.46, y: 0.08, width: 0.5, height: 0.84 };
/** How many times each particle is drawn along its path a frame. */
const STAMPS = 3;
/** The share of particles homed on the edge rather than the fill: the outline reads bright and crisp. */
const EDGE = 0.3;

/**
 * Starts a neon swarm on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {NeonSwarmConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function neonSwarm(el, config) {
	let palette = paletteUniform(pickColors(config, COLORS));
	const area = config.area ?? AREA;
	const start = performance.now();
	const count = Math.round((config.count ?? 6000) * (isMobileGpu() ? 0.5 : 1));
	const swarm = createSwarm(count);
	const data = new Float32Array(count * STAMPS * 4);
	for (let i = 0; i < count * STAMPS; i++) data[i * 4 + 2] = (Math.floor(i / STAMPS) * 0.618034) % 1;
	const trail = Math.min(0.95, Math.max(0, config.trail ?? 0.82));
	const flow = config.flow ?? 1;
	const scatter = config.scatter ?? 1;
	let homed = false;
	/** Bumped on each resize, so a slow shape drawn for an old size is dropped. */
	let generation = 0;
	/** @type {import('./points.js').Points | null} */
	let points = null;
	/** @type {import('./feedback.js').Feedback | null} */
	let trails = null;

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		setup({ gl, uniform }) {
			points = createPoints(gl, VERTEX, SPRITE);
			trails = createFeedback(gl, { precise: true });
			if (!points || !trails) return false;
			gl.uniform1i(uniform('uTrails'), 0);
			gl.uniform3fv(uniform('uGround'), parseColor(config.background ?? '#030406'));
			return () => trails?.dispose();
		},
		resize({ canvas, still }) {
			trails?.resize(canvas.width, canvas.height);
			const aspect = canvas.width / canvas.height;
			const mine = ++generation;
			const width = Math.min(1024, canvas.width);
			const height = Math.max(1, Math.round((width * canvas.height) / canvas.width));
			drawShape({ text: config.text, font: config.font, src: config.src, area, padding: 0.06 }, width, height)
				.then((mask) => {
					if (mine !== generation) return;
					const edge = Math.round(count * EDGE);
					const homes = new Float32Array(count * 2);
					homes.set(samplePoints(mask, count - edge));
					homes.set(edgePoints(mask, edge), (count - edge) * 2);
					// In heights of the canvas, so the flow's swirls are round.
					for (let i = 0; i < count * 2; i += 2) homes[i] *= aspect;
					setHomes(swarm, homes);
					if (still) settle(swarm);
					else if (!homed) disperse(swarm, (area.x + area.width / 2) * aspect, 1 - area.y - area.height / 2, 0.45);
					homed = true;
					if (still) stage?.redraw();
				})
				.catch((error) => console.warn('[effects-astro]', error));
		},
		update({ gl, canvas, ratio, still }, now, dt) {
			if (!points || !trails) return;
			const t = (now - start) / 1000;
			const aspect = canvas.width / canvas.height;
			if (homed && !still) {
				const p = scatter > 0 && canHover() ? pointerIn(el) : null;
				stepSwarm(swarm, dt, {
					flow: 0.5 * flow,
					wander: 0.05 * Math.min(1, flow),
					pointer: p?.inside ? { x: p.x * aspect, y: p.y, radius: 0.15, force: 70 * scatter } : null,
				});
			}
			// Each particle stamped along the way it came this frame, so a fast one draws a line, not dots.
			const step = (dt || 1 / 60) / STAMPS;
			for (let i = 0; i < count; i++) {
				const vx = swarm.vel[i * 2];
				const vy = swarm.vel[i * 2 + 1];
				const speed = Math.hypot(vx, vy);
				for (let k = 0; k < STAMPS; k++) {
					const at = (i * STAMPS + k) * 4;
					data[at] = swarm.pos[i * 2] - vx * step * k;
					data[at + 1] = swarm.pos[i * 2 + 1] - vy * step * k;
					data[at + 3] = speed;
				}
			}
			if (homed) points.upload(data);
			// The fade a frame, kept the same whatever the frame rate; a still frame has no trail.
			const fade = still ? 0 : trail ** ((dt || 1 / 60) * 60);
			const u = points.program.uniform;
			const sprites = points;
			trails.draw(fade, () => {
				if (!homed) return;
				sprites.passes(0, () => {
					gl.uniform2f(u('uRes'), canvas.width, canvas.height);
					gl.uniform1f(u('uTime'), t);
					gl.uniform1f(u('uRatio'), ratio);
					gl.uniform1f(u('uSize'), config.size ?? 2.4);
					gl.uniform1f(u('uGain'), (1 - fade) / STAMPS);
					gl.uniform3fv(u('uPal'), palette);
				});
			});
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, trails.texture());
		},
		uniforms({ gl, uniform, canvas, ratio }, now) {
			const aspect = canvas.width / canvas.height;
			gl.uniform1f(uniform('uTime'), (now - start) / 1000);
			gl.uniform1f(uniform('uRatio'), ratio);
			gl.uniform3f(uniform('uCentre'), area.x + area.width / 2, 1 - area.y - area.height / 2, (Math.min(area.width * aspect, area.height) * 0.6));
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
