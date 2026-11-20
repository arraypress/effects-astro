import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLOW_DEFAULTS, TICKS, flowNoise, flowAngle, driveAt, quietFactor, trailCount, flowRamp, lifeAlpha, createFlow } from '../src/runtime/flow-field.js';
import { mixOklab } from '../src/runtime/color.js';

/** Buckets as the canvas makes them: ten colour steps by ten alpha steps. */
const buckets = (tones = 10) => Array.from({ length: tones * 10 }, () => /** @type {number[]} */ ([]));

test('flowNoise is centred on 0.5, keeps its spread between time slices, and moves with time', () => {
	for (const z of [0, 0.5, 3.25]) {
		let sum = 0;
		let sq = 0;
		let n = 0;
		for (let x = 0; x < 20; x += 0.37)
			for (let y = 0; y < 20; y += 0.41) {
				const v = flowNoise(x, y, z);
				sum += v;
				sq += v * v;
				n++;
			}
		const mean = sum / n;
		const sd = Math.sqrt(sq / n - mean * mean);
		assert.ok(Math.abs(mean - 0.5) < 0.06, `mean ${mean} at z ${z}`);
		assert.ok(sd > 0.12, `spread ${sd} at z ${z}: not flat between slices`);
	}
	assert.equal(flowNoise(1.3, 2.7, 0.4), flowNoise(1.3, 2.7, 0.4));
	assert.notEqual(flowNoise(1.3, 2.7, 0.4), flowNoise(1.3, 2.7, 0.9));
	// smooth: a tiny step moves it a little
	assert.ok(Math.abs(flowNoise(1.3, 2.7, 0.4) - flowNoise(1.301, 2.7, 0.4)) < 0.01);
	assert.ok(Math.abs(flowNoise(1.3, 2.7, 0.4) - flowNoise(1.3, 2.7, 0.401)) < 0.01);
});

test('flowAngle is the noise times two whole turns', () => {
	assert.equal(flowAngle(0.2, 0.9, 1.1), flowNoise(0.2, 0.9, 1.1) * Math.PI * 4);
});

test('driveAt stays in 0–1, wanders slowly, reaches both ends, and its channels differ', () => {
	let lo = 1;
	let hi = 0;
	for (let t = 0; t < 2000; t += 0.5) {
		const v = driveAt(t, 0);
		assert.ok(v >= 0 && v <= 1);
		lo = Math.min(lo, v);
		hi = Math.max(hi, v);
	}
	assert.ok(lo < 0.05 && hi > 0.95, `${lo}–${hi}`);
	assert.ok(Math.abs(driveAt(10, 0) - driveAt(10.1, 0)) < 0.02, 'slow');
	assert.notEqual(driveAt(10, 0), driveAt(10, 1));
});

test('quietFactor follows the shared quiet: 1 − depth at the centre, 1 at the edge, 1 with none', () => {
	const quiet = { radius: 0.4, depth: 0.9 };
	assert.ok(Math.abs(quietFactor(200, 150, 400, 300, quiet) - 0.1) < 1e-9);
	assert.equal(quietFactor(5, 5, 400, 300, quiet), 1);
	assert.equal(quietFactor(200, 150, 400, 300, null), 1);
	// it rises from the centre outward
	const a = quietFactor(200 + 30, 150, 400, 300, quiet);
	const b = quietFactor(200 + 80, 150, 400, 300, quiet);
	assert.ok(0.1 < a && a < b && b < 1);
	// an off-centre area moves with its x, y (0–1 from the top left)
	assert.ok(Math.abs(quietFactor(100, 75, 400, 300, { x: 0.25, y: 0.25, radius: 0.4, depth: 1 })) < 1e-9);
});

test('trailCount follows the area', () => {
	assert.equal(trailCount(100, 100, 12), 12);
	assert.equal(trailCount(1280, 720, 12), Math.round(92.16 * 12));
	assert.equal(trailCount(330, 412), Math.round(13.596 * FLOW_DEFAULTS.density));
	assert.equal(trailCount(1, 1, 12), 1, 'at least one for any area');
	assert.equal(trailCount(0, 100, 12), 0);
});

test('flowRamp blends from the first colour to the last in Oklab', () => {
	assert.deepEqual(flowRamp(['#ffffff']), ['rgb(255 255 255)']);
	const ramp = flowRamp(['#000000', '#ffffff'], 5);
	assert.equal(ramp.length, 5);
	assert.equal(ramp[0], 'rgb(0 0 0)');
	assert.equal(ramp[4], 'rgb(255 255 255)');
	// the middle is Oklab's (L 0.5), not sRGB's 128
	const mid = Math.round(mixOklab([0, 0, 0], [1, 1, 1], 0.5)[0] * 255);
	assert.equal(ramp[2], `rgb(${mid} ${mid} ${mid})`);
	assert.notEqual(mid, 128);
	assert.throws(() => flowRamp(['nope']), TypeError);
});

test('lifeAlpha fades in, holds, and fades out', () => {
	assert.equal(lifeAlpha(0, 4), 0);
	assert.equal(lifeAlpha(2, 4), 1);
	assert.equal(lifeAlpha(4, 4), 0);
	assert.ok(lifeAlpha(0.1, 4) > 0 && lifeAlpha(0.1, 4) < 1);
	assert.ok(lifeAlpha(3.9, 4) > 0 && lifeAlpha(3.9, 4) < 1);
});

