import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOLD_STYLES, foldHeight, foldHue, foldColors, foldsStill } from '../src/runtime/fluid-folds.js';

test('heights stay in 0–1, the same for the same settings, and the two styles differ', () => {
	const sigs = new Set();
	for (const style of FOLD_STYLES) {
		let sig = '';
		for (let y = 0.02; y < 1; y += 0.07)
			for (let x = 0.02; x < 0.8; x += 0.07) {
				const h = foldHeight({ style, seed: 3 }, x, y, 2);
				assert.ok(h >= 0 && h <= 1, `${style} ${x} ${y}: ${h}`);
				assert.equal(h, foldHeight({ style, seed: 3 }, x, y, 2));
				sig += h.toFixed(2);
			}
		sigs.add(sig);
	}
	assert.equal(sigs.size, FOLD_STYLES.length);
});

test('the folds are folds: crests and hollows across the frame, not one flat tone', () => {
	for (const style of FOLD_STYLES) {
		let lo = 1;
		let hi = 0;
		for (let y = 0.6; y < 1; y += 0.02) for (let x = 0.05; x < 0.8; x += 0.05) {
			const h = foldHeight({ style }, x, y);
			lo = Math.min(lo, h);
			hi = Math.max(hi, h);
		}
		assert.ok(hi > 0.85 && lo < 0.15, `${style}: ${lo}–${hi}`);
	}
});

test('dunes leave a dark sky above their level', () => {
	for (let x = 0.05; x < 0.8; x += 0.1) assert.ok(foldHeight({ style: 'dunes', level: 0.6 }, x, 0.1) < 0.01);
});

test('they move: the same point changes with time, and the hue drifts', () => {
	for (const style of FOLD_STYLES) {
		let moved = 0;
		for (let y = 0.6; y < 1; y += 0.1) for (let x = 0.05; x < 0.8; x += 0.1) moved += Math.abs(foldHeight({ style, rate: 0.2 }, x, y, 0) - foldHeight({ style, rate: 0.2 }, x, y, 3));
		assert.ok(moved > 0.5, `${style} (${moved})`);
	}
	const h = foldHue({}, 0.3, 0.4);
	assert.ok(h >= 0 && h < 1);
});

test('three colours, and a CSS-only still ending in the ground', () => {
	assert.deepEqual(foldColors({ colors: ['#111111', '#222222', '#333333'] }), ['#111111', '#222222', '#333333']);
	assert.deepEqual(foldColors({ colors: ['#111111', '#333333'] }), ['#111111', '#333333', '#333333']);
	for (const style of FOLD_STYLES) {
		const css = foldsStill({ style, background: '#050302' });
		assert.doesNotMatch(css, /url\(|data:/);
		assert.match(css, /, #050302$/);
	}
});
