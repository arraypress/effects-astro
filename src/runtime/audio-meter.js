/**
 * @module @arraypress/effects-astro/audio-meter
 *
 * The arithmetic of audio reactivity, kept apart from the Web Audio graph
 * (./audio.js) so it runs and is tested under Node: an analyser's byte
 * spectrum and waveform turned into what effects draw with.
 *
 *   - `bandLevel`: one band of the spectrum (bass, mid, treble), 0–1.
 *   - `loudness`: a waveform's RMS on a decibel scale, 0–1.
 *   - `logSpectrum`: the spectrum resampled to a few log-spaced bins, as an
 *     ear hears it, tilted so the treble reads beside the bass.
 *   - `scope`: the waveform as an oscilloscope shows it, started at a rising
 *     zero crossing so a steady note stands still, and smoothed.
 *   - `createMeter`: all of it each frame, eased (quick to rise, slower to
 *     fall, as meters move), with the kicks counted.
 *
 * The analyser's bytes are 0–255: its spectrum in decibels between its
 * `minDecibels` and `maxDecibels`, its waveform centred on 128.
 */

/** The bands, Hz: bass, mid and treble, and the low end where kicks live. */
export const BANDS = {
	bass: [20, 250],
	mid: [250, 2000],
	treble: [2000, 12000],
	kick: [40, 160],
};
/** Bins in a meter's `spectrum`. */
export const SPECTRUM = 96;
/** Points in a meter's `waveform`. */
export const WAVEFORM = 64;
/** The quietest RMS that registers, dB (0 on the `loudness` scale), and the loudest (1). */
const QUIET_DB = -50;
const LOUD_DB = -8;
/** A kick: the low end this far above its own recent average (0–1 of the band), at least this long after the last; the next waits until it has fallen back under half that. */
const KICK_RISE = 0.07;
const KICK_GAP = 0.14;

/**
 * The mean of a spectrum's bins between two frequencies, 0–1.
 *
 * @param {ArrayLike<number>} freq The spectrum, bytes 0–255, bin 0 at 0 Hz.
 * @param {number} binHz Hz per bin (the sample rate over the FFT size).
 * @param {number} lo The band's low edge, Hz.
 * @param {number} hi Its high edge, Hz.
 * @returns {number} Its level, 0 for silence or a band outside the spectrum.
 */
export function bandLevel(freq, binHz, lo, hi) {
	const from = Math.max(0, Math.ceil(lo / binHz));
	const to = Math.min(freq.length - 1, Math.floor(hi / binHz));
	if (from >= freq.length) return 0;
	// A band narrower than a bin reads the bin it falls in.
	if (to < from) return freq[Math.min(freq.length - 1, Math.round(lo / binHz))] / 255;
	let sum = 0;
	for (let i = from; i <= to; i++) sum += freq[i];
	return sum / ((to - from + 1) * 255);
}

/**
 * How loud a waveform is: its RMS in decibels, mapped from QUIET_DB (0) to
 * LOUD_DB (1), so a quiet passage still moves and a loud one does not pin.
 *
 * @param {ArrayLike<number>} time The waveform, bytes centred on 128.
 * @returns {number} Its loudness, 0–1.
 */
export function loudness(time) {
	if (!time.length) return 0;
	let sum = 0;
	for (let i = 0; i < time.length; i++) {
		const v = (time[i] - 128) / 128;
		sum += v * v;
	}
	const rms = Math.sqrt(sum / time.length);
	if (rms <= 0) return 0;
	const db = 20 * Math.log10(rms);
	return Math.min(1, Math.max(0, (db - QUIET_DB) / (LOUD_DB - QUIET_DB)));
}

/**
 * Resamples a spectrum into log-spaced bins between two frequencies, each
 * the loudest of the analyser bins it covers (interpolated where a bin is
 * narrower than one), weighted up a little each octave so the treble,
 * which carries less energy, reads beside the bass. Silence stays silent.
 *
 * @param {ArrayLike<number>} freq The spectrum, bytes 0–255, bin 0 at 0 Hz.
 * @param {number} binHz Hz per bin.
 * @param {Float32Array} out Filled with the bins, 0–1, lowest first.
 * @param {number} [lo=40] The lowest frequency, Hz.
 * @param {number} [hi=16000] The highest, Hz.
 * @returns {Float32Array} `out`.
 */
