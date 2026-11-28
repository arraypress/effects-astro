import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameGate, SLOW_FPS } from '../src/runtime/stage.js';

/** Runs a gate over `frames` frames of `hz`, and returns the drawn frames' times. */
const run = (fps, hz, frames, jitter = 0) => {
	const gate = frameGate(fps);
	const drawn = [];
	for (let i = 0; i < frames; i++) {
		const dt = (1 + (i % 2 ? jitter : -jitter)) / hz;
		const whole = gate(dt);
		if (whole > 0) drawn.push(whole);
	}
	return drawn;
};

test('a slow effect asks for 30 frames a second', () => {
	assert.equal(SLOW_FPS, 30);
});

test('capped at 30: every other frame of a 60 Hz screen, one in four at 120 Hz, every frame of a slower screen', () => {
	assert.equal(run(30, 60, 600).length, 300);
	assert.equal(run(30, 120, 1200).length, 300);
	assert.equal(run(30, 30, 300).length, 300);
	assert.equal(run(30, 24, 240).length, 240);
});

test('an uneven screen never drops a capped effect to every third frame', () => {
	assert.equal(run(30, 60, 600, 0.08).length, 300);
	assert.equal(run(30, 60, 600, 0.2).length, 300);
});

test('no time is lost: the drawn frames cover the time of the ones passed over, so the effect keeps its speed', () => {
	for (const hz of [60, 75, 90, 120, 144]) {
		const drawn = run(30, hz, hz * 10);
		const covered = drawn.reduce((a, b) => a + b, 0);
		// all but, at most, the last passed-over frames
		assert.ok(10 - covered < 2 / hz + 1e-9, `${hz} Hz covers ${covered}`);
		assert.ok(drawn.length <= 10 * 30 * 1.34, `${hz} Hz draws ${drawn.length}`);
	}
});

test('two capped effects take turns on a 60 Hz screen: one starts half a gap ahead, so each frame draws one of them', () => {
	const a = frameGate(30),
		b = frameGate(30, 0.5 / 30);
	let both = 0,
		drawn = 0;
	for (let i = 0; i < 600; i++) {
		const x = a(1 / 60) > 0,
			y = b(1 / 60) > 0;
		if (x && y) both++;
		drawn += Number(x) + Number(y);
	}
	assert.equal(both, 0);
	assert.equal(drawn, 600);
});
