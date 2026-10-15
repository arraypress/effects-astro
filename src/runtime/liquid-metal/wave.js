/**
 * @module @arraypress/effects-astro/liquid-metal/wave
 *
 * The liquid metal's surface, simulated on the GPU: a grid of heights and
 * vertical speeds over the logo's box, in a pair of float targets
 * (src/runtime/ping-pong.js), stepped by a damped wave equation with a
 * spring back to rest (shaders.js's STEP). The cells are square, so waves
 * run at the same speed every way.
 *
 * Reads the distance field from texture unit 1, where the effect keeps it;
 * uses unit 0 for its own state. Each step leaves its program, framebuffer
 * and viewport bound: whoever draws next restores theirs.
 */

import { createProgram, bindTriangle, VERTEX } from '../gl.js';
import { createPingPong } from '../ping-pong.js';
import { STEP, MAX_PUSHES } from './shaders.js';

/**
 * The shape the waves run through, in box heights.
 *
 * @typedef {object} WaveShape
 * @property {number} aspect The box's width over its height.
 * @property {number} spread The distance field's reach.
 * @property {number} bevel The width of the rounded edge.
 * @property {number} bulge How far the outline moves per unit of height.
 */

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
 * @typedef {object} Wave
 * @property {(longSide: number, aspect: number) => void} resize Sizes the
 *   grid: `longSide` cells along the box's longer side, square cells; cleared.
 * @property {(shape: WaveShape) => void} shape Sets the shape the waves run through.
 * @property {(motion: WaveMotion, pushes: Float32Array, count: number) => void} step
 *   One step. `pushes` holds x, y (box heights), radius and strength for each
 *   of `count` pushes (at most MAX_PUSHES).
 * @property {() => void} clear Flattens the surface.
 * @property {() => WebGLTexture} texture The current state.
 * @property {() => [number, number]} texel One cell, as a share of the box.
 * @property {() => void} dispose Frees its targets, program and buffer.
 */

/**
 * Sets up the wave simulation.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @returns {Wave | null} The wave, or null where the GPU cannot draw into
 *   float textures or the step does not compile.
 */
export function createWave(gl) {
	const pass = createProgram(gl, VERTEX, STEP);
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
	gl.uniform1i(uniform('uSdf'), 1);

	return {
		resize(longSide, aspect) {
			const cols = aspect >= 1 ? longSide : Math.round(longSide * aspect);
			const rows = Math.max(2, Math.round(cols / aspect));
			state.resize(Math.max(2, cols), rows);
			const size = state.size();
			gl.useProgram(pass.program);
			gl.uniform2f(uniform('uTexel'), 1 / size.width, 1 / size.height);
		},
		shape({ aspect, spread, bevel, bulge }) {
			gl.useProgram(pass.program);
			gl.uniform1f(uniform('uAspect'), aspect);
			gl.uniform1f(uniform('uSpread'), spread);
			gl.uniform1f(uniform('uBevel'), bevel);
			gl.uniform1f(uniform('uBulge'), bulge);
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
		dispose() {
			state.dispose();
			gl.deleteBuffer(triangle);
			gl.deleteProgram(pass.program);
		},
	};
}
