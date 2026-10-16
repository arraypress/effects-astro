/**
 * @module @arraypress/effects-astro/liquid-glass
 *
 * Real refraction for `.glass` panels (glass.css): the live page behind a
 * panel is bent as if through a thick lens, hardest at the rim, with the
 * colours splitting there and a bright highlight along the edge. Text
 * behind stays live and links stay clickable, since nothing is copied: an
 * SVG filter reaches the page through `backdrop-filter: url(#…)`.
 *
 * Each panel's filter is built from its lens map (lens-map.js) for its
 * size and corner radius: `feImage` holds the map, `feDisplacementMap`
 * bends the backdrop by it (three times, at slightly different strengths,
 * for red, green and blue, when there is dispersion), and the map's blue
 * channel lays the rim's highlight over the result. Panels of the same
 * shape share a filter; one hidden `<svg>` holds them all. A panel's
 * filter is remade only when its size or radius changes (ResizeObserver,
 * and a watch on its `style` and `class`), so nothing runs per frame.
 *
 * Only Chromium draws an SVG filter in `backdrop-filter`. Safari and
 * Firefox parse it and draw nothing, and no script can read back what a
 * backdrop filter drew, so the check is that `backdrop-filter: url()`
 * parses and the engine is neither WebKit (which takes
 * `-webkit-backdrop-filter`) nor Gecko (`-moz-appearance`). Elsewhere the
 * panel keeps glass.css's frost, tint, rim and sheen, untouched. Every
 * filter is drawn at 1× and has an id of its own per shape, which also
 * suits WebKit (it caches filters by id) should it come to draw them.
 *
 * The technique is adapted from Sam Asante's liquid-glass
 * (https://github.com/samasante/liquid-glass, MIT, © 2026 Sam Asante):
 * an SDF displacement map with a specular channel, fed to
 * `feDisplacementMap` through `backdrop-filter`, with a three-pass RGB
 * split for dispersion. This is our own code.
 */

import { lensMap } from './lens-map.js';
import { mount } from './mount.js';

/**
 * @typedef {import('./liquid-glass.js').LiquidGlassOptions} LiquidGlassOptions
 * @typedef {import('./liquid-glass.js').LensSettings} LensSettings
 * @typedef {Extract<import('./liquid-glass.js').LensStep, { kind: 'bend' }>} BendStep
 * @typedef {Extract<import('./liquid-glass.js').LensStep, { kind: 'shine' }>} ShineStep
 */

/** The settings a lens takes when neither its options nor its CSS give one. */
export const LENS_DEFAULTS = Object.freeze({ refract: 1, dispersion: 0.35, bezel: 28, specular: 0.7 });
/** The CSS custom property each setting is read from. */
const PROPERTIES = /** @type {const} */ ({ refract: '--glass-refract', dispersion: '--glass-dispersion', bezel: '--glass-bezel', specular: '--glass-specular' });
/** The furthest the rim moves what is behind it at strength 1, as a share of the bezel. */
const REACH = 1;
/** How far apart red and blue bend at full dispersion, as a share of the bend. */
const SPREAD = 0.3;
/** How many lens maps are kept for shapes no panel has now (a panel resized back and forth). */
const KEEP = 12;
const SVG = 'http://www.w3.org/2000/svg';
/** The custom properties in a panel's style that never change its lens: the sheen's place (glass-sheen.js) and the lens itself. */
const OWN = /--glass-(?:x|y|lens):[^;]*;?/g;

/** @type {boolean | undefined} */
let supported;
/** @type {SVGDefsElement | undefined} */
let defs;
let serial = 0;
/** The filters on the page, by shape and settings: each with its element and how many panels use it. */
/** @type {Map<string, { id: string, node: SVGFilterElement, users: number }>} */
const filters = new Map();
/** Lens maps as data URLs, by shape, the most recently used last. */
/** @type {Map<string, string>} */
const maps = new Map();

/**
 * Whether this browser draws SVG filters in `backdrop-filter` (Chromium).
 * Worked out once.
 *
 * @returns {boolean} True where refraction can be drawn.
 */
export function lensSupported() {
	if (supported !== undefined) return supported;
	const css = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' ? CSS : null;
	supported = Boolean(css && css.supports('backdrop-filter', 'url(#a)') && !css.supports('-webkit-backdrop-filter', 'none') && !css.supports('-moz-appearance', 'none'));
	return supported;
}

