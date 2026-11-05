import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, nebulaField, galaxyRamp, galaxyStops, nebulaPixels } from '../src/runtime/galaxy.js';

test('nebulaField gives a value a pixel, 0–1, the same for the same seed', () => {
	const field = nebulaField(80, 45, 7);
	assert.equal(field.length, 80 * 45);
	assert.ok(field.every((v) => v >= 0 && v <= 1));
	assert.deepEqual(nebulaField(80, 45, 7), field, 'the same seed, the same nebula');
	assert.notDeepEqual(nebulaField(80, 45, 8), field);
	// Not flat: clouds and darker gaps both.
	const min = Math.min(...field);
	const max = Math.max(...field);
	assert.ok(max - min > 0.3, `spread ${min}–${max}`);
});

test('nebulaField tiles: its noise wraps, so the first column follows on from the last', () => {
	const w = 64;
	const field = nebulaField(w, 32, 3);
	let seam = 0;
	let inner = 0;
	for (let y = 0; y < 32; y++) {
		seam += Math.abs(field[y * w] - field[y * w + w - 1]);
		inner += Math.abs(field[y * w + 31] - field[y * w + 32]);
	}
	assert.ok(seam < inner * 3 + 0.5, `seam ${seam} vs inner ${inner}`);
});

test('galaxyRamp runs from near-black through the colours to a pale top', () => {
	const ramp = galaxyRamp(COLORS, 256);
	assert.equal(ramp.length, 256 * 3);
	const at = (i) => [ramp[i * 3], ramp[i * 3 + 1], ramp[i * 3 + 2]];
	assert.ok(at(0).every((v) => v < 60), `dark start ${at(0)}`);
	assert.deepEqual(at(255), [245, 240, 255]);
	// The colours sit at their stops: deep, the four colours, pale is six stops over 255 steps.
	const blue = at(Math.round((255 / 5) * 1));
	assert.ok(Math.abs(blue[0] - 0x3a) < 6 && Math.abs(blue[2] - 0xd9) < 6, `first colour ${blue}`);
	assert.throws(() => galaxyRamp(['tomato']), TypeError);
	assert.deepEqual(galaxyRamp([]), galaxyRamp(COLORS), 'no colours, the default');
});

test('nebulaPixels paints each value along the ramp, opaque', () => {
	const ramp = galaxyRamp(['#ff0000', '#00ff00'], 3);
	const px = nebulaPixels(Float32Array.from([0, 0.5, 1]), ramp);
	assert.equal(px.length, 12);
	assert.deepEqual([...px.slice(8, 12)], [245, 240, 255, 255]);
	assert.deepEqual([...px.slice(4, 8)], [ramp[3], ramp[4], ramp[5], 255]);
	assert.ok([3, 7, 11].every((i) => px[i] === 255));
});

/**
 * The Logomarks studio's first nebula (packages/studio/src/galaxy.ts before it used this library), kept
 * as it was: the reference `rng: 'park-miller'` with `blend: 'srgb'` must match to the byte.
 *
 * @param {number} W Width.
 * @param {number} H Height.
 * @param {string[]} colors `#rrggbb`.
 * @param {number} seed The seed.
 * @returns {Uint8ClampedArray} RGBA.
 */
