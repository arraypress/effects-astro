/**
 * @module @arraypress/effects-astro/export/svg-attrs
 *
 * An inline `<svg>` in the page as a plain SVG fragment: each element's
 * computed style written as presentation attributes (inherited ones only
 * where they change), a CSS transform baked into its `transform`, the
 * page's classes and data attributes dropped, and anything a `<use>`
 * points to elsewhere on the page brought along. What plain SVG cannot
 * say (a CSS filter or blend mode, a 3D transform) is listed as an issue.
 */

import { cssColor } from './probe.js';
import { cssNumber, matrixOf, round2 } from './format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';

/** Properties written where they differ from the parent's (they inherit). */
const INHERITED_ATTRS = [
	'fill',
	'fill-opacity',
	'fill-rule',
	'stroke',
	'stroke-width',
	'stroke-opacity',
	'stroke-linecap',
	'stroke-linejoin',
	'stroke-miterlimit',
	'stroke-dasharray',
	'stroke-dashoffset',
	'clip-rule',
	'paint-order',
	'font-family',
	'font-size',
	'font-weight',
	'font-style',
	'letter-spacing',
	'text-anchor',
	'dominant-baseline',
	'visibility',
	'shape-rendering',
	'color-interpolation-filters',
];

/** Properties written where they differ from SVG's initial value (they do not inherit). */
const OWN_ATTRS = ['opacity', 'stop-color', 'stop-opacity', 'flood-color', 'flood-opacity', 'lighting-color', 'clip-path', 'mask', 'filter', 'vector-effect'];

/** SVG's initial values, what the nested root is compared with. */
/** @type {Record<string, string>} */
const INITIAL = {
	fill: '#000000',
	'fill-opacity': '1',
	'fill-rule': 'nonzero',
	stroke: 'none',
	'stroke-width': '1',
	'stroke-opacity': '1',
	'stroke-linecap': 'butt',
	'stroke-linejoin': 'miter',
	'stroke-miterlimit': '4',
	'stroke-dasharray': 'none',
	'stroke-dashoffset': '0',
	'clip-rule': 'nonzero',
	'paint-order': 'normal',
	'letter-spacing': 'normal',
	'text-anchor': 'start',
	'dominant-baseline': 'auto',
	visibility: 'visible',
	'shape-rendering': 'auto',
	'color-interpolation-filters': 'linearRGB',
	opacity: '1',
	'stop-color': '#000000',
	'stop-opacity': '1',
	'flood-color': '#000000',
	'flood-opacity': '1',
	'lighting-color': '#ffffff',
	'clip-path': 'none',
	mask: 'none',
	filter: 'none',
	'vector-effect': 'none',
};

/** Properties that take a paint (a colour or a `url()`). */
const PAINTS = new Set(['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color']);

/** Where a paint's alpha goes. */
/** @type {Record<string, string>} */
const ALPHA_OF = { fill: 'fill-opacity', stroke: 'stroke-opacity', 'stop-color': 'stop-opacity', 'flood-color': 'flood-opacity' };

/** Shapes whose geometry a stylesheet can set. */
const SHAPES = ['rect', 'circle', 'ellipse'];

/** The geometry properties read back from them. */
const GEOMETRY = ['x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height'];

/**
 * A computed value as an attribute's: px dropped, `url("#a")` as
 * `url(#a)`, a colour as hex (its alpha noted in `alpha`).
 *
 * @param {string} name The property.
 * @param {string} v Its computed value.
 * @param {Map<string, number>} alpha Collects each paint's alpha, by the opacity attribute it goes into.
 * @returns {string} The attribute's value.
 */
