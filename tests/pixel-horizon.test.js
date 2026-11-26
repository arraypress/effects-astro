import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HORIZON_SIDES, horizonBlocks, horizonColors, horizonStill } from '../src/runtime/pixel-horizon.js';

test('solid at its side, empty at the far one, broken between, for every side', () => {
	for (const side of HORIZON_SIDES) {
		const b = horizonBlocks({ side, level: 0.3, spread: 0.3, sway: 0, wander: 0 }, 24, 30, 2);
		const at = (fx, fy) => b[Math.floor(fy * 29.99)][Math.floor(fx * 23.99)];
		const near = { bottom: [0.5, 0.98], top: [0.5, 0.02], left: [0.02, 0.5], right: [0.98, 0.5] }[side];
		const far = { bottom: [0.5, 0.02], top: [0.5, 0.98], left: [0.98, 0.5], right: [0.02, 0.5] }[side];
		assert.equal(at(...near).lit, true, `${side} solid`);
		assert.equal(at(...near).chance, 1);
		assert.equal(at(...far).lit, false, `${side} empty`);
		const band = b.flat().filter((p) => p.chance > 0.1 && p.chance < 0.9);
		const lit = band.filter((p) => p.lit).length;
		assert.ok(band.length > 10 && lit > 0 && lit < band.length, `${side} broken`);
	}
});

test('blocks in the band roll again over time; the same time gives the same blocks', () => {
	const a = horizonBlocks({ seed: 3 }, 24, 30, 1);
	assert.deepEqual(a, horizonBlocks({ seed: 3 }, 24, 30, 1));
	const b = horizonBlocks({ seed: 3 }, 24, 30, 9);
	let changed = 0;
	for (let r = 0; r < 30; r++) for (let k = 0; k < 24; k++) if (a[r][k].lit !== b[r][k].lit) changed++;
	assert.ok(changed > 5, `${changed} changed`);
});

test('the quiet area clears the blocks behind copy', () => {
	const b = horizonBlocks({ level: 0.6, spread: 0.1, sway: 0, wander: 0, quiet: { radius: 0.4, depth: 1 } }, 24, 30, 0);
	assert.equal(b[15][12].lit, false);
	assert.equal(b[29][0].lit, true);
});

test('colours: one colour serves as both; the still is CSS only', () => {
	assert.deepEqual(horizonColors({ colors: ['#1aff00'] }), ['#1aff00', '#1aff00']);
	for (const side of HORIZON_SIDES) {
		const css = horizonStill({ side, background: '#0b0b0b', colors: ['#1aff00'], quiet: { radius: 0.4 } });
		assert.doesNotMatch(css, /url\(|data:/);
		assert.match(css, side === 'bottom' || side === 'top' ? /repeat-x/ : /repeat-y/);
		assert.match(css, /, #0b0b0b$/);
	}
});
