import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANDS, SPECTRUM, WAVEFORM, bandLevel, loudness, logSpectrum, scope, sampleAt, smoothInto, follow, createMeter } from '../src/runtime/audio-meter.js';
import { readable } from '../src/runtime/audio.js';

/** Hz per bin for a 2048-point FFT at 44.1 kHz, as the analyser has it. */
const BIN = 44100 / 2048;

/**
 * A spectrum of 1024 bins, loud (`value`) between two frequencies and silent elsewhere.
 *
 * @param {number} lo Hz.
 * @param {number} hi Hz.
 * @param {number} [value=255] The loud bins' byte.
 * @returns {Uint8Array} The spectrum.
 */
function spectrum(lo, hi, value = 255) {
	return Uint8Array.from({ length: 1024 }, (_, i) => (i * BIN >= lo && i * BIN <= hi ? value : 0));
}

/**
 * A sine wave as the analyser's bytes: 2048 samples centred on 128.
 *
 * @param {number} amplitude 0–1 of full scale.
 * @param {number} [cycles=16] Cycles across the buffer.
 * @param {number} [phase=0] Its starting phase, radians.
 * @returns {Uint8Array} The waveform.
 */
function sine(amplitude, cycles = 16, phase = 0) {
	return Uint8Array.from({ length: 2048 }, (_, i) => Math.round(128 + 127 * amplitude * Math.sin((i / 2048) * cycles * 2 * Math.PI + phase)));
}

test('bandLevel averages the bins in a band, 0–1', () => {
	const bass = spectrum(BANDS.bass[0], BANDS.bass[1]);
	assert.ok(bandLevel(bass, BIN, ...BANDS.bass) > 0.9);
	assert.equal(bandLevel(bass, BIN, ...BANDS.treble), 0);
	assert.equal(bandLevel(new Uint8Array(1024), BIN, 20, 250), 0);
	assert.equal(bandLevel(spectrum(0, 30000, 128), BIN, 1000, 2000), 128 / 255);
	// A band above the spectrum's top is silent, not an error.
	assert.equal(bandLevel(bass, BIN, 40000, 50000), 0);
});

test('loudness maps RMS in decibels to 0–1: silence 0, full scale 1, half scale between', () => {
	assert.equal(loudness(new Uint8Array(2048).fill(128)), 0);
	assert.equal(loudness(new Uint8Array(0)), 0);
	assert.equal(loudness(sine(1)), 1);
	const half = loudness(sine(0.5));
	assert.ok(half > 0.6 && half < 1, `half scale reads ${half}`);
	assert.ok(loudness(sine(0.05)) < half);
	assert.ok(loudness(sine(0.001)) < 0.05);
});

test('logSpectrum puts low notes in the low bins and high notes in the high ones', () => {
	const out = new Float32Array(48);
	logSpectrum(spectrum(60, 120), BIN, out);
	const lowPeak = out.indexOf(Math.max(...out));
	logSpectrum(spectrum(6000, 9000), BIN, out);
	const highPeak = out.indexOf(Math.max(...out));
	assert.ok(lowPeak < 8, `bass peaks at bin ${lowPeak}`);
	assert.ok(highPeak > 36, `treble peaks at bin ${highPeak}`);
	assert.ok(out.every((v) => v >= 0 && v <= 1));
	// Silence is silent, the tilt included; the treble is weighted up beside the bass.
	assert.ok(logSpectrum(new Uint8Array(1024), BIN, out).every((v) => v === 0));
	logSpectrum(spectrum(0, 30000, 100), BIN, out);
	assert.ok(out[47] > out[0]);
});

test('scope starts at a rising zero crossing, so a steady note holds still', () => {
	const a = scope(sine(0.8, 16, 0.3), new Float32Array(64));
	const b = scope(sine(0.8, 16, 2.1), new Float32Array(64));
	assert.ok(a[0] >= 0 && a[0] < 0.4 && a[1] > a[0], 'starts rising from zero');
	for (let i = 0; i < 64; i++) assert.ok(Math.abs(a[i] - b[i]) < 0.08, `point ${i}: ${a[i]} vs ${b[i]}`);
	assert.ok(Math.max(...a) > 0.6 && Math.min(...a) < -0.6);
	assert.ok(scope(new Uint8Array(2048).fill(128), new Float32Array(16)).every((v) => v === 0));
});

