/**
 * @module @arraypress/effects-astro/particle-logo
 *
 * A logo or a word drawn in thousands of twinkling particles. They breathe
 * in place; near the pointer they scatter outward and swirl round it, then
 * drift home as it passes, and the whole mark tilts towards the pointer in
 * a gentle perspective. Each dot is drawn with its red and blue a little
 * apart, and two slow blooms of colour glow behind.
 *
 * The motion is worked out per particle on the GPU from where it lives and
 * a seed, so there is no simulation to step: 16,000 particles cost one
 * draw (three with the colour split).
 *
 * Opaque: the effect is the whole background of what it fills. Without
 * WebGL it removes its canvas and the element's background shows.
 */

import { createStage } from './stage.js';
import { createPoints, GLSL_PROJECT } from './points.js';
import { drawShape, samplePoints } from './shape.js';
import { parseColor } from './color.js';
import { canHover, isMobileGpu } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {object} ParticleLogoConfig
 * @property {string} [text] A word to draw in particles.
 * @property {string} [font] Its CSS font, without the size (default: the page's, bold).
 * @property {string} [src] An image (an SVG logo) to draw in particles instead.
 * @property {{ x: number, y: number, width: number, height: number }} [area]
 *   Where the shape sits, each 0–1 from the top left (default: the middle).
 * @property {string[]} [colors] The dots' two colours, then the two blooms' (default white and ice blue, deep teal and midnight blue).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`. White dots, then its three colours.
 * @property {string} [background='#030305'] The ground.
 * @property {number} [count=16000] How many particles (half on phones).
 * @property {number} [size=2.2] A particle's size, CSS px.
 * @property {number} [swarm=1] How strongly they scatter round the pointer; 0 for not at all.
 * @property {number} [tilt=1] How far the mark tilts towards the pointer.
 * @property {number} [aberration=1.5] How far red and blue part, CSS px; 0 for none.
 */

/** The ground and its two blooms. */
const GROUND = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uGround;
uniform vec3 uBloomA;
uniform vec3 uBloomB;
void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
	vec2 a = (uv - vec2(0.08 + 0.04 * sin(uTime * 0.11), 0.7)) * aspect;
	vec2 b = (uv - vec2(0.92, 0.25 + 0.05 * cos(uTime * 0.09))) * aspect;
	vec3 col = uGround + uBloomA * exp(-dot(a, a) * 2.2) * 0.6 + uBloomB * exp(-dot(b, b) * 2.0) * 0.55;
	gl_FragColor = vec4(col, 1.0);
}
`;

/** Each particle: home (x, y), seed; breathing, the swarm, the tilt. */
const VERTEX = `
precision highp float;
attribute vec4 p;
uniform vec2 uRes;
uniform float uTime;
uniform float uRatio;
uniform vec2 uShift;
uniform vec2 uPtr;
uniform float uActive;
uniform vec2 uTilt;
uniform float uSize;
uniform float uSwarm;
uniform vec3 uDotA;
uniform vec3 uDotB;
varying vec3 vColour;
varying float vAlpha;
${GLSL_PROJECT}
void main() {
	float aspect = uRes.x / uRes.y;
	float s = p.z;
	vec3 v = vec3((p.x * 2.0 - 1.0) * aspect, p.y * 2.0 - 1.0, (fract(s * 17.3) - 0.5) * 0.12);
	// Breathing in place.
	v.xy += 0.006 * vec2(sin(uTime * (0.6 + s) + s * 40.0), cos(uTime * (0.5 + s * 0.7) + s * 17.0));
	// Round the pointer: out, and swirling, half one way and half the other.
	vec2 ptr = vec2((uPtr.x * 2.0 - 1.0) * aspect, uPtr.y * 2.0 - 1.0);
	vec2 d = v.xy - ptr;
	float dist = length(d) + 1e-3;
	float f = exp(-dist * dist / 0.07) * uActive * uSwarm;
	vec2 out_ = d / dist;
	v.xy += out_ * f * 0.22 + vec2(-out_.y, out_.x) * f * 0.2 * (s > 0.5 ? 1.0 : -1.0);
	v.z += f * (s - 0.3) * 0.8;
	// Towards the pointer, in perspective.
	v = rotateY(v, uTilt.x * 0.35);
	v = rotateX(v, -uTilt.y * 0.25);
	vec4 pos = project(v, aspect);
	gl_Position = pos + vec4(uShift * pos.w, 0.0, 0.0);
	float twinkle = 0.55 + 0.45 * sin(uTime * (1.5 + s * 3.0) + s * 60.0);
	gl_PointSize = uSize * uRatio * (0.6 + 0.9 * fract(s * 7.13)) * (0.8 + 0.4 * twinkle) / pos.w;
	vColour = mix(uDotA, uDotB, fract(s * 3.7));
	vAlpha = twinkle * 0.9;
}
`;

/** The defaults: white and ice-blue dots, a deep teal and a midnight-blue bloom. */
const COLORS = ['#ffffff', '#a5c8ff', '#0f4c5c', '#0b1f3a'];

/**
 * Starts a particle logo on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {ParticleLogoConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function particleLogo(el, config) {
	let colors = pickColors(config, COLORS, (p) => ['#ffffff', ...p.colors]);
	const start = performance.now();
	const ptr = { x: 0.5, y: 0.5 };
	const tilt = { x: 0, y: 0 };
	let active = 0;
	/** @type {import('./points.js').Points | null} */
	let points = null;
	let generation = 0;
	const count = Math.round((config.count ?? 16000) * (isMobileGpu() ? 0.5 : 1));

	const { stage, stop } = createStage(el, {
		fragment: GROUND,
		alpha: false,
		setup({ gl, program }) {
			points = createPoints(gl, VERTEX);
			if (!points) return false;
			gl.useProgram(program);
		},
		resize({ canvas }) {
			const mine = ++generation;
			const width = Math.min(1024, canvas.width);
			const height = Math.max(1, Math.round((width * canvas.height) / canvas.width));
			drawShape({ text: config.text, font: config.font, src: config.src, area: config.area, padding: 0.12 }, width, height)
				.then((mask) => {
					if (mine !== generation || !points) return;
					const homes = samplePoints(mask, count);
					const data = new Float32Array(count * 4);
					for (let i = 0; i < count; i++) {
						data.set([homes[i * 2], homes[i * 2 + 1], Math.random(), 0], i * 4);
					}
					points.upload(data);
					if (stage?.still) stage.redraw();
				})
				.catch((error) => console.warn('[effects-astro]', error));
		},
		uniforms({ gl, uniform }, now) {
			gl.uniform1f(uniform('uTime'), (now - start) / 1000);
			gl.uniform3fv(uniform('uGround'), parseColor(config.background ?? '#030305'));
			gl.uniform3fv(uniform('uBloomA'), parseColor(colors[2] ?? COLORS[2]));
			gl.uniform3fv(uniform('uBloomB'), parseColor(colors[3] ?? colors[2] ?? COLORS[3]));
		},
		after({ gl, ratio, still }, now) {
			if (!points?.count()) return;
			const t = (now - start) / 1000;
			const p = !still && canHover() ? pointerIn(el) : null;
			if (p?.inside) {
				ptr.x += (p.x - ptr.x) * 0.12;
				ptr.y += (p.y - ptr.y) * 0.12;
			}
			active += ((p?.inside ? 1 : 0) - active) * 0.06;
			// Towards the pointer, or a slow sway without one.
			const lean = p?.inside ? { x: (p.x - 0.5) * 2, y: (p.y - 0.5) * 2 } : { x: Math.sin(t * 0.3) * 0.3, y: Math.sin(t * 0.23) * 0.2 };
			tilt.x += (lean.x * (config.tilt ?? 1) - tilt.x) * 0.05;
			tilt.y += (lean.y * (config.tilt ?? 1) - tilt.y) * 0.05;
			const u = points.program.uniform;
			points.passes((config.aberration ?? 1.5) * ratio, () => {
				gl.uniform2f(u('uRes'), gl.drawingBufferWidth, gl.drawingBufferHeight);
				gl.uniform1f(u('uTime'), t);
				gl.uniform1f(u('uRatio'), ratio);
				gl.uniform2f(u('uPtr'), ptr.x, ptr.y);
				gl.uniform1f(u('uActive'), active);
				gl.uniform2f(u('uTilt'), tilt.x, tilt.y);
				gl.uniform1f(u('uSize'), config.size ?? 2.2);
				gl.uniform1f(u('uSwarm'), config.swarm ?? 1);
				gl.uniform3fv(u('uDotA'), parseColor(colors[0]));
				gl.uniform3fv(u('uDotB'), parseColor(colors[1] ?? colors[0]));
			});
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		colors = next.colors;
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
