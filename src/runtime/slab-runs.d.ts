/** A stretch of logo across a slice, as columns (both ends included). */
export interface Run {
	from: number;
	to: number;
}

/** The runs of each slice (top first, each left to right): where a mask's logo crosses it. `phase` (0–1) is where in its slice each samples, `band` (0–1) how much of it, `threshold` the coverage that counts (0–255), `min` the narrowest run kept. */
export declare function sliceRuns(
	mask: { alpha: Uint8ClampedArray | Uint8Array; width: number; height: number },
	slices: number,
	options?: { phase?: number; band?: number; threshold?: number; min?: number },
): Run[][];

/** The runs as the shader's RGBA texture (a row per slice, a texel per column): where along its run a column is in red and green (16 bits), 255 in blue, the run's width share in alpha; zero outside runs. */
export declare function runsTexture(runs: Run[][], width: number): Uint8Array;

/** A slice's disc size in the intro, `t` seconds in (0 none to 1 whole; a little over while settling): the bottom first, the top done by `duration`. */
export declare function slabGrowth(slice: number, slices: number, t: number, duration?: number): number;
