import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileGrid, glowUniform } from '../src/runtime/mosaic-reveal.js';
import { wrap, swipeStep } from '../src/runtime/slideshow.js';
import { toOklab, parseColor } from '../src/runtime/color.js';

test('wrap brings a slide number into range at either end', () => {
	assert.equal(wrap(0, 4), 0);
	assert.equal(wrap(4, 4), 0);
	assert.equal(wrap(-1, 4), 3);
	assert.equal(wrap(9, 4), 1);
	assert.equal(wrap(-9, 4), 3);
});

test('swipeStep takes a quick sideways stroke far enough across', () => {
	assert.equal(swipeStep(-120, 10, 200), 1);
	assert.equal(swipeStep(120, -10, 200), -1);
	// Too short, too slow, or more down than across.
	assert.equal(swipeStep(-20, 0, 200), 0);
	assert.equal(swipeStep(-120, 0, 1500), 0);
	assert.equal(swipeStep(-120, 100, 200), 0);
});

test('tileGrid puts the tiles across the longer side and keeps them square', () => {
	assert.deepEqual(tileGrid(9, 16 / 9), [9, 5]);
	assert.deepEqual(tileGrid(9, 9 / 16), [5, 9]);
	assert.deepEqual(tileGrid(9, 1), [9, 9]);
	// Never fewer than one, and whole tiles.
	assert.deepEqual(tileGrid(3, 10), [3, 1]);
	assert.deepEqual(tileGrid(0.4, 1), [1, 1]);
	assert.deepEqual(tileGrid(8.6, 2), [9, 5]);
});

test('glowUniform gives the outer colour and the core in Oklab, one colour serving as both', () => {
	const two = glowUniform(['#ff6a1a', '#ffe2b0']);
	assert.equal(two.length, 6);
	const outer = toOklab(parseColor('#ff6a1a'));
	const core = toOklab(parseColor('#ffe2b0'));
	[...outer, ...core].forEach((v, i) => assert.ok(Math.abs(two[i] - v) < 1e-6));
	const one = glowUniform(['#ff6a1a']);
	assert.deepEqual([...one.slice(0, 3)], [...one.slice(3)]);
});
