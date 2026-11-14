/**
 * @module @arraypress/effects-astro/export/styles
 *
 * An element's computed style as the few declarations that matter: those
 * that differ from the browser's own default for that element (read from
 * a blank, same-origin frame), and of the inherited ones only those that
 * differ from the parent's. Written inline on a copy, they rebuild the
 * element's look with no stylesheet at all, small enough to serialise
 * every frame of a recording.
 *
 * Resolved values only: custom properties, motion (animation, transition)
 * and interaction (cursor, pointer events) are left out, and so is a
 * path's `d` (its attribute already says it).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The pseudo-elements an export reads. */
export const PSEUDOS = /** @type {const} */ (['::before', '::after']);

/** Properties that inherit (CSS and SVG), so a child repeats them only where it differs from its parent. */
const INHERITED = new Set(
	(
		'border-collapse border-spacing caption-side color direction empty-cells font-family font-feature-settings font-kerning ' +
		'font-optical-sizing font-palette font-size font-size-adjust font-stretch font-style font-synthesis font-synthesis-weight ' +
		'font-synthesis-style font-synthesis-small-caps font-variant font-variant-alternates font-variant-caps font-variant-east-asian ' +
		'font-variant-ligatures font-variant-numeric font-variant-position font-variation-settings font-weight hyphens image-rendering ' +
		'letter-spacing line-break line-height list-style-image list-style-position list-style-type orphans overflow-wrap paint-order ' +
		'quotes ruby-position tab-size text-align text-align-last text-anchor text-decoration-skip-ink text-emphasis-color ' +
		'text-emphasis-position text-emphasis-style text-indent text-orientation text-rendering text-shadow text-size-adjust ' +
		'text-transform text-underline-offset text-underline-position text-wrap-mode text-wrap-style visibility white-space-collapse ' +
		'widows word-break word-spacing writing-mode -webkit-text-fill-color -webkit-text-stroke-color -webkit-text-stroke-width ' +
		'-webkit-font-smoothing -webkit-locale -webkit-text-security print-color-adjust -webkit-print-color-adjust -webkit-border-horizontal-spacing ' +
		'-webkit-border-vertical-spacing -webkit-text-emphasis-color -webkit-text-emphasis-position -webkit-text-emphasis-style ' +
		'-webkit-text-orientation -webkit-writing-mode -webkit-rtl-ordering -webkit-hyphenate-character -webkit-line-break ' +
		'-webkit-user-modify -webkit-tap-highlight-color clip-rule color-interpolation color-interpolation-filters color-rendering ' +
		'dominant-baseline fill fill-opacity fill-rule marker-start marker-mid marker-end shape-rendering stroke stroke-dasharray ' +
		'stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width math-depth math-style math-shift'
	).split(' '),
);

/** Left out: motion, interaction, and what an attribute already carries. */
const SKIP =
	/^(--|(min-|max-)?(block|inline)-size|(border|margin|padding|inset|overflow|contain-intrinsic|scroll-margin|scroll-padding)-(block|inline)|animation|transition|will-change|cursor|pointer-events|user-select|-webkit-user-(select|drag)|caret|scroll-|overscroll|touch-action|view-transition|content-visibility|interactivity|anchor-|position-anchor|position-try|container-name|timeline-|scroll-timeline|view-timeline|interest-)/;

/** The blank frame the defaults are read in. */
/** @type {HTMLIFrameElement | null} */
let frame = null;

/** The browser's defaults, by namespace, tag and pseudo-element. */
/** @type {Map<string, Map<string, string>>} */
const defaults = new Map();

/**
 * Whether a property is read at all.
 *
 * @param {string} name The property, in CSS's own spelling (`margin-top`).
 * @returns {boolean} Whether it is.
 */
export const kept = (name) => !SKIP.test(name) && name !== 'd';

/**
 * Whether a pseudo-element is drawn at all: it has content and is not
 * `display: none`.
 *
 * @param {{ content: string, display: string }} cs The pseudo-element's computed style.
 * @returns {boolean} Whether it is.
 */
export const pseudoShows = (cs) => !!cs.content && cs.content !== 'none' && cs.content !== 'normal' && cs.display !== 'none';

/**
 * The blank frame's document: made once, kept off screen, its
 * `about:blank` page an `html`, `head` and empty `body` with no styles of
 * the page's.
 *
 * @returns {Document} The document.
 */
function blank() {
	if (!frame?.isConnected) {
		frame = document.createElement('iframe');
		frame.setAttribute('aria-hidden', 'true');
		frame.tabIndex = -1;
		frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:10px;height:10px;border:0;visibility:hidden';
		document.body.append(frame);
	}
	return /** @type {Document} */ (frame.contentDocument);
}

/**
 * The browser's default computed style for an element like `el` (its tag
 * and namespace), or for its pseudo-element.
 *
 * @param {Element} el The element.
 * @param {string} [pseudo] `'::before'` or `'::after'`.
 * @returns {Map<string, string>} Each property's default value.
 */
function defaultsOf(el, pseudo) {
	const key = `${el.namespaceURI}|${el.localName}|${pseudo ?? ''}`;
	let map = defaults.get(key);
	if (map) return map;
	const doc = blank();
	const isSvg = el.namespaceURI === SVG_NS;
	const host = isSvg && el.localName !== 'svg' ? doc.createElementNS(SVG_NS, 'svg') : null;
	const probe = isSvg ? doc.createElementNS(SVG_NS, el.localName) : doc.createElement(el.localName);
	(host ?? doc.body).append(probe);
	if (host) doc.body.append(host);
	const cs = /** @type {Window} */ (doc.defaultView).getComputedStyle(probe, pseudo);
	map = new Map();
	for (let i = 0; i < cs.length; i++) map.set(cs[i], cs.getPropertyValue(cs[i]));
	(host ?? probe).remove();
	defaults.set(key, map);
	return map;
}

/**
 * The declarations that rebuild `el`'s look (or its pseudo-element's) on a
 * copy with no stylesheet.
 *
 * @param {Element} el The element.
 * @param {string} [pseudo] `'::before'` or `'::after'`, for a pseudo-element.
 * @param {CSSStyleDeclaration | null} [inheritsFrom] The computed style the copy inherits from (its parent's; the element's own for a pseudo-element); none for the copy's root, which inherits only the browser's defaults.
 * @returns {string} The declarations (`name:value;` each).
 */
export function declarations(el, pseudo, inheritsFrom) {
	const cs = getComputedStyle(el, pseudo);
	const base = defaultsOf(el, pseudo);
	const rootBase = defaultsOf(document.body); // what a root inherits: the blank page's body
	const plain = defaultsOf(document.createElement('span'), pseudo); // an element the browser gives no style of its own
	let out = '';
	for (let i = 0; i < cs.length; i++) {
		const name = cs[i];
		if (!kept(name)) continue;
		const v = cs.getPropertyValue(name);
		// an inherited property is left to inherit, unless the browser sets it on this element itself (<i>'s italic,
		// <b>'s weight): then it is written whenever it is not that default
		if (INHERITED.has(name) && base.get(name) === plain.get(name)) {
			const from = inheritsFrom ? inheritsFrom.getPropertyValue(name) : rootBase.get(name);
			if (v === from) continue;
		} else if (v === base.get(name)) continue;
		out += `${name}:${v};`;
	}
	return out;
}

/**
 * Removes the blank frame, when the page is done exporting for a while
 * (the defaults read in it are kept).
 */
export function releaseDefaults() {
	frame?.remove();
	frame = null;
}
