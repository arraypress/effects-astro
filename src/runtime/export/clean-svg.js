/**
 * @module @arraypress/effects-astro/export/clean-svg
 *
 * An element rebuilt as a plain SVG: real `<rect>`, `<image>` and
 * `<text>` elements (and its own inline SVGs, their styles written as
 * attributes), so it opens and edits in a design tool, not only in a
 * browser. Its web fonts go in as `@font-face` rules (inlined), so
 * browsers set the words exactly; a design tool uses the face if it is
 * installed.
 *
 * Only what plain SVG can say faithfully is rebuilt: flat colour boxes
 * (rounded or not, with a plain border), pictures (cover, contain or
 * fill), inline SVG, and text. Anything else (a CSS filter or blend, a
 * gradient or image background, a shadow, a clip, a rotated box, a
 * pseudo-element that paints) is listed by `cleanIssues()`, and
 * `cleanSvg()` refuses: an export that came out different from the
 * element would be worse than none.
 */

import { fontFaceCss } from './fonts.js';
import { toDataUrl } from './fetch.js';
import { cssColor } from './probe.js';
import { cssNumber, escapeXml, matrixOf, round2 } from './format.js';
import { pseudoShows, PSEUDOS } from './styles.js';
import { inlineSvg } from './svg-attrs.js';
import { textLines } from './svg-text.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';

/** @typedef {{ w: number, c: string, st: string }} Side A border side: its width, colour and style. */

/**
 * Whether a computed transform is a translate and scale only (no rotation
 * or skew).
 *
 * @param {string} t The computed `transform`.
 * @returns {boolean} Whether it is.
 */
export function plainTransform(t) {
	if (t === 'none') return true;
	const m = matrixOf(t);
	if (!m) return false;
	const [, b, c] = m;
	return Math.abs(b) < 1e-6 && Math.abs(c) < 1e-6;
}

/**
 * An element as an issue's message names it: its tag and first two
 * classes.
 *
 * @param {Element} el The element.
 * @returns {string} Its name (`div.card.wide`).
 */
export const describe = (el) => `${el.localName}${el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : ''}`;

/**
 * Markup faded to an opacity, in a group (as it is when it is opaque).
 *
 * @param {string} markup The markup.
 * @param {number} opacity Its opacity, 0–1.
 * @returns {string} The markup, grouped when it is faded and not empty.
 */
export const faded = (markup, opacity) => (opacity < 1 && markup ? `<g opacity="${round2(opacity)}">${markup}</g>` : markup);

/**
 * A box's position and size as attributes.
 *
 * @param {number} x Left.
 * @param {number} y Top.
 * @param {number} w Width.
 * @param {number} h Height.
 * @returns {string} `x`, `y`, `width` and `height`.
 */
const boxAttrs = (x, y, w, h) => `x="${round2(x)}" y="${round2(y)}" width="${round2(w)}" height="${round2(h)}"`;

/**
 * A paint attribute and, for a translucent colour, its opacity.
 *
 * @param {string} c The colour (one `cssColor` reads).
 * @param {string} attr `fill` or `stroke`.
 * @returns {string} The attributes.
 */
function paintAttr(c, attr) {
	const k = /** @type {{ hex: string, a: number }} */ (cssColor(c));
	return `${attr}="${k.hex}"${k.a < 1 ? ` ${attr}-opacity="${round2(k.a)}"` : ''}`;
}

/**
 * An element's four border sides, top, right, bottom and left.
 *
 * @param {CSSStyleDeclaration} cs Its computed style.
 * @returns {Side[]} The sides.
 */
const borderSides = (cs) =>
	['top', 'right', 'bottom', 'left'].map((s) => ({ w: cssNumber(cs.getPropertyValue(`border-${s}-width`)), c: cs.getPropertyValue(`border-${s}-color`), st: cs.getPropertyValue(`border-${s}-style`) }));

/**
 * Whether a border side is drawn at all.
 *
 * @param {Side} s The side.
 * @returns {boolean} Whether it is.
 */
const drawnSide = (s) => s.w > 0 && s.st !== 'none' && !!cssColor(s.c);

/**
 * Whether a pseudo-element paints something.
 *
 * @param {Element} el The element.
 * @param {string} p `'::before'` or `'::after'`.
 * @returns {boolean} Whether it does.
 */
