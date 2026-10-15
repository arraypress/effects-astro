/**
 * @module @arraypress/effects-astro/random
 *
 * A small seeded random generator (mulberry32), for effects that build
 * something from a `seed` and must build the same thing on every load.
 */

/**
 * Makes a seeded generator: the same seed gives the same sequence.
 *
 * @param {number} seed Any number; its integer part is used.
 * @returns {() => number} The next value, 0 (inclusive) to 1 (exclusive).
 */
export function seededRandom(seed) {
	let s = Math.floor(seed) >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
