/** A seeded generator's name: `mulberry32` (well mixed from any seed) or `park-miller` (the minimal standard, × 16807 mod 2³¹ − 1). */
export type RandomName = 'mulberry32' | 'park-miller';

/** A seeded generator (mulberry32): the same seed gives the same sequence of values, 0 (inclusive) to 1 (exclusive). */
export function seededRandom(seed: number): () => number;

/** A Park–Miller minimal standard generator (× 16807 mod 2³¹ − 1): the same seed gives the same sequence, over 0 and under 1. A seed that comes to 0 is moved into range. */
export function parkMiller(seed: number): () => number;

/** The generators by name. */
export const RANDOMS: Readonly<Record<RandomName, (seed: number) => () => number>>;

/** Makes a generator by name (default `mulberry32`). Throws a TypeError for an unknown name. */
export function randomFrom(name: RandomName | undefined, seed: number): () => number;
