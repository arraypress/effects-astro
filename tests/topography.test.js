import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LATTICE, OCTAVES, LOW, HIGH, MEAN_SLOPE, latticeData, driftAt, fieldAt, onContour, digitsOf, halton } from '../src/runtime/topography.js';

const lattice = latticeData();

test('latticeData packs each cell with its right, up and up-right neighbours, wrapping', () => {
	assert.equal(lattice.length, LATTICE * LATTICE * 4);
	const at = (x, y) => lattice[((y % LATTICE) * LATTICE + (x % LATTICE)) * 4];
	for (const [x, y] of [[0, 0], [5, 9], [LATTICE - 1, 3], [7, LATTICE - 1], [LATTICE - 1, LATTICE - 1]]) {
		const i = (y * LATTICE + x) * 4;
		assert.deepEqual([...lattice.subarray(i, i + 4)], [at(x, y), at(x + 1, y), at(x, y + 1), at(x + 1, y + 1)]);
	}
	assert.deepEqual(latticeData(), lattice, 'the same seed, the same land');
	assert.notDeepEqual(latticeData(1), lattice);
});

test('driftAt starts each octave at its offset and moves it at its rate', () => {
	const now = driftAt(0);
	const later = driftAt(10);
	OCTAVES.forEach(({ offset, drift }, k) => {
		assert.ok(Math.abs(now[k * 2] - offset[0]) < 1e-5 && Math.abs(now[k * 2 + 1] - offset[1]) < 1e-5);
		assert.ok(Math.abs(later[k * 2] - now[k * 2] - drift[0] * 10) < 1e-4);
	});
});

test('fieldAt gives the slope of the height it gives', () => {
	const drift = driftAt(40);
	const e = 1e-5;
	for (const [x, y] of [[0, 0], [0.31, -0.22], [-0.8, 0.45], [1.7, 0.1]]) {
		const [h, gx, gy] = fieldAt(lattice, drift, 1.3, x, y);
		const dx = (fieldAt(lattice, drift, 1.3, x + e, y)[0] - fieldAt(lattice, drift, 1.3, x - e, y)[0]) / (2 * e);
		const dy = (fieldAt(lattice, drift, 1.3, x, y + e)[0] - fieldAt(lattice, drift, 1.3, x, y - e)[0]) / (2 * e);
		assert.ok(h > 0 && h < 1);
		assert.ok(Math.abs(gx - dx) < 1e-4 && Math.abs(gy - dy) < 1e-4, `${x}, ${y}`);
	}
});

test('MEAN_SLOPE, LOW and HIGH match the field', () => {
	let slope = 0;
	const heights = [];
	for (const t of [0, 300]) {
		const drift = driftAt(t);
		for (let i = 0; i < 120; i++) {
			for (let j = 0; j < 120; j++) {
				const [h, , gy] = fieldAt(lattice, drift, 1, i * 0.41 - 25, j * 0.33 - 20);
				slope += Math.abs(gy);
				heights.push(h);
			}
		}
	}
	slope /= heights.length;
	heights.sort((a, b) => a - b);
	assert.ok(Math.abs(slope / MEAN_SLOPE - 1) < 0.1, `mean slope ${slope}`);
	assert.ok(Math.abs(heights[Math.floor(heights.length * 0.02)] - LOW) < 0.04);
	assert.ok(Math.abs(heights[Math.floor(heights.length * 0.98)] - HIGH) < 0.04);
});

test('onContour walks a point onto the line, and gives up on flat ground', () => {
	const drift = driftAt(40);
	const height = (x, y) => fieldAt(lattice, drift, 1.3, x, y);
	const level = height(0.2, 0.1)[0] + 0.01;
	const at = onContour(height, 0.2, 0.1, level, 8);
	assert.ok(at && Math.abs(height(at.x, at.y)[0] - level) < 1e-5 && at.miss < 1e-4);
	assert.equal(onContour(() => [0.5, 0, 0], 0, 0, 0.6), null);
});

test('digitsOf spells a number left to right, padded and clamped', () => {
	assert.deepEqual(digitsOf(800), [8, 0, 0, -1]);
	assert.deepEqual(digitsOf(1260), [1, 2, 6, 0]);
	assert.deepEqual(digitsOf(-5), [0, -1, -1, -1]);
	assert.deepEqual(digitsOf(123456), [9, 9, 9, 9]);
});

test('halton spreads points over the square', () => {
	assert.deepEqual(halton(1), [0.5, 1 / 3]);
	assert.deepEqual(halton(2), [0.25, 2 / 3]);
	const points = Array.from({ length: 64 }, (_, i) => halton(i + 1));
	assert.ok(points.every(([x, y]) => x > 0 && x < 1 && y > 0 && y < 1));
	for (const [qx, qy] of [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]) {
		assert.ok(points.some(([x, y]) => x >= qx && x < qx + 0.5 && y >= qy && y < qy + 0.5));
	}
});