function paints(el, p) {
	const cs = getComputedStyle(el, p);
	if (!pseudoShows(cs)) return false;
	if (cssNumber(cs.opacity) === 0 || cs.visibility === 'hidden') return false;
	if (cssColor(cs.backgroundColor) || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none') return true;
	if (borderSides(cs).some((s) => s.w > 0 && s.st !== 'none')) return true;
	return cs.content.replace(/^["']|["']$/g, '').trim() !== '';
}

/**
 * What stops an element's own box being rebuilt: its filters, blends,
 * clips, image backgrounds, shadows, rotations and painting
 * pseudo-elements.
 *
 * @param {Element} el The element.
 * @param {CSSStyleDeclaration} cs Its computed style.
 * @param {string[]} issues Collects them.
 * @param {boolean} root Whether it is the root (its shadow and transform are the frame's, not the art's).
 */
function boxIssues(el, cs, issues, root) {
	const name = describe(el);
	if (cs.filter !== 'none') issues.push(`a filter on ${name}`);
	if (cs.backdropFilter && cs.backdropFilter !== 'none') issues.push(`a backdrop filter on ${name}`);
	if (cs.mixBlendMode !== 'normal') issues.push(`a blend mode on ${name}`);
	if (cs.clipPath !== 'none' || cs.maskImage !== 'none') issues.push(`a clip on ${name}`);
	if (cs.backgroundImage !== 'none') issues.push(`an image or gradient background on ${name}`);
	if (!root && cs.boxShadow !== 'none') issues.push(`a shadow on ${name}`);
	if (!root && !plainTransform(cs.transform)) issues.push(`a rotated ${name}`);
	if (!root && (cs.rotate !== 'none' || cs.transform.startsWith('matrix3d'))) issues.push(`a rotated ${name}`);
	for (const p of PSEUDOS) if (paints(el, p)) issues.push(`a ${p.slice(2)} on ${name}`);
}

/**
 * An inline `<svg>` in the page, with what stops it being rebuilt.
 *
 * @param {SVGSVGElement} el The SVG.
 * @param {CSSStyleDeclaration} cs Its computed style.
 * @param {DOMRect} box Its box.
 * @param {DOMRect} origin The root's box.
 * @param {string[]} issues Collects what cannot be rebuilt.
 * @param {boolean} root Whether it is the root.
 * @returns {string} The nested `<svg>`.
 */
function nestedSvg(el, cs, box, origin, issues, root) {
	const name = describe(el);
	if (!root && !plainTransform(cs.transform)) issues.push(`a rotated ${name}`);
	if (cs.filter !== 'none') issues.push(`a filter on ${name}`);
	if (cs.mixBlendMode !== 'normal') issues.push(`a blend mode on ${name}`);
	if (cs.clipPath !== 'none' || cs.maskImage !== 'none') issues.push(`a clip on ${name}`);
	return inlineSvg(el, box, origin, issues);
}

/**
 * A box's paint: a flat colour, rounded alike at every corner, and a
 * plain border (all four sides alike as a stroke, or some sides only as
 * strips).
 *
 * @param {Element} el The element.
 * @param {CSSStyleDeclaration} cs Its computed style.
 * @param {DOMRect} box Its box.
 * @param {number} x Its left, from the root's.
 * @param {number} y Its top, from the root's.
 * @param {string[]} issues Collects what cannot be rebuilt.
 * @param {boolean} root Whether it is the root (whose corners are the frame's).
 * @returns {string} The rects.
 */
function boxPaint(el, cs, box, x, y, issues, root) {
	const name = describe(el);
	let out = '';
	const radii = root ? [0] : [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(cssNumber);
	if (radii.some((r) => r !== radii[0]) || (!root && /%|\s/.test(cs.borderTopLeftRadius.trim()) && cssNumber(cs.borderTopLeftRadius) > 0)) issues.push(`uneven rounded corners on ${name}`);
	const rx = radii[0] ? ` rx="${round2(Math.min(radii[0], box.width / 2, box.height / 2))}"` : '';
	if (cssColor(cs.backgroundColor)) out += `<rect ${boxAttrs(x, y, box.width, box.height)}${rx} ${paintAttr(cs.backgroundColor, 'fill')} />`;
	const sides = borderSides(cs);
	const drawn = sides.filter(drawnSide);
	if (drawn.some((d) => d.st !== 'solid')) issues.push(`a dashed or styled border on ${name}`);
	const even = drawn.length === 4 && drawn.every((d) => d.w === drawn[0].w && d.c === drawn[0].c);
	if (even) {
		const s = drawn[0];
		return out + `<rect ${boxAttrs(x + s.w / 2, y + s.w / 2, box.width - s.w, box.height - s.w)}${rx} fill="none" ${paintAttr(s.c, 'stroke')} stroke-width="${round2(s.w)}" />`;
	}
	if (!drawn.length) return out;
	// a rule on some sides only (a title block's lines): each side a filled strip
	if (radii[0]) issues.push(`a part border on rounded ${name}`);
	const [t, r, b, l] = sides;
	/**
	 * One side as a filled strip, if it is drawn.
	 *
	 * @param {Side} side The side.
	 * @param {number} sx Left.
	 * @param {number} sy Top.
	 * @param {number} sw Width.
	 * @param {number} sh Height.
	 * @returns {string} The rect, or nothing.
	 */
	const strip = (side, sx, sy, sw, sh) => (drawnSide(side) ? `<rect ${boxAttrs(sx, sy, sw, sh)} ${paintAttr(side.c, 'fill')} />` : '');
	return out + strip(t, x, y, box.width, t.w) + strip(b, x, y + box.height - b.w, box.width, b.w) + strip(l, x, y, l.w, box.height) + strip(r, x + box.width - r.w, y, r.w, box.height);
}

/**
 * A picture, fitted as the page fits it (cover, contain or fill; centred).
 * Its file is fetched later (`inlinePictures`), so it is written with a
 * `data-src`.
 *
 * @param {HTMLImageElement} el The picture.
 * @param {CSSStyleDeclaration} cs Its computed style.
 * @param {DOMRect} box Its box.
 * @param {number} x Its left, from the root's.
 * @param {number} y Its top, from the root's.
 * @param {string[]} issues Collects what cannot be rebuilt.
 * @returns {string} An `<svg>` holding its `<image>`.
 */
function picture(el, cs, box, x, y, issues) {
	const fit = cs.objectFit;
	if (cs.objectPosition !== '50% 50%') issues.push('an off-centre picture');
	const par = fit === 'cover' ? 'xMidYMid slice' : fit === 'contain' ? 'xMidYMid meet' : fit === 'none' || fit === 'scale-down' ? null : 'none';
	if (!par) issues.push('a picture set at its own size');
	return `<svg ${boxAttrs(x, y, box.width, box.height)}><image data-src="${escapeXml(el.currentSrc || el.src)}" width="100%" height="100%" preserveAspectRatio="${par ?? 'none'}" /></svg>`;
}

/**
 * An element's own words (its text nodes, not its children's), with what
 * stops them being rebuilt.
 *
 * @param {Element} el The element.
 * @param {CSSStyleDeclaration} cs Its computed style.
 * @param {DOMRect} origin The root's box.
 * @param {number} opacity Its opacity.
 * @param {string[]} issues Collects what cannot be rebuilt.
 * @returns {string} The `<text>` elements.
 */
function ownText(el, cs, origin, opacity, issues) {
	const name = describe(el);
	let out = '';
	for (const n of el.childNodes) {
		if (!(n instanceof Text) || !n.data.trim()) continue;
		if (cs.textShadow !== 'none') issues.push(`a text shadow on ${name}`);
		if (cssNumber(cs.getPropertyValue('-webkit-text-stroke-width')) > 0) issues.push(`outlined text on ${name}`);
		if (cs.backgroundClip === 'text' || cs.getPropertyValue('-webkit-background-clip') === 'text') issues.push(`text filled with a picture on ${name}`);
		const box = /** @type {HTMLElement} */ (el);
		if (cs.textOverflow === 'ellipsis' && box.scrollWidth > box.clientWidth + 1) issues.push(`cut-off text on ${name}`);
		out += textLines(n, cs, origin, opacity);
	}
	return out;
}

/**
 * An element's children in paint order (z-index, else document order).
 * A child under its parent's own background can be drawn only when the
 * parent is a stacking context.
 *
 * @param {Element} el The element.
 * @param {CSSStyleDeclaration} cs Its computed style.
 * @param {DOMRect} origin The root's box.
 * @param {number} opacity Its opacity.
 * @param {string[]} issues Collects what cannot be rebuilt.
 * @param {boolean} root Whether it is the root.
 * @returns {string} The children's SVG.
 */
function children(el, cs, origin, opacity, issues, root) {
	const kids = [...el.children]
		.filter((k) => getComputedStyle(k).display !== 'none')
		.map((k, i) => ({ k, i, z: getComputedStyle(k).position !== 'static' ? parseInt(getComputedStyle(k).zIndex) || 0 : 0 }));
	const context = root || cs.isolation === 'isolate' || (cs.position !== 'static' && cs.zIndex !== 'auto') || opacity < 1 || cs.transform !== 'none';
	if (!context && kids.some((k) => k.z < 0)) issues.push(`a layer behind ${describe(el)}`);
	kids.sort((a, b) => a.z - b.z || a.i - b.i);
	return kids.map(({ k }) => walk(k, origin, issues)).join('');
}

/**
 * Walks an element: its paint as SVG, and what cannot be said in plain SVG.
 *
 * @param {Element} el The element.
 * @param {DOMRect} origin The root's box (positions are measured from it).
 * @param {string[]} issues Collects what cannot be rebuilt.
 * @param {boolean} [root] Whether it is the root (its shadow, radius and transform are the frame's, not the art's).
 * @returns {string} Its SVG.
 */
function walk(el, origin, issues, root = false) {
	const cs = getComputedStyle(el);
	if (cs.display === 'none' || cs.visibility === 'hidden') return '';
	const opacity = cssNumber(cs.opacity);
	if (opacity === 0) return '';
	const box = el.getBoundingClientRect();
	if (el instanceof SVGSVGElement) return faded(nestedSvg(el, cs, box, origin, issues, root), opacity);
	if (el instanceof SVGElement) return ''; // (inside an inline svg: drawn with it)
	boxIssues(el, cs, issues, root);
	const x = box.left - origin.left,
		y = box.top - origin.top;
	let out = boxPaint(el, cs, box, x, y, issues, root);
	if (el instanceof HTMLImageElement) out += picture(el, cs, box, x, y, issues);
	let inner = ownText(el, cs, origin, opacity, issues) + children(el, cs, origin, opacity, issues, root);
	// clipped to its box, when it clips and is not the root (whose box is the whole picture)
	if (!root && cs.overflow !== 'visible' && inner) inner = `<svg ${boxAttrs(x, y, box.width, box.height)} viewBox="${round2(x)} ${round2(y)} ${round2(box.width)} ${round2(box.height)}">${inner}</svg>`;
	out += inner;
	return faded(out, opacity);
}

/**
 * Swaps each picture's `data-src` for an `href` to its file as a `data:`
 * URL, so the SVG stands alone (a file that cannot be fetched is left
 * empty).
 *
 * @param {string} body The SVG's markup.
 * @returns {Promise<string>} The markup, its pictures inlined.
 */
export async function inlinePictures(body) {
	/**
	 * A `data-src` attribute's URL, unescaped.
	 *
	 * @param {string} s The attribute's text.
	 * @returns {string} The URL.
	 */
	const unescape = (s) => s.replace(/&amp;/g, '&');
	const srcs = [...body.matchAll(/data-src="([^"]+)"/g)].map((m) => unescape(m[1]));
	const data = new Map(await Promise.all(srcs.map(async (s) => /** @type {const} */ ([s, await toDataUrl(s).catch(() => '')]))));
	return body.replace(/data-src="([^"]+)"/g, (_, s) => `href="${data.get(unescape(s)) ?? ''}"`);
}

/**
 * What stops an element being rebuilt faithfully as plain SVG.
 *
 * @param {HTMLElement} el The element, shown and laid out.
 * @returns {string[]} The issues, each once; empty when it can be.
 */
export function cleanIssues(el) {
	/** @type {string[]} */
	const issues = [];
	walk(el, el.getBoundingClientRect(), issues, true);
	return [...new Set(issues)];
}

/**
 * The element as a plain SVG document.
 *
 * @param {HTMLElement} el The element, shown and laid out.
 * @param {number} [long] The SVG's width or height, whichever is longer, px (its viewBox stays the element's CSS size). Default 1080.
 * @returns {Promise<string>} The SVG document.
 * @throws {Error} Listing why, when it cannot be rebuilt faithfully (see `cleanIssues`).
 */
export async function cleanSvg(el, long = 1080) {
	/** @type {string[]} */
	const issues = [];
	const body = walk(el, el.getBoundingClientRect(), issues, true);
	if (issues.length) throw new Error(`export: not plain SVG: ${[...new Set(issues)].join('; ')}`);
	const w = el.offsetWidth,
		h = el.offsetHeight;
	const k = long / Math.max(w, h);
	const fonts = await fontFaceCss(el);
	const art = await inlinePictures(body);
	return (
		`<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK}" width="${Math.round(w * k)}" height="${Math.round(h * k)}" viewBox="0 0 ${w} ${h}">` +
		(fonts ? `<defs><style>${fonts}</style></defs>` : '') +
		`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${art}</svg></svg>`
	);
}
