import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRIP_DEFAULTS, DEPTH_STEP, dripRun, dripAt, dripAnchors, dripPlan, dripClock, dripStill, dripPath, dripsAtRest } from '../src/runtime/paint-drip.js';

/** A hexagon on its point, as the mark's coverage. */
function hexagon(n = 160) {
	const a = new Float32Array(n * n);
	const c = n / 2,
		R = n * 0.44;
	for (let y = 0; y < n; y++)
		for (let x = 0; x < n; x++) {
			const dx = Math.abs(x - c),
				dy = y - c;
			if (dx <= R * 0.866 && Math.abs(dy) <= R - dx * 0.577) a[y * n + x] = 1;
		}
	return a;
}

test('more paint runs further and faster, and every drip stops (it dries)', () => {
	let lastLength = 0,
		lastSpeed = 0;
	for (const paint of [0.6, 0.9, 1.2, 1.6]) {
		const run = dripRun({ paint, room: 0.5 });
		assert.ok(run.length > lastLength, `${paint}: ${run.length}`);
		const top = Math.max(...run.v);
		assert.ok(top > lastSpeed);
		assert.ok(run.duration < 6, `${paint} stops (${run.duration} s)`);
		assert.ok(run.v[run.v.length - 1] < 0.005, 'at rest at the end');
		lastLength = run.length;
		lastSpeed = top;
	}
	assert.ok(lastLength > 0.15 && lastLength < 0.35, 'a big drip runs a fifth of the card or so');
});

test('it pools before it moves, then accelerates, then slows: viscous, not a line extending', () => {
	const run = dripRun({ paint: 1.2, room: 0.5 });
	const startIdx = run.y.findIndex((y) => y > 0);
	assert.ok(startIdx > 5, 'the pool holds a moment before the drip breaks away');
	const peak = run.v.indexOf(Math.max(...run.v));
	assert.ok(peak > startIdx && peak < run.v.length - 10, 'speeds up, then slows to a stop');
	// the bead shrinks as it lays paint behind it
	assert.ok(run.r[run.r.length - 1] < Math.max(...run.r) * 0.9);
	// a body width at every depth, never wider than the widest bead
	assert.equal(run.w.length, Math.floor(run.length / DEPTH_STEP) + 1);
	for (const w of run.w) assert.ok(w > 0 && w <= 2 * Math.max(...run.r));
});

test('a drip that meets something below stops there', () => {
	const run = dripRun({ paint: 1.6, room: 0.05 });
	assert.ok(run.length <= 0.05 && run.length > 0.02, `${run.length}`);
	assert.ok(run.duration < 3);
});

test('the paint drips from the lower edges: near the bottom of a hexagon, apart, the same for the same seed', () => {
	const n = 160,
		a = hexagon(n);
	for (const seed of [1, 2, 3, 4]) {
		const at = dripAnchors(a, n, n, 3, seed);
		assert.equal(at.length, 3);
		for (const p of at) {
			assert.ok(p.y > 0.6, `low on the mark (${p.y})`);
			assert.ok(p.open, 'clear below');
		}
		for (let i = 1; i < at.length; i++) assert.ok(at[i].x - at[i - 1].x >= 0.11);
		assert.deepEqual(at, dripAnchors(a, n, n, 3, seed));
	}
	// nothing to drip from: no ink
	assert.deepEqual(dripAnchors(new Float32Array(n * n), n, n, 3, 1), []);
});

test('the plan: staggered starts, no drip past the floor, and a loop that holds then fades', () => {
	const n = 160;
	const plan = dripPlan(dripAnchors(hexagon(n), n, n, 3, 5), { left: 0.15, top: 0.17, size: 0.5 }, { seed: 5 });
	assert.equal(plan.drips.length, 3);
	const starts = plan.drips.map((d) => d.run.t0);
	assert.ok(new Set(starts).size === 3);
	for (const d of plan.drips) assert.ok(d.y + d.run.length <= DRIP_DEFAULTS.floor + 1e-9);
	assert.ok(plan.cycle > plan.settled + DRIP_DEFAULTS.hold);
	assert.equal(dripClock(plan, plan.settled + 0.1).fade, 1);
	assert.equal(dripClock(plan, plan.cycle - 0.3).fade, 0);
	// the loop comes round: the same frame a cycle later
	assert.deepEqual(dripClock(plan, 2), dripClock(plan, 2 + plan.cycle));
	// the still frame (after every drip has stopped) shows each at its full length
	for (const d of plan.drips) {
		const h = dripAt(d.run, plan.settled + 0.01);
		assert.ok(h.done && Math.abs(h.y - d.run.length) < 1e-6);
	}
});

test('a CSS still of the ground', () => {
	const css = dripStill({ background: '#808080' });
	assert.match(css, /^radial-gradient\(/);
	assert.match(css, /#808080 70%\)$/);
	assert.doesNotMatch(css, /url\(/);
});

test('never from a counter or a stripe end inside the mark: only the outer lower silhouette', () => {
	// an E: a top bar, a stem, a middle bar with ink below it, a bottom bar
	const n = 96,
		a = new Float32Array(n * n);
	const fill = (x0, y0, x1, y1) => {
		for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a[y * n + x] = 1;
	};
	fill(10, 10, 86, 24);
	fill(10, 24, 24, 86);
	fill(10, 45, 70, 58);
	fill(10, 72, 86, 86);
	for (let seed = 1; seed < 12; seed++)
		for (const p of dripAnchors(a, n, n, 4, seed)) {
			assert.ok(p.open, 'clear all the way below');
			assert.ok(p.y > 0.85, `from the bottom bar, not the middle one (${p.y})`);
		}
});

test('the still and the canvas draw the same outline: every drip at full length, as SVG path data', () => {
	const n = 160;
	const plan = dripPlan(dripAnchors(hexagon(n), n, n, 3, 2), { left: 0.15, top: 0.17, size: 0.5 }, { seed: 2 });
	const rest = dripsAtRest(plan);
	assert.equal(rest.match(/M/g).length, 3, 'one shape a drip');
	assert.match(rest, /^M[\d.]+ [\d.]+Q/);
	assert.doesNotMatch(rest, /NaN|Infinity/);
	for (const d of plan.drips) {
		const path = dripPath(d, plan.settled + 0.01);
		// the bead reaches the drip's full length
		const ys = [...path.matchAll(/[\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
		assert.ok(Math.abs(Math.max(...ys) - (d.y + d.run.length)) < 0.01);
		assert.equal(dripPath(d, d.run.t0 - 0.1), '', 'nothing before it starts');
	}
});
