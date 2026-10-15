/**
 * @module @arraypress/effects-astro/ping-pong
 *
 * Two float render targets for a simulation on the GPU: each step reads
 * one and writes the other, then they swap. Full floats where the GPU can
 * draw into and filter them, else half floats; none where it can do
 * neither. WebGL 1 or 2. Uses texture unit 0 while it allocates.
 *
 * @example
 * const state = createPingPong(gl, 256, 128);
 * gl.bindFramebuffer(gl.FRAMEBUFFER, state.write.fbo);
 * // …bind state.read.texture, draw a pass…
 * state.swap();
 */

/**
 * A float texture format a context offers for render targets.
 *
 * @typedef {object} FloatFormat
 * @property {number} internal The internal format.
 * @property {number} type The texel type.
 * @property {boolean} linear Whether it can be filtered linearly.
 */

/**
 * A texture and the framebuffer that draws into it.
 *
 * @typedef {object} Target
 * @property {WebGLTexture} texture The texture.
 * @property {WebGLFramebuffer} fbo The framebuffer.
 */

/**
 * @typedef {object} PingPong
 * @property {Target} read The target read this step.
 * @property {Target} write The target written this step.
 * @property {() => void} swap Swaps them, after a step.
 * @property {(width: number, height: number) => boolean} resize Reallocates
 *   both at a new size, cleared; false if the GPU will not draw into them.
 * @property {() => void} clear Clears both to zero.
 * @property {() => { width: number, height: number }} size Their size, texels.
 * @property {boolean} linear Whether they are filtered linearly (else nearest).
 * @property {() => void} dispose Frees the textures and framebuffers.
 */

/**
 * The float formats a context offers for render targets, best first: full
 * floats where they can be filtered, then half floats, filtered where they
 * can be. Asks for the extensions it needs on the way.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @returns {FloatFormat[]} The candidates (not yet proven drawable).
 */
export function floatFormats(gl) {
	/** @type {FloatFormat[]} */
	const formats = [];
	if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
		const color = gl.getExtension('EXT_color_buffer_float');
		if (color && gl.getExtension('OES_texture_float_linear')) formats.push({ internal: gl.RGBA32F, type: gl.FLOAT, linear: true });
		// Half floats always filter in WebGL 2.
		if (color || gl.getExtension('EXT_color_buffer_half_float')) formats.push({ internal: gl.RGBA16F, type: gl.HALF_FLOAT, linear: true });
		return formats;
	}
	const full = gl.getExtension('OES_texture_float');
	if (full && gl.getExtension('OES_texture_float_linear')) {
		gl.getExtension('WEBGL_color_buffer_float');
		formats.push({ internal: gl.RGBA, type: gl.FLOAT, linear: true });
	}
	const half = gl.getExtension('OES_texture_half_float');
	if (half) {
		gl.getExtension('EXT_color_buffer_half_float');
		formats.push({ internal: gl.RGBA, type: half.HALF_FLOAT_OES, linear: !!gl.getExtension('OES_texture_half_float_linear') });
	}
	return formats;
}

/**
 * Makes a pair of float targets, cleared.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @param {number} width Texels across.
 * @param {number} height Texels down.
 * @returns {PingPong | null} The pair, or null where the GPU cannot draw into float textures.
 */
export function createPingPong(gl, width, height) {
	const targets = [0, 1].map(() => ({
		texture: /** @type {WebGLTexture} */ (gl.createTexture()),
		fbo: /** @type {WebGLFramebuffer} */ (gl.createFramebuffer()),
	}));
	let w = 1;
	let h = 1;

	/** Frees both targets. */
	const dispose = () => {
		for (const { texture, fbo } of targets) {
			gl.deleteTexture(texture);
			gl.deleteFramebuffer(fbo);
		}
	};

	/**
	 * Allocates both targets in a format, cleared.
	 *
	 * @param {FloatFormat} format The format.
	 * @returns {boolean} Whether the GPU can draw into them.
	 */
	const allocate = (format) => {
		const filter = format.linear ? gl.LINEAR : gl.NEAREST;
		for (const { texture, fbo } of targets) {
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(gl.TEXTURE_2D, 0, format.internal, w, h, 0, gl.RGBA, format.type, null);
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
			if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return false;
		}
		return true;
	};

	/** Clears both targets to zero, and leaves the canvas bound. */
	const clear = () => {
		gl.clearColor(0, 0, 0, 0);
		for (const { fbo } of targets) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
			gl.viewport(0, 0, w, h);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	};

	w = Math.max(1, Math.round(width));
	h = Math.max(1, Math.round(height));
	const format = floatFormats(gl).find(allocate);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	if (!format) {
		dispose();
		return null;
	}
	clear();
	const chosen = format;

	/**
	 * Sizes both targets, cleared.
	 *
	 * @param {number} width Texels across.
	 * @param {number} height Texels down.
	 * @returns {boolean} Whether the GPU can draw into them.
	 */
	const resize = (width, height) => {
		w = Math.max(1, Math.round(width));
		h = Math.max(1, Math.round(height));
		const ok = allocate(chosen);
		clear();
		return ok;
	};

	/** @type {PingPong} */
	const pair = {
		read: targets[0],
		write: targets[1],
		swap() {
			[pair.read, pair.write] = [pair.write, pair.read];
		},
		resize,
		clear,
		size: () => ({ width: w, height: h }),
		linear: format.linear,
		dispose,
	};
	return pair;
}
