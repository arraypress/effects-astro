import { test } from 'node:test';
import assert from 'node:assert/strict';
import { samplePoints, gridPoints, distanceField, blurField, fontAt } from '../src/runtime/shape.js';
import { paletteUniform, quietUniform } from '../src/runtime/glsl.js';
import { GLYPH_SETS } from '../src/runtime/glyphs.js';

/**
 * A square mask: a filled square in the middle of an empty canvas.
 *
 * @param {number} size The canvas's side.
 * @param {number} inset The empty margin round the square.
 * @returns {import('../src/runtime/shape.js').Mask} The mask (no canvas; the helpers only read alpha).
 */
const square = (size, inset) => {
	const alpha = new Uint8ClampedArray(size * size);
	for (let y = inset; y < size - inset; y++) for (let x = inset; x < size - inset; x++) alpha[y * size + x] = 255;
	return /** @type {any} */ ({ alpha, width: size, height: size });
};

/**
 * A seeded random source, so layouts repeat.
 *
 * @param {number} seed The seed.
 * @returns {() => number} 0–1, repeatably.
 */
const seeded = (seed) => () => {
	seed = (seed * 16807) % 2147483647;
	return (seed - 1) / 2147483646;
};

test('samplePoints lands every point inside the shape', () => {
	const mask = square(40, 10);
	const points = samplePoints(mask, 500, seeded(7));
	assert.equal(points.length, 1000);
	for (let i = 0; i < points.length; i += 2) {
		const x = points[i] * 40;
		const y = (1 - points[i + 1]) * 40;
		assert.ok(x >= 10 && x <= 30 && y >= 10 && y <= 30, `${x}, ${y} is outside`);
	}
});

test('samplePoints on an empty mask gives zeros, not a crash', () => {
	const points = samplePoints(square(10, 5), 4);
	assert.deepEqual([...points], [0, 0, 0, 0, 0, 0, 0, 0]);
});

test('gridPoints puts a dot in each grid cell inside the shape', () => {
	// 40 px across, 10 columns: 4 px cells; the square covers 20 px, five cells a side.
	assert.equal(gridPoints(square(40, 10), 10).length / 2, 25);
});

test('distanceField is 0.5 at the edge, higher inside, lower outside', () => {
	const mask = square(64, 16);
	const field = distanceField(mask, 8);
	/**
	 * The field at a pixel.
	 *
	 * @param {number} x Across.
	 * @param {number} y Down.
	 * @returns {number} Its byte.
	 */
	const at = (x, y) => field[y * 64 + x];
	assert.ok(Math.abs(at(16, 32) - 128) <= 20, `edge is ${at(16, 32)}`);
	assert.equal(at(32, 32), 255);
	assert.equal(at(2, 2), 0);
	assert.ok(at(20, 32) > at(17, 32), 'rises going in');
});

test('blurField leaves a flat field flat, and softens a step', () => {
	const flat = new Uint8Array(100).fill(200);
	assert.ok(blurField(flat, 10, 10, 2).every((v) => v === 200));
	const step = new Uint8Array(100).map((_, i) => (i % 10 < 5 ? 0 : 255));
	const soft = blurField(step, 10, 10, 2);
	assert.ok(soft[4] > 0 && soft[4] < 255 && soft[5] > 0 && soft[5] < 255);
});

test('fontAt puts the style and weight before the size', () => {
	assert.equal(fontAt('900 Anton, sans-serif', 120), '900 120px Anton, sans-serif');
	assert.equal(fontAt('italic 700 Inter', 40), 'italic 700 40px Inter');
	assert.equal(fontAt('Georgia, serif', 16), '16px Georgia, serif');
});

test('paletteUniform gives three Oklab colours, repeating a short palette', () => {
	const one = paletteUniform(['#ffffff']);
	assert.equal(one.length, 9);
	assert.ok(Math.abs(one[0] - 1) < 1e-3 && Math.abs(one[3] - 1) < 1e-3);
});

test('quietUniform centres the area and turns it off when absent', () => {
	assert.deepEqual(quietUniform(null, 2), [0, 0, 0, 0]);
	assert.deepEqual(quietUniform({ x: 0.75, y: 0.25, radius: 0.5, depth: 0.6 }, 2), [0.5, 0.25, 0.5, 0.6]);
	assert.deepEqual(quietUniform({}, 1), [0, 0, 0.8, 0.72]);
});

test('every glyph set runs from empty to full', () => {
	for (const [name, set] of Object.entries(GLYPH_SETS)) {
		assert.equal(set[0], ' ', `${name} should start empty`);
		assert.ok([...set].length >= 3, `${name} needs steps`);
	}
});
