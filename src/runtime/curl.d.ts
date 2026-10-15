/** Value noise at (x, y), 0–1, with its gradient: `[value, d/dx, d/dy]`. */
export function noiseGrad(x: number, y: number, out?: Float64Array): Float64Array;

/** The curl of two drifting octaves of noise at (x, y) and time `t`: a swirling flow with no sources or sinks, `[across, up]`. */
export function curl<T extends Float64Array | number[]>(x: number, y: number, t: number, out?: T): T;