export function attrValue(name, v, alpha) {
	if (PAINTS.has(name)) {
		if (v === 'none') return 'none';
		if (v.startsWith('url(')) return v.replace(/url\("?([^")]+)"?\)(.*)/, 'url($1)');
		const c = cssColor(v);
		if (!c) return 'none';
		if (c.a < 1 && ALPHA_OF[name]) alpha.set(ALPHA_OF[name], c.a);
		return c.hex;
	}
	if (['clip-path', 'mask', 'filter'].includes(name)) return v === 'none' ? 'none' : v.replace(/url\("?([^")]+)"?\)/, 'url($1)');
	if (name === 'stroke-dasharray') return v === 'none' ? 'none' : v.replace(/px/g, '').replace(/,\s*/g, ' ');
	if (name === 'font-family') return v.replace(/"/g, "'");
	return v.replace(/(\d)px\b/g, '$1');
}

/**
 * A CSS transform about its origin, as an SVG `transform` attribute
 * (about the user space's 0, 0).
 *
 * @param {number[]} m The computed `matrix()`'s six numbers.
 * @param {number} ox The transform origin's x.
 * @param {number} oy The transform origin's y.
 * @returns {string} The attribute's `matrix(…)`.
 */
export function aboutOrigin([a, b, c, d, e, f], ox, oy) {
	const tx = e + ox - a * ox - c * oy,
		ty = f + oy - b * ox - d * oy;
	return `matrix(${[a, b, c, d, tx, ty].map(round2).join(' ')})`;
}

/**
 * Removes the page's own attributes from a copied element: its class,
 * style and data attributes, and its ARIA ones when asked.
 *
 * @param {Element} e The copy.
 * @param {boolean} aria Whether to remove `aria-` attributes too.
 */
function stripPageAttrs(e, aria) {
	for (const a of [...e.attributes]) if (a.name === 'class' || a.name === 'style' || a.name.startsWith('data-') || (aria && a.name.startsWith('aria-'))) e.removeAttribute(a.name);
}

/**
 * Geometry a stylesheet set on a shape (a circle's `r`, a rect's size),
 * where it differs from the attribute.
 *
 * @param {SVGElement} o The element in the page.
 * @param {CSSStyleDeclaration} cs Its computed style.
 * @param {Map<string, string>} set Collects the attributes to write.
 */
function shapeGeometry(o, cs, set) {
	if (!SHAPES.includes(o.localName)) return;
	for (const g of GEOMETRY) {
		const v = cs.getPropertyValue(g);
		if (v && v !== 'auto' && /px$/.test(v) && cssNumber(o.getAttribute(g) ?? 'NaN') !== cssNumber(v)) set.set(g, round2(cssNumber(v)));
	}
}

/**
 * A CSS transform on an element, baked about its origin into the
 * attribute (a 3D one is an issue).
 *
 * @param {SVGElement} o The element in the page.
 * @param {CSSStyleDeclaration} cs Its computed style.
 * @param {Map<string, string>} set Collects the attributes to write.
 * @param {string[]} issues Collects what cannot be said in plain SVG.
 */
function bakedTransform(o, cs, set, issues) {
	const t = cs.transform;
	if (!t || t === 'none') return;
	const m = matrixOf(t);
	if (!m) {
		issues.push('a 3D transform on the artwork');
		return;
	}
	let [ox, oy] = cs.transformOrigin.split(' ').map(cssNumber);
	if (cs.transformBox === 'fill-box' && o instanceof SVGGraphicsElement) {
		const bb = o.getBBox();
		ox += bb.x;
		oy += bb.y;
	}
	set.set('transform', aboutOrigin(m, ox, oy));
}

/**
 * One SVG element's computed style as attributes on its copy.
 *
 * @param {SVGElement} o The element in the page.
 * @param {SVGElement} c Its copy.
 * @param {CSSStyleDeclaration | null} parent The parent's computed style; null for the nested root.
 * @param {string[]} issues Collects what cannot be said in plain SVG.
 */
