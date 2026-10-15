/**
 * @module @arraypress/effects-astro/feedback
 *
 * A picture that fades a little every frame while new things are drawn
 * into it, so whatever moves leaves a trail: particles streak, the path a
 * pointer took lingers and dies away. Two textures take turns: each frame
 * the last is copied into the other, dimmed, and the effect draws on top.
 *
 * Kept in half floats where the GPU can draw into them (`precise`), so long
 * fades stay smooth; otherwise in bytes, where a small floor is taken off
 * as well, or the dimming would stall on the last faint level and leave a
 * stain. Uses texture unit 0 while it draws; effects keep their own
 * textures on other units.
 */

import { createProgram, bindTriangle, VERTEX } from './gl.js';

/** The fade: the last frame, dimmed and floored. */
const FADE = `
precision highp float;
uniform sampler2D uLast;
uniform float uFade;
uniform float uFloor;
varying vec2 vUv;
void main() {
	gl_FragColor = max(texture2D(uLast, vUv) * uFade - uFloor, 0.0);
}
`;

/**
 * @typedef {object} Feedback
 * @property {(width: number, height: number) => void} resize Sizes it for a
 *   canvas of that many pixels (at its `scale`), cleared.
 * @property {(fade: number, add: () => void) => void} draw One frame: the
 *   last, times `fade` (0 clears, 1 keeps everything), then `add` draws on
 *   top with the target bound and its viewport set. Leaves the canvas bound.
 * @property {() => WebGLTexture} texture The latest frame.
 * @property {() => { width: number, height: number }} size Its size in pixels.
 * @property {() => void} dispose Frees its textures, framebuffers and program.
 */

/**
 * Makes a feedback buffer.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @param {object} [options]
 * @param {number} [options.scale=1] Its size as a share of the canvas's.
 * @param {boolean} [options.precise=false] Half floats where they can be drawn into.
 * @returns {Feedback | null} The buffer, or null when its program does not compile.
 */
export function createFeedback(gl, { scale = 1, precise = false } = {}) {
	const fade = createProgram(gl, VERTEX, FADE);
	if (!fade) return null;
	const triangle = bindTriangle(gl);
	const gl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext ? gl : null;
	let half = !!(precise && gl2 && (gl2.getExtension('EXT_color_buffer_float') || gl2.getExtension('EXT_color_buffer_half_float')));
	const targets = [0, 1].map(() => ({
		texture: /** @type {WebGLTexture} */ (gl.createTexture()),
		fbo: /** @type {WebGLFramebuffer} */ (gl.createFramebuffer()),
	}));
	let width = 1;
	let height = 1;
	let current = 0;

	/**
	 * Allocates both textures at the current size, in half floats or bytes,
	 * and clears them.
	 *
	 * @returns {boolean} Whether the GPU can draw into them.
	 */
	const allocate = () => {
		for (const { texture, fbo } of targets) {
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			if (half && gl2) gl2.texImage2D(gl.TEXTURE_2D, 0, gl2.RGBA16F, width, height, 0, gl.RGBA, gl2.HALF_FLOAT, null);
			else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
			if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return false;
			gl.viewport(0, 0, width, height);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}
		return true;
	};

	return {
		resize(canvasWidth, canvasHeight) {
			width = Math.max(1, Math.round(canvasWidth * scale));
			height = Math.max(1, Math.round(canvasHeight * scale));
			// Half floats that cannot be drawn into after all: bytes instead.
			if (!allocate() && half) {
				half = false;
				allocate();
			}
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		},
		draw(amount, add) {
			const last = targets[current];
			const next = targets[1 - current];
			gl.bindFramebuffer(gl.FRAMEBUFFER, next.fbo);
			gl.viewport(0, 0, width, height);
			gl.disable(gl.BLEND);
			gl.useProgram(fade.program);
			bindTriangle(gl, triangle);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, last.texture);
			gl.uniform1i(fade.uniform('uLast'), 0);
			gl.uniform1f(fade.uniform('uFade'), amount);
			gl.uniform1f(fade.uniform('uFloor'), half ? 0.0004 : 1.5 / 255);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			add();
			current = 1 - current;
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		},
		texture: () => targets[current].texture,
		size: () => ({ width, height }),
		dispose() {
			for (const { texture, fbo } of targets) {
				gl.deleteTexture(texture);
				gl.deleteFramebuffer(fbo);
			}
			gl.deleteBuffer(triangle);
			gl.deleteProgram(fade.program);
		},
	};
}
