/**
 * @module @arraypress/effects-astro/ocean/presets
 *
 * The ocean's times of day: for each, where the sun (or the moon) sits,
 * its light, the sky's colours and the water's. `oceanLook` resolves a
 * time and tints it with the effect's `colors` or `palette`, keeping each
 * colour's lightness so the light still reads as that time of day; and
 * `oceanBackdrop` paints the scene as a CSS gradient for a browser
 * without WebGL.
 */

import { fromOklab, mixOklab, parseColor, toHex, toOklab } from '../color.js';
import { pickColors } from '../palettes.js';

/**
 * @typedef {'dawn' | 'noon' | 'sunset' | 'night'} OceanTime
 */

/**
 * @typedef {object} OceanLook
 * @property {OceanTime} time The time of day it is.
 * @property {number} x Where the sun sits across the frame, 0–1 from the left (beyond it, off to the side).
 * @property {number} elevation Its height above the horizon, degrees.
 * @property {number} size Its apparent radius, radians (drawn larger than life, as a long lens shows it).
 * @property {string} light The colour of its light on the water.
 * @property {number} power How strong that light is.
 * @property {string} zenith The sky overhead.
 * @property {string} horizon The sky along the horizon, and the haze.
 * @property {string} glow The glow round the sun.
 * @property {string} deep The deep water's own colour, lit from above.
 * @property {string} scatter The colour light takes through a thin crest.
 * @property {string} cloud The clouds' shaded side.
 * @property {number} haze How far, in metres, the air takes to hide the sea.
 * @property {number} exposure The camera's exposure.
 * @property {number} stars How bright the stars are, 0 for none.
 */

/** @type {Readonly<Record<OceanTime, OceanLook>>} */
export const OCEAN_TIMES = Object.freeze({
	dawn: {
		time: 'dawn',
		x: 0.3,
		elevation: 4,
		size: 0.011,
		light: '#ffcf9e',
		power: 5,
		zenith: '#5576a8',
		horizon: '#f3c6aa',
		glow: '#ffbb8c',
		deep: '#18334f',
		scatter: '#3c9f98',
		cloud: '#8a86a6',
		haze: 2200,
		exposure: 0.95,
		stars: 0,
	},
	noon: {
		time: 'noon',
		x: 1.45,
		elevation: 50,
		size: 0.009,
		light: '#fff6e8',
		power: 5.5,
		zenith: '#2463b6',
		horizon: '#b4d3ec',
		glow: '#fffaf0',
		deep: '#03324f',
		scatter: '#14b2a4',
		cloud: '#c1cad6',
		haze: 5200,
		exposure: 0.7,
		stars: 0,
	},
	sunset: {
		time: 'sunset',
		x: 0.68,
		elevation: 2.4,
		size: 0.012,
		light: '#ff9a52',
		power: 6,
		zenith: '#1a3772',
		horizon: '#f79a5c',
		glow: '#ff7a32',
		deep: '#0b1828',
		scatter: '#2b8a80',
		cloud: '#3a3d5c',
		haze: 9000,
		exposure: 0.85,
		stars: 0,
	},
	night: {
		time: 'night',
		x: 0.62,
		elevation: 7,
		size: 0.01,
		light: '#c9d8f2',
		power: 0.8,
		zenith: '#03081a',
		horizon: '#16253f',
		glow: '#2c3c5c',
		deep: '#01050c',
		scatter: '#0e3a46',
		cloud: '#141c2e',
		haze: 3000,
		exposure: 1.25,
		stars: 1,
	},
});

/** The default time of day: the most striking. */
export const OCEAN_TIME = 'sunset';

/** How far a tint moves each colour's hue and chroma towards the tint's, 0–1; its lightness is kept. */
const TINT = 0.6;

/**
 * Moves a colour's hue and chroma towards another's, in Oklab, keeping
 * its own lightness: the light keeps its strength and only its colour
 * changes.
 *
 * @param {string} color The colour, CSS hex.
 * @param {string} tint The tint, CSS hex.
 * @param {number} [amount=TINT] How far, 0–1.
 * @returns {string} The tinted colour, CSS hex.
 * @throws {TypeError} When either is not a hex colour.
 */
export function tintColor(color, tint, amount = TINT) {
	const [L, a, b] = toOklab(parseColor(color));
	const [, ta, tb] = toOklab(parseColor(tint));
	return toHex(fromOklab([L, a + (ta - a) * amount, b + (tb - b) * amount]));
}

/**
 * A time of day, tinted by the effect's colours: the first tints the sky,
 * the second the water, the third the sun's light and glow. An unknown
 * time is warned about and the default used.
 *
 * @param {{ time?: string, colors?: string[], palette?: string }} config The effect's settings.
 * @returns {OceanLook} The look, its colours as CSS hex.
 * @throws {TypeError} When a colour is not a hex colour.
 */
export function oceanLook(config) {
	const name = config.time ?? OCEAN_TIME;
	const known = Object.hasOwn(OCEAN_TIMES, name);
	if (!known) console.warn('[effects-astro]', `No ocean time "${name}"`);
	const look = { ...OCEAN_TIMES[known ? /** @type {OceanTime} */ (name) : OCEAN_TIME] };
	const tints = pickColors(config, []);
	if (!tints.length) return look;
	/**
	 * The tint for a part of the scene: its colour, or the last one given.
	 *
	 * @param {number} i 0 the sky, 1 the water, 2 the light.
	 * @returns {string} The tint.
	 */
	const tint = (i) => tints[Math.min(i, tints.length - 1)];
	look.zenith = tintColor(look.zenith, tint(0));
	look.horizon = tintColor(look.horizon, tint(0));
	look.cloud = tintColor(look.cloud, tint(0));
	look.deep = tintColor(look.deep, tint(1));
	look.scatter = tintColor(look.scatter, tint(1));
	look.glow = tintColor(look.glow, tint(2));
	look.light = tintColor(look.light, tint(2));
	return look;
}

/**
 * The scene as CSS backgrounds, for a browser without WebGL: the sky from
 * its zenith down to the horizon, the sun's glow, and the sea from the
 * sky it mirrors at the horizon down into its deep colour.
 *
 * @param {OceanLook} look The look.
 * @param {number} [horizon=0.3] Where the horizon sits, 0–1 up the frame.
 * @returns {string} A CSS `background` value.
 */
export function oceanBackdrop(look, horizon = 0.3) {
	const line = ((1 - Math.min(1, Math.max(0, horizon))) * 100).toFixed(1);
	const sunY = Math.max(4, Number(line) - Math.min(look.elevation, 20) * 1.5).toFixed(1);
	// The far sea mirrors the sky above the horizon; the near sea is its own deep colour.
	const sea = toHex(mixOklab(mixOklab(parseColor(look.zenith), parseColor(look.horizon), 0.4), parseColor(look.deep), 0.3));
	return [
		`radial-gradient(ellipse 36% 16% at ${(look.x * 100).toFixed(1)}% ${sunY}%, ${look.glow}cc, transparent 70%)`,
		`linear-gradient(to bottom, ${look.zenith} 0%, ${look.horizon} ${line}%, ${sea} ${line}%, ${look.deep} 100%)`,
	].join(', ');
}
