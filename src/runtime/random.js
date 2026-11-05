/**
 * @module @arraypress/effects-astro/random
 *
 * Small seeded random generators, for effects that build something from a
 * `seed` and must build the same thing on every load: mulberry32 (the
 * default, well mixed from any seed) and the Park–Miller minimal standard
 * (a multiplicative generator, × 16807 mod 2³¹ − 1), kept so a sky first
 * drawn with it can be drawn again exactly.
 */

/** Park–Miller's modulus, 2³¹ − 1. */
const PM_MODULUS = 2147483647;

/** Park–Miller's multiplier (the minimal standard's). */
const PM_MULTIPLIER = 16807;

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

/**
 * Makes a Park–Miller generator: the state times 16807, mod 2³¹ − 1, read
 * as a fraction of the modulus. Exact in double precision. A seed that
 * comes to 0 (or a multiple of the modulus) would stick at 0, so it is
 * moved into range first.
 *
 * @param {number} seed Any number; its integer part is used.
 * @returns {() => number} The next value, over 0 and under 1.
 */
export function parkMiller(seed) {
	let s = Math.floor(seed) % PM_MODULUS;
	if (s <= 0) s += PM_MODULUS - 1;
	return () => (s = (s * PM_MULTIPLIER) % PM_MODULUS) / PM_MODULUS;
}

/** The generators by name, for an effect's `rng` setting. */
export const RANDOMS = Object.freeze({ mulberry32: seededRandom, 'park-miller': parkMiller });

/**
 * Makes a generator by name.
 *
 * @param {string | undefined} name `mulberry32` (the default) or `park-miller`.
 * @param {number} seed The seed.
 * @returns {() => number} The generator.
 * @throws {TypeError} When the name is not one of RANDOMS.
 */
export function randomFrom(name, seed) {
	const key = /** @type {keyof typeof RANDOMS} */ (name ?? 'mulberry32');
	if (!Object.hasOwn(RANDOMS, key)) throw new TypeError(`Unknown random generator: ${name} (use ${Object.keys(RANDOMS).join(' or ')})`);
	return RANDOMS[key](seed);
}
