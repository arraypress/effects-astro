import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLSL_HASH33, GLSL_GRADIENT_NOISE, GLSL_NOISE_FIELD, hash33, grad, gnoise, noiseField } from '../src/runtime/hash-noise.js';

test('the GLSL declares what its JS twins compute', () => {
	assert.match(GLSL_HASH33, /vec3 hash33\(vec3 p3\)/);
	assert.match(GLSL_GRADIENT_NOISE, /vec2 grad\(vec2 p\)[\s\S]*float gnoise\(vec2 p\)/);
	assert.match(GLSL_NOISE_FIELD, /float noiseField\(vec2 p, float evo, float wt\)/);
});

test('hash33 and grad stay in range and spread, the same for the same input', () => {
	const hs = [];
	for (let i = 0; i < 400; i++) {
		const h = hash33(i * 0.37, i * 1.91 - 50, i % 7);
		assert.ok(h.every((v) => v >= 0 && v < 1));
		hs.push(h[0]);
		const g = grad(i - 200, (i * 13) % 97);
		assert.ok(g.every((v) => v >= -1 && v <= 1));
	}
	const mean = hs.reduce((a, b) => a + b, 0) / hs.length;
	assert.ok(Math.abs(mean - 0.5) < 0.06, `mean ${mean}`);
	assert.deepEqual(hash33(1, 2, 3), hash33(1, 2, 3));
	// large lattice values (a card's offset plus a long-running drift) still spread, as on the GPU
	assert.ok(new Set(Array.from({ length: 50 }, (_, i) => grad(9000 + i, 4000)[0].toFixed(3))).size > 40);
});

test('gnoise is 0.5 on the lattice, smooth and 0–1 between; noiseField moves with both clocks', () => {
	for (let x = -3; x <= 3; x++) assert.ok(Math.abs(gnoise(x, 2) - 0.5) < 1e-12);
	for (let x = -2; x < 2; x += 0.13) {
		const v = gnoise(x, 0.7);
		assert.ok(v >= 0 && v <= 1);
		assert.ok(Math.abs(gnoise(x + 1e-4, 0.7) - v) < 1e-3, 'continuous');
	}
	const v = noiseField(0.3, 0.7, 2, 4);
	assert.ok(v > 0 && v < 1);
	assert.notEqual(noiseField(0.3, 0.7, 3, 4), v);
	assert.notEqual(noiseField(0.3, 0.7, 2, 9), v);
});
