/** The bands, Hz: bass, mid and treble, and the low end where kicks live. */
export const BANDS: {
	bass: [number, number];
	mid: [number, number];
	treble: [number, number];
	kick: [number, number];
};

/** Bins in a meter's `spectrum`. */
export const SPECTRUM: number;

/** Points in a meter's `waveform`. */
export const WAVEFORM: number;

/** What a meter reports each frame. The arrays are the meter's own, filled again each frame. */
export interface Reading {
	/** How loud, 0–1 (`loudness`, eased). */
	level: number;
	/** The bass band, 0–1, eased. */
	bass: number;
	/** The mid band, 0–1, eased. */
	mid: number;
	/** The treble band, 0–1, eased. */
	treble: number;
	/** A kick's light: 1 (or its strength) on a kick in the low end, fading over a fifth of a second. */
	kick: number;
	/** Kicks heard so far: an effect does something once each time it goes up. */
	beats: number;
	/** `SPECTRUM` log-spaced bins, 0–1, lowest first, eased. */
	spectrum: Float32Array;
	/** `WAVEFORM` points of the trace (`scope`), -1–1, eased and scaled to its own recent peak. */
	waveform: Float32Array;
}

/** A meter: the analyser's bytes each frame in, an eased reading out. */
export interface Meter {
	/** The latest reading. */
	reading: Reading;
	/** Reads a frame of the analyser's spectrum and waveform `dt` seconds after the last. */
	update(freq: ArrayLike<number>, time: ArrayLike<number>, binHz: number, dt: number): Reading;
}

/** The mean of a spectrum's bins (bytes 0–255, bin 0 at 0 Hz, `binHz` apart) between two frequencies, 0–1. */
export function bandLevel(freq: ArrayLike<number>, binHz: number, lo: number, hi: number): number;

/** How loud a waveform (bytes centred on 128) is: its RMS in decibels, mapped to 0–1. */
export function loudness(time: ArrayLike<number>): number;

/** Resamples a spectrum into `out`'s log-spaced bins between `lo` and `hi` Hz (default 40–16000), 0–1, tilted so the treble reads. Returns `out`. */
export function logSpectrum(freq: ArrayLike<number>, binHz: number, out: Float32Array, lo?: number, hi?: number): Float32Array;

/** The waveform as an oscilloscope draws it, from a rising zero crossing, averaged down to `out`'s length, -1–1. Returns `out`. */
export function scope(time: ArrayLike<number>, out: Float32Array): Float32Array;

/** A value read between an array's entries, as a texture reads: `u` 0 is the first, 1 the last (clamped), linearly blended between. */
export function sampleAt(values: ArrayLike<number>, u: number): number;

/** Resamples values (at least two) onto `out` along a smooth Catmull-Rom curve through them, its ends on the first and last. Returns `out`. */
export function smoothInto(values: ArrayLike<number>, out: Float32Array): Float32Array;

/** Eases a value towards a target over `dt` seconds: time constant `rise` going up, `fall` going down. */
export function follow(value: number, target: number, dt: number, rise: number, fall: number): number;

/** A meter, reading silence. */
export function createMeter(): Meter;
