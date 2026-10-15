/**
 * @module @arraypress/effects-astro/height-field
 *
 * A surface of waves simulated on the GPU, cheaply: a grid of heights and
 * vertical speeds in a pair of float targets (src/runtime/ping-pong.js),
 * stepped by a damped wave equation. The cells are square, so waves run at
 * the same speed every way. Pushes from the pointer dent it; each effect
 * writes its own step shader round the shared pieces (GLSL_HEIGHT_FIELD),
 * so a liquid metal and a pond differ only in what holds the water.
 *
 * The state texture: r the surface's height off its rest, g its vertical
 * speed. Uses texture unit 0 for it. Each step leaves its program,
 * framebuffer and viewport bound: whoever draws next restores theirs.
 *
 * @example
 * const STEP = `precision highp float;
 * varying vec2 vUv;
 * ${GLSL_HEIGHT_FIELD}
 * void main() {
 * 	vec4 s = waveState(vUv);
 * 	float v = (s.y + waveForce(s) - wavePushes(vUv)) * uMotion.z;
 * 	gl_FragColor = wavePack(s.x + v, v);
 * }`;
 * const field = createHeightField(gl, STEP);
 */

import { createProgram, bindTriangle, VERTEX } from './gl.js';
import { createPingPong } from './ping-pong.js';

/** The most pushes one step takes. */
export const MAX_PUSHES = 20;

/**
 * GLSL (ES 1.00) for a step shader: the state and its neighbours, the
 * forces on a cell, and the pushes.
 *
 * - `vec4 waveState(vec2 uv)`: height, speed, and the Laplacian of each
 *   (how far the cell sits below its neighbours).
 * - `float waveForce(vec4 s)`: the change in speed this step: the wave
 *   (`uMotion.x`, speed squared in cells a step, at most 0.5), a spring
 *   back to rest (`uMotion.y`) and viscosity evening out speeds
 *   (`uMotion.w`). `uMotion.z` is the share of speed kept each step, for
 *   the shader to apply as it likes.
 * - `float wavePushes(vec2 uv)`: how far the pushes press the cell down
 *   this step. Each is a dent ringed by a smaller swell (a difference of
 *   gaussians that adds no volume), at x, y in box heights.
 * - `vec4 wavePack(float h, float v)`: the new state, clamped.
 */
export const GLSL_HEIGHT_FIELD = `
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uAspect;
uniform vec4 uMotion;
uniform vec4 uPush[${MAX_PUSHES}];
uniform int uPushes;

vec4 waveState(vec2 uv) {
	vec2 s = texture2D(uState, uv).rg;
	vec2 l = texture2D(uState, uv - vec2(uTexel.x, 0.0)).rg;
	vec2 r = texture2D(uState, uv + vec2(uTexel.x, 0.0)).rg;
	vec2 t = texture2D(uState, uv + vec2(0.0, uTexel.y)).rg;
	vec2 b = texture2D(uState, uv - vec2(0.0, uTexel.y)).rg;
	return vec4(s, l + r + t + b - 4.0 * s);
}

float waveForce(vec4 s) {
	return uMotion.x * s.z - uMotion.y * s.x + uMotion.w * s.w;
}

float wavePushes(vec2 uv) {
	vec2 p = uv * vec2(uAspect, 1.0);
	float dent = 0.0;
	for (int i = 0; i < ${MAX_PUSHES}; i++) {
		if (i >= uPushes) break;
		vec4 push = uPush[i];
		vec2 d = p - push.xy;
		float k = dot(d, d) / (push.z * push.z);
		dent += push.w * (exp(-k) - 0.25 * exp(-k * 0.25));
	}
	return dent;
}

vec4 wavePack(float h, float v) {
	return vec4(clamp(h, -6.0, 6.0), clamp(v, -3.0, 3.0), 0.0, 1.0);
}
`;

/**
 * How the surface moves, per step.
 *
 * @typedef {object} WaveMotion
 * @property {number} speed Wave speed squared, cells a step (at most 0.5).
 * @property {number} spring The pull back to rest.
 * @property {number} keep The share of speed kept each step.
 * @property {number} viscosity How much neighbouring speeds even out.
 */

/**
 * @typedef {object} HeightField
 * @property {WebGLProgram} program The step's program.
 * @property {(name: string) => WebGLUniformLocation | null} uniform A uniform of the step.
 * @property {(longSide: number, aspect: number) => void} resize Sizes the
 *   grid: `longSide` cells along the box's longer side, square cells; cleared.
 * @property {(motion: WaveMotion, pushes: Float32Array, count: number) => void} step
 *   One step. `pushes` holds x, y (box heights), radius and strength for each
 *   of `count` pushes (at most MAX_PUSHES).
 * @property {() => void} clear Flattens the surface.
 * @property {() => WebGLTexture} texture The current state.
 * @property {() => [number, number]} texel One cell, as a share of the box.
 * @property {boolean} linear Whether the state is filtered linearly (else nearest).
 * @property {() => void} dispose Frees its targets, program and buffer.
 */

/**
 * Sets up a height field with a step shader built on GLSL_HEIGHT_FIELD.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @param {string} step The step's fragment shader (`vUv` 0–1 across the box).
 * @returns {HeightField | null} The field, or null where the GPU cannot draw
 *   into float textures or the step does not compile.
 */
export function createHeightField(gl, step) {
	const pass = createProgram(gl, VERTEX, step);
	if (!pass) return null;
	const state = createPingPong(gl, 2, 2);
	if (!state) {
		gl.deleteProgram(pass.program);
		return null;
	}
	const triangle = bindTriangle(gl);
	const { uniform } = pass;
	gl.useProgram(pass.program);
	gl.uniform1i(uniform('uState'), 0);

	return {
		program: pass.program,
		uniform,
		resize(longSide, aspect) {
			const cols = aspect >= 1 ? longSide : Math.round(longSide * aspect);
			const rows = Math.max(2, Math.round(cols / aspect));
			state.resize(Math.max(2, cols), rows);
			const size = state.size();
			gl.useProgram(pass.program);
			gl.uniform2f(uniform('uTexel'), 1 / size.width, 1 / size.height);
			gl.uniform1f(uniform('uAspect'), aspect);
		},
		step(motion, pushes, count) {
			const { width, height } = state.size();
			gl.useProgram(pass.program);
			bindTriangle(gl, triangle);
			gl.disable(gl.BLEND);
			gl.bindFramebuffer(gl.FRAMEBUFFER, state.write.fbo);
			gl.viewport(0, 0, width, height);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, state.read.texture);
			gl.uniform4f(uniform('uMotion'), motion.speed, motion.spring, motion.keep, motion.viscosity);
			const n = Math.min(count, MAX_PUSHES);
			gl.uniform1i(uniform('uPushes'), n);
			if (n) gl.uniform4fv(uniform('uPush'), pushes.subarray(0, MAX_PUSHES * 4));
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			state.swap();
		},
		clear: () => state.clear(),
		texture: () => state.read.texture,
		texel() {
			const { width, height } = state.size();
			return [1 / width, 1 / height];
		},
		linear: state.linear,
		dispose() {
			state.dispose();
			gl.deleteBuffer(triangle);
			gl.deleteProgram(pass.program);
		},
	};
}
