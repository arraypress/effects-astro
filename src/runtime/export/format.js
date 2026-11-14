/**
 * @module @arraypress/effects-astro/export/format
 *
 * Values read from a computed style, and values written into SVG: a CSS
 * length as a number, a number to two decimal places, text escaped for
 * XML, and a 2D `matrix()` transform as its six numbers.
 */

/**
 * A CSS length or number as a number (`'12.5px'` is 12.5); 0 when it is not one.
 *
 * @param {string} v The computed value.
 * @returns {number} Its number.
 */
export const cssNumber = (v) => parseFloat(v) || 0;

/**
 * A number to at most two decimal places, as an attribute's text.
 *
 * @param {number} n The number.
 * @returns {string} It, rounded.
 */
export const round2 = (n) => String(Math.round(n * 100) / 100);

/**
 * Text made safe inside an XML element or a double-quoted attribute.
 *
 * @param {string} s The text.
 * @returns {string} It, with `&`, `<`, `>` and `"` escaped.
 */
export const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * A computed 2D transform's six numbers.
 *
 * @param {string} t The computed `transform`.
 * @returns {number[] | null} `[a, b, c, d, e, f]` of a `matrix()`, or null for anything else (`none`, a `matrix3d()`).
 */
export function matrixOf(t) {
	const m = t.match(/^matrix\(([^)]+)\)$/);
	return m ? m[1].split(',').map(Number) : null;
}
