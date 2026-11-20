import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOISE_RAMPS, rampOf, noiseField, asciiCells, noiseColors } from '../src/runtime/ascii-noise.js';
import { GLYPH_SETS } from '../src/runtime/glyphs.js';

test('rampOf takes a ramp, a glyph set or the characters, and falls back to ascii', () => {
	assert.deepEqual(rampOf('shade'), [...NOISE_RAMPS.shade]);
	assert.deepEqual(rampOf('binary'), [...GLYPH_SETS.binary]);
	assert.deepEqual(rampOf(' xo'), [' ', 'x', 'o']);
	assert.deepEqual(rampOf(), [...NOISE_RAMPS.ascii]);
	assert.deepEqual(rampOf('x'), [...NOISE_RAMPS.ascii], 'one character is no ramp');
	for (const ramp of Object.values(NOISE_RAMPS)) assert.ok([...ramp].length > 1);
});

test('noiseField stays in 0–1, is the same for the same input, and moves with its clocks', () => {
	let sum = 0;
	let n = 0;
	for (let x = -3; x < 3; x += 0.37)
		for (let y = -3; y < 3; y += 0.41) {
			const v = noiseField(x, y, 1.5, 7);
			assert.ok(v >= 0 && v <= 1, `${x}, ${y}: ${v}`);
			sum += v;
			n++;
		}
	assert.ok(Math.abs(sum / n - 0.5) < 0.08, `mean ${sum / n}`);
	assert.equal(noiseField(0.3, 0.7, 2, 4), noiseField(0.3, 0.7, 2, 4));
	assert.notEqual(noiseField(0.3, 0.7, 2, 4), noiseField(0.3, 0.7, 3, 4));
	assert.notEqual(noiseField(0.3, 0.7, 2, 4), noiseField(0.3, 0.7, 2, 9));
});

test('asciiCells fills the grid with indices into the ramp, both quiet and loud at the default contrast', () => {
	const cells = asciiCells({}, 40, 30);
	const n = rampOf().length;
	assert.equal(cells.length, 30);
	assert.ok(cells.every((row) => row.length === 40));
	const flat = cells.flat();
	assert.ok(flat.every((i) => Number.isInteger(i) && i >= 0 && i < n));
	assert.ok(flat.includes(0) && flat.includes(n - 1), 'blobs: some cells empty, some full');
	assert.deepEqual(asciiCells({}, 40, 30), cells, 'the same settings, the same frame');
	assert.notDeepEqual(asciiCells({ offset: [3, 1] }, 40, 30), cells);
	assert.notDeepEqual(asciiCells({}, 40, 30, 5), cells, 'it moves');
});

test('asciiCells keeps the quiet area quiet', () => {
	const loud = { brightness: 0.4 };
	const cells = asciiCells({ ...loud, quiet: { radius: 0.3, depth: 1 } }, 40, 30);
	const open = asciiCells(loud, 40, 30);
	assert.equal(cells[15][20], 0, 'the centre is empty');
	assert.ok(open[15][20] > 0);
	assert.deepEqual(cells[0], open[0], 'the edge is untouched');
});

test('noiseColors gives the quiet and loud colours, a palette its ends', () => {
	assert.deepEqual(noiseColors({}), ['#3a3a3a', '#ffffff']);
	assert.deepEqual(noiseColors({ colors: ['#111111', '#222222'] }), ['#111111', '#222222']);
	const [lo, hi] = noiseColors({ palette: 'Mono' });
	assert.match(lo, /^#/);
	assert.match(hi, /^#/);
});
