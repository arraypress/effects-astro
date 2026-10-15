import { test } from 'node:test';
import assert from 'node:assert/strict';

// A document just big enough for the pointer module to listen on, installed
// before it is imported: the handlers it adds are kept here to fire by hand.
/** @type {Record<string, (e: object) => void>} */
const handlers = {};
globalThis.document = /** @type {any} */ ({
	addEventListener: (type, fn) => {
		handlers[type] = fn;
	},
	documentElement: {
		addEventListener: (type, fn) => {
			handlers[`root:${type}`] = fn;
		},
	},
});

const { pointerIn, trail } = await import('../src/runtime/pointer.js');
const { readConfig } = await import('../src/runtime/mount.js');
const { pixelRatio, isMobileGpu, prefersReducedMotion, canHover } = await import('../src/runtime/device.js');

/** An element 200 × 100 at the viewport's top left. */
const el = /** @type {any} */ ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }) });

/**
 * Moves the pointer.
 *
 * @param {number} x Viewport x.
 * @param {number} y Viewport y.
 */
const move = (x, y) => handlers.pointermove({ clientX: x, clientY: y });

test('pointerIn measures from the bottom left, 0–1', () => {
	move(50, 25);
	assert.deepEqual(pointerIn(el), { x: 0.25, y: 0.75, inside: true });
	move(300, 25);
	assert.equal(pointerIn(el).inside, false);
});

test('trail lays nothing for the first move, then a ribbon along the stroke', () => {
	const stroke = trail(el, { step: 0.05 });
	move(20, 50);
	assert.deepEqual(stroke.read(1 / 60), []);
	move(40, 50);
	const points = stroke.read(1 / 60);
	// 0.1 of the width at 0.05 apart: two points, ending where the pointer is.
	assert.equal(points.length, 2);
	assert.equal(points[1].x, 0.2);
	assert.equal(points[1].y, 0.5);
	// Velocity in element widths a second.
	assert.ok(Math.abs(points[0].dx - 6) < 1e-9);
	assert.equal(points[0].dy, 0);
});

test('trail reads nothing when the pointer has not moved', () => {
	const stroke = trail(el);
	move(10, 10);
	stroke.read(1 / 60);
	assert.deepEqual(stroke.read(1 / 60), []);
});

test('trail treats a jump as a new stroke, not a line across', () => {
	const stroke = trail(el);
	move(10, 50);
	stroke.read(1 / 60);
	move(190, 50);
	assert.deepEqual(stroke.read(1 / 60), []);
});

test('trail caps the points in one read', () => {
	const stroke = trail(el, { step: 0.001, max: 5 });
	move(10, 50);
	stroke.read(1 / 60);
	move(40, 50);
	assert.equal(stroke.read(1 / 60).length, 5);
});

test('trail forgets the stroke when the pointer leaves the window', () => {
	const stroke = trail(el);
	move(10, 50);
	stroke.read(1 / 60);
	handlers['root:pointerleave']({});
	move(20, 50);
	assert.deepEqual(stroke.read(1 / 60), []);
});

test('readConfig parses data-effect-config, and falls back to empty', () => {
	assert.deepEqual(readConfig(/** @type {any} */ ({ dataset: { effectConfig: '{"radius":0.5}' } })), { radius: 0.5 });
	assert.deepEqual(readConfig(/** @type {any} */ ({ dataset: { effectConfig: 'not json' } })), {});
	assert.deepEqual(readConfig(/** @type {any} */ ({ dataset: {} })), {});
});

test('device checks answer as a desktop with motion allowed outside a browser', () => {
	assert.equal(isMobileGpu(), false);
	assert.equal(pixelRatio(), 1);
	assert.equal(pixelRatio(0.5), 0.5);
	assert.equal(prefersReducedMotion(), false);
	assert.equal(canHover(), false);
});
