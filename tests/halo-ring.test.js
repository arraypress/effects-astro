import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringSize, shapeBlend, outline } from '../src/runtime/halo-ring.js';

test('ringSize fits the hexagon inside the margin on a wide canvas', () => {
	const size = ringSize(1600, 900, 'morph', 0.05, 0.3);
	assert.equal(size.upright, false);
	// Height-bound: the inradius is half the height less the margin.
	assert.equal(size.hex, 450 - 45);
	// The hexagon's width (2 × inradius × 2/√3) stays inside the margin.
	assert.ok(size.hex * (4 / Math.sqrt(3)) <= 1600 - 90);
	assert.ok(size.corner > 0 && size.corner < size.box[1]);
});

test('ringSize lays the shape on its side on a tall canvas, and fills it with rect', () => {
	const tall = ringSize(400, 800, 'hexagon', 0.05, 0.3);
	assert.equal(tall.upright, true);
	assert.ok(tall.reach > tall.hex * (2 / Math.sqrt(3)) && tall.reach <= 380);
	const rect = ringSize(400, 800, 'rect', 0.05, 0.3);
	assert.equal(rect.upright, false);
	assert.deepEqual(rect.box, [180, 380]);
	assert.equal(ringSize(400, 800, 'circle', 0.05, 0).corner, 0);
});

test('shapeBlend holds still shapes and drifts between them with morph', () => {
	assert.equal(shapeBlend('hexagon', 7), 0);
	assert.equal(shapeBlend('rect', 7), 1);
	assert.equal(shapeBlend('morph', 0), 0);
	const half = Math.PI / 0.2;
	assert.ok(Math.abs(shapeBlend('morph', half) - 1) < 1e-9);
});

test('outline gives the hexagon at 0 and the rectangle at 1, pulled in by the corner', () => {
	const size = { hex: 100, reach: 200 / Math.sqrt(3), box: /** @type {[number, number]} */ ([120, 80]), corner: 10 };
	const hex = outline(size, 0);
	assert.equal(hex.length, 12);
	// The right-hand corner sits at the circumradius of the inset hexagon.
	assert.ok(Math.abs(hex[0] - 90 * (2 / Math.sqrt(3))) < 1e-4);
	assert.ok(Math.abs(hex[3] - 90) < 1e-4);
	assert.deepEqual([...outline(size, 1)], [110, 0, 110, 70, -110, 70, -110, 0, -110, -70, 110, -70]);
});
