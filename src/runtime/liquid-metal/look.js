/**
 * @module @arraypress/effects-astro/liquid-metal/look
 *
 * The liquid metal's colours: the metal's own (its reflectance face on,
 * by name or as a CSS colour) and the studio's, which a palette tints.
 */

import { parseColor, toOklab, fromOklab } from '../color.js';

/**
 * @typedef {import('../color.js').Rgb} Rgb
 */

/** The metals by name: each one's colour face on, sRGB. Black chrome is a dark mirror that only lights at its edges and glints. */
export const METALS = Object.freeze({
	chrome: '#e6e8eb',
	gold: '#ffd98f',
	'rose-gold': '#f4c2ad',
	copper: '#f2a882',
	'black-chrome': '#58595d',
});

/** The studio's colours with no palette: a cool sky, a white horizon, a warm floor. */
const STUDIO = ['#dde5ef', '#ffffff', '#ebe7e2'];
/** How light a palette colour is made before it tints the studio (Oklab L), and how much of its colour it keeps. */
const STUDIO_LIGHTNESS = 0.9;
const STUDIO_CHROMA = 0.75;

/**
 * The metal's colour, face on. A tint that is neither a metal's name nor a
 * hex colour is warned about, and chrome used.
 *
 * @param {string | undefined} tint A metal's name (METALS, any case) or a CSS hex colour; none for chrome.
 * @returns {Rgb} Its colour, sRGB 0–1.
 */
export function metalColor(tint) {
	if (!tint) return parseColor(METALS.chrome);
	const name = /** @type {keyof typeof METALS | undefined} */ (Object.keys(METALS).find((k) => k === tint.toLowerCase().replace(/\s+/g, '-')));
	try {
		return parseColor(name ? METALS[name] : tint);
	} catch {
		console.warn('[effects-astro]', `No metal "${tint}"`);
		return parseColor(METALS.chrome);
	}
}

/**
 * The studio's three tints (the sky, the horizon, the floor) from a
 * palette: each colour made light and a little softer in Oklab, so it
 * colours the light without dimming the room. Without colours, the
 * neutral studio. Fewer than three colours repeat.
 *
 * @param {string[] | undefined} colors CSS hex colours.
 * @returns {[Rgb, Rgb, Rgb]} The sky's, the horizon's and the floor's tint, sRGB 0–1.
 */
export function studioTints(colors) {
	if (!colors?.length) return /** @type {[Rgb, Rgb, Rgb]} */ (STUDIO.map(parseColor));
	return /** @type {[Rgb, Rgb, Rgb]} */ (
		[0, 1, 2].map((i) => {
			const [, a, b] = toOklab(parseColor(colors[i % colors.length]));
			return fromOklab([STUDIO_LIGHTNESS, a * STUDIO_CHROMA, b * STUDIO_CHROMA]);
		})
	);
}