test('sampleAt reads between entries, clamped at the ends', () => {
	const v = [0, 10, 20];
	assert.equal(sampleAt(v, 0), 0);
	assert.equal(sampleAt(v, 1), 20);
	assert.equal(sampleAt(v, 0.25), 5);
	assert.equal(sampleAt(v, -1), 0);
	assert.equal(sampleAt(v, 2), 20);
	assert.equal(sampleAt([7], 0.5), 7);
});

test('smoothInto passes through every value, smoothly between, and keeps a line straight', () => {
	const v = [0, 1, 0, -1, 0];
	const out = smoothInto(v, new Float32Array(17));
	for (let i = 0; i < v.length; i++) assert.ok(Math.abs(out[i * 4] - v[i]) < 1e-6, `point ${i}`);
	assert.ok(out[2] > 0.5 && out[2] < 1, 'between 0 and 1 on the way up');
	// Away from the ends (where the curve has no neighbour to aim by), a line stays straight.
	const line = smoothInto([0, 1, 2, 3, 4], new Float32Array(9));
	for (let i = 2; i <= 6; i++) assert.ok(Math.abs(line[i] - i / 2) < 1e-6, `point ${i}: ${line[i]}`);
});

test('follow rises on its rise time and falls on its fall time', () => {
	assert.ok(Math.abs(follow(0, 1, 0.1, 0.1, 1) - (1 - Math.exp(-1))) < 1e-9);
	assert.ok(Math.abs(follow(1, 0, 0.1, 0.1, 1) - Math.exp(-0.1)) < 1e-9);
	assert.equal(follow(0.5, 0.5, 0.1, 0.1, 0.1), 0.5);
	assert.equal(follow(0.3, 1, 0, 0.1, 0.1), 0.3);
});

test('a meter eases towards the sound, and counts a kick when the low end jumps', () => {
	const meter = createMeter();
	assert.equal(meter.reading.spectrum.length, SPECTRUM);
	assert.equal(meter.reading.waveform.length, WAVEFORM);
	const quiet = new Uint8Array(1024);
	const still = new Uint8Array(2048).fill(128);
	for (let i = 0; i < 30; i++) meter.update(quiet, still, BIN, 1 / 60);
	assert.equal(meter.reading.beats, 0);
	assert.equal(meter.reading.level, 0);

	// A kick drum: the low end, all at once.
	const thump = spectrum(40, 160);
	const loud = sine(0.9, 4);
	meter.update(thump, loud, BIN, 1 / 60);
	assert.equal(meter.reading.beats, 1);
	assert.ok(meter.reading.kick > 0.9);
	for (let i = 0; i < 30; i++) meter.update(thump, loud, BIN, 1 / 60);
	assert.equal(meter.reading.beats, 1, 'a held note is not a new kick');
	assert.ok(meter.reading.kick < 0.2, 'the kick fades');
	assert.ok(meter.reading.bass > 0.4 && meter.reading.treble === 0);
	assert.ok(meter.reading.level > 0.9);
	assert.ok(meter.reading.spectrum[0] > 0.8 && meter.reading.spectrum[SPECTRUM - 1] < 0.2);
	assert.ok(Math.max(...meter.reading.waveform) > 0.8, 'the trace fills its range');

	// Silence, then another kick.
	for (let i = 0; i < 40; i++) meter.update(quiet, still, BIN, 1 / 60);
	meter.update(thump, loud, BIN, 1 / 60);
	assert.equal(meter.reading.beats, 2);
});

test('readable: same origin, blob, data and CORS audio can be read; other origins without CORS cannot', () => {
	const origin = 'https://shop.example';
	assert.ok(readable('/audio/loop.mp3', null, origin));
	assert.ok(readable('https://shop.example/audio/loop.mp3', null, origin));
	assert.ok(readable('blob:https://shop.example/1234', null, origin));
	assert.ok(readable('data:audio/mpeg;base64,AAAA', null, origin));
	assert.ok(readable('https://cdn.example/loop.mp3', 'anonymous', origin));
	assert.ok(readable('', null, origin), 'a stream set as srcObject');
	assert.equal(readable('https://cdn.example/loop.mp3', null, origin), false);
	assert.equal(readable('http://shop.example/loop.mp3', null, origin), false, 'another scheme is another origin');
});
