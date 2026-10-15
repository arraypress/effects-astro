import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetDepth, sheetAt, sheetGrid, gradientUniform, MAX_COLORS } from '../src/runtime/dot-surface.js';
import { projectPoint } from '../src/runtime/points.js';
import { toOklab, parseColor } from '../src/runtime/color.js';

const TILT = (42 * Math.PI) / 180;

test('sheetAt undoes the projection the shader uses', () => {
	const aspect = 16 / 9;
	for (const [x, z] of [[0, 0], [0.8, -0.6], [-1.4, 0.5], [2.1, 1.1]]) {
		// GLSL_PROJECT with the sheet turned towards the camera: y down from the top, as projectPoint gives it.
		const p = projectPoint([x, 0, z], 0, -TILT, aspect);
		const back = sheetAt(p.x, 1 - p.y, TILT, aspect);
		assert.ok(back && Math.abs(back.x - x) < 1e-9 && Math.abs(back.z - z) < 1e-9, `${x}, ${z}`);
	}
});

test('sheetDepth runs from near at the bottom to far towards the horizon', () => {
	assert.ok(sheetDepth(-1, TILT) < 0);
	assert.equal(sheetDepth(0, TILT), 0);
	assert.ok(sheetDepth(0.5, TILT) > sheetDepth(0.3, TILT));
	// A grazing camera has its horizon low on the screen: above it is no sheet.
	assert.equal(sheetDepth(0.9, 0.1), Infinity);
	assert.equal(sheetAt(0.5, 0.95, 0.1, 1), null);
});

test('sheetGrid is a square grid covering the frame, near to far', () => {
	const aspect = 1.6;
	const spacing = 0.04;
	const data = sheetGrid(aspect, spacing, TILT);
	assert.equal(data.length % 4, 0);
	let minDepth = 1;
	let maxDepth = 0;
	for (let i = 0; i < data.length; i += 4) {
		const [x, z, depth, across] = data.subarray(i, i + 4);
		minDepth = Math.min(minDepth, depth);
		maxDepth = Math.max(maxDepth, depth);
		assert.ok(Math.abs(x / spacing - Math.round(x / spacing)) < 1e-3, 'on the grid');
		assert.ok(across > -0.1 && across < 1.1, 'on screen, with a margin');
		// The flat sheet lands within the frame's height, or just below it.
		const p = projectPoint([x, 0, z], 0, -TILT, aspect);
		assert.ok(p.y > 0 && p.y < 1.15);
	}
	assert.equal(minDepth, 0);
	assert.equal(maxDepth, 1);
	// A finer grid has more dots: about four times at half the spacing.
	const finer = sheetGrid(aspect, spacing / 2, TILT).length / data.length;
	assert.ok(finer > 3.6 && finer < 4.4, String(finer));
});

test('gradientUniform gives Oklab colours, padded with the last', () => {
	const one = gradientUniform(['#ff8a1f']);
	assert.equal(one.length, MAX_COLORS * 3);
	const lab = toOklab(parseColor('#ff8a1f'));
	for (let i = 0; i < MAX_COLORS; i++) lab.forEach((v, c) => assert.ok(Math.abs(one[i * 3 + c] - v) < 1e-6));
	const many = gradientUniform(['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00']);
	assert.equal(many.length, MAX_COLORS * 3);
	assert.ok(Math.abs(many[3] - 1) < 1e-3, 'white has L 1');
	assert.throws(() => gradientUniform(['orange']), TypeError);
});
