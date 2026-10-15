/** The character sets, each ordered from empty to full. */
export const GLYPH_SETS: {
	data: string;
	ascii: string;
	bars: string;
	blocks: string;
	binary: string;
	boxes: string;
};

/**
 * Draws glyphs (a GLYPH_SETS key, or the characters, darkest first) into a
 * one-row texture left bound on `unit`.
 */
export function createGlyphs(
	gl: WebGLRenderingContext | WebGL2RenderingContext,
	glyphs: string,
	options?: { cell?: number; aspect?: number; font?: string; unit?: number },
): { texture: WebGLTexture; count: number };

/** GLSL declaring `uGlyphs`, `uGlyphCount` and `float glyph(vec2 cellUv, float level)`. */
export const GLSL_GLYPHS: string;
