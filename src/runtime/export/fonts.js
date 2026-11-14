/**
 * @module @arraypress/effects-astro/export/fonts
 *
 * The page's web fonts that an element's text uses, as `@font-face` rules
 * with the files inlined (`data:` URLs), so an exported SVG sets its words
 * in the same faces wherever it is opened in a browser.
 *
 * Only the faces needed go in: the families, styles and weights the text
 * is set in, and of those only the `unicode-range` subsets its characters
 * fall in (a font split into latin, latin-ext, cyrillic and so on).
 */

import { toDataUrl } from './fetch.js';
import { PSEUDOS } from './styles.js';

/** @typedef {{ style: string, weights: Set<number>, chars: Set<number> }} FontUse A face the text asks for: its style, the weights, and the characters set in it. */

/** The descriptors a face's rule keeps, besides its `src`. */
const DESCRIPTORS = ['font-family', 'font-style', 'font-weight', 'font-stretch', 'unicode-range'];

/**
 * A family name as it is matched: unquoted, lower case.
 *
 * @param {string} s The name, as CSS writes it.
 * @returns {string} The name to match on.
 */
export const familyKey = (s) => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase();

/**
 * Notes a piece of text's font against each family in its stack.
 *
 * @param {Map<string, FontUse[]>} uses The uses so far, by family; added to.
 * @param {{ fontStyle: string, fontWeight: string, fontFamily: string }} cs The text's computed style.
 * @param {string} text The text.
 */
export function noteUse(uses, cs, text) {
	if (!text.trim()) return;
	const style = cs.fontStyle === 'normal' ? 'normal' : 'italic';
	const weight = Number(cs.fontWeight) || 400;
	// both cases: text-transform may set it either way
	const chars = [...text, ...text.toUpperCase(), ...text.toLowerCase()].map((c) => /** @type {number} */ (c.codePointAt(0)));
	for (const family of cs.fontFamily.split(',').map(familyKey)) {
		const list = uses.get(family) ?? [];
		let use = list.find((x) => x.style === style);
		if (!use) list.push((use = { style, weights: new Set(), chars: new Set() }));
		use.weights.add(weight);
		for (const c of chars) use.chars.add(c);
		uses.set(family, list);
	}
}

/**
 * The fonts of every visible piece of text under `root`, pseudo-elements'
 * text too.
 *
 * @param {Element} root The element.
 * @returns {Map<string, FontUse[]>} The uses, by family.
 */
