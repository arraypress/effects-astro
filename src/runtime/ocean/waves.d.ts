/** The sea's waves, longest first, as the shader takes them. */
export interface WaveSet {
	/** How many waves. */
	count: number;
	/** Four floats a wave: direction (x, z), wavenumber (rad/m) and height (m). */
	shape: Float32Array;
	/** Two floats a wave: its phase now (rad, 0 to 2π) and how sharp its crest is. */
	motion: Float32Array;
	/** Each wave's angular speed, rad/s: √(g·k), as deep water runs. */
	speed: Float32Array;
	/** Each wave's phase at time 0. */
	start: Float32Array;
	/** The highest the long waves can lift the sea, metres. */
	crest: number;
	/** How steep the long waves get (twice their rms slope): how far a march may stride. */
	slope: number;
	/** Where the wind drives the sea: a unit vector (x, z). */
	wind: [number, number];
}

/**
 * Makes the waves for a sea state (0 glassy to 2 rough) running towards
 * `wind` degrees (0 towards the viewer, 90 left to right): `count` of
 * them from a long swell to ripples, the first `geometry` shaping the surface.
 */
export function waveSet(sea: number, wind: number, count: number, geometry: number): WaveSet;

/** Moves every wave on to `time` seconds, writing the phases into `set.motion` (returned). */
export function wavePhases(set: WaveSet, time: number): Float32Array;
