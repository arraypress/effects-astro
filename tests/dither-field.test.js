import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bayer, ripplePulse, rippleAt, ditherDots, ditherColors, ditherStill, DITHER_DEFAULTS } from '../src/runtime/dither-field.js';

/** The classic 8×8 Bayer matrix, as the sketch's texture held it. */
const BAYER_8 = [
	[0, 32, 8, 40, 2, 34, 10, 42],
	[48, 16, 56, 24, 50, 18, 58, 26],
	[12, 44, 4, 36, 14, 46, 6, 38],
	[60, 28, 52, 20, 62, 30, 54, 22],
	[3, 35, 11, 43, 1, 33, 9, 41],
	[51, 19, 59, 27, 49, 17, 57, 25],
	[15, 47, 7, 39, 13, 45, 5, 37],
	[63, 31, 55, 23, 61, 29, 53, 21],
];

test('bayer is the classic 8×8 matrix, repeating every 8 dots either way', () => {
	for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) assert.equal(bayer(x, y), BAYER_8[y][x] / 64, `${x}, ${y}`);
	assert.equal(bayer(13, 21), bayer(5, 5));
	assert.equal(bayer(-3, -1), bayer(5, 7));
});

test('ripplePulse is smooth, in 0–1, and reaches both ends', () => {
	let lo = 1;
	let hi = 0;
	let prev = ripplePulse(0);
	for (let s = 0.01; s < 60; s += 0.01) {
		const v = ripplePulse(s);
		assert.ok(v >= 0 && v <= 1, `${s}: ${v}`);
		assert.ok(Math.abs(v - prev) < 0.05, `no jump at ${s}`);
		lo = Math.min(lo, v);
		hi = Math.max(hi, v);
		prev = v;
	}
	assert.ok(lo === 0 && hi === 1, 'swells and calms');
});

test('rippleAt travels outward at rippleSpeed, needs no history, and fades far out', () => {
	const config = { rings: 3, rippleSpeed: 0.1 };
	for (const t of [0, 1.3, 7, 250]) {
		// what is at 0.2 widths now is at 0.5 widths 3 s later
		assert.ok(Math.abs(rippleAt(0.2, t, config) - rippleAt(0.5, t + 3, config)) < 1e-9, `t ${t}`);
	}
	assert.equal(rippleAt(0.4, 12, config), rippleAt(0.4, 12, config), 'a pure function of time');
	assert.equal(rippleAt(2, 5, config), 0, 'gone by two widths');
	assert.notEqual(rippleAt(0.3, 4, { ...config, offset: [1, 2] }), rippleAt(0.3, 4, config), 'an offset shifts the rings');
});

test('ditherDots has empty, dithered and solid dots, and is the same for the same settings', () => {
	const dots = ditherDots({}, 60, 75);
	assert.equal(dots.length, 75);
	assert.ok(dots.every((row) => row.length === 60));
	const flat = dots.flat();
	assert.ok(flat.every((v) => v === -1 || (v >= 0 && v <= 1)));
	const lit = flat.filter((v) => v >= 0).length;
	assert.ok(lit > flat.length * 0.1 && lit < flat.length * 0.9, `lit ${lit} of ${flat.length}`);
	assert.ok(flat.some((v) => v === 1), 'some core');
	assert.deepEqual(ditherDots({}, 60, 75), dots);
	assert.notDeepEqual(ditherDots({ offset: [3, 1] }, 60, 75), dots, 'an offset differs');
	assert.notDeepEqual(ditherDots({}, 60, 75, 6), dots, 'it moves');
});

test('ditherDots dithers between empty and solid: a dotted band, not a hard contour', () => {
	const dots = ditherDots({ contrast: 3 }, 80, 80);
	let mixed = 0;
	for (let r = 0; r < 80; r += 8)
		for (let c = 0; c < 80; c += 8) {
			const block = dots.slice(r, r + 8).flatMap((row) => row.slice(c, c + 8));
			const on = block.filter((v) => v >= 0).length;
			if (on > 8 && on < 56) mixed++;
		}
	assert.ok(mixed > 0, 'some 8×8 blocks are partly lit');
});

test('ditherDots keeps the quiet area empty and the edge untouched', () => {
	const loud = { brightness: 0.4 };
	const quiet = ditherDots({ ...loud, quiet: { radius: 0.3, depth: 1 } }, 40, 40);
	const open = ditherDots(loud, 40, 40);
	assert.equal(quiet[20][20], -1, 'the centre is empty');
	assert.notEqual(open[20][20], -1);
	assert.deepEqual(quiet[0], open[0]);
});

test('ripple 0 turns the rings off', () => {
	const off = ditherDots({ ripple: 0 }, 30, 30, 4);
	const on = ditherDots({ ripple: 3, origin: [0.5, 0.5] }, 30, 30, 4);
	assert.notDeepEqual(off, on);
	assert.deepEqual(off, ditherDots({ ripple: 0, rings: 9 }, 30, 30, 4), 'rings mean nothing without ripple');
});

test('ditherColors gives the edge and core colours, a palette its ends', () => {
	assert.deepEqual(ditherColors({}), ['#b4b4b4', '#ffbe50']);
	assert.deepEqual(ditherColors({ colors: ['#111111', '#222222', '#333333'] }), ['#111111', '#333333']);
	const [edge, core] = ditherColors({ palette: 'Mono' });
	assert.match(edge, /^#/);
	assert.match(core, /^#/);
});

test('ditherStill ends on the ground and leaves the quiet area to it', () => {
	const css = ditherStill({ background: '#0b0b0b', colors: ['#3d4d0a', '#c8ff00'] });
	assert.match(css, /#0b0b0b$/);
	assert.match(css, /#c8ff00/);
	assert.match(ditherStill({}), /#000000$/);
	const quiet = ditherStill({ background: '#0b0b0b', quiet: { x: 0.5, y: 0.5, radius: 0.6 } });
	assert.match(quiet, /^radial-gradient\(33% 33% at 50% 50%, #0b0b0b/);
	assert.match(ditherStill({ dot: 4 }), /0 0 \/ 8px 8px/, 'the checker is two dots across');
	assert.deepEqual(DITHER_DEFAULTS.origin, [0.04, 0.3]);
});
