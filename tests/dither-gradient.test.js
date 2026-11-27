import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRADIENT_SHAPES, gradientSettings, gradientTone, gradientDots, gradientColors, gradientStill } from '../src/runtime/dither-gradient.js';
import { bayer as sharedBayer } from '../src/runtime/bayer.js';
import { bayer } from '../src/runtime/dither-field.js';

test('the dither field still exports the shared Bayer matrix', () => {
	for (let y = -9; y < 17; y++) for (let x = -9; x < 17; x++) assert.equal(bayer(x, y), sharedBayer(x, y));
});

test('every shape gives tones in 0–1, the same for the same settings, and differs from the others', () => {
	const seen = new Set();
	for (const shape of GRADIENT_SHAPES) {
		const s = gradientSettings({ shape, offset: [1.3, 2.1] }, 80);
		let sig = '';
		for (let y = 0.02; y < 1.25; y += 0.11)
			for (let x = 0.02; x < 1; x += 0.09) {
				const v = gradientTone(s, x, y, 1.25, 3.5);
				assert.ok(v >= 0 && v <= 1, `${shape} ${x} ${y}: ${v}`);
				assert.equal(v, gradientTone(s, x, y, 1.25, 3.5));
				sig += v.toFixed(2);
			}
		seen.add(sig);
	}
	assert.equal(seen.size, GRADIENT_SHAPES.length);
});

test('the wave rises from its angle: bright at the bottom by default, at the left at 90°', () => {
	const up = gradientSettings({ shape: 'wave' }, 80);
	assert.ok(gradientTone(up, 0.5, 1.2, 1.25) > 0.9 && gradientTone(up, 0.5, 0.05, 1.25) < 0.1);
	const left = gradientSettings({ shape: 'wave', angle: 90 }, 80);
	assert.ok(gradientTone(left, 0.02, 0.62, 1.25) > 0.9 && gradientTone(left, 0.98, 0.62, 1.25) < 0.1);
});

test('the shapes move with time', () => {
	for (const shape of GRADIENT_SHAPES) {
		const s = gradientSettings({ shape, rate: 0.2 }, 80);
		let moved = 0;
		for (let y = 0.05; y < 1.25; y += 0.1) for (let x = 0.05; x < 1; x += 0.1) moved += Math.abs(gradientTone(s, x, y, 1.25, 0) - gradientTone(s, x, y, 1.25, 2.5));
		assert.ok(moved > 0.5, `${shape} moves (${moved})`);
	}
});

test('gradientDots: the quiet area empties the middle; bayer dots thin out with the tone', () => {
	const dots = gradientDots({ shape: 'swirl', quiet: { radius: 0.5, depth: 1 } }, 60, 75, 1);
	assert.equal(dots.length, 75);
	assert.equal(dots[0].length, 60);
	assert.equal(dots[37][30].tone, 0);
	assert.equal(dots[37][30].lit, false);
	const all = gradientDots({ shape: 'wave' }, 60, 75).flat();
	const share = (lo, hi) => {
		const d = all.filter((p) => p.tone >= lo && p.tone < hi);
		return d.filter((p) => p.lit).length / Math.max(1, d.length);
	};
	assert.ok(share(0.05, 0.3) < share(0.4, 0.7) && share(0.4, 0.7) < share(0.8, 1.01));
	assert.ok(all.every((p) => (p.tone === 0 ? !p.lit : true)), 'nothing lit where the tone is 0');
});

test('colours: its own, a palette\'s ends, or the plum and pink', () => {
	assert.deepEqual(gradientColors({ colors: ['#111111', '#222222', '#333333'] }), ['#111111', '#333333']);
	assert.equal(gradientColors({}).length, 2);
});

test('the still is CSS only (no url or data:), with the ground last and the quiet area first', () => {
	for (const shape of GRADIENT_SHAPES)
		for (const mode of ['bayer', 'halftone']) {
			const css = gradientStill({ shape, mode, background: '#0b0b0b', quiet: { radius: 0.5 } });
			assert.doesNotMatch(css, /url\(|data:/);
			assert.match(css, /^radial-gradient\(/);
			assert.match(css, /, #0b0b0b$/);
		}
});

test('the orb and the pill: brightest near the centre, dark far out', () => {
	for (const shape of ['orb', 'pill']) {
		const s = gradientSettings({ shape, size: 0.25, rate: 0 }, 80);
		const mid = gradientTone(s, 0.5, 0.625, 1.25);
		const corner = gradientTone(s, 0.02, 0.02, 1.25);
		assert.ok(mid > corner && corner < 0.1, `${shape}: ${mid} ${corner}`);
	}
	const pill = gradientSettings({ shape: 'pill', size: 0.25, rate: 0 }, 80);
	assert.ok(gradientTone(pill, 0.78, 0.625, 1.25) > gradientTone(pill, 0.5, 0.95, 1.25), 'the pill reaches further along than across');
});

test('gradientRamp: three colours of their own, or halfway between two', async () => {
	const { gradientRamp } = await import('../src/runtime/dither-gradient.js');
	assert.deepEqual(gradientRamp({ colors: ['#111111', '#777777', '#ffffff'] }), ['#111111', '#777777', '#ffffff']);
	const [lo, mid, hi] = gradientRamp({ colors: ['#000000', '#ffffff'] });
	assert.equal(lo, '#000000');
	assert.equal(hi, '#ffffff');
	assert.notEqual(mid, lo);
	assert.match(gradientStill({ shape: 'orb', colors: ['#111111', '#777777', '#ffffff'], background: '#000000' }), /#777777/);
});
