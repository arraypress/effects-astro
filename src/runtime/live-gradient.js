/**
 * @module @arraypress/effects-astro/live-gradient
 *
 * A live gradient: Paper's mesh gradient in your colours, morphing slowly
 * (subtle by default: a sixth of Paper's speed, a gentle swirl), drawn at
 * half resolution (a soft gradient loses nothing, and grain covers the
 * rest). It comes with the same colours as a still CSS gradient, to show
 * before it starts and without WebGL, so the live one can fade in over it.
 * `<LiveGradient>` is the component; this builds its settings, for pages
 * that write their own HTML (a card list made in a script).
 */

/**
 * @typedef {object} LiveGradientOptions
 * @property {number} [speed=0.16] How fast it morphs (Paper's speed; 1 is Paper's own).
 * @property {number} [distortion=0.7] How far the colours bend into each other, 0–1.
 * @property {number} [swirl=0.3] How much they turn, 0–1.
 * @property {number} [scale=0.5] Share of the pixel ratio drawn at.
 */

/**
 * The Paper settings and the still CSS gradient for a live gradient.
 *
 * @param {string[]} colors Two to four colours (hex); the last is the ground the others bloom on.
 * @param {LiveGradientOptions} [options] How it moves.
 * @returns {{ config: import('./paper.js').PaperConfig, fallback: string }} `config` for `paperShader`, `fallback` a CSS `background`.
 * @throws {TypeError} With fewer than two colours.
 */
export function liveGradient(colors, { speed = 0.16, distortion = 0.7, swirl = 0.3, scale = 0.5 } = {}) {
	if (!Array.isArray(colors) || colors.length < 2) throw new TypeError('A live gradient needs at least two colours');
	const cs = colors.slice(0, 4);
	const ground = cs[cs.length - 1];
	const blooms = cs.slice(0, -1);
	const at = ['20% 18%', '82% 72%', '28% 88%'];
	const fallback = [...blooms.map((c, i) => `radial-gradient(at ${at[i]}, ${c} 0, transparent 60%)`), ground].join(', ');
	return {
		config: { shader: 'mesh-gradient', colors: cs, speed, scale, params: { distortion, swirl, grainMixer: 0, grainOverlay: 0 } },
		fallback,
	};
}
