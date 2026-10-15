/**
 * @module @arraypress/effects-astro/glyphs
 *
 * Text characters as a texture, for effects that draw in character cells:
 * a strip of glyphs, darkest first, that a shader picks from by brightness.
 * `GLSL_GLYPHS` is the shader side: `glyph(cellUv, level)` returns how much
 * of the cell the glyph for a brightness level covers.
 */

/**
 * The character sets, each ordered from empty to full. Block and bar
 * characters are drawn by the canvas from the system's monospace font,
 * which on every current system includes them.
 */
export const GLYPH_SETS = {
	/**
	 * A data readout drawn as shapes, not type: empty, a low line, a hollow
	 * bar, a solid bar, so a streak fades out through outlines and then
	 * underscores at its ends. Crisp, and the same on every system.
	 */
	data: ' _▯▮',
	/** Classic ASCII art. */
	ascii: ' .:-=+*#%@',
	/** Vertical bars filling from the left, and a solid block: a data readout. */
	bars: ' ·▏▎▍▌▋▊▉█',
	/** Shade blocks. */
	blocks: ' ░▒▓█',
	/** Ones and noughts. */
	binary: ' 01',
	/** Hollow and solid boxes, like a terminal missing its glyphs. */
	boxes: ' ·▫□▢▣■',
};

/**
 * Draws a set of glyphs into a texture: one row, one glyph a cell, each
 * centred and sized to fill the cell's height.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @param {string} glyphs The characters, darkest first (a key of GLYPH_SETS, or the characters themselves).
 * @param {object} [options]
 * @param {number} [options.cell=48] Each glyph's cell height in texture pixels.
 * @param {number} [options.aspect=0.6] A cell's width over its height.
 * @param {string} [options.font='ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'] The font family.
 * @param {number} [options.unit=0] The texture unit to leave it bound on.
 * @returns {{ texture: WebGLTexture, count: number }} The texture and how many glyphs it holds.
 */
export function createGlyphs(gl, glyphs, { cell = 48, aspect = 0.6, font = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', unit = 0 } = {}) {
	const chars = [...(GLYPH_SETS[/** @type {keyof typeof GLYPH_SETS} */ (glyphs)] ?? glyphs)];
	const width = Math.round(cell * aspect);
	const canvas = document.createElement('canvas');
	canvas.width = width * chars.length;
	canvas.height = cell;
	const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
	ctx.fillStyle = '#fff';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `${Math.round(cell * 0.92)}px ${font}`;
	if (glyphs === 'data') {
		// Drawn as rectangles: a solid bar nearly the cell's height (rows of
		// them touch), and a smaller hollow one in a fine line.
		const line = Math.max(2, cell * 0.08);
		chars.forEach((ch, i) => {
			const [w, h] = ch === '▮' ? [width * 0.6, cell * 0.94] : [width * 0.62, cell * 0.76];
			const x = (i + 0.5) * width - w / 2;
			const y = (cell - h) / 2;
			if (ch === '_') {
				ctx.fillRect(x, cell * 0.97 - line, w, line);
			} else if (ch === '▯') {
				ctx.fillRect(x, y, w, line);
				ctx.fillRect(x, y + h - line, w, line);
				ctx.fillRect(x, y, line, h);
				ctx.fillRect(x + w - line, y, line, h);
			} else if (ch === '▮') {
				ctx.fillRect(x, y, w, h);
			}
		});
	} else {
		chars.forEach((ch, i) => ctx.fillText(ch, (i + 0.5) * width, cell * 0.52));
	}

	const texture = /** @type {WebGLTexture} */ (gl.createTexture());
	gl.activeTexture(gl.TEXTURE0 + unit);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
	return { texture, count: chars.length };
}

/**
 * GLSL (ES 1.00) for reading the strip: declares `uGlyphs` and
 * `uGlyphCount`, and `float glyph(vec2 cellUv, float level)`, the coverage
 * of the glyph for a brightness `level` (0–1) at a point in its cell
 * (`cellUv` 0–1, y up).
 */
export const GLSL_GLYPHS = `
uniform sampler2D uGlyphs;
uniform float uGlyphCount;
float glyph(vec2 cellUv, float level) {
	float index = floor(clamp(level, 0.0, 1.0) * (uGlyphCount - 1.0) + 0.5);
	vec2 at = vec2((index + clamp(cellUv.x, 0.02, 0.98)) / uGlyphCount, 1.0 - clamp(cellUv.y, 0.02, 0.98));
	return texture2D(uGlyphs, at).a;
}
`;
