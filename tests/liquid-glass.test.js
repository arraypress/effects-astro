import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bend, lensMap, roundedRect, shine } from '../src/runtime/lens-map.js';
import { LENS_DEFAULTS, lensSettings, lensSteps, lensValue } from '../src/runtime/liquid-glass.js';

/**
 * One pixel of a map.
 *
 * @param {Uint8ClampedArray} map The map.
 * @param {number} width Its width.
 * @param {number} x The column.
 * @param {number} y The row.
 * @returns {number[]} Its red, green, blue and alpha.
 */
const at = (map, width, x, y) => [...map.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)];

test('roundedRect measures to the nearest edge, negative inside', () => {
	assert.equal(roundedRect(50, 25, 100, 50, 10).distance, -25);
	assert.deepEqual(roundedRect(0, 25, 100, 50, 10), { distance: 0, nx: -1, ny: 0 });
	assert.deepEqual(roundedRect(50, 60, 100, 50, 10), { distance: 10, nx: 0, ny: 1 });
});

test('roundedRect rounds the corners: the normal points out along the diagonal', () => {
	const corner = roundedRect(0, 0, 100, 100, 20);
	assert.ok(Math.abs(corner.distance - (Math.SQRT2 * 20 - 20)) < 1e-9);
	assert.ok(Math.abs(corner.nx + Math.SQRT1_2) < 1e-9 && Math.abs(corner.ny + Math.SQRT1_2) < 1e-9);
});

test('roundedRect clamps the radius to half the shorter side: a pill', () => {
	const pill = roundedRect(0, 20, 200, 40, 999);
	assert.ok(Math.abs(pill.distance) < 1e-9);
	assert.equal(pill.nx, -1);
});

test('bend is strongest at the rim and fades to nothing at the bezel and beyond', () => {
	assert.equal(bend(0, 20), 1);
	assert.equal(bend(20, 20), 0);
	assert.equal(bend(-1, 20), 0);
	assert.equal(bend(5, 0), 0);
	assert.ok(bend(5, 20) > bend(10, 20) && bend(10, 20) > bend(15, 20));
});

test('shine is brightest on the rim facing the top left', () => {
	assert.ok(shine(0, 0, -1, 20) > shine(0, 0, 1, 20));
	assert.ok(shine(0, -1, 0, 20) > shine(0, 1, 0, 20));
	assert.ok(shine(0, 0, -1, 20) > shine(6, 0, -1, 20));
	assert.equal(shine(-1, 0, -1, 20), 0);
	assert.equal(shine(25, 0, -1, 20), 0);
	for (const depth of [0, 1, 3, 10]) assert.ok(shine(depth, 0, -1, 20) <= 1);
});

test('lensMap is flat in the middle and outside the corners, and opaque', () => {
	const map = lensMap(120, 80, 20, 16);
	assert.equal(map.length, 120 * 80 * 4);
	assert.deepEqual(at(map, 120, 60, 40), [128, 128, 0, 255]);
	assert.deepEqual(at(map, 120, 0, 0), [128, 128, 0, 255]);
	for (let i = 3; i < map.length; i += 4) assert.equal(map[i], 255);
});

test('lensMap looks inwards at the rim: right on the left edge, down on the top', () => {
	const map = lensMap(120, 80, 20, 16);
	const [left] = at(map, 120, 0, 40);
	const [right] = at(map, 120, 119, 40);
	const [, top] = at(map, 120, 60, 0);
	const [, bottom] = at(map, 120, 60, 79);
	assert.ok(left > 200 && right < 56);
	assert.ok(top > 200 && bottom < 56);
	assert.equal(at(map, 120, 0, 40)[1], 128);
});

test('lensMap is symmetric across the panel', () => {
	const map = lensMap(64, 40, 12, 10);
	for (const [x, y] of [[0, 20], [3, 5], [10, 2]]) {
		const [r] = at(map, 64, x, y);
		const [mirrored] = at(map, 64, 63 - x, y);
		assert.ok(Math.abs(r - 128 + (mirrored - 128)) <= 1);
	}
});

test('lensMap puts the highlight on the rim, brighter at the top than the bottom', () => {
	const map = lensMap(120, 80, 20, 16);
	assert.ok(at(map, 120, 60, 0)[2] > at(map, 120, 60, 79)[2]);
	assert.ok(at(map, 120, 60, 0)[2] > 128);
	assert.equal(at(map, 120, 60, 40)[2], 0);
});

test('lensMap rounds its size and keeps at least a pixel', () => {
	assert.equal(lensMap(10.4, 9.6, 2, 3).length, 10 * 10 * 4);
	assert.equal(lensMap(0, 0, 0, 0).length, 4);
});

test('lensValue reads numbers, booleans and custom property text', () => {
	assert.equal(lensValue(true), 1);
	assert.equal(lensValue(false), 0);
	assert.equal(lensValue(' 1.5 '), 1.5);
	assert.equal(lensValue('24px'), 24);
	assert.equal(lensValue('true'), 1);
	assert.equal(lensValue('none'), 0);
	assert.equal(lensValue(''), undefined);
	assert.equal(lensValue('soft'), undefined);
	assert.equal(lensValue(undefined), undefined);
});

test('lensSettings takes options over CSS over defaults, clamped', () => {
	const css = /** @type {Record<string, string>} */ ({ '--glass-refract': '3', '--glass-bezel': '30px', '--glass-specular': ' 0.2' });
	const read = (/** @type {string} */ property) => css[property] ?? '';
	assert.deepEqual(lensSettings({ specular: 0.9 }, read), { refract: 2, dispersion: LENS_DEFAULTS.dispersion, bezel: 30, specular: 0.9 });
	assert.deepEqual(lensSettings({}, () => ''), LENS_DEFAULTS);
	assert.equal(lensSettings({}, () => '', 0).refract, 0);
	assert.equal(lensSettings({ refract: true, dispersion: -1 }, () => '', 0).refract, 1);
	assert.equal(lensSettings({ dispersion: -1 }, () => '').dispersion, 0);
});

test('lensSteps bends once without dispersion, three times with, blue furthest', () => {
	const plain = lensSteps({ refract: 1, dispersion: 0, bezel: 20, specular: 0 });
	assert.deepEqual(plain, [{ kind: 'bend', scale: 40 }]);
	const split = lensSteps({ refract: 1, dispersion: 1, bezel: 20, specular: 0.5 });
	assert.deepEqual(split.map((step) => (step.kind === 'bend' ? step.channel : step.kind)), ['R', 'G', 'B', 'shine']);
	const [r, g, b] = /** @type {Array<{ scale: number }>} */ (split);
	assert.ok(r.scale < g.scale && g.scale < b.scale);
	assert.deepEqual(split[3], { kind: 'shine', amount: 0.5 });
});

test('lensSteps scales the bend with the strength and the bezel', () => {
	const [one] = /** @type {Array<{ scale: number }>} */ (lensSteps({ refract: 1, dispersion: 0, bezel: 20, specular: 0 }));
	const [two] = /** @type {Array<{ scale: number }>} */ (lensSteps({ refract: 2, dispersion: 0, bezel: 20, specular: 0 }));
	const [wide] = /** @type {Array<{ scale: number }>} */ (lensSteps({ refract: 1, dispersion: 0, bezel: 40, specular: 0 }));
	assert.equal(two.scale, one.scale * 2);
	assert.equal(wide.scale, one.scale * 2);
});