function svgAttrs(o, c, parent, issues) {
	const cs = getComputedStyle(o);
	/** @type {Map<string, number>} */
	const alpha = new Map();
	/** @type {Map<string, string>} */
	const set = new Map();
	for (const name of INHERITED_ATTRS) {
		const v = cs.getPropertyValue(name);
		if (parent && v === parent.getPropertyValue(name)) continue;
		const a = attrValue(name, v, alpha);
		// the nested root says its paint whatever it is (its own fill="currentColor" means nothing out of the page)
		if (parent || a !== INITIAL[name] || name === 'fill' || name === 'stroke') set.set(name, a);
	}
	for (const name of OWN_ATTRS) {
		const v = cs.getPropertyValue(name);
		if (name === 'filter' && v !== 'none' && !/^url\(/.test(v)) issues.push('a CSS filter on the artwork');
		const a = attrValue(name, v, alpha);
		if (a !== INITIAL[name]) set.set(name, a);
	}
	for (const [k, a] of alpha) set.set(k, round2(a * cssNumber(set.get(k) ?? cs.getPropertyValue(k) ?? '1')));
	if (cs.mixBlendMode !== 'normal') issues.push('a blend mode on the artwork');
	if (cs.display === 'none') set.set('display', 'none');
	shapeGeometry(o, cs, set);
	bakedTransform(o, cs, set, issues);
	stripPageAttrs(c, true);
	for (const [k, v] of set) c.setAttribute(k, v);
	const href = c.localName === 'use' && c.getAttribute('href');
	if (href) c.setAttributeNS(XLINK, 'xlink:href', href);
}

/**
 * A copy of whatever the `<use>`s in a copied SVG point to elsewhere on
 * the page (a card's one copy of its mark, drawn in a sprite), so the
 * fragment stands alone.
 *
 * @param {SVGSVGElement} c The copied SVG.
 * @returns {SVGDefsElement | null} A `<defs>` holding the copies, or null when nothing is missing.
 */
function missingDefs(c) {
	const missing = [...c.querySelectorAll('use')]
		.map((u) => (u.getAttribute('href') ?? u.getAttribute('xlink:href') ?? '').slice(1))
		.filter((id) => id && !c.querySelector(`[id="${CSS.escape(id)}"]`));
	if (!missing.length) return null;
	const defs = /** @type {SVGDefsElement} */ (document.createElementNS(SVG_NS, 'defs'));
	for (const id of new Set(missing)) {
		const target = document.getElementById(id);
		if (!target) continue;
		const copy = /** @type {Element} */ (target.cloneNode(true));
		for (const e of [copy, ...copy.querySelectorAll('*')]) stripPageAttrs(e, false);
		defs.append(copy);
	}
	return defs;
}

/**
 * An inline `<svg>` in the page, as a nested `<svg>` placed where it shows.
 *
 * @param {SVGSVGElement} o The SVG in the page.
 * @param {DOMRect} box Its box.
 * @param {DOMRect} origin The exported element's box (positions are measured from it).
 * @param {string[]} issues Collects what cannot be said in plain SVG.
 * @returns {string} The nested `<svg>`, serialised.
 */
export function inlineSvg(o, box, origin, issues) {
	const c = /** @type {SVGSVGElement} */ (o.cloneNode(true));
	const os = [o, ...o.querySelectorAll('*')];
	const cs = [c, ...c.querySelectorAll('*')];
	os.forEach((e, i) => svgAttrs(/** @type {SVGElement} */ (e), /** @type {SVGElement} */ (cs[i]), e === o ? null : getComputedStyle(e.parentElement ?? o), issues));
	const defs = missingDefs(c);
	if (defs) c.prepend(defs);
	c.removeAttribute('transform'); // the outer box's transform is in its rect
	c.removeAttribute('opacity'); // and its opacity on the group round it
	c.setAttribute('x', round2(box.left - origin.left));
	c.setAttribute('y', round2(box.top - origin.top));
	c.setAttribute('width', round2(box.width));
	c.setAttribute('height', round2(box.height));
	if (!c.getAttribute('viewBox')) c.setAttribute('viewBox', `0 0 ${round2(o.clientWidth || box.width)} ${round2(o.clientHeight || box.height)}`);
	if (getComputedStyle(o).overflow === 'visible') c.setAttribute('overflow', 'visible');
	return new XMLSerializer().serializeToString(c).replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, '');
}
