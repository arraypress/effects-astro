import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sliceRuns, runsTexture, slabGrowth } from '../src/runtime/slab-runs.js';
import { sliceTints, stackLayout } from '../src/runtime/glass-stack.js';

/** A mask from rows of '#' and '.'. */
const maskOf = (rows) => {
	const width = rows[0].length,
		height = rows.length;
	const alpha = new Uint8ClampedArray(width * height);
	rows.forEach((row, y) => [...row].forEach((ch, x) => (alpha[y * width + x] = ch === '#' ? 255 : 0)));
	return { alpha, width, height };
};

test('each slice finds its runs, gaps kept open', () => {
	const mask = maskOf(['..........', '.###..###.', '.###..###.', '..........', '...####...', '...####...']);
	const runs = sliceRuns(mask, 2, { phase: 0.5, band: 1 });
	assert.deepEqual(runs[0], [
		{ from: 1, to: 3 },
		{ from: 6, to: 8 },
	]);
	assert.deepEqual(runs[1], [{ from: 3, to: 6 }]);
});

test('a slice samples a band, so a small part between lines is not lost', () => {
	const mask = maskOf(['....##....', '..........', '..........', '..........', '..........', '..........']);
	assert.deepEqual(sliceRuns(mask, 1, { phase: 0.5, band: 0 }), [[]]);
	assert.deepEqual(sliceRuns(mask, 1, { phase: 0.5, band: 1 }), [[{ from: 4, to: 5 }]]);
});

test('runs narrower than the minimum are dropped', () => {
	const mask = maskOf(['#.##.####.']);
	assert.deepEqual(
		sliceRuns(mask, 1, { band: 1, min: 3 })[0].map((r) => r.from),
		[5],
	);
});

test('the texture holds where each column is along its run', () => {
	const tex = runsTexture([[{ from: 2, to: 5 }]], 8);
	const along = (x) => ((tex[x * 4] << 8) | tex[x * 4 + 1]) / 65535;
	assert.equal(tex[0 * 4 + 2], 0, 'outside');
	assert.equal(tex[2 * 4 + 2], 255, 'inside');
	assert.ok(Math.abs(along(2) - 0.125) < 1e-3 && Math.abs(along(5) - 0.875) < 1e-3);
	assert.ok(along(3) < along(4));
	assert.equal(tex[2 * 4 + 3], Math.round((4 / 8) * 255));
});

test('the discs grow from the bottom up and settle on 1', () => {
	const n = 10;
	assert.ok(slabGrowth(n - 1, n, 0.3) > 0 && slabGrowth(0, n, 0.3) === 0, 'the bottom first');
	for (let i = 0; i < n; i++) assert.equal(slabGrowth(i, n, 1.61), 1);
	let peak = 0;
	for (let t = 0; t < 1.6; t += 0.01) peak = Math.max(peak, slabGrowth(n - 1, n, t));
	assert.ok(peak > 1 && peak < 1.25, `it overshoots a little (${peak})`);
	assert.equal(slabGrowth(3, n, 0, 0), 1, 'no intro: whole at once');
});

test('the tints run from the first colour at the top to the last at the bottom', () => {
	const t = sliceTints(['#ff0000', '#0000ff'], 5);
	assert.equal(t.length, 5);
	assert.deepEqual(t[0].map((v) => Math.round(v * 255)), [255, 0, 0]);
	assert.deepEqual(t[4].map((v) => Math.round(v * 255)), [0, 0, 255]);
});

test('the stack sits in a square box centred in its area', () => {
	const l = stackLayout({ area: { x: 0, y: 0, width: 1, height: 0.5 }, logoScale: 0.8 }, 2);
	assert.deepEqual(l.centre, { x: 0.5, y: 0.25 });
	assert.ok(Math.abs(l.edge - 0.4) < 1e-9);
});
