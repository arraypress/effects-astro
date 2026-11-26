import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLOW_SHAPES, glowAt, fluteSample, glowColors, glowStill } from '../src/runtime/fluted-glow.js';

test('the ring is brightest at its radius and dark in its middle and far out', () => {
	const c = { shape: 'ring', size: 0.3, thickness: 0.09, breathe: 0, drift: 0 };
	const mid = glowAt(c, 0.4, 0.5, 0.8);
	const onRing = glowAt(c, 0.4 + 0.3, 0.5, 0.8);
	const far = glowAt(c, 0.4, 0.02, 0.8);
	assert.ok(onRing > 0.95 && mid < 0.01 && far < 0.05);
});

test('the orb falls off from its centre; the rise grows toward the bottom', () => {
	const orb = { shape: 'orb', breathe: 0, drift: 0 };
	assert.ok(glowAt(orb, 0.4, 0.5, 0.8) > glowAt(orb, 0.4, 0.8, 0.8));
	const rise = { shape: 'rise', size: 0.5 };
	assert.ok(glowAt(rise, 0.4, 0.98, 0.8) > 0.9 && glowAt(rise, 0.4, 0.02, 0.8) < 0.05);
});

test('it breathes: the same point changes with time', () => {
	for (const shape of GLOW_SHAPES) {
		const c = { shape, rate: 0.2 };
		let moved = 0;
		for (let y = 0.05; y < 1; y += 0.1) moved += Math.abs(glowAt(c, 0.3, y, 0.8, 0) - glowAt(c, 0.3, y, 0.8, 1.5));
		assert.ok(moved > 0.05, `${shape} (${moved})`);
	}
});

test('each flute shows a squeezed slice about its own centre', () => {
	const flutes = 10;
	for (let i = 0; i < flutes; i++) {
		const centre = (i + 0.5) / flutes;
		const a = fluteSample(i / flutes + 0.0001, flutes, 0.35);
		const b = fluteSample((i + 1) / flutes - 0.0001, flutes, 0.35);
		assert.ok(Math.abs(fluteSample(centre, flutes, 0.35).x - centre) < 1e-9);
		assert.ok(Math.abs(b.x - a.x - 0.035) < 1e-3, 'the slice is squeeze × the flute');
		assert.ok(a.local < -0.99 && b.local > 0.99);
	}
});

test('three colours, and a CSS-only still with the flutes over the light', () => {
	assert.deepEqual(glowColors({ colors: ['#111111', '#222222', '#333333'] }), ['#111111', '#222222', '#333333']);
	assert.deepEqual(glowColors({ colors: ['#111111', '#333333'] }), ['#111111', '#333333', '#333333']);
	for (const shape of GLOW_SHAPES) {
		const css = glowStill({ shape, background: '#050302' });
		assert.doesNotMatch(css, /url\(|data:/);
		assert.match(css, /^repeating-linear-gradient\(90deg/);
		assert.match(css, /, #050302$/);
	}
});
