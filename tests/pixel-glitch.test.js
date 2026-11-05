import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outlineAlpha, rowTears } from '../src/runtime/pixel-glitch.js';

/**
 * An RGBA picture with solid rectangles in it.
 *
 * @param {number} w Width.
 * @param {number} h Height.
 * @param {Array<[number, number, number, number]>} rects Each x, y, width, height.
 * @returns {Uint8ClampedArray} The picture.
 */
function picture(w, h, rects) {
	const px = new Uint8ClampedArray(w * h * 4);
	for (const [x0, y0, rw, rh] of rects) {
		for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) px[(y * w + x) * 4 + 3] = 255;
	}
	return px;
}

test('outlineAlpha keeps a band inside the edge and empties the middle', () => {
	const out = outlineAlpha(picture(20, 20, [[2, 2, 16, 16]]), 20, 20, 2);
	assert.equal(out.length, 400);
	assert.equal(out[0], 0, 'outside stays empty');
	assert.equal(out[2 * 20 + 2], 255, 'the corner is edge');
	assert.equal(out[10 * 20 + 3], 255, 'within the width of the edge');
	assert.equal(out[10 * 20 + 10], 0, 'the middle is hollow');
});

test('outlineAlpha draws one outline round shapes that overlap, not their crossings', () => {
	// Two squares overlapping by half: where they cross, inside the union, there is no line.
	const out = outlineAlpha(picture(40, 20, [[2, 2, 16, 16], [10, 2, 16, 16]]), 40, 20, 2);
	assert.equal(out[10 * 40 + 17], 0, "the first square's right edge, inside the second, is gone");
	assert.equal(out[10 * 40 + 10], 0, "the second's left edge, inside the first, is gone");
	assert.equal(out[10 * 40 + 25], 255, 'the outer edge stays');
});

test('outlineAlpha keeps antialiased edges soft and takes at least a pixel', () => {
	const px = picture(10, 10, [[2, 2, 6, 6]]);
	px[(5 * 10 + 1) * 4 + 3] = 100;
	const out = outlineAlpha(px, 10, 10, 0.2);
	assert.equal(out[5 * 10 + 1], 100, 'a half-covered edge pixel keeps its coverage');
	assert.equal(out[5 * 10 + 5], 0, 'the inside is still hollow at a width under a pixel');
});

/**
 * Random values from a list, recording how many were asked for.
 *
 * @param {number[]} values The values, in order.
 * @returns {(() => number) & { used: number }} The generator.
 */
function scripted(values) {
	const next = () => values[next.used++];
	next.used = 0;
	return next;
}

test('rowTears: a row tears by its hottest cell, on some frames, the rest stay put', () => {
	// Three rows of four: cold, warm (0.4), hot (0.9 in one cell).
	const heat = Float32Array.from([0, 0, 0, 0, 0.4, 0.4, 0.4, 0.4, 0.1, 0.9, 0.2, 0]);
	const rnd = scripted([0.1, 1]);
	const tears = rowTears(heat, 4, 3, 22, rnd);
	assert.equal(rnd.used, 2, 'only the hot row draws (whether, then how far), as the site did');
	assert.deepEqual([...tears], [0, 0, Math.round((1 - 0.5) * Math.fround(0.9) * 22)]);
	// The same row, on a frame that does not tear.
	const calm = scripted([0.5]);
	assert.deepEqual([...rowTears(heat, 4, 3, 22, calm)], [0, 0, 0]);
	assert.equal(calm.used, 1);
});

test('rowTears slips either way, at most half the shift', () => {
	const heat = Float32Array.from([1, 1]);
	assert.deepEqual([...rowTears(heat, 1, 2, 22, scripted([0, 0, 0, 0.999999]))], [-11, 11]);
	assert.deepEqual([...rowTears(heat, 1, 2, 22, Math.random)].map((v) => Math.abs(v) <= 11), [true, true]);
});
