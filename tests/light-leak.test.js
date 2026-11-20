import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEAK_COLORS, leakHash, valueNoise, fbm, leakShape, clampOctaves, leakColors, leakFields, leakMix, leakColor, lightLeakStill } from '../src/runtime/light-leak.js';
import { parseColor, toOklab } from '../src/runtime/color.js';

const lightness = (/** @type {string} */ hex) => toOklab(parseColor(hex))[0];

test('leakHash is 0–1, spread evenly, and the same for the same lattice point', () => {
	let sum = 0;
	let n = 0;
	for (let x = -40; x < 40; x++)
		for (let y = -40; y < 40; y++) {
			const h = leakHash(x, y);
			assert.ok(h >= 0 && h < 1, `${x}, ${y}: ${h}`);
			sum += h;
			n++;
		}
	assert.ok(Math.abs(sum / n - 0.5) < 0.03, `mean ${sum / n}`);
	assert.equal(leakHash(3, 7), leakHash(3, 7));
	assert.notEqual(leakHash(3, 7), leakHash(7, 3));
	// far from the origin (a big offset, a long run) it is still a hash, not a constant
	assert.notEqual(leakHash(10000, 20000), leakHash(10001, 20000));
});

test('valueNoise passes through the hash at lattice points and is smooth between them', () => {
	assert.equal(valueNoise(2, 5), leakHash(2, 5));
	const a = valueNoise(2.5, 5.5);
	const b = valueNoise(2.501, 5.5);
	assert.ok(Math.abs(a - b) < 0.01);
});

test('fbm sums octaves as the sketch does, scaled to span 0–1 at any count', () => {
	for (const octaves of [1, 2, 3, 4]) {
		let sum = 0;
		let n = 0;
		for (let x = -30; x < 30; x += 0.53)
			for (let y = -30; y < 30; y += 0.59) {
				const v = fbm(x, y, octaves);
				assert.ok(v >= 0 && v <= 1, `${octaves}: ${v}`);
				sum += v;
				n++;
			}
		assert.ok(Math.abs(sum / n - 0.5) < 0.04, `${octaves} octaves, mean ${sum / n}`);
	}
	assert.ok(Math.abs(fbm(0.3, 0.7, 2) - (0.5 * valueNoise(0.3, 0.7) + 0.25 * valueNoise(0.6, 1.4)) / 0.75) < 1e-12);
	assert.equal(fbm(0.3, 0.7, 1), valueNoise(0.3, 0.7));
});

test('leakShape pushes a field from its middle and keeps it 0–1', () => {
	assert.equal(leakShape(0.5, 3), 0.5);
	assert.equal(leakShape(0.7, 1), 0.7);
	assert.ok(Math.abs(leakShape(0.6, 2) - 0.7) < 1e-12);
	assert.equal(leakShape(0.95, 3), 1);
	assert.equal(leakShape(0.05, 3), 0);
});

test('clampOctaves keeps 1–4, whole', () => {
	assert.equal(clampOctaves(undefined), 2);
	assert.equal(clampOctaves(0), 1);
	assert.equal(clampOctaves(9), 4);
	assert.equal(clampOctaves(2.6), 3);
	assert.equal(clampOctaves(NaN), 2);
});

test('leakColors takes four, resamples others, orders a palette by lightness', () => {
	assert.deepEqual(leakColors({}), LEAK_COLORS);
	const four = ['#000000', '#333333', '#666666', '#ffffff'];
	assert.deepEqual(leakColors({ colors: four }), four);
	const two = leakColors({ colors: ['#000000', '#ffffff'] });
	assert.equal(two.length, 4);
	assert.equal(two[0], '#000000');
	assert.equal(two[3], '#ffffff');
	assert.ok(lightness(two[1]) < lightness(two[2]));
	const pal = leakColors({ palette: 'Glacier' });
	assert.equal(pal.length, 4);
	for (let i = 1; i < 4; i++) assert.ok(lightness(pal[i - 1]) <= lightness(pal[i]), 'darkest first');
});

test('leakMix gives the ramp ends at the field extremes, and blends in Oklab', () => {
	const c = ['#000000', '#ff0000', '#00ff00', '#ffffff'];
	assert.equal(leakMix(c, [0, 0, 0]), '#000000');
	assert.equal(leakMix(c, [1, 1, 1]), '#ffffff');
	assert.equal(leakMix(c, [1, 0, 0]), '#ff0000');
	assert.equal(leakMix(c, [0, 0, 1]), '#00ff00');
	// halfway from black to white is Oklab's perceptual middle grey, not RGB's #808080
	assert.equal(leakMix(c, [0, 1, 0.5]), '#636363');
});

test('leakFields is deterministic, moves with time and offset, and stays 0–1', () => {
	const a = leakFields({}, 0.3, 0.6, 330 / 412);
	assert.deepEqual(leakFields({}, 0.3, 0.6, 330 / 412), a);
	assert.notDeepEqual(leakFields({}, 0.3, 0.6, 330 / 412, 20), a, 'it drifts');
	assert.notDeepEqual(leakFields({ offset: [4, 2] }, 0.3, 0.6, 330 / 412), a, 'an offset differs');
	for (const f of a) assert.ok(f >= 0 && f <= 1);
	assert.notDeepEqual(leakFields({ warp: 0 }, 0.3, 0.6, 330 / 412), a, 'the warp bends it');
});

test('leakFields measures in the shorter side: the centre of any shape samples the same point', () => {
	assert.deepEqual(leakFields({}, 0.5, 0.5, 330 / 412), leakFields({}, 0.5, 0.5, 16 / 9));
	// a point half the shorter side right of centre is the same field on a card and a hero
	const across = (/** @type {number} */ aspect) => 0.5 + (0.5 * Math.min(aspect, 1)) / aspect;
	const card = leakFields({}, across(330 / 412), 0.5, 330 / 412);
	const hero = leakFields({}, across(16 / 9), 0.5, 16 / 9);
	card.forEach((v, i) => assert.ok(Math.abs(v - hero[i]) < 1e-9));
});

test('the quiet area settles to its tone at the centre and leaves the edge alone', () => {
	const quiet = { radius: 0.4, depth: 1 };
	assert.deepEqual(leakFields({ quiet }, 0.5, 0.5, 1), [0, 0, 0]);
	assert.deepEqual(leakFields({ quiet, quietTone: 1 }, 0.5, 0.5, 1), [1, 1, 1]);
	assert.equal(leakColor({ quiet }, 0.5, 0.5, 1), LEAK_COLORS[0]);
	assert.deepEqual(leakFields({ quiet }, 0.02, 0.02, 1), leakFields({}, 0.02, 0.02, 1));
});

test('lightLeakStill is a CSS background of nine soft pools over a solid', () => {
	const css = lightLeakStill({}, 330 / 412);
	assert.equal((css.match(/radial-gradient/g) ?? []).length, 9);
	assert.match(css, /, #[0-9a-f]{6}$/);
	assert.notEqual(lightLeakStill({ offset: [5, 5] }), lightLeakStill({}));
});
