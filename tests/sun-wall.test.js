import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blindsAt, spectrumRgb, sunWallStill, SUN_MODES } from '../src/runtime/sun-wall.js';

test('through the blinds the patch breaks into bars: some points lit, some in shade, none outside the patch', () => {
	const c = { angle: 0, patch: [0.5, 0.5], size: [0.6, 0.7], slats: 10, drift: 0, soft: 0 };
	const aspect = 0.8;
	let lit = 0,
		dark = 0;
	for (let y = 0.2; y < 0.8; y += 0.005) {
		const v = blindsAt(c, 0.4, y, aspect);
		if (v > 0.9) lit++;
		if (v < 0.1) dark++;
	}
	assert.ok(lit > 20 && dark > 20, `${lit} lit, ${dark} dark`);
	assert.ok(blindsAt(c, 0.4, 0.02, aspect) < 0.01 && blindsAt(c, 0.02, 0.5, aspect) < 0.01, 'outside the patch is shade');
});

test('the bars soften with the throw: the far edge of a bar is wider than the near one', () => {
	const c = { angle: 0, patch: [0.5, 0.5], size: [0.6, 0.7], slats: 6, drift: 0, soft: 1 };
	const ramp = (y0) => {
		let n = 0;
		for (let y = y0; y < y0 + 0.12; y += 0.0005) {
			const v = blindsAt(c, 0.4, y, 0.8);
			if (v > 0.05 && v < 0.95) n++;
		}
		return n;
	};
	assert.ok(ramp(0.62) > ramp(0.18), 'more half-lit points low (far) than high (near)');
});

test('the spectrum runs red to violet, brightest in the middle', () => {
	const [r0, , b0] = spectrumRgb(0);
	const [r1, , b1] = spectrumRgb(1);
	assert.ok(r0 > b0 && b1 > r1 * 0.5);
	const lum = (x) => spectrumRgb(x).reduce((t, v) => t + v, 0);
	assert.ok(lum(0.35) > lum(0) && lum(0.35) > lum(1));
});

test('a CSS-only still for each mode', () => {
	for (const mode of SUN_MODES) {
		const css = sunWallStill({ mode });
		assert.doesNotMatch(css, /url\(|data:/);
		assert.match(css, mode === 'blinds' ? /repeating-linear-gradient/ : /linear-gradient/);
	}
});
