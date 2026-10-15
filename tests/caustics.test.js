import { test } from 'node:test';
import assert from 'node:assert/strict';
import { causticTones } from '../src/runtime/caustics.js';
import { PALETTES } from '../src/runtime/palettes.js';
import { parseColor, toOklab } from '../src/runtime/color.js';

/**
 * Oklab lightness of a hex colour.
 *
 * @param {string} hex The colour.
 * @returns {number} Its lightness.
 */
const L = (hex) => toOklab(parseColor(hex))[0];

test('causticTones takes the colours in any order: darkest deep, lightest light, the median floor', () => {
	const a = causticTones({ colors: ['#f2fff9', '#0b7ea8', '#2cc3d0'] });
	const b = causticTones({ colors: ['#2cc3d0', '#f2fff9', '#0b7ea8'] });
	assert.deepEqual(a, b);
	assert.equal(a.deep, '#0b7ea8');
	assert.equal(a.floor, '#2cc3d0');
	assert.equal(a.light, '#f2fff9');
});

test('causticTones darkens the deep water for the background unless one is given', () => {
	const tones = causticTones({});
	assert.ok(L(tones.background) < L(tones.deep));
	assert.equal(causticTones({ background: '#001122' }).background, '#001122');
});

test('causticTones makes the most of one or two colours', () => {
	const one = causticTones({ colors: ['#2cc3d0'] });
	assert.equal(one.floor, '#2cc3d0');
	assert.equal(one.light, '#ffffff');
	assert.ok(L(one.deep) < L(one.floor));
	const two = causticTones({ colors: ['#fff4d6', '#c97a12'] });
	assert.equal(two.floor, '#c97a12');
	assert.equal(two.light, '#fff4d6');
	assert.ok(L(two.deep) < L(two.floor));
});

test('causticTones reads a palette by name', () => {
	const tones = causticTones({ palette: 'saffron' });
	const colors = PALETTES.Saffron.colors;
	assert.ok(colors.includes(tones.floor) && colors.includes(tones.deep) && colors.includes(tones.light));
	assert.ok(L(tones.deep) < L(tones.floor) && L(tones.floor) < L(tones.light));
});

test('causticTones throws on a colour that is not hex', () => {
	assert.throws(() => causticTones({ colors: ['aqua', '#fff'] }), TypeError);
});
