import { test } from 'node:test';
import assert from 'node:assert/strict';
import { axisList, DEFAULT_AXES, idleWave, swell, variation, widestSwell } from '../src/runtime/variable-type.js';

test('axes default to weight and width, and drop anything malformed', () => {
	assert.deepEqual(axisList(), [
		{ tag: 'wght', rest: 100, peak: 900 },
		{ tag: 'wdth', rest: 75, peak: 125 },
	]);
	assert.deepEqual(axisList(DEFAULT_AXES), axisList());
	assert.deepEqual(axisList(/** @type {any} */ ({ slnt: [0, -10], weight: [1, 2], opsz: [8], GRAD: [0, 'x'] })), [{ tag: 'slnt', rest: 0, peak: -10 }]);
});

test('a variation runs from rest to peak', () => {
	const axes = axisList({ wght: [200, 1000], slnt: [0, -10] });
	assert.equal(variation(axes, 0), '"wght" 200, "slnt" 0');
	assert.equal(variation(axes, 1), '"wght" 1000, "slnt" -10');
	assert.equal(variation(axes, 0.5), '"wght" 600, "slnt" -5');
	assert.equal(variation([], 0.5), 'normal');
});

test('a swell peaks under the pointer and is gone at its radius', () => {
	assert.equal(swell(0, 1, 0.5), 1);
	assert.equal(swell(1, 1, 0.5), 0);
	assert.equal(swell(3, 1, 0.5), 0);
	assert.equal(swell(0.2, 0, 0.5), 0);
	assert.ok(swell(0.3, 1, 0.5) > swell(0.6, 1, 0.5));
	// A sharper falloff drops away faster.
	assert.ok(swell(0.5, 1, 1) < swell(0.5, 1, 0));
});

test('the idle swell stays between 0 and 1 and travels', () => {
	for (let x = 0; x < 12; x += 0.37) {
		const v = idleWave(x, 1.3);
		assert.ok(v >= 0 && v <= 1);
	}
	assert.ok(Math.abs(idleWave(0, 0) - 1) < 1e-9);
	// The crest at 0 has moved on a second later.
	assert.ok(idleWave(0, 1) < 1);
});

test('the widest swell is found along the line', () => {
	const xs = [0, 1, 2, 3, 4];
	const growth = [10, 10, 10, 10, 10];
	// Only the letter under the crest grows: one letter's worth.
	assert.equal(widestSwell(xs, growth, (offset) => (offset === 0 ? 1 : 0)), 10);
	// Every letter grows fully: all of them.
	assert.equal(widestSwell(xs, growth, () => 1), 50);
	assert.equal(widestSwell([], [], () => 1), 0);
	const wide = widestSwell(xs, growth, (offset) => swell(Math.abs(offset), 1.5, 0.5));
	assert.ok(wide > 10 && wide < 50);
});
