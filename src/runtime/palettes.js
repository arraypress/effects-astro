/**
 * @module @arraypress/effects-astro/palettes
 *
 * Named colour sets every colour-taking effect accepts as `palette`:
 * Trirat's twelve from the LumiThemes ink, then a few more. Each is three
 * colours and a glint (a highlight some effects use). An effect's own
 * `colors` always win; a `palette` fills in when there are none, shaped
 * to what that effect takes (three colours, a light and a glint, an ink
 * and a paper…).
 */

/**
 * @typedef {object} Palette
 * @property {[string, string, string]} colors Three colours, as CSS hex.
 * @property {string} glint A highlight colour.
 */

/**
 * The palettes by name, in the order a switcher should cycle them.
 *
 * @type {Readonly<Record<string, Palette>>}
 */
export const PALETTES = Object.freeze({
	// Trirat's twelve, from the LumiThemes ink.
	Lumetri: { colors: ['#2532ef', '#0957ff', '#f69d03'], glint: '#FFFDCF' },
	Forest: { colors: ['#2c824a', '#4e3a3a', '#31625a'], glint: '#5d8d61' },
	Cadmium: { colors: ['#f15025', '#c9783a', '#303030'], glint: '#FF6B35' },
	Peacock: { colors: ['#18d2e3', '#092eff', '#03f6b9'], glint: '#5f7eee' },
	Vermillion: { colors: ['#e31818', '#931168', '#bd5d0e'], glint: '#ff0000' },
	Barbie: { colors: ['#ff0bce', '#1bfefe', '#2d026e'], glint: '#ff00ff' },
	Uranium: { colors: ['#aaff0b', '#4d7a60', '#1b1b1b'], glint: '#04ff00' },
	Azure: { colors: ['#066aff', '#0095ff', '#0062ff'], glint: '#0080ff' },
	Ruby: { colors: ['#ff0000', '#870000', '#3b475e'], glint: '#ff0000' },
	Ultramarine: { colors: ['#0044ff', '#561616', '#005fc4'], glint: '#0037ff' },
	Saffron: { colors: ['#ffb700', '#521212', '#ffcb53'], glint: '#ff8c00' },
	Crimson: { colors: ['#ff0000', '#173a71', '#4f0000'], glint: '#ff0000' },
	// And a few more.
	Ember: { colors: ['#ff5a1f', '#ffb347', '#7a1c0c'], glint: '#ffe2b8' },
	Lagoon: { colors: ['#00c2a8', '#0a7ea4', '#f2d49b'], glint: '#d6fff6' },
	Citrus: { colors: ['#c6f432', '#ffd400', '#ff7a00'], glint: '#fffbd1' },
	Glacier: { colors: ['#bfe6ff', '#4aa8ff', '#1b3a5c'], glint: '#ffffff' },
	Rosewater: { colors: ['#ff7aa2', '#ffc2a8', '#3d1d2b'], glint: '#fff0f4' },
	Mono: { colors: ['#f4f4f5', '#a1a1aa', '#3f3f46'], glint: '#ffffff' },
});

/**
 * A palette by name, in any case.
 *
 * @param {string | undefined} name The name.
 * @returns {Palette | undefined} The palette, or undefined when there is none by that name.
 */
export function findPalette(name) {
	if (!name) return undefined;
	const key = Object.keys(PALETTES).find((k) => k.toLowerCase() === String(name).toLowerCase());
	return key ? PALETTES[key] : undefined;
}

/**
 * The colours an effect draws with: its own `colors` if it has them,
 * else its `palette` shaped to what it takes, else its defaults. An
 * unknown palette name is warned about and the defaults used.
 *
 * @param {{ colors?: string[], palette?: string }} config The effect's settings.
 * @param {string[]} fallback Its default colours.
 * @param {(palette: Palette) => string[]} [shape] Turns a palette into the colours it takes (default the palette's three).
 * @returns {string[]} The colours.
 */
export function pickColors(config, fallback, shape = (palette) => [...palette.colors]) {
	if (config.colors?.length) return config.colors;
	if (!config.palette) return fallback;
	const palette = findPalette(config.palette);
	if (palette) return shape(palette);
	console.warn('[effects-astro]', `No palette "${config.palette}"`);
	return fallback;
}
