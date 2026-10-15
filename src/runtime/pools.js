/**
 * @module @arraypress/effects-astro/pools
 *
 * The still stand-in for a light effect without WebGL: its colours as soft
 * pools of light on a ground, as a CSS `background`. A component sets it on
 * its element, so it shows before the canvas draws and wherever it cannot.
 */

/**
 * Three colours as soft pools of light, upper left, upper right and lower
 * right, over a ground.
 *
 * @param {string[]} colors CSS colours, at least one (looped to make three).
 * @param {string} ground The colour under them.
 * @returns {string} A CSS `background`.
 */
export function colorPools(colors, ground) {
	const [a, b, c] = [0, 1, 2].map((i) => colors[i % colors.length]);
	return [
		`radial-gradient(60% 50% at 20% 25%, ${a} 0%, transparent 70%)`,
		`radial-gradient(55% 45% at 80% 30%, ${b} 0%, transparent 70%)`,
		`radial-gradient(60% 50% at 70% 85%, ${c} 0%, transparent 70%)`,
		ground,
	].join(', ');
}