function textUses(root) {
	/** @type {Map<string, FontUse[]>} */
	const uses = new Map();
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const el = n.parentElement;
		if (el) noteUse(uses, getComputedStyle(el), n.textContent ?? '');
	}
	for (const el of [root, ...root.querySelectorAll('*')])
		for (const p of PSEUDOS) {
			const cs = getComputedStyle(el, p);
			const c = cs.content;
			if (c && c !== 'none' && c !== 'normal') noteUse(uses, cs, c.replace(/^["']|["']$/g, ''));
		}
	return uses;
}

/**
 * A `unicode-range` descriptor as code point ranges.
 *
 * @param {string} desc The descriptor (`U+0000-00FF, U+0131, U+02??`).
 * @returns {[number, number][]} Each range's first and last code point; all of Unicode when it is empty.
 */
export function unicodeRanges(desc) {
	if (!desc.trim()) return [[0, 0x10ffff]];
	return desc.split(',').map((part) => {
		const [a, b] = part.trim().replace(/^u\+/i, '').split('-');
		if (a.includes('?')) return [parseInt(a.replace(/\?/g, '0'), 16), parseInt(a.replace(/\?/g, 'f'), 16)];
		return [parseInt(a, 16), parseInt(b ?? a, 16)];
	});
}

/**
 * Whether any of the characters falls in the ranges.
 *
 * @param {Iterable<number>} chars Code points.
 * @param {[number, number][]} ranges From `unicodeRanges`.
 * @returns {boolean} Whether one does.
 */
export const coversAny = (chars, ranges) => [...chars].some((c) => ranges.some(([a, b]) => c >= a && c <= b));

/**
 * Whether a face serves any of the weights: a variable face's range, or a
 * static face at the weight asked for or the nearest the browser would
 * fall back to (within 100).
 *
 * @param {string} desc The face's `font-weight` descriptor (`400`, `100 900`).
 * @param {number[]} weights The weights the text is set in.
 * @returns {boolean} Whether it does (always, for a descriptor that is not a number).
 */
export function servesWeight(desc, weights) {
	const [lo, hi = lo] = desc.split(/\s+/).map(Number);
	return !Number.isFinite(lo) || weights.some((w) => w >= lo - 100 && w <= hi + 100);
}

/**
 * A face's file and format, from its `src` descriptor (the first with a
 * `format()`, else the first URL).
 *
 * @param {string} src The descriptor.
 * @returns {{ url: string, format: string } | null} The file's URL (as written) and format (`woff2` when unsaid), or null for none.
 */
export function fontSource(src) {
	const m = src.match(/url\((['"]?)([^'")]+)\1\)\s*format\((['"]?)([^'")]+)\3\)/) ?? src.match(/url\((['"]?)([^'")]+)\1\)/);
	return m ? { url: m[2], format: m[4] ?? 'woff2' } : null;
}

/**
 * A face's rule again, its file inlined.
 *
 * @param {{ getPropertyValue(name: string): string }} style The face rule's descriptors.
 * @param {string} data The file as a `data:` URL.
 * @param {string} format The file's format.
 * @returns {string} The `@font-face` rule.
 */
export function faceRule(style, data, format) {
	const desc = DESCRIPTORS.map((p) => [p, style.getPropertyValue(p)])
		.filter(([, v]) => v)
		.map(([p, v]) => `${p}:${v};`)
		.join('');
	return `@font-face{${desc}src:url("${data}") format("${format}");}`;
}

/**
 * Every `@font-face` rule the page can read: same-origin sheets, inside
 * `@media`, `@supports`, `@layer` and `@import` too.
 *
 * @returns {Generator<CSSFontFaceRule>} The rules.
 */
function* faceRules() {
	for (const sheet of document.styleSheets) {
		try {
			yield* faceRulesIn(sheet.cssRules);
		} catch {
			/* a cross-origin sheet */
		}
	}
}

/**
 * The `@font-face` rules in a list of rules, at any depth.
 *
 * @param {CSSRuleList} rules The rules.
 * @returns {Generator<CSSFontFaceRule>} The face rules.
 */
function* faceRulesIn(rules) {
	for (const r of rules) {
		if (r instanceof CSSFontFaceRule) yield r;
		else if (r instanceof CSSImportRule && r.styleSheet) {
			try {
				yield* faceRulesIn(r.styleSheet.cssRules);
			} catch {
				/* a cross-origin import */
			}
		} else if ('cssRules' in r) yield* faceRulesIn(/** @type {CSSGroupingRule} */ (r).cssRules);
	}
}

/**
 * The `@font-face` rules for the text under `root`, each file inlined (a
 * file that cannot be fetched is left out).
 *
 * @param {Element} root The element being exported.
 * @returns {Promise<string>} The rules, one a line.
 */
export async function fontFaceCss(root) {
	const want = textUses(root);
	/** @type {Promise<string>[]} */
	const jobs = [];
	for (const rule of faceRules()) {
		const list = want.get(familyKey(rule.style.getPropertyValue('font-family')));
		if (!list) continue;
		const style = /italic|oblique/.test(rule.style.getPropertyValue('font-style')) ? 'italic' : 'normal';
		const use = list.find((x) => x.style === style);
		if (!use) continue;
		if (!servesWeight(rule.style.getPropertyValue('font-weight'), [...use.weights])) continue;
		if (!coversAny(use.chars, unicodeRanges(rule.style.getPropertyValue('unicode-range')))) continue;
		const source = fontSource(rule.style.getPropertyValue('src'));
		if (!source) continue;
		const file = new URL(source.url, rule.parentStyleSheet?.href ?? location.href).href;
		jobs.push(toDataUrl(file).then((data) => faceRule(rule.style, data, source.format), () => ''));
	}
	return (await Promise.all(jobs)).join('\n');
}
