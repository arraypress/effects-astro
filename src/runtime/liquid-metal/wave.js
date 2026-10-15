/**
 * @module @arraypress/effects-astro/liquid-metal/wave
 *
 * The liquid metal's surface: a height field (src/runtime/height-field.js)
 * over the logo's box, stepped by shaders.js's STEP, which keeps the waves
 * in the metal and adds a spring back to rest.
 *
 * Reads the distance field from texture unit 1, where the effect keeps it;
 * uses unit 0 for its own state. Each step leaves its program, framebuffer
 * and viewport bound: whoever draws next restores theirs.
 */

import { createHeightField } from '../height-field.js';
import { STEP } from './shaders.js';

/**
 * The shape the waves run through, in box heights.
 *
 * @typedef {object} WaveShape
 * @property {number} spread The distance field's reach.
 * @property {number} bevel The width of the rounded edge.
 * @property {number} bulge How far the outline moves per unit of height.
 */

/**
 * @typedef {import('../height-field.js').HeightField & { shape: (shape: WaveShape) => void }} Wave
 *   The height field, and `shape`, which sets the shape the waves run through.
 */

/**
 * Sets up the wave simulation.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @returns {Wave | null} The wave, or null where the GPU cannot draw into
 *   float textures or the step does not compile.
 */
export function createWave(gl) {
	const field = createHeightField(gl, STEP);
	if (!field) return null;
	const { uniform } = field;
	gl.useProgram(field.program);
	gl.uniform1i(uniform('uSdf'), 1);

	return {
		...field,
		shape({ spread, bevel, bulge }) {
			gl.useProgram(field.program);
			gl.uniform1f(uniform('uSpread'), spread);
			gl.uniform1f(uniform('uBevel'), bevel);
			gl.uniform1f(uniform('uBulge'), bulge);
		},
	};
}
