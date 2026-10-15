/** A seeded generator (mulberry32): the same seed gives the same sequence of values, 0 (inclusive) to 1 (exclusive). */
export function seededRandom(seed: number): () => number;
