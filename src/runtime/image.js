/**
 * @module @arraypress/effects-astro/image
 *
 * Pictures for the effects: loading one, putting it on the GPU, and
 * fitting it to a canvas the way CSS `object-fit: cover` does.
 */

/**
 * Loads and decodes an image, asking for CORS so a WebGL texture may read
 * it (same origin, or served with Access-Control-Allow-Origin).
 *
 * @param {string} src Its URL.
 * @returns {Promise<HTMLImageElement>} The image, decoded.
 * @throws {Error} When it cannot be loaded or decoded.
 */
export function loadImage(src) {
	const img = new Image();
	img.crossOrigin = 'anonymous';
	img.src = src;
	return img.decode().then(
		() => img,
		() => {
			throw new Error(`Could not load ${src}`);
		},
	);
}

/**
 * Uploads a picture as a texture on the active texture unit: clamped at
 * its edges, smoothly filtered, and mipmapped when asked (WebGL 1 needs
 * power-of-two sizes for that, so it is skipped there for any other size).
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @param {TexImageSource} source The picture (an image, canvas or video).
 * @param {{ mipmap?: boolean }} [options] `mipmap` for a picture drawn much smaller than it is.
 * @returns {WebGLTexture | null} The texture, bound.
 */
export function imageTexture(gl, source, { mipmap = false } = {}) {
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
	const { width, height } = /** @type {{ width: number, height: number }} */ (source);
	/**
	 * Whether a size is a power of two.
	 *
	 * @param {number} n The size.
	 * @returns {boolean} True for 1, 2, 4, 8…
	 */
	const pow2 = (n) => (n & (n - 1)) === 0;
	const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
	if (mipmap && (webgl2 || (pow2(width) && pow2(height)))) {
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	}
	return texture;
}

/**
 * How to scale texture coordinates so a picture covers a box without
 * stretching, cropping the overflow evenly (CSS `object-fit: cover`).
 * Pass it to `coverUv` in GLSL_COVER.
 *
 * @param {number} imageAspect The picture's width over its height.
 * @param {number} boxAspect The box's width over its height.
 * @returns {[number, number]} The scale for x and y, each at most 1.
 */
export function coverScale(imageAspect, boxAspect) {
	return boxAspect > imageAspect ? [1, imageAspect / boxAspect] : [boxAspect / imageAspect, 1];
}

/** GLSL: `coverUv(uv, scale)`, a 0–1 box coordinate to a picture's, cropped to cover (scale from coverScale). */
export const GLSL_COVER = `
vec2 coverUv(vec2 uv, vec2 scale) {
	return (uv - 0.5) * scale + 0.5;
}
`;
