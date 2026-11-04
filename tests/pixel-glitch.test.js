import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outlineAlpha } from '../src/runtime/pixel-glitch.js';

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
