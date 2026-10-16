/**
 * @module @arraypress/effects-astro/paper-look
 *
 * A Paper look on the page: its plain props (src/runtime/paper-looks.js)
 * turned into Paper's settings and run as a Paper shader
 * (src/runtime/paper.js). A prop left out keeps its preset's setting, so
 * with no props a look is its preset. Shared by every look's component
 * through src/components/PaperBackground.astro.
 *
 * `quiet` dims the shader towards its `background` behind copy, with a
 * mask on the canvas over the element's own background, since Paper's
 * shaders are run unchanged.
 */

import { paperSettings, paperShader } from './paper.js';
import { pickColors } from './palettes.js';
import { PAPER_LOOKS } from './paper-looks.js';

/**
 * @typedef {import('./paper-look.js').PaperLookConfig} PaperLookConfig
 * @typedef {import('./paper.js').PaperConfig} PaperConfig
 */

/** The props every look shares, and the Paper settings they set; a pair sets two from `[x, y]`. */
const SHARED = /** @type {Record<string, string | [string, string]>} */ ({ background: 'colorBack', zoom: 'scale', rotation: 'rotation', offset: ['offsetX', 'offsetY'] });

/**
 * A look's props as a Paper shader's config: its shader, its preset (the
 * named one or the look's), and Paper's settings for the props given.
 *
 * @param {PaperLookConfig} config The look and its props.
 * @returns {PaperConfig} The shader's config.
 * @throws {Error} When there is no such look.
 */
export function paperLookSettings(config) {
	const look = PAPER_LOOKS[config.look];
	if (!look) throw new Error(`No Paper look "${config.look}"`);
	/** @type {Record<string, unknown>} */
	const params = {};
	for (const [prop, setting] of Object.entries({ ...SHARED, ...look.props })) {
		const value = /** @type {Record<string, unknown>} */ (config)[prop];
		if (value === undefined) continue;
		if (Array.isArray(setting)) setting.forEach((name, i) => (params[name] = /** @type {unknown[]} */ (value)[i]));
		else params[setting] = value;
	}
	const colors = pickColors(config, []);
	return {
		shader: look.shader,
		preset: config.preset ?? look.preset,
		params,
		...(colors.length ? { colors } : {}),
		...(config.speed !== undefined ? { speed: config.speed } : {}),
	};
}

/**
 * The CSS mask that dims a canvas behind copy: `1 - depth` at the quiet
 * area's centre, rising to full by its edge. Sized in the element's
 * height (`cqh`), as the effects' own quiet areas are.
 *
 * @param {NonNullable<PaperLookConfig['quiet']>} quiet The quiet area.
 * @returns {string} The mask.
 */
export function quietMask({ x = 0.5, y = 0.5, radius = 0.8, depth = 0.72 }) {
	return `radial-gradient(circle calc(${radius} * 100cqh) at ${x * 100}% ${y * 100}%, rgb(0 0 0 / ${Number((1 - depth).toFixed(3))}) calc(${radius * 0.06} * 100cqh), #000)`;
}

/**
 * Starts a Paper look on an element: the shader in its canvas, the
 * element's background the shader's (what shows through the quiet area),
 * and its quiet area masked.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {PaperLookConfig} config The look and its props.
 * @returns {() => void} Stops it.
 */
export function paperLook(el, config) {
	const shader = paperLookSettings(config);
	const canvas = el.querySelector('canvas');
	const back = paperSettings(shader).colorBack;
	if (typeof back === 'string') el.style.backgroundColor = back;
	if (config.quiet && canvas) {
		el.style.containerType = 'size';
		canvas.style.maskImage = canvas.style.webkitMaskImage = quietMask(config.quiet);
	}
	const stop = paperShader(el, shader);
	return () => {
		stop();
		if (canvas) canvas.style.maskImage = canvas.style.webkitMaskImage = '';
	};
}
