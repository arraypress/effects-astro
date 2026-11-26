import { test } from 'node:test';
import assert from 'node:assert/strict';
import { truchetTile, truchetTone, truchetColors, truchetStill, TRUCHET_DEFAULTS } from '../src/runtime/truchet-field.js';

test('a tile is one way or the other, about half each, and the same for the same seed', () => {
	let ones = 0;
	for (let r = 0; r < 30; r++)
		for (let c = 0; c < 30; c++) {
			const a = truchetTile({ seed: 2 }, c, r, 4);
			assert.ok(a.way === 0 || a.way === 1);
			assert.deepEqual(a, truchetTile({ seed: 2 }, c, r, 4));
			ones += a.way;
		}
	assert.ok(ones > 350 && ones < 550, `${ones} of 900`);
});

test('a few tiles turn at a time, each turn running 0–1 and ending on its new way', () => {
	const config = { seed: 1, period: 4, turn: 0.5 };
	let turning = 0;
	for (let c = 0; c < 40; c++)
		for (let r = 0; r < 40; r++) {
			const { turning: t } = truchetTile(config, c, r, 10);
			assert.ok(t >= 0 && t < 1);
			if (t > 0) turning++;
		}
	assert.ok(turning > 0 && turning < 1600 * 0.15, `${turning} turning`);
	// Over a long run every tile changes its way at least once.
	const changed = [0, 1, 2, 3].map((c) => new Set(Array.from({ length: 60 }, (_, i) => truchetTile(config, c, 5, i * 1.7).way)).size);
	assert.ok(changed.every((n) => n === 2));
});

test('the tone is 0–1 and drifts with time', () => {
	let moved = 0;
	for (let x = 0; x < 1; x += 0.1)
		for (let y = 0; y < 1.25; y += 0.1) {
			const a = truchetTone({}, x, y, 0);
			const b = truchetTone({}, x, y, 20);
			assert.ok(a >= 0 && a <= 1);
			moved += Math.abs(a - b);
		}
	assert.ok(moved > 1);
});

test('colours and a CSS-only still of arcs at the tile size', () => {
	assert.deepEqual(truchetColors({ colors: ['#101010', '#f0f0f0'] }), ['#101010', '#f0f0f0']);
	const css = truchetStill({ background: '#0b0b0b', tile: 30, quiet: { radius: 0.5 } });
	assert.doesNotMatch(css, /url\(|data:/);
	assert.match(css, /\/ 30px 30px/);
	assert.match(css, /, #0b0b0b$/);
	assert.equal(TRUCHET_DEFAULTS.tube, true);
});
