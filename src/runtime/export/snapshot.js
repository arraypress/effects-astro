/**
 * @module @arraypress/effects-astro/export/snapshot
 *
 * An element as a self-contained SVG: a copy of it, every computed style
 * written inline, its pseudo-elements as rules, its pictures and fonts
 * inlined, inside a `<foreignObject>`. Drawn to a canvas it is a
 * pixel-faithful picture of the element as the browser shows it (CSS
 * filters, blend modes, gradients, web fonts and all), at any scale.
 *
 * The copy stays live: after the page's animations are stepped (see
 * `clock`), `update()` rewrites only what they moved, so a recording can
 * draw frame after frame cheaply.
 */

import { declarations, pseudoShows, PSEUDOS } from './styles.js';
import { fontFaceCss } from './fonts.js';
import { hasOuterUrl, inlineCssUrls, toDataUrl } from './fetch.js';

const XHTML = 'http://www.w3.org/1999/xhtml';

/**
 * What moved between frames: an element (or its pseudo-element) and the
 * properties to read again.
 *
 * @typedef {object} Moved
 * @property {Element} el The element.
 * @property {string} [pseudo] `'::before'` or `'::after'`, for its pseudo-element.
 * @property {string[] | 'all'} props The properties; `'all'` reads the element and everything in it again (for a custom property others are computed from).
 */

/**
 * @typedef {object} Snapshot
 * @property {number} width The element's width, CSS px.
 * @property {number} height The element's height, CSS px.
 * @property {(scale?: number) => string} svg The SVG document, `scale` times the element's size (every vector and word sharp).
 * @property {(moved: Moved[]) => Promise<void>} update Reads the moved properties again from the page into the copy.
 * @property {(type?: string) => number} canvases Reads every kept canvas again into the copy, now (a `live` snapshot).
 */

/**
 * The copy and what is known about it, shared by the steps that write it.
 *
 * @typedef {object} Copy
 * @property {HTMLElement} el The element.
 * @property {HTMLElement} root The copy.
 * @property {number} width The element's width, CSS px.
 * @property {number} height The element's height, CSS px.
 * @property {boolean} square Whether the copy's corners are square.
 * @property {Map<Element, Element>} pairs Each element in the page and its copy.
 * @property {Map<Element, number>} ids Each element with a pseudo-element that shows, and its number.
 * @property {Map<string, string>} pseudoRules Each pseudo-element (`${n}::before`) and its declarations.
 * @property {Promise<unknown>[]} pending Pictures and URLs being inlined.
 * @property {boolean} live Whether every canvas is kept, blank ones too (`snapshot`'s `live`).
 * @property {[HTMLCanvasElement, Element][]} canvases Each canvas kept and the picture standing for it in the copy.
 */

/**
 * The inline style that sets the copy's root where the SVG wants it: in
 * place, at its size, untransformed, with no shadow.
 *
 * @param {number} width The element's width, CSS px.
 * @param {number} height The element's height, CSS px.
 * @param {boolean} square Whether to square its corners.
 * @returns {string} The declarations.
 */
export const rootStyle = (width, height, square) =>
	`margin:0;transform:none;translate:none;rotate:none;scale:none;box-shadow:none;position:relative;inset:auto;width:${width}px;height:${height}px;${square ? 'border-radius:0;' : ''}`;

/**
 * The pseudo-elements' rules, each on the class its element's copy carries.
 *
 * @param {Map<string, string>} rules Each pseudo-element (`${n}::before`) and its declarations.
 * @returns {string} The rules, one a line.
 */
export const pseudoCss = (rules) =>
	[...rules].map(([k, v]) => `.xs${k.replace(/::.*/, '')}${/** @type {RegExpMatchArray} */ (k.match(/::.*/))[0]}{${v}}`).join('\n');

/**
 * The SVG document round a serialised copy.
 *
 * @param {string} body The copy, serialised.
 * @param {number} width The element's width, CSS px.
 * @param {number} height The element's height, CSS px.
 * @param {number} scale The document's pixel size over the element's.
 * @returns {string} The SVG document.
 */
