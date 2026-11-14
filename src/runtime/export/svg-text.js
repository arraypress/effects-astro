/**
 * @module @arraypress/effects-astro/export/svg-text
 *
 * A text node as SVG `<text>` elements, one a line, each where the
 * browser set it: its letters' boxes grouped into lines, the line's
 * baseline from the font's ascent and descent, its width held with
 * `textLength` so a design tool's own face sets it the same length.
 */

import { cssColor, fontMetrics } from './probe.js';
import { cssNumber, escapeXml, round2 } from './format.js';

/**
 * A line of text as the browser set it.
 *
 * @typedef {object} TextLine
 * @property {number} top Its top, viewport px.
 * @property {number} h Its height, px.
 * @property {number} left Its left edge, viewport px.
 * @property {number} right Its right edge, viewport px.
 * @property {string} s Its characters.
 */

/**
 * Text as `text-transform` shows it.
 *
 * @param {string} s The text.
 * @param {string} t The computed `text-transform`.
 * @returns {string} The text as shown.
 */
export const transformText = (s, t) =>
	t === 'uppercase' ? s.toUpperCase() : t === 'lowercase' ? s.toLowerCase() : t === 'capitalize' ? s.replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase()) : s;

/**
 * Characters grouped into the lines they were set on: a character joins
 * the line whose top is within half its height of its own.
 *
 * @param {{ rect: { top: number, left: number, right: number, height: number }, ch: string }[]} glyphs Each character and its box, in order.
 * @returns {TextLine[]} The lines, in the order they start.
 */
export function groupLines(glyphs) {
	/** @type {TextLine[]} */
	const lines = [];
	for (const { rect, ch } of glyphs) {
		let line = lines.find((l) => Math.abs(l.top - rect.top) < rect.height / 2);
		if (!line) lines.push((line = { top: rect.top, h: rect.height, left: rect.left, right: rect.right, s: '' }));
		line.left = Math.min(line.left, rect.left);
		line.right = Math.max(line.right, rect.right);
		line.s += ch;
	}
	return lines;
}

/**
 * Each character of a text node and its box (a character with no box,
 * collapsed white space, is left out).
 *
 * @param {Text} node The text node.
 * @returns {{ rect: DOMRect, ch: string }[]} The characters.
 */
function glyphsOf(node) {
	const text = node.data;
	const range = document.createRange();
	/** @type {{ rect: DOMRect, ch: string }[]} */
	const glyphs = [];
	for (let i = 0; i < text.length; i++) {
		range.setStart(node, i);
		range.setEnd(node, i + 1);
		const rect = range.getClientRects()[0];
		if (rect) glyphs.push({ rect, ch: text[i] });
	}
	return glyphs;
}

/**
 * What every line of a piece of text shares: its font, spacing and fill
 * as attributes, and what only CSS can say (a width, variable axes) as a
 * style.
 *
 * @param {CSSStyleDeclaration} cs The text's computed style.
 * @param {{ hex: string, a: number }} fill Its fill colour.
 * @param {number} opacity Its element's opacity.
 * @param {number} ls Its letter-spacing, px.
 * @returns {{ attrs: string, style: string }} The attributes (each with a space before it), and the style (empty for none), escaped.
 */
function fontAttrs(cs, fill, opacity, ls) {
	const style = [cs.fontStretch !== '100%' && `font-stretch:${cs.fontStretch}`, cs.fontVariationSettings !== 'normal' && `font-variation-settings:${cs.fontVariationSettings}`]
		.filter(Boolean)
		.join(';');
	const attrs =
		` font-family="${escapeXml(cs.fontFamily.replace(/"/g, "'"))}" font-size="${round2(cssNumber(cs.fontSize))}" font-weight="${cs.fontWeight}"` +
		(cs.fontStyle !== 'normal' ? ` font-style="${cs.fontStyle}"` : '') +
		(ls ? ` letter-spacing="${round2(ls)}"` : '') +
		` fill="${fill.hex}"` +
		(fill.a * opacity < 1 ? ` fill-opacity="${round2(fill.a)}"` : '');
	return { attrs, style: escapeXml(style) };
}

/**
 * A text node's lines as `<text>` elements, each where the browser set it.
 *
 * @param {Text} node The text node.
 * @param {CSSStyleDeclaration} cs Its element's computed style.
 * @param {DOMRect} origin The exported element's box (positions are measured from it).
 * @param {number} opacity Its element's opacity.
 * @returns {string} The `<text>` elements.
 */
export function textLines(node, cs, origin, opacity) {
	const lines = groupLines(glyphsOf(node));
	const fill = cssColor(cs.getPropertyValue('-webkit-text-fill-color') || cs.color);
	if (!fill) return '';
	const ls = cs.letterSpacing === 'normal' ? 0 : cssNumber(cs.letterSpacing);
	const { asc, desc } = fontMetrics(`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`);
	const { attrs, style } = fontAttrs(cs, fill, opacity, ls);
	return lines
		.map((l) => {
			const body = transformText(l.s.replace(/\s+/g, ' '), cs.textTransform).trim();
			if (!body) return '';
			const y = l.top - origin.top + (l.h - (asc + desc)) / 2 + asc;
			const w = l.right - l.left - ls; // the browser spaces after the last letter too
			return `<text x="${round2(l.left - origin.left)}" y="${round2(y)}"${attrs} textLength="${round2(w)}" lengthAdjust="spacing"${style ? ` style="${style}"` : ''} xml:space="preserve">${escapeXml(body)}</text>`;
		})
		.join('');
}
