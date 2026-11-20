import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	MESH_DEFAULTS,
	hash33,
	driveAt,
	clockAt,
	pulseWave,
	seedOptions,
	macroSeed,
	innerSeeds,
	macroAt,
	meshPolygons,
	meshColors,
	meshSvg,
	meshStill,
} from '../src/runtime/voronoi-mesh.js';

test('hash33 stays in 0–1, is the same for the same input and differs between points', () => {
	const seen = new Set();
	for (let x = -20; x < 20; x += 3)
		for (let y = -20; y < 20; y += 3)
			for (let z = 0; z < 4; z++) {
				const h = hash33(x, y, z);
				assert.equal(h.length, 3);
				for (const v of h) assert.ok(v >= 0 && v < 1, `${x}, ${y}, ${z}: ${v}`);
				seen.add(h[0].toFixed(6));
			}
	assert.ok(seen.size > 0.95 * 14 * 14 * 4, 'well spread');
	assert.deepEqual(hash33(3, 4, 1), hash33(3, 4, 1));
});

test('clockAt is the integral of the driver: 0 at 0, rising at 1 + 2 · driveAt', () => {
	assert.equal(clockAt(0), 0);
	assert.equal(clockAt(10, 0), 10, 'no driver, plain seconds');
	for (const t of [0.5, 7, 33, 120, 900]) {
		const h = 1e-4;
		const rate = (clockAt(t + h) - clockAt(t - h)) / (2 * h);
		assert.ok(Math.abs(rate - (1 + 2 * driveAt(t))) < 1e-5, `t ${t}: ${rate}`);
		assert.ok(driveAt(t) >= 0 && driveAt(t) <= MESH_DEFAULTS.breathe);
	}
});

test('pulseWave rests through its dead zone and peaks halfway', () => {
	assert.equal(pulseWave(0), 0);
	assert.equal(pulseWave(0.03), 0);
	assert.ok(pulseWave(0.999) < 1e-3);
	assert.ok(Math.abs(pulseWave(0.5) - 1) < 1e-12);
	assert.ok(pulseWave(0.25) > 0.3 && pulseWave(0.25) < 0.7);
});

test('macro seeds stay inside their own square (under 0.42 off its centre on each axis), so a 3×3 neighbourhood always holds the nearest', () => {
	const options = seedOptions({ jitter: 1, orbit: 1 });
	for (let cx = -6; cx < 6; cx++)
		for (let cy = -6; cy < 6; cy++)
			for (const clock of [0, 5, 13.7, 40]) {
				const [x, y] = macroSeed(cx, cy, clock, options);
				assert.ok(Math.abs(x - cx - 0.5) <= 0.42 + 1e-9 && Math.abs(y - cy - 0.5) <= 0.42 + 1e-9);
			}
	assert.notDeepEqual(macroSeed(2, 3, 0), macroSeed(2, 3, 9), 'they orbit');
	assert.deepEqual(macroSeed(2, 3, 0, seedOptions({ jitter: 0, orbit: 0 })), [2.5, 3.5]);
});

test('macroAt finds the nearest seed and the exact border distance a brute force over 7×7 finds', () => {
	const options = seedOptions({ jitter: 1, orbit: 1 });
	let n = 0;
	for (let x = 0.13; x < 6; x += 0.29)
		for (let y = 0.07; y < 6; y += 0.31) {
			const clock = n++ * 1.7;
			const found = macroAt(x, y, clock, options);
			let best = Infinity;
			let seed = [0, 0];
			const all = [];
			for (let j = -3; j <= 3; j++)
				for (let i = -3; i <= 3; i++) {
					const s = macroSeed(Math.floor(x) + i, Math.floor(y) + j, clock, options);
					all.push(s);
					const d = Math.hypot(s[0] - x, s[1] - y);
					if (d < best) [best, seed] = [d, s];
				}
			assert.deepEqual(found.seed, seed);
			let edge = Infinity;
			for (const s of all) {
				const l = Math.hypot(s[0] - seed[0], s[1] - seed[1]);
				if (l > 1e-9) edge = Math.min(edge, (((s[0] + seed[0]) / 2 - x) * (s[0] - seed[0]) + ((s[1] + seed[1]) / 2 - y) * (s[1] - seed[1])) / l);
			}
			assert.ok(Math.abs(found.edge - edge) < 1e-9, `${x}, ${y}: ${found.edge} vs ${edge}`);
			assert.ok(found.edge >= 0);
		}
});

