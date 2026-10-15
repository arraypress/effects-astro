/**
 * @module @arraypress/effects-astro/instancing
 *
 * Instanced drawing on either WebGL: built into WebGL 2, through the
 * ANGLE_instanced_arrays extension on WebGL 1. One draw puts the same mesh
 * down many times, each copy reading its own values from attributes that
 * advance once an instance.
 */

/**
 * @typedef {object} Instancing
 * @property {(location: number, divisor: number) => void} divisor How many
 *   instances share each value of an attribute (0: it advances every vertex).
 * @property {(mode: number, first: number, count: number, instances: number) => void} draw
 *   Draws `count` vertices from `first`, `instances` times.
 */

/**
 * Instanced drawing for a context, where it has it.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @returns {Instancing | null} The calls, or null where there is no instancing.
 */
export function instancing(gl) {
	if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
		return {
			divisor: (location, divisor) => gl.vertexAttribDivisor(location, divisor),
			draw: (mode, first, count, instances) => gl.drawArraysInstanced(mode, first, count, instances),
		};
	}
	const ext = gl.getExtension('ANGLE_instanced_arrays');
	if (!ext) return null;
	return {
		divisor: (location, divisor) => ext.vertexAttribDivisorANGLE(location, divisor),
		draw: (mode, first, count, instances) => ext.drawArraysInstancedANGLE(mode, first, count, instances),
	};
}
