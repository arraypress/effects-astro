import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logoBox } from '../src/runtime/liquid-metal.js';
import { METALS, metalColor, studioTints } from '../src/runtime/liquid-metal/look.js';
import { fieldSampler, splash, stepBeads, packBeads } from '../src/runtime/liquid-metal/beads.js';
import { RENDER, STEP, SMOOTH, MAX_BEADS } from '../src/runtime/liquid-metal/shaders.js';
import { MAX_PUSHES } from '../src/runtime/height-field.js';
import { distanceField } from '../src/runtime/shape.js';
import { parseColor, toOklab } from '../src/runtime/color.js';

/**
 * A seeded random source, so splashes repeat.
 *
 * @param {number} seed The seed.
 * @returns {() => number} 0–1, repeatably.
 */
const seeded = (seed) => () => {
	seed = (seed * 16807) % 2147483647;
	return (seed - 1) / 2147483646;
};

/**
 * A disc's distance field, packed as shape.js packs it, with a sampler over it.
 *
 * @param {number} size The field's side, pixels.
 * @param {number} radius The disc's radius, pixels.
 * @returns {import('../src/runtime/liquid-metal/beads.js').FieldSampler} The sampler (a square box: aspect 1).
 */
const disc = (size, radius) => {
	const alpha = new Uint8ClampedArray(size * size);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) < radius) alpha[y * size + x] = 255;
	const spread = 24;
	const field = distanceField(/** @type {any} */ ({ alpha, width: size, height: size }), spread);
	return fieldSampler(field, size, size, spread / size, 1);
};

test('logoBox grows the area by a margin, keeps it on the canvas, and places the logo inside it', () => {
	const box = logoBox({ x: 0.5, y: 0.1, width: 0.4, height: 0.8 }, 1, 1000, 500);
	assert.ok(box.left < 500 && box.left + box.width > 900, 'the box spans the area');
	assert.ok(box.top >= 0 && box.top + box.height <= 500, 'the box stays on the canvas');
	const { shape } = box;
	assert.ok(shape.x > 0 && shape.x + shape.width < 1, 'the logo sits inside the box across');
	assert.ok(Math.abs(shape.x * box.width + box.left - 500) < 1e-6, 'and where the area says');
	// An area at the canvas's edge is cut to it.
	const edge = logoBox({ x: 0, y: 0, width: 1, height: 1 }, 1, 800, 600);
	assert.deepEqual([edge.left, edge.top, edge.width, edge.height], [0, 0, 800, 600]);
	// A smaller size shrinks the logo about the area's middle.
	const small = logoBox({ x: 0.5, y: 0.1, width: 0.4, height: 0.8 }, 0.5, 1000, 500);
	assert.ok(small.width < box.width && Math.abs(small.left + small.width / 2 - (box.left + box.width / 2)) <= 1);
});

test('metalColor reads metals by name in any case, and hex colours; anything else is chrome', (t) => {
	assert.deepEqual(metalColor(undefined), parseColor(METALS.chrome));
	assert.deepEqual(metalColor('gold'), parseColor(METALS.gold));
	assert.deepEqual(metalColor('Rose Gold'), parseColor(METALS['rose-gold']));
	assert.deepEqual(metalColor('BLACK-CHROME'), parseColor(METALS['black-chrome']));
	assert.deepEqual(metalColor('#ff8800'), parseColor('#ff8800'));
	const warn = t.mock.method(console, 'warn', () => {});
	assert.deepEqual(metalColor('platinum'), parseColor(METALS.chrome));
	assert.equal(warn.mock.callCount(), 1);
});

test('studioTints is neutral without colours, and lightens palette colours in Oklab keeping their hue', () => {
	const neutral = studioTints(undefined);
	assert.equal(neutral.length, 3);
	for (const c of neutral) assert.ok(Math.min(...c) > 0.85, 'a neutral studio is near white');
	const tints = studioTints(['#0044ff', '#ff0000']);
	assert.equal(tints.length, 3);
	assert.deepEqual(tints[2], tints[0], 'fewer than three colours repeat');
	const blue = toOklab(tints[0]);
	assert.ok(Math.abs(blue[0] - 0.9) < 0.05, 'made light');
	assert.ok(blue[2] < 0 && toOklab(parseColor('#0044ff'))[2] < 0, 'still blue');
	assert.ok(tints[1][0] > tints[1][1] && tints[1][0] > tints[1][2], 'still red');
});

