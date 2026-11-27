import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOKEH_DEFAULTS, MAX_DISCS, focusAt, blurAt, discAt, highlightTints, photoBokehStill } from '../src/runtime/photo-bokeh.js';

test('the focus racks near to far and back, and the same settings give the same focus', () => {
	const c = { rate: 0.1, seed: 2 };
	let lo = 1,
		hi = 0;
	for (let t = 0; t < 10; t += 0.1) {
		const f = focusAt(c, t);
		lo = Math.min(lo, f);
		hi = Math.max(hi, f);
		assert.equal(f, focusAt(c, t));
	}
	assert.ok(lo < 0.1 && hi > 0.9, `${lo}–${hi}`);
});

test('sharp at the plane of focus, softest well away from it, never past the widest blur', () => {
	const c = { blur: 0.04, rate: 0.1 };
	for (let t = 0; t < 10; t += 0.7) {
		const f = focusAt(c, t);
		assert.equal(blurAt(c, f, t), 0);
		assert.ok(blurAt(c, f > 0.5 ? 0 : 1, t) > 0.035);
		for (let d = 0; d <= 1; d += 0.1) assert.ok(blurAt(c, d, t) <= 0.04 + 1e-12);
	}
});

test('the lights rise, sway a little and come round from the bottom', () => {
	const c = { drift: 0.05, seed: 1 };
	for (let i = 0; i < MAX_DISCS; i++) {
		const a = discAt(c, i, 1),
			b = discAt(c, i, 3);
		const wrapped = b.y > a.y + 0.5;
		assert.ok(b.y < a.y || wrapped, `light ${i} rises`);
		assert.ok(a.r >= BOKEH_DEFAULTS.size * 0.6 - 1e-9 || c.size);
		assert.ok(a.y > -0.2 && a.y < 1.2);
	}
});

test('tints from the photo: its brightest, most coloured pixels, lightened, four of them', () => {
	const rgba = [];
	for (let i = 0; i < 64; i++) rgba.push(20, 20, 20, 255);
	rgba.push(255, 60, 60, 255, 250, 220, 230, 255, 60, 90, 255, 255);
	const tints = highlightTints(rgba);
	assert.equal(tints.length, 4);
	for (const t of tints) for (const v of t) assert.ok(v >= 0.4 && v <= 1);
	assert.ok(tints[0][0] > tints[0][2], 'the red highlight leads');
});

test('the still is the photo itself, covering', () => {
	assert.equal(photoBokehStill({ src: '/img/a.webp' }), 'center / cover no-repeat url("/img/a.webp")');
});
