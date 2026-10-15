import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, toHex, toOklab, fromOklab, mixOklab, paletteAt, GLSL_OKLAB } from '../src/runtime/color.js';

/**
 * Asserts two colours match to within a rounding step.
 *
 * @param {number[]} actual The colour got.
 * @param {number[]} expected The colour wanted.
 * @param {number} [tolerance=1e-3] Largest difference a channel may have.
 */
const close = (actual, expected, tolerance = 1e-3) => {
	actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) <= tolerance, `${actual} ≉ ${expected}`));
};

test('parseColor reads 6- and 3-digit hex, with or without #', () => {
	close(parseColor('#ff8000'), [1, 128 / 255, 0]);
	close(parseColor('0f0'), [0, 1, 0]);
	close(parseColor(' #FFFFFF '), [1, 1, 1]);
});

test('parseColor rejects anything else', () => {
	assert.throws(() => parseColor('red'), TypeError);
	assert.throws(() => parseColor('#12345'), TypeError);
	assert.throws(() => parseColor('rgb(0,0,0)'), TypeError);
});

test('toHex writes back what parseColor read, clamping', () => {
	assert.equal(toHex(parseColor('#7c3aed')), '#7c3aed');
	assert.equal(toHex([1.4, -0.2, 0.5]), '#ff0080');
});

test('Oklab round-trips', () => {
	for (const hex of ['#7c3aed', '#db2777', '#06b6d4', '#000000', '#ffffff']) {
		close(fromOklab(toOklab(parseColor(hex))), parseColor(hex), 2e-3);
	}
});

test('white is L 1 and black L 0 in Oklab', () => {
	close(toOklab([1, 1, 1]), [1, 0, 0]);
	close(toOklab([0, 0, 0]), [0, 0, 0]);
});

test('mixOklab keeps the ends and stays bright in the middle', () => {
	const violet = parseColor('#7c3aed');
	const cyan = parseColor('#06b6d4');
	close(mixOklab(violet, cyan, 0), violet, 2e-3);
	close(mixOklab(violet, cyan, 1), cyan, 2e-3);
	// The same midpoint mixed in sRGB is darker: Oklab keeps its lightness.
	const oklabMid = toOklab(mixOklab(violet, cyan, 0.5))[0];
	const rgbMid = toOklab(violet.map((v, i) => (v + cyan[i]) / 2))[0];
	assert.ok(oklabMid > rgbMid, `${oklabMid} should be lighter than ${rgbMid}`);
});

test('paletteAt loops through the colours and wraps', () => {
	const palette = ['#ff0000', '#00ff00', '#0000ff'].map(parseColor);
	close(paletteAt(palette, 0), palette[0], 2e-3);
	close(paletteAt(palette, 1 / 3), palette[1], 2e-3);
	close(paletteAt(palette, 2 / 3), palette[2], 2e-3);
	close(paletteAt(palette, 1.25), paletteAt(palette, 0.25));
	close(paletteAt(palette, -0.75), paletteAt(palette, 0.25));
});

test('paletteAt needs a colour', () => {
	assert.throws(() => paletteAt([], 0), RangeError);
});

test('GLSL_OKLAB defines oklabMix', () => {
	assert.match(GLSL_OKLAB, /vec3 oklabMix\(vec3 a, vec3 b, float t\)/);
});