function studioNebula(W, H, colors, seed) {
	const hex = (h) => {
		const n = parseInt(h.replace('#', '').slice(0, 6), 16);
		return [n >> 16, (n >> 8) & 255, n & 255];
	};
	const lattice = (n, rnd) => {
		const v = new Float32Array(n * n).map(() => rnd());
		return (x, y) => {
			const fx = x * n, fy = y * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
			const at = (i, j) => v[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
			const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx, b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
			return a + (b - a) * sy;
		};
	};
	let s = seed;
	const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
	const oct = [3, 6, 12, 24, 48].map((n) => lattice(n, rnd));
	const dust = [5, 10, 20].map((n) => lattice(n, rnd));
	const hue = lattice(2, rnd);
	const cs = colors.map(hex);
	const ramp = [cs[0].map((v) => v * 0.18), ...cs, [245, 240, 255]];
	const d = new Uint8ClampedArray(W * H * 4);
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			const u = x / W, v = y / H;
			let n = 0, amp = 0.5;
			for (const o of oct) { n += o(u, v) * amp; amp *= 0.5; }
			n /= 0.97;
			let r = 0;
			for (const o of dust) r += 1 - Math.abs(o(u, v) * 2 - 1);
			r /= dust.length;
			let t = Math.min(1, Math.max(0, (n - 0.3) * 2.3));
			t *= 1 - Math.max(0, r - 0.72) * 2.2;
			t = Math.max(0, t);
			const k = Math.min(1, Math.max(0, t * 0.8 + (hue(u, v) - 0.5) * 0.6)) * (ramp.length - 1);
			const i = Math.min(ramp.length - 2, Math.floor(k)), f = k - i;
			const p = (y * W + x) * 4;
			for (let ch = 0; ch < 3; ch++) d[p + ch] = ramp[i][ch] + (ramp[i + 1][ch] - ramp[i][ch]) * f;
			d[p + 3] = 255;
		}
	return d;
}

test("rng 'park-miller' with blend 'srgb' paints the studio's first nebula to the byte", () => {
	// 25 and 75 are bytes whose near-black (× 0.18) lands on a half: rounding must match too.
	for (const colors of [COLORS, ['#19194b', '#4b7dff', '#e1af19']]) {
		const ours = nebulaPixels(nebulaField(400, 225, 7, 'park-miller'), galaxyStops(colors, 'srgb'), true);
		const theirs = studioNebula(400, 225, colors, 7);
		let differ = 0;
		for (let i = 0; i < ours.length; i++) if (ours[i] !== theirs[i]) differ++;
		assert.equal(differ, 0, `${colors}: ${differ} bytes differ`);
	}
	assert.notDeepEqual(nebulaField(40, 20, 7, 'park-miller'), nebulaField(40, 20, 7), 'a different generator, a different sky');
});

test('galaxyStops: near-black, the colours, the pale top; srgb darkens the bytes', () => {
	const srgb = galaxyStops(['#3a2bd9', '#5c7cff'], 'srgb');
	assert.equal(srgb.length, 4 * 3);
	assert.deepEqual([...srgb.slice(0, 3)], [0x3a * 0.18, 0x2b * 0.18, 0xd9 * 0.18]);
	assert.deepEqual([...srgb.slice(3, 9)], [0x3a, 0x2b, 0xd9, 0x5c, 0x7c, 0xff]);
	assert.deepEqual([...srgb.slice(9)], [245, 240, 255]);
	const oklab = galaxyStops(COLORS);
	const ramp = galaxyRamp(COLORS);
	assert.deepEqual([0, 1, 2].map((i) => Math.round(oklab[i])), [ramp[0], ramp[1], ramp[2]], 'the Oklab ramp starts at its near-black');
	assert.deepEqual(galaxyStops([], 'srgb'), galaxyStops(COLORS, 'srgb'));
});

test("galaxyRamp with 'srgb' runs in straight lines between the stops", () => {
	const ramp = galaxyRamp(['#000000', '#ffffff'], 7, 'srgb');
	// Stops at 0, 1/3, 2/3 and 1 of the way: black (× 0.18), black, white, pale.
	assert.deepEqual([...ramp.slice(0, 3)], [0, 0, 0]);
	assert.deepEqual([...ramp.slice(9, 12)], [128, 128, 128], 'half way between black and white');
	assert.deepEqual([...ramp.slice(18)], [245, 240, 255]);
	assert.notDeepEqual(galaxyRamp(COLORS, 256, 'srgb'), galaxyRamp(COLORS));
});

test('nebulaPixels smooth blends between the entries either side', () => {
	const px = nebulaPixels([0, 0.25, 0.5, 1], [0, 0, 0, 200, 100, 50, 255, 255, 255], true);
	assert.deepEqual([...px.slice(0, 4)], [0, 0, 0, 255]);
	assert.deepEqual([...px.slice(4, 8)], [100, 50, 25, 255]);
	assert.deepEqual([...px.slice(8, 12)], [200, 100, 50, 255]);
	assert.deepEqual([...px.slice(12, 16)], [255, 255, 255, 255]);
});