/**
 * Reads a setting's value: a number, `true` (1), `false` or `none` (0).
 *
 * @param {unknown} value The value given (an option, or a custom property's text).
 * @returns {number | undefined} The number, or undefined when there is none.
 */
export function lensValue(value) {
	if (value === undefined || value === null) return undefined;
	if (typeof value === 'boolean') return value ? 1 : 0;
	const text = String(value).trim();
	if (!text) return undefined;
	if (text === 'true') return 1;
	if (text === 'false' || text === 'none') return 0;
	const n = Number.parseFloat(text);
	return Number.isFinite(n) ? n : undefined;
}

/**
 * Works out a lens's settings: each from its option, else its custom
 * property, else the default, clamped to its range.
 *
 * @param {LiquidGlassOptions} options The options given.
 * @param {(property: string) => string} read Reads a custom property's text.
 * @param {number} [unset] The strength when neither gives one. Default 1.
 * @returns {LensSettings} The settings.
 */
export function lensSettings(options, read, unset = LENS_DEFAULTS.refract) {
	/**
	 * One setting, from its option, its property or its default.
	 *
	 * @param {keyof LensSettings} name The setting.
	 * @param {number} fallback Its default.
	 * @returns {number} Its value.
	 */
	const pick = (name, fallback) => lensValue(options[name]) ?? lensValue(read(PROPERTIES[name])) ?? fallback;
	/**
	 * Clamps a number to a range.
	 *
	 * @param {number} n The number.
	 * @param {number} max The top of the range (the bottom is 0).
	 * @returns {number} It, within 0 and `max`.
	 */
	const clamp = (n, max) => Math.min(max, Math.max(0, n));
	return {
		refract: clamp(pick('refract', unset), 2),
		dispersion: clamp(pick('dispersion', LENS_DEFAULTS.dispersion), 1),
		bezel: clamp(pick('bezel', LENS_DEFAULTS.bezel), 400),
		specular: clamp(pick('specular', LENS_DEFAULTS.specular), 1),
	};
}

/**
 * The steps of a lens's filter: one bend of the backdrop, or three (red,
 * green, blue, each at its own strength) with dispersion, then the rim's
 * highlight if it has one. A bend's `scale` is `feDisplacementMap`'s,
 * twice the furthest it moves a point, px.
 *
 * @param {LensSettings} settings The lens's settings.
 * @returns {Array<BendStep | ShineStep>} The steps, in order.
 */
export function lensSteps({ refract, dispersion, bezel, specular }) {
	const scale = round(2 * refract * bezel * REACH);
	/** @type {Array<BendStep | ShineStep>} */
	const steps =
		dispersion > 0
			? [
					{ kind: 'bend', scale: round(scale * (1 - (SPREAD / 2) * dispersion)), channel: 'R' },
					{ kind: 'bend', scale, channel: 'G' },
					{ kind: 'bend', scale: round(scale * (1 + (SPREAD / 2) * dispersion)), channel: 'B' },
				]
			: [{ kind: 'bend', scale }];
	if (specular > 0) steps.push({ kind: 'shine', amount: round(specular) });
	return steps;
}

/**
 * Rounds to two decimal places, for filter attributes and cache keys.
 *
 * @param {number} n The number.
 * @returns {number} It, rounded.
 */
function round(n) {
	return Math.round(n * 100) / 100;
}

/**
 * The hidden `<svg>` that holds every lens filter, put back on the page if
 * a view transition swapped the body out from under it.
 *
 * @returns {SVGDefsElement} Its `<defs>`.
 */
function holder() {
	if (!defs) {
		const svg = document.createElementNS(SVG, 'svg');
		svg.setAttribute('aria-hidden', 'true');
		svg.setAttribute('focusable', 'false');
		svg.setAttribute('width', '0');
		svg.setAttribute('height', '0');
		svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
		defs = document.createElementNS(SVG, 'defs');
		svg.append(defs);
	}
	if (!defs.ownerSVGElement?.isConnected) document.body.append(/** @type {SVGSVGElement} */ (defs.ownerSVGElement));
	return defs;
}

/**
 * A shape's lens map as a PNG data URL, made once and kept for a while.
 *
 * @param {number} width The panel's width, whole px.
 * @param {number} height Its height, whole px.
 * @param {number} radius Its corner radius, px.
 * @param {number} bezel The rim's width, px.
 * @returns {string} The data URL.
 */
