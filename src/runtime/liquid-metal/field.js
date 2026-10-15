/**
 * @module @arraypress/effects-astro/liquid-metal/field
 *
 * The logo's distance field on the GPU, on texture unit 1. It arrives as
 * bytes (src/runtime/shape.js), whose steps the rounded edge's slope
 * would show as stripes, so it is blurred on the GPU into a float target
 * (src/runtime/ping-pong.js), where the steps become smooth ramps. Where
 * the GPU cannot filter a float target, the bytes are used as they are.
 *
 * Uploading uses unit 0 for the blur and leaves its framebuffer bound:
 * whoever draws next restores theirs.
 */

import { createProgram, bindTriangle, VERTEX } from '../gl.js';
import { createPingPong } from '../ping-pong.js';
import { SMOOTH } from './shaders.js';

/**
 * @typedef {object} Field
 * @property {(bytes: Uint8Array, width: number, height: number) => void} upload
 *   Takes a new field (one byte a pixel, rows from the top) and binds it to unit 1.
 * @property {() => void} dispose Frees its textures, targets, program and buffer.
 */

/**
 * Sets up the field, empty (all outside) until the first upload.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @returns {Field} The field.
 */
export function createField(gl) {
	const bytes = gl.createTexture();
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, bytes);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([0]));

	const blur = createProgram(gl, VERTEX, SMOOTH);
	const smooth = blur && createPingPong(gl, 1, 1);
	const targets = smooth?.linear ? smooth : null;
	const triangle = bindTriangle(gl);

	/**
	 * One blur pass into the write target.
	 *
	 * @param {WebGLTexture} source What is blurred.
	 * @param {number} x The step across, a share of the width.
	 * @param {number} y The step down, a share of the height.
	 */
	const pass = (source, x, y) => {
		if (!blur || !targets) return;
		const { width, height } = targets.size();
		gl.bindFramebuffer(gl.FRAMEBUFFER, targets.write.fbo);
		gl.viewport(0, 0, width, height);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, source);
		gl.uniform2f(blur.uniform('uStep'), x, y);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		targets.swap();
	};

	return {
		upload(field, width, height) {
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, bytes);
			gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, field);
			if (!blur || !targets || !targets.resize(width, height)) return;
			gl.useProgram(blur.program);
			bindTriangle(gl, triangle);
			gl.disable(gl.BLEND);
			gl.uniform1i(blur.uniform('uSource'), 0);
			pass(/** @type {WebGLTexture} */ (bytes), 1 / width, 0);
			pass(targets.read.texture, 0, 1 / height);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, targets.read.texture);
		},
		dispose() {
			gl.deleteTexture(bytes);
			smooth?.dispose();
			if (blur) gl.deleteProgram(blur.program);
			gl.deleteBuffer(triangle);
		},
	};
}
