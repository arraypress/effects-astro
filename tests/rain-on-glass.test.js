import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxBlur } from '../src/runtime/blur.js';
import { findLights } from '../src/runtime/rain-on-glass/backdrop.js';
import { createWipe } from '../src/runtime/rain-on-glass/wipe.js';
import { FRAG } from '../src/runtime/rain-on-glass/shader.js';

/**
 * A dark RGBA picture with some pixels lit.
 *
 * @param {number} width Pixels across.
 * @param {number} height Pixels down.
 * @param {Array<[number, number, [number, number, number]]>} lit Each lit pixel: x, y and its RGB, 0–255.
 * @returns {Uint8ClampedArray} The pixels.
 */
const picture = (width, height, lit) => {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let i = 3; i < data.length; i += 4) data[i] = 255;
	for (const [x, y, rgb] of lit) data.set(rgb, (y * width + x) * 4);
	return data;
};

test('boxBlur leaves a flat picture flat', () => {
	const data = new Uint8ClampedArray(16 * 8 * 4).fill(120);
	boxBlur(data, 16, 8, 3);
	assert.ok(data.every((v) => v === 120));
});

test('boxBlur spreads a bright pixel out, keeping its light', () => {
	const data = picture(21, 21, [[10, 10, [255, 255, 255]]]);
	boxBlur(data, 21, 21, 2);
	const red = (x, y) => data[(y * 21 + x) * 4];
	assert.ok(red(10, 10) < 255 && red(10, 10) > 0);
	assert.ok(red(11, 10) > 0 && red(10, 12) > 0);
	assert.ok(red(10, 10) >= red(12, 10));
	let sum = 0;
	for (let i = 0; i < data.length; i += 4) sum += data[i];
	assert.ok(Math.abs(sum - 255) < 40, `${sum}`);
});

test('boxBlur with no radius changes nothing', () => {
	const data = picture(4, 4, [[1, 1, [200, 10, 10]]]);
	const before = Uint8ClampedArray.from(data);
	boxBlur(data, 4, 4, 0);
	assert.deepEqual(data, before);
});

test('findLights finds the bright points, brightest first, with their hue', () => {
	const data = picture(40, 30, [
		[5, 5, [255, 120, 20]],
		[30, 20, [255, 255, 255]],
	]);
	const lights = findLights(data, 40, 30, { threshold: 0.3 });
	assert.equal(lights.length, 2);
	assert.deepEqual([lights[0].x, lights[0].y], [30 / 40, 20 / 30]);
	assert.ok(lights[0].level > lights[1].level);
	const [r, g, b] = lights[1].rgb;
	assert.equal(r, 1);
	assert.ok(r > g && g > b, `${lights[1].rgb}`);
});

test('findLights keeps lights apart and stops at its count', () => {
	const data = picture(40, 30, [
		[10, 10, [255, 255, 255]],
		[12, 10, [240, 240, 240]],
		[30, 10, [230, 230, 230]],
		[30, 25, [220, 220, 220]],
	]);
	assert.equal(findLights(data, 40, 30, { threshold: 0.3, spacing: 5 }).length, 3);
	assert.equal(findLights(data, 40, 30, { threshold: 0.3, spacing: 5, count: 2 }).length, 2);
	assert.equal(findLights(data, 40, 30, { threshold: 0.95 }).length, 1);
});

test('a wipe clears a soft spot that fogs back over', () => {
	const wipe = createWipe(20, 10);
	assert.equal(wipe.settle(0.016), false);
	wipe.stamp(0.5, 0.5, 0.3);
	assert.equal(wipe.settle(0.016), true);
	const at = (x, y) => wipe.bytes[y * 20 + x];
	assert.equal(at(10, 5), 255);
	assert.ok(at(10, 5) >= at(12, 5));
	assert.equal(at(0, 0), 0);
	let steps = 0;
	while (wipe.settle(0.1)) steps++;
	assert.ok(steps > 20 && steps < 80, `${steps}`);
	assert.ok(wipe.bytes.every((v) => v === 0));
});

test('the shader reads the uniforms the runtime sets', () => {
	for (const name of ['uTime', 'uUnit', 'uCover', 'uPhoto', 'uSoft', 'uWipe', 'uRain', 'uFog', 'uClearBias', 'uTint', 'uShow']) {
		assert.match(FRAG, new RegExp(`uniform \\w+ ${name};`));
	}
});