function mapURL(width, height, radius, bezel) {
	const key = `${width}x${height}r${radius}b${bezel}`;
	let url = maps.get(key);
	if (url) maps.delete(key);
	else {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		canvas.getContext('2d')?.putImageData(new ImageData(lensMap(width, height, radius, bezel), width, height), 0, 0);
		url = canvas.toDataURL('image/png');
	}
	maps.set(key, url);
	for (const old of maps.keys()) {
		if (maps.size <= KEEP) break;
		maps.delete(old);
	}
	return url;
}

/**
 * Makes an SVG element with attributes.
 *
 * @param {string} name The element's name.
 * @param {Record<string, string | number>} attributes Its attributes.
 * @returns {SVGElement} The element.
 */
function node(name, attributes) {
	const el = /** @type {SVGElement} */ (document.createElementNS(SVG, name));
	for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, String(value));
	return el;
}

/**
 * Builds a lens filter: the map, the bends, the highlight over them.
 *
 * @param {string} id The filter's id.
 * @param {number} width The panel's width, whole px.
 * @param {number} height Its height, whole px.
 * @param {number} radius Its corner radius, px.
 * @param {LensSettings} settings The lens's settings.
 * @returns {SVGFilterElement} The filter.
 */
function build(id, width, height, radius, settings) {
	const box = { x: 0, y: 0, width, height };
	const filter = /** @type {SVGFilterElement} */ (node('filter', { id, ...box, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }));
	filter.append(node('feImage', { ...box, href: mapURL(width, height, radius, settings.bezel), preserveAspectRatio: 'none', result: 'map' }));
	const steps = lensSteps(settings);
	const bends = /** @type {BendStep[]} */ (steps.filter((step) => step.kind === 'bend'));
	/** Keeps one colour channel of a bend: red, green or blue, with full alpha. */
	const only = { R: '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0', G: '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0', B: '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0' };
	bends.forEach(({ scale, channel }, i) => {
		const bent = channel ? `bent-${channel}` : 'bent';
		filter.append(node('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale, xChannelSelector: 'R', yChannelSelector: 'G', result: bent }));
		if (!channel) return;
		filter.append(node('feColorMatrix', { in: bent, type: 'matrix', values: only[channel], result: channel }));
		if (i) filter.append(node('feComposite', { in: i === 1 ? 'R' : 'RG', in2: channel, operator: 'arithmetic', k2: 1, k3: 1, result: i === 1 ? 'RG' : 'bent' }));
	});
	const shine = /** @type {ShineStep | undefined} */ (steps.find((step) => step.kind === 'shine'));
	if (shine) {
		filter.append(node('feColorMatrix', { in: 'map', type: 'matrix', values: `0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 ${shine.amount} 0 0`, result: 'shine' }));
		filter.append(node('feComposite', { in: 'shine', in2: 'bent', operator: 'over' }));
	}
	return filter;
}

/**
 * Takes a lens filter for a shape and settings, building it if no panel
 * has it yet.
 *
 * @param {number} width The panel's width, whole px.
 * @param {number} height Its height, whole px.
 * @param {number} radius Its corner radius, px.
 * @param {LensSettings} settings The lens's settings.
 * @returns {{ key: string, id: string }} The filter's key (to give it back) and id.
 */
function acquire(width, height, radius, settings) {
	const key = `${width}x${height}r${radius}:${settings.refract},${settings.dispersion},${settings.bezel},${settings.specular}`;
	let entry = filters.get(key);
	if (!entry) {
		const id = `fx-lens-${++serial}`;
		entry = { id, node: build(id, width, height, radius, settings), users: 0 };
		filters.set(key, entry);
	}
	const parent = holder();
	if (entry.node.parentNode !== parent) parent.append(entry.node);
	entry.users++;
	return { key, id: entry.id };
}

/**
 * Gives a lens filter back, taking it off the page once no panel uses it.
 *
 * @param {string} key The filter's key.
 */
function release(key) {
	const entry = filters.get(key);
	if (!entry || --entry.users > 0) return;
	entry.node.remove();
	filters.delete(key);
}

/**
 * A panel's corner radius in px, from its top-left corner (a percentage
 * of its width), clamped to half its shorter side.
 *
 * @param {CSSStyleDeclaration} style The panel's computed style.
 * @param {number} width The panel's width, px.
 * @param {number} height Its height, px.
 * @returns {number} The radius, whole px.
 */
function radiusOf(style, width, height) {
	const first = style.borderTopLeftRadius.split(' ')[0] ?? '0';
	const r = first.endsWith('%') ? (Number.parseFloat(first) / 100) * width : Number.parseFloat(first) || 0;
	return Math.round(Math.min(r, width / 2, height / 2));
}

/**
 * Starts a lens on one panel: from then on, `--glass-lens` holds its
 * filter (glass.css puts it in the panel's `backdrop-filter`) and
 * `data-glass-lens` is set, while its strength is above 0. Where the
 * browser cannot draw it, nothing is done.
 *
 * @param {HTMLElement} el The panel (`class="glass"`).
 * @param {LiquidGlassOptions} options Its settings; any left out are read
 *   from its custom properties (`--glass-refract`…), so CSS can change them.
 * @param {number} unset The strength when neither options nor CSS give one.
 * @returns {() => void} Stops the lens and takes its filter off.
 */
function start(el, options, unset) {
	if (!lensSupported() || typeof ResizeObserver === 'undefined') return () => {};
	let width = 0;
	let height = 0;
	/** @type {string | null} */
	let key = null;
	let frame = 0;

	/** Takes the panel's filter off it. */
	const clear = () => {
		if (key) release(key);
		key = null;
		if (el.style.getPropertyValue('--glass-lens')) el.style.removeProperty('--glass-lens');
		if (el.hasAttribute('data-glass-lens')) el.removeAttribute('data-glass-lens');
	};

	/** Gives the panel the filter for its size, radius and settings, if that is not the one it has. */
	const refresh = () => {
		frame = 0;
		const style = getComputedStyle(el);
		const settings = lensSettings(options, (property) => style.getPropertyValue(property), unset);
		if (settings.refract <= 0 || width < 2 || height < 2) return clear();
		const radius = radiusOf(style, width, height);
		const next = acquire(width, height, radius, settings);
		if (key) release(key);
		key = next.key;
		const value = `url(#${next.id})`;
		if (el.style.getPropertyValue('--glass-lens') !== value) el.style.setProperty('--glass-lens', value);
		if (!el.hasAttribute('data-glass-lens')) el.setAttribute('data-glass-lens', '');
	};

	/** Refreshes at the next frame, once however many changes come before it. */
	const queue = () => {
		frame ||= requestAnimationFrame(refresh);
	};

	/**
	 * What of the panel's class and style could change its lens: all of it
	 * but the sheen's place, which follows the pointer, and the lens itself.
	 *
	 * @returns {string} The class and the rest of the style.
	 */
	const look = () => `${el.className}|${(el.getAttribute('style') ?? '').replace(OWN, '')}`;
	let looked = look();
	/** Refreshes when the panel's class or style changed in a way that could change its lens. */
	const restyled = () => {
		const now = look();
		if (now === looked) return;
		looked = now;
		queue();
	};

	/**
	 * Takes the panel's new size, border box in whole px, and refreshes.
	 *
	 * @param {ResizeObserverEntry[]} entries The panel's resize, the only one watched.
	 */
	const measure = ([entry]) => {
		const box = entry.borderBoxSize?.[0];
		width = Math.round(box ? box.inlineSize : el.offsetWidth);
		height = Math.round(box ? box.blockSize : el.offsetHeight);
		queue();
	};
	const sizes = new ResizeObserver(measure);
	sizes.observe(el, { box: 'border-box' });
	const looks = new MutationObserver(restyled);
	looks.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });

	return () => {
		cancelAnimationFrame(frame);
		sizes.disconnect();
		looks.disconnect();
		clear();
	};
}

/**
 * Bends what is behind one glass panel, as a thick lens. Settings left out
 * of `options` are read from the panel's custom properties.
 *
 * @param {HTMLElement} el The panel (`class="glass"`, from glass.css).
 * @param {LiquidGlassOptions} [options] The lens's settings.
 * @returns {() => void} Stops it.
 */
export function liquidGlass(el, options = {}) {
	return start(el, options, LENS_DEFAULTS.refract);
}

/**
 * Bends what is behind every `.glass` panel on the page, now and later,
 * whose `--glass-refract` is above 0 (it is 0 unless set). Where the
 * browser cannot draw it, nothing runs. Once is enough.
 */
export function glassLens() {
	if (typeof document === 'undefined' || !lensSupported()) return;
	mount('.glass', (el) => start(el, {}, 0));
}
