/**
 * @module @arraypress/effects-astro/iso-city/look
 *
 * The city's colours. Three are given (buildings, parks, roads), or taken
 * from a palette and softened so even a loud palette makes a calm city;
 * everything else (pavements, markings, trees, water, roof clutter) is
 * mixed from them in Oklab. Day and night each have their own defaults and
 * light: a warm sun with cool shade by day, a dim blue moon at night, when
 * windows, lamps and headlights do the lighting.
 */

import { mixOklab, parseColor, toHex } from '../color.js';
import { findPalette, pickColors } from '../palettes.js';

/** By day: warm off-white buildings, sage parks, graphite roads, amber taxis, a paper ground. */
export const DAY = { colors: ['#f3eee5', '#a9bf99', '#3b3f46'], accent: '#f2a53a', background: '#e9e3d8' };
/** By night: slate buildings, deep green parks, near-black roads, a midnight ground. */
export const NIGHT = { colors: ['#3b434f', '#22372d', '#161a20'], accent: '#ffb547', background: '#0d1219' };
/** The cars that are not taxis: white, silver, grey, graphite, black. */
export const NEUTRALS = ['#f5f5f3', '#cfd3d8', '#8f969f', '#4a5059', '#22252a'];

/**
 * @typedef {import('../color.js').Rgb} Rgb
 */

/**
 * @typedef {object} Look
 * @property {Rgb} buildings Walls.
 * @property {Rgb} roofs Roofs.
 * @property {Rgb} detail Things on roofs.
 * @property {Rgb} parks Grass.
 * @property {Rgb[]} trees Crowns, three greens.
 * @property {Rgb} trunk Trunks.
 * @property {Rgb} path Park paths.
 * @property {Rgb} water Ponds.
 * @property {Rgb} roads Tarmac.
 * @property {Rgb} pavement Pavements and plazas.
 * @property {Rgb} marking Road markings.
 * @property {Rgb} lamp Lamp posts.
 * @property {Rgb} solar Solar panels.
 * @property {Rgb[]} tints A few tints for buildings that differ.
 * @property {Rgb} background The ground the city fades into.
 * @property {Rgb} accent The taxis.
 * @property {Rgb[]} neutrals The other cars.
 * @property {Rgb} person People.
 * @property {boolean} night Whether it is night.
 */

/**
 * The city's colours from its settings.
 *
 * @param {{ colors?: string[], palette?: string, accent?: string, background?: string, night?: boolean }} config The settings.
 * @returns {Look} The colours.
 */
export function cityLook(config) {
	const night = config.night === true;
	const base = night ? NIGHT : DAY;
	const [b, p, r] = baseColors(config).map(parseColor);
	const white = parseColor('#ffffff');
	const black = parseColor('#000000');
	const palette = config.colors?.length ? undefined : findPalette(config.palette);
	return {
		buildings: b,
		roofs: mixOklab(b, night ? black : white, 0.25),
		detail: mixOklab(b, r, night ? 0.25 : 0.2),
		parks: p,
		trees: [mixOklab(p, parseColor('#3e6a47'), 0.5), mixOklab(p, parseColor('#557a4c'), 0.35), mixOklab(p, parseColor('#6f8f58'), 0.3)].map((c) =>
			night ? mixOklab(c, black, 0.35) : c,
		),
		trunk: mixOklab(parseColor('#7b6450'), r, night ? 0.5 : 0.1),
		path: mixOklab(p, b, 0.6),
		water: night ? mixOklab(parseColor('#1f3a52'), r, 0.3) : mixOklab(parseColor('#8dbcd2'), b, 0.15),
		roads: r,
		pavement: mixOklab(b, r, night ? 0.3 : 0.12),
		marking: mixOklab(r, white, night ? 0.32 : 0.72),
		lamp: mixOklab(r, b, 0.25),
		solar: mixOklab(parseColor('#2c3b55'), r, 0.2),
		tints: night
			? [mixOklab(b, parseColor('#4a3f45'), 0.35), mixOklab(b, parseColor('#3b4a4f'), 0.35)]
			: [mixOklab(b, parseColor('#e6c8ae'), 0.4), mixOklab(b, parseColor('#c8d2cf'), 0.45)],
		background: parseColor(config.background ?? base.background),
		accent: parseColor(config.accent ?? (palette ? palette.colors[0] : base.accent)),
		neutrals: NEUTRALS.map((c) => (night ? mixOklab(parseColor(c), black, 0.25) : parseColor(c))),
		person: parseColor(night ? '#8b93a3' : '#4a4f58'),
		night,
	};
}

/**
 * The three base colours: `colors` as given, a palette softened into a
 * city (light buildings, muted parks, dark roads), or the defaults.
 *
 * @param {{ colors?: string[], palette?: string, night?: boolean }} config The settings.
 * @returns {string[]} Buildings, parks, roads.
 */
function baseColors(config) {
	const base = config.night ? NIGHT : DAY;
	const colors = pickColors(config, base.colors, (palette) => {
		const [a, b, c] = palette.colors.map(parseColor);
		const [db, dp, dr] = base.colors.map(parseColor);
		return [mixOklab(db, a, config.night ? 0.3 : 0.16), mixOklab(dp, b, 0.4), mixOklab(dr, c, 0.3)].map(toHex);
	});
	return [colors[0] ?? base.colors[0], colors[1] ?? base.colors[1], colors[2] ?? base.colors[2]];
}