export const snapshotSvg = (body, width, height, scale) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width * scale)}" height="${Math.round(height * scale)}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="${width}" height="${height}">${body}</foreignObject></svg>`;

/**
 * Whether a canvas reads back blank, testing a few pixels: a WebGL canvas
 * that was not kept (no `preserveDrawingBuffer`) does outside the frame
 * it was drawn in, and one from another origin cannot be read at all.
 *
 * @param {HTMLCanvasElement} c The canvas.
 * @returns {boolean} Whether it is blank (or cannot be read).
 */
function blankCanvas(c) {
	try {
		const probe = document.createElement('canvas');
		probe.width = probe.height = 8;
		const ctx = /** @type {CanvasRenderingContext2D} */ (probe.getContext('2d', { willReadFrequently: true }));
		ctx.drawImage(c, 0, 0, 8, 8);
		const d = ctx.getImageData(0, 0, 8, 8).data;
		for (let i = 3; i < d.length; i += 4) if (d[i]) return false;
		return true;
	} catch {
		return true;
	}
}

/**
 * What each canvas shows, as a PNG `data:` URL, read inside an animation
 * frame after the page's own drawing in it, when a WebGL canvas that was
 * not kept still holds its picture. A blank canvas is left out.
 *
 * @param {HTMLCanvasElement[]} canvases The canvases.
 * @returns {Promise<Map<HTMLCanvasElement, string>>} Each canvas that shows something, and its picture.
 */
async function canvasShots(canvases) {
	/** @type {Map<HTMLCanvasElement, string>} */
	const shots = new Map();
	if (!canvases.length) return shots;
	await new Promise((done) =>
		requestAnimationFrame(() => {
			for (const cv of canvases) if (cv.width && cv.height && !blankCanvas(cv)) shots.set(cv, cv.toDataURL('image/png'));
			done(undefined);
		}),
	);
	return shots;
}

/**
 * Writes one element's styles, and its pseudo-elements', onto its copy.
 *
 * @param {Copy} copy The copy.
 * @param {Element} o The element in the page.
 */
function writeStyles(copy, o) {
	const c = /** @type {Element} */ (copy.pairs.get(o));
	const parent = o === copy.el ? null : o.parentElement && getComputedStyle(o.parentElement);
	let css = declarations(o, undefined, parent);
	if (o === copy.el) css += rootStyle(copy.width, copy.height, copy.square);
	if (hasOuterUrl(css)) copy.pending.push(inlineCssUrls(css).then((v) => c.setAttribute('style', v)));
	c.setAttribute('style', css);
	const own = getComputedStyle(o);
	for (const p of PSEUDOS) {
		if (!pseudoShows(getComputedStyle(o, p))) continue;
		if (!copy.ids.has(o)) copy.ids.set(o, copy.ids.size);
		const n = copy.ids.get(o);
		c.classList.add(`xs${n}`);
		const decl = declarations(o, p, own);
		copy.pseudoRules.set(`${n}${p}`, decl);
		if (hasOuterUrl(decl)) copy.pending.push(inlineCssUrls(decl).then((v) => copy.pseudoRules.set(`${n}${p}`, v)));
	}
}

/**
 * Makes a copied picture stand alone: an image's file inlined, a canvas
 * swapped for a picture of what it shows now (one that cannot be read
 * back is left out, and the element's own still background shows
 * instead), an SVG image's file inlined.
 *
 * @param {Copy} copy The copy.
 * @param {Element} o The element in the page.
 * @param {Map<HTMLCanvasElement, string>} shots What each canvas shows.
 */
function inlineMedia(copy, o, shots) {
	const c = /** @type {Element} */ (copy.pairs.get(o));
	if (o instanceof HTMLImageElement) {
		c.removeAttribute('srcset');
		c.removeAttribute('loading');
		const src = o.currentSrc || o.src;
		if (src) copy.pending.push(toDataUrl(src).then((d) => c.setAttribute('src', d), () => c.removeAttribute('src')));
	} else if (o instanceof HTMLCanvasElement) {
		const shot = shots.get(o);
		if (!shot && !copy.live) {
			c.remove();
			return;
		}
		const img = document.createElementNS(XHTML, 'img');
		img.setAttribute('style', c.getAttribute('style') ?? '');
		if (shot) img.setAttribute('src', shot);
		c.replaceWith(img);
		copy.pairs.set(o, img);
		copy.canvases.push([o, img]);
	} else if (o instanceof SVGImageElement) {
		const href = o.href.baseVal;
		if (href && !href.startsWith('data:')) copy.pending.push(toDataUrl(href).then((d) => c.setAttribute('href', d)));
	}
}

/**
 * Reads what moved again into the copy.
 *
 * @param {Copy} copy The copy.
 * @param {Moved} m What moved.
 */
function rewrite(copy, m) {
	const c = copy.pairs.get(m.el);
	if (!c) return;
	if (m.props === 'all') {
		for (const o of [m.el, ...m.el.querySelectorAll('*')]) if (copy.root.contains(copy.pairs.get(o) ?? null)) writeStyles(copy, o);
		return;
	}
	if (m.pseudo) {
		const n = copy.ids.get(m.el);
		if (n !== undefined) copy.pseudoRules.set(`${n}${m.pseudo}`, declarations(m.el, m.pseudo, getComputedStyle(m.el)));
		return;
	}
	const cs = getComputedStyle(m.el);
	const s = /** @type {HTMLElement | SVGElement} */ (c).style;
	for (const p of m.props) s.setProperty(p, cs.getPropertyValue(p));
}

/**
 * Snapshots an element.
 *
 * @param {HTMLElement} el The element (shown, laid out).
 * @param {{ square?: boolean, skip?: (el: Element) => boolean, live?: boolean }} [options] `square` corners whatever its border-radius (an export of a card, not of its frame; default true), elements to `skip`, and `live`: keep every canvas, blank ones too, for `canvases()` to read again each frame (a recording of live effects, export/field-video.js).
 * @returns {Promise<Snapshot>} The snapshot.
 */
export async function snapshot(el, { square = true, skip, live = false } = {}) {
	const root = /** @type {HTMLElement} */ (el.cloneNode(true));
	const all = [el, ...el.querySelectorAll('*')];
	const copies = [root, ...root.querySelectorAll('*')];
	/** @type {Copy} */
	const copy = {
		el,
		root,
		width: el.offsetWidth,
		height: el.offsetHeight,
		square,
		pairs: new Map(all.map((o, i) => [o, copies[i]])),
		ids: new Map(),
		pseudoRules: new Map(),
		pending: [],
		live,
		canvases: [],
	};
	const shots = await canvasShots([...el.querySelectorAll('canvas')]);
	for (const o of all) {
		const c = /** @type {Element} */ (copy.pairs.get(o));
		if (o !== el && (skip?.(o) || getComputedStyle(o).display === 'none')) {
			c.remove();
			continue;
		}
		if (!root.contains(c)) continue; // inside a removed one
		writeStyles(copy, o);
		inlineMedia(copy, o, shots);
	}
	const fonts = await fontFaceCss(el);
	await Promise.all(copy.pending);

	const style = document.createElementNS(XHTML, 'style');
	root.prepend(style);
	const serialiser = new XMLSerializer();
	return {
		width: copy.width,
		height: copy.height,
		/**
		 * The SVG document.
		 *
		 * @param {number} [scale] Its pixel size over the element's (2 draws it twice as big). Default 1.
		 * @returns {string} The document.
		 */
		svg(scale = 1) {
			style.textContent = `${fonts}\n${pseudoCss(copy.pseudoRules)}`;
			return snapshotSvg(serialiser.serializeToString(root), copy.width, copy.height, scale);
		},
		/**
		 * Reads the moved properties again from the page into the copy.
		 *
		 * @param {Moved[]} moved What moved (a clock's `moved()`).
		 * @returns {Promise<void>} Once any pictures they brought are inlined.
		 */
		async update(moved) {
			for (const m of moved) rewrite(copy, m);
			await Promise.all(copy.pending.splice(0));
		},
		/**
		 * Reads every canvas again into the copy, now: call it in the same task as the drawing (a WebGL canvas that
		 * isn't kept reads blank later). For a `live` snapshot of effects stepped by hand (loop.js `holdFrames`).
		 *
		 * @param {string} [type] The pictures' format; PNG keeps a canvas's transparency. Default PNG.
		 * @returns {number} How many it read.
		 */
		canvases(type = 'image/png') {
			let n = 0;
			for (const [cv, img] of copy.canvases) {
				if (!cv.width || !cv.height) continue;
				img.setAttribute('src', cv.toDataURL(type));
				n++;
			}
			return n;
		},
	};
}