test('inner seeds draw in to the macro seed at the pulse’s rest, push out at its peak, and hold with pulse 0', () => {
	const opts = seedOptions({ inner: 6 });
	assert.equal(innerSeeds(1, 2, 0, opts).length, 6);
	assert.equal(innerSeeds(1, 2, 0, seedOptions({ inner: 0 })).length, 0);
	assert.equal(seedOptions({ inner: 20 }).inner, 8, 'at most eight');
	// Over a whole pulse cycle (20 s) each seed comes in close and goes out far.
	let near = Infinity;
	let far = 0;
	for (let clock = 0; clock < 20; clock += 0.05) {
		const [mx, my] = macroSeed(1, 2, clock, opts);
		const [qx, qy] = innerSeeds(1, 2, clock, opts)[0];
		const d = Math.hypot(qx - mx, qy - my);
		near = Math.min(near, d);
		far = Math.max(far, d);
	}
	assert.ok(near < 1e-3, `in to the seed: ${near}`);
	assert.ok(far > 0.4 && far <= 0.6 * 1.1 + 1e-9, `out: ${far}`);
	const still = seedOptions({ pulse: 0 });
	const at = (/** @type {number} */ c) => {
		const [mx, my] = macroSeed(1, 2, c, still);
		const [qx, qy] = innerSeeds(1, 2, c, still)[0];
		return Math.hypot(qx - mx, qy - my);
	};
	assert.ok(Math.abs(at(0) - at(7.3)) < 1e-12, 'pulse 0 holds them');
});

test('meshPolygons tiles the view: the macro cells cover the bound once, with inner cells inside them', () => {
	const config = { cells: 5, offset: /** @type {[number, number]} */ ([3.2, 1.7]) };
	const { macro, inner } = meshPolygons(config, 330, 412, 4);
	const area = (/** @type {[number, number][]} */ p) => Math.abs(p.reduce((a, [x, y], i) => a + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * y, 0)) / 2;
	const unit = 330 / 5;
	const total = macro.reduce((a, p) => a + area(p), 0);
	const bound = (330 + 2 * unit) * (412 + 2 * unit);
	assert.ok(Math.abs(total - bound) / bound < 1e-9, `${total} vs ${bound}`);
	assert.ok(macro.length > 20);
	assert.ok(inner.length > macro.length * 3, 'inner cells, about five a macro cell');
	for (const p of [...macro, ...inner]) for (const [x, y] of p) assert.ok(Number.isFinite(x) && Number.isFinite(y));
	assert.deepEqual(meshPolygons(config, 330, 412, 4), { macro, inner }, 'the same settings, the same frame');
	assert.notDeepEqual(meshPolygons({ ...config, offset: [9, 9] }, 330, 412, 4).macro, macro);
	assert.equal(meshPolygons({ ...config, inner: 0 }, 330, 412, 4).inner.length, 0);
});

test('meshColors gives the macro and inner colours; a palette its glint and first colour', () => {
	assert.deepEqual(meshColors({}), ['#c1c2bc', '#a67676']);
	assert.deepEqual(meshColors({ colors: ['#111111', '#222222'] }), ['#111111', '#222222']);
	assert.deepEqual(meshColors({ colors: ['#111111'] }), ['#111111', '#111111']);
	assert.deepEqual(meshColors({ palette: 'mono' }), ['#ffffff', '#f4f4f5']);
});

test('meshSvg draws the ground, both tiers and a quiet mask; meshStill wraps it as a CSS background', () => {
	const svg = meshSvg({ cells: 4, quiet: { radius: 0.5 } }, 330, 412);
	assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="330" height="412"/);
	assert.match(svg, /<rect width="330" height="412" fill="#350f0e"\/>/);
	assert.equal(svg.match(/<path /g)?.length, 2);
	assert.match(svg, /<mask id="m">/);
	assert.ok(!/NaN|undefined/.test(svg));
	assert.ok(!/<mask/.test(meshSvg({ cells: 4 }, 330, 412)), 'no quiet, no mask');
	assert.equal(meshSvg({ cells: 4, inner: 0 }, 330, 412).match(/<path /g)?.length, 1);
	assert.ok(!/<rect/.test(meshSvg({ cells: 4, background: 'transparent' }, 330, 412)));
	const still = meshStill({ cells: 4, background: '#0b0b0b' }, 330, 412);
	assert.match(still, /^url\("data:image\/svg\+xml,%3Csvg /);
	assert.match(still, /, #0b0b0b$/);
	assert.ok(!/[<>#"]/.test(still.slice(5, still.indexOf('") '))), 'the SVG is escaped');
	assert.ok(still.length < 40_000, `small enough for a style attribute: ${still.length}`);
});

test('a setting left undefined keeps its default', () => {
	assert.deepEqual(seedOptions({ jitter: undefined, inner: undefined }), seedOptions());
	assert.deepEqual(meshPolygons({ opacity: undefined, cells: 4 }, 200, 200), meshPolygons({ cells: 4 }, 200, 200));
});