test('createFlow starts settled: trails alive with full tails, about the count the area holds', () => {
	const flow = createFlow({}, 330, 412);
	const alive = flow.trails.filter((p) => p.alive);
	const base = trailCount(330, 412, FLOW_DEFAULTS.density);
	assert.ok(alive.length > base * 0.4 && alive.length <= flow.trails.length, `${alive.length} of ${base}`);
	assert.equal(flow.steps, Math.round(FLOW_DEFAULTS.length * TICKS) + 1);
	// most trails have moved: their tail's ends differ
	const long = alive.filter((p) => {
		const tail = (p.head + 1) % flow.steps;
		return Math.hypot(p.path[p.head * 2] - p.path[tail * 2], p.path[p.head * 2 + 1] - p.path[tail * 2 + 1]) > 10;
	});
	assert.ok(long.length > alive.length * 0.6, `${long.length} of ${alive.length} with tails`);
	const laid = flow.segments(buckets());
	assert.ok(laid > alive.length * 3, `${laid} segments`);
});

test('a hero holds proportionally more trails than a card', () => {
	const card = createFlow({}, 330, 412);
	const hero = createFlow({}, 1280, 720);
	const ratio = hero.trails.length / card.trails.length;
	assert.ok(Math.abs(ratio - (1280 * 720) / (330 * 412)) < 0.2, `${ratio}`);
});

test('the same seed makes the same field, another seed another', () => {
	const at = (/** @type {number} */ seed) => createFlow({ seed }, 300, 300).trails.slice(0, 5).map((p) => [p.x, p.y]);
	assert.deepEqual(at(4), at(4));
	assert.notDeepEqual(at(4), at(5));
});

test('stepping is frame-rate independent: 30 fps and 60 fps land in the same place', () => {
	const a = createFlow({ seed: 9 }, 300, 300, { warm: 0 });
	const b = createFlow({ seed: 9 }, 300, 300, { warm: 0 });
	for (let i = 0; i < 60; i++) a.advance(1 / 30);
	for (let i = 0; i < 120; i++) b.advance(1 / 60);
	assert.ok(Math.abs(a.time - b.time) < 1e-9);
	assert.deepEqual(
		a.trails.map((p) => [p.x, p.y]),
		b.trails.map((p) => [p.x, p.y]),
	);
});

test('trails move along the field at their pace', () => {
	const flow = createFlow({ vary: 0, pace: 120 }, 400, 400, { warm: 0.5 });
	const p = flow.trails.find((t) => t.alive && t.age < t.life - 0.2);
	assert.ok(p);
	const [x, y] = [p.x, p.y];
	flow.advance(1 / TICKS);
	if (p.alive) assert.ok(Math.abs(Math.hypot(p.x - x, p.y - y) - p.pace / TICKS) < 1e-3);
	assert.ok(p.pace > 120 * 0.8 && p.pace < 120 * 1.2);
});

test('segments fade from head to tail and sit in their buckets', () => {
	const flow = createFlow({ colors: ['#ffffff'] }, 300, 300);
	const bs = buckets(1);
	flow.segments(bs);
	// parse each bucket: a count, then that many x, y pairs
	let total = 0;
	for (const b of bs) {
		for (let i = 0; i < b.length; ) {
			const n = b[i++];
			assert.ok(n >= 2);
			i += n * 2;
			total++;
		}
	}
	assert.ok(total > 0);
	// the brightest bucket holds heads, the faintest tails: both are used
	assert.ok(bs[9].length > 0 && bs[0].length > 0);
});

test('a quiet area holds fewer and fainter trails at its centre', () => {
	const near = (/** @type {import('../src/runtime/flow-field.js').Flow} */ flow) => {
		const bs = buckets();
		flow.segments(bs);
		let weight = 0;
		bs.forEach((b, k) => {
			for (let i = 0; i < b.length; ) {
				const n = b[i++];
				const x = b[i];
				const y = b[i + 1];
				if (Math.hypot(x - 200, y - 200) < 60) weight += (k % 10) + 1;
				i += n * 2;
			}
		});
		return weight;
	};
	let open = 0;
	let quiet = 0;
	for (const seed of [1, 2, 3, 4]) {
		open += near(createFlow({ seed, vary: 0 }, 400, 400));
		quiet += near(createFlow({ seed, vary: 0, quiet: { radius: 0.4, depth: 0.95 } }, 400, 400));
	}
	assert.ok(quiet < open * 0.3, `${quiet} against ${open}`);
});

test('the drives swing the count wanted, and vary 0 holds it', () => {
	const held = createFlow({ vary: 0 }, 300, 300, { warm: 0 });
	const swung = createFlow({ vary: 1 }, 300, 300, { warm: 0 });
	const targets = new Set();
	const swings = new Set();
	for (let i = 0; i < 60; i++) {
		held.advance(1);
		swung.advance(1);
		targets.add(held.target);
		swings.add(swung.target);
	}
	assert.equal(targets.size, 1);
	assert.ok(swings.size > 5);
	assert.ok([...swings].every((n) => n <= swung.trails.length));
});

test('colorBy speed and random give each trail a tone in 0–1', () => {
	for (const colorBy of /** @type {const} */ (['speed', 'random'])) {
		const flow = createFlow({ colorBy, colors: ['#000000', '#ffffff'] }, 300, 300);
		const tones = flow.trails.filter((p) => p.alive).map((p) => p.tone);
		assert.ok(tones.every((t) => t >= 0 && t <= 1));
		assert.ok(new Set(tones).size > 3);
	}
});