export function logSpectrum(freq, binHz, out, lo = 40, hi = 16000) {
	const n = out.length;
	const ratio = hi / lo;
	const last = freq.length - 1;
	for (let i = 0; i < n; i++) {
		const f0 = lo * ratio ** (i / n);
		const f1 = lo * ratio ** ((i + 1) / n);
		const a = f0 / binHz;
		const b = f1 / binHz;
		let v = 0;
		if (b - a < 1) {
			v = sampleAt(freq, (a + b) / 2 / last);
		} else {
			for (let j = Math.floor(a); j <= Math.min(last, Math.ceil(b)); j++) v = Math.max(v, freq[j]);
		}
		const tilt = Math.max(0.9, 1 + 0.07 * Math.log2(Math.sqrt(f0 * f1) / 250));
		out[i] = Math.min(1, (v / 255) * tilt);
	}
	return out;
}

/**
 * The waveform as an oscilloscope draws it: from the first rising zero
 * crossing in its first half (so a steady note holds still), averaged down
 * to `out`'s length over the second half's span, -1–1.
 *
 * @param {ArrayLike<number>} time The waveform, bytes centred on 128.
 * @param {Float32Array} out Filled with the trace.
 * @returns {Float32Array} `out`.
 */
export function scope(time, out) {
	const span = Math.floor(time.length / 2);
	let start = 0;
	for (let i = 1; i < span; i++) {
		if (time[i - 1] < 128 && time[i] >= 128) {
			start = i;
			break;
		}
	}
	const per = span / out.length;
	for (let i = 0; i < out.length; i++) {
		const from = start + Math.floor(i * per);
		const to = Math.max(from + 1, start + Math.floor((i + 1) * per));
		let sum = 0;
		for (let j = from; j < to; j++) sum += time[j];
		out[i] = (sum / (to - from) - 128) / 128;
	}
	return out;
}

/**
 * A value read between an array's entries, as a texture reads: `u` 0 is the
 * first, 1 the last, linearly blended between.
 *
 * @param {ArrayLike<number>} values The values, at least one.
 * @param {number} u Where, 0–1 (clamped).
 * @returns {number} The value there.
 */
export function sampleAt(values, u) {
	const at = Math.min(1, Math.max(0, u)) * (values.length - 1);
	const i = Math.floor(at);
	const j = Math.min(values.length - 1, i + 1);
	return values[i] + (values[j] - values[i]) * (at - i);
}

/**
 * Resamples values onto a finer array along a smooth curve through them
 * (Catmull-Rom), so a trace drawn from it has no corners.
 *
 * @param {ArrayLike<number>} values The values, at least two.
 * @param {Float32Array} out Filled with the curve, its ends on the first and last value.
 * @returns {Float32Array} `out`.
 */
export function smoothInto(values, out) {
	const last = values.length - 1;
	for (let i = 0; i < out.length; i++) {
		const at = (i / Math.max(1, out.length - 1)) * last;
		const j = Math.min(last - 1, Math.floor(at));
		const t = at - j;
		const p0 = values[Math.max(0, j - 1)];
		const p1 = values[j];
		const p2 = values[j + 1];
		const p3 = values[Math.min(last, j + 2)];
		out[i] = p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
	}
	return out;
}

/**
 * Eases a value towards a target over time: quick on the way up, slower on
 * the way down, as a meter's needle moves.
 *
 * @param {number} value Now.
 * @param {number} target Where it is headed.
 * @param {number} dt Seconds since the last step.
 * @param {number} rise The time constant going up, seconds.
 * @param {number} fall The time constant going down, seconds.
 * @returns {number} The value after the step.
 */
export function follow(value, target, dt, rise, fall) {
	return value + (target - value) * (1 - Math.exp(-dt / (target > value ? rise : fall)));
}