test('fieldSampler is positive inside, negative outside, and its slope points inwards', () => {
	const sample = disc(128, 32);
	const centre = sample(0.5, 0.5);
	assert.ok(centre.d > 0, 'inside');
	assert.ok(sample(0.95, 0.95).d < 0, 'outside');
	// Just right of the edge (y up): the slope points left, back in.
	const right = sample(0.5 + 40 / 128, 0.5);
	assert.ok(right.d < 0 && right.gx < 0 && Math.abs(right.gy) < Math.abs(right.gx));
	// Just above it: the slope points down.
	const above = sample(0.5, 0.5 + 40 / 128);
	assert.ok(above.d < 0 && above.gy < 0 && Math.abs(above.gx) < Math.abs(above.gy));
	// A distance field's slope is about one.
	assert.ok(Math.abs(Math.hypot(right.gx, right.gy) - 1) < 0.2);
});

test('splash throws a ring of beads into the air, repeatably', () => {
	const a = splash(0.5, 0.5, 12, 1, seeded(3));
	const b = splash(0.5, 0.5, 12, 1, seeded(3));
	assert.deepEqual(a, b);
	assert.equal(a.length, 12);
	for (const bead of a) {
		assert.equal(bead.mode, 'fly');
		assert.ok(bead.vz > 0 && bead.r > 0 && bead.r === bead.size);
		assert.ok(Math.hypot(bead.x - 0.5, bead.y - 0.5) < 0.05);
	}
	// Thrown every way round.
	const angles = new Set(a.map((bead) => Math.floor(((Math.atan2(bead.vy, bead.vx) + Math.PI) / (2 * Math.PI)) * 4)));
	assert.equal(angles.size, 4);
});

test('stepBeads brings every bead back: each lands or crawls home, ripples once, and sinks in', () => {
	const sample = disc(128, 30);
	let beads = splash(0.5, 0.5, 20, 1.4, seeded(9));
	const landed = [];
	let t = 0;
	while (beads.length && t < 10) {
		beads = stepBeads(beads, 1 / 60, sample, 1, (x, y, size) => landed.push({ x, y, size }));
		for (const bead of beads) assert.ok(bead.x >= 0 && bead.x <= 1 && bead.y >= 0 && bead.y <= 1, 'beads stay in the box');
		t += 1 / 60;
	}
	assert.equal(beads.length, 0, 'every bead is taken back');
	assert.ok(t < 6, `within a few seconds (${t.toFixed(2)} s)`);
	assert.equal(landed.length, 20, 'each ripples the surface once');
	for (const { x, y } of landed) assert.ok(sample(x, y).d > -0.03, 'where the metal is');
});

test('a bead thrown beyond the field crawls back to where it came from', () => {
	const sample = disc(128, 20);
	/** @type {import('../src/runtime/liquid-metal/beads.js').Bead[]} */
	let beads = [{ x: 0.95, y: 0.95, vx: 0, vy: 0, z: 0, vz: 0, r: 0.01, size: 0.01, mode: 'crawl', joined: false, age: 0, ox: 0.5, oy: 0.5 }];
	let joined = false;
	for (let i = 0; i < 600 && beads.length; i++) beads = stepBeads(beads, 1 / 60, sample, 1, () => (joined = true));
	assert.ok(joined, 'it reached the metal and joined it');
});

test('packBeads draws flying and top-sinking beads on top, crawling and edge-sinking ones melted in', () => {
	const base = { vx: 0, vy: 0, vz: 0, size: 0.02, age: 0, ox: 0, oy: 0 };
	/** @type {import('../src/runtime/liquid-metal/beads.js').Bead[]} */
	const beads = [
		{ ...base, x: 0.1, y: 0.2, z: 0.05, r: 0.02, mode: 'fly', joined: false },
		{ ...base, x: 0.3, y: 0.4, z: 0, r: 0.01, mode: 'crawl', joined: false },
		{ ...base, x: 0.5, y: 0.6, z: 0, r: 0.005, mode: 'sink', joined: false },
		{ ...base, x: 0.7, y: 0.8, z: 0, r: 0.005, mode: 'sink', joined: true },
	];
	const out = new Float32Array(MAX_BEADS * 4);
	assert.equal(packBeads(beads, out), 4);
	assert.deepEqual([...out.subarray(0, 16)].map((v) => +v.toFixed(3)), [0.1, 0.2, 0.02, 0.05, 0.3, 0.4, 0.01, -1, 0.5, 0.6, 0.005, 0, 0.7, 0.8, 0.005, -1]);
	assert.equal(packBeads(beads, new Float32Array(8)), 2, 'no more than fit');
});

test('the shaders size their arrays from the shared limits', () => {
	assert.match(STEP, new RegExp(`uPush\\[${MAX_PUSHES}\\]`));
	assert.match(RENDER, new RegExp(`uBeads\\[${MAX_BEADS}\\]`));
	for (const source of [STEP, RENDER, SMOOTH]) assert.match(source, /void main\(\)/);
});
