import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parkMiller, randomFrom, seededRandom, RANDOMS } from '../src/runtime/random.js';

const M = 2147483647;

test('parkMiller is the minimal standard: × 16807 mod 2³¹ − 1', () => {
	const rnd = parkMiller(1);
	assert.equal(rnd(), 16807 / M);
	assert.equal(rnd(), 282475249 / M);
	assert.equal(rnd(), 1622650073 / M);
	// Park and Miller's own check: from 1, the 10,000th state is 1043618065.
	const check = parkMiller(1);
	let v = 0;
	for (let i = 0; i < 10000; i++) v = check();
	assert.equal(v * M, 1043618065);
});

test('parkMiller stays over 0 and under 1, and a seed of 0 does not stick', () => {
	for (const seed of [0, M, -5, 7.9]) {
		const rnd = parkMiller(seed);
		for (let i = 0; i < 1000; i++) {
			const v = rnd();
			assert.ok(v > 0 && v < 1, `${seed}: ${v}`);
		}
	}
	assert.deepEqual([parkMiller(7.9)(), parkMiller(7.9)()], [parkMiller(7)(), parkMiller(7)()], 'the integer part');
});

test('randomFrom makes a generator by name, mulberry32 by default', () => {
	assert.deepEqual(Object.keys(RANDOMS), ['mulberry32', 'park-miller']);
	const a = randomFrom(undefined, 42);
	const b = seededRandom(42);
	assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
	const p = randomFrom('park-miller', 31);
	assert.equal(p(), (31 * 16807) / M);
	assert.throws(() => randomFrom(/** @type {any} */ ('xorshift'), 1), TypeError);
	assert.throws(() => randomFrom(/** @type {any} */ ('toString'), 1), TypeError);
});