/**
 * What a meter reports each frame. The arrays are the meter's own, filled
 * again each frame.
 *
 * @typedef {object} Reading
 * @property {number} level How loud, 0–1 (`loudness`, eased).
 * @property {number} bass The bass band, 0–1, eased.
 * @property {number} mid The mid band, 0–1, eased.
 * @property {number} treble The treble band, 0–1, eased.
 * @property {number} kick A kick's light: 1 (or its strength) on a kick in the low end, fading over a fifth of a second.
 * @property {number} beats Kicks heard so far: an effect does something once each time it goes up.
 * @property {Float32Array} spectrum SPECTRUM log-spaced bins, 0–1, lowest first, eased.
 * @property {Float32Array} waveform WAVEFORM points of the trace (`scope`), -1–1, eased and scaled to its own recent peak.
 */

/**
 * @typedef {object} Meter
 * @property {Reading} reading The latest reading.
 * @property {(freq: ArrayLike<number>, time: ArrayLike<number>, binHz: number, dt: number) => Reading} update
 *   Reads a frame of the analyser's spectrum and waveform `dt` seconds after the last.
 */

/**
 * A meter: the analyser's bytes each frame in, an eased reading out.
 *
 * @returns {Meter} The meter, reading silence.
 */
export function createMeter() {
	/** @type {Reading} */
	const reading = { level: 0, bass: 0, mid: 0, treble: 0, kick: 0, beats: 0, spectrum: new Float32Array(SPECTRUM), waveform: new Float32Array(WAVEFORM) };
	const bins = new Float32Array(SPECTRUM);
	const trace = new Float32Array(WAVEFORM);
	/** The low end's recent average, the trace's recent peak, time since the last kick, and whether the next may come. */
	let low = 0;
	let peak = 0.2;
	let since = 1;
	let armed = true;

	/**
	 * Eases the reading towards a frame's values.
	 *
	 * @param {{ level: number, bass: number, mid: number, treble: number }} raw This frame's levels.
	 * @param {number} dt Seconds since the last frame.
	 */
	const ease = (raw, dt) => {
		reading.level = follow(reading.level, raw.level, dt, 0.04, 0.2);
		reading.bass = follow(reading.bass, raw.bass, dt, 0.03, 0.16);
		reading.mid = follow(reading.mid, raw.mid, dt, 0.03, 0.14);
		reading.treble = follow(reading.treble, raw.treble, dt, 0.02, 0.12);
		reading.kick *= Math.exp(-dt / 0.2);
		for (let i = 0; i < SPECTRUM; i++) reading.spectrum[i] = follow(reading.spectrum[i], bins[i], dt, 0.02, 0.12);
		const k = 1 - Math.exp(-dt / 0.05);
		for (let i = 0; i < WAVEFORM; i++) reading.waveform[i] += (trace[i] / peak - reading.waveform[i]) * k;
	};

	return {
		reading,
		update(freq, time, binHz, dt) {
			logSpectrum(freq, binHz, bins);
			scope(time, trace);
			let top = 0;
			for (let i = 0; i < WAVEFORM; i++) top = Math.max(top, Math.abs(trace[i]));
			peak = Math.max(0.08, top, peak * Math.exp(-dt / 1.5));
			// A kick: the low end jumping above where it has been lately.
			const kick = bandLevel(freq, binHz, BANDS.kick[0], BANDS.kick[1]);
			since += dt;
			if (kick - low > KICK_RISE && since > KICK_GAP && armed) {
				reading.kick = Math.min(1, 0.4 + (kick - low) * 5);
				reading.beats++;
				since = 0;
				armed = false;
			} else if (kick - low < KICK_RISE / 2) {
				armed = true;
			}
			low = follow(low, kick, dt, 0.25, 0.25);
			ease(
				{
					level: loudness(time),
					bass: bandLevel(freq, binHz, BANDS.bass[0], BANDS.bass[1]),
					mid: bandLevel(freq, binHz, BANDS.mid[0], BANDS.mid[1]),
					treble: bandLevel(freq, binHz, BANDS.treble[0], BANDS.treble[1]),
				},
				dt,
			);
			return reading;
		},
	};
}
