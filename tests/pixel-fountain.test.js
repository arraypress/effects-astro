import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFountain, fadeSteps, shadeAt, tierSizes, pixelRect, inkedCells, MAX_PIXELS, STEP, TRAIL_CAP, POINTER_DEFAULTS } from '../src/runtime/pixel-fountain.js';

/**
 * The live pixels' state, rounded, for comparing two runs.
 *
 * @param {ReturnType<typeof createFountain>} f The fountain.
 * @returns {string} One line a pixel.
 */
function snapshot(f) {
	return f.pixels
		.slice(0, f.count)
		.map((p) => [p.x, p.y, p.vx, p.vy, p.age, p.tier, p.on].map((v) => (typeof v === 'number' ? v.toFixed(6) : String(v))).join(' '))
		.join('\n');
}

/**
 * Runs a fountain through the same script: a trickle, a burst, a stream.
 *
 * @param {number} seed The seed.
 * @returns {ReturnType<typeof createFountain>} The fountain after it.
 */
function run(seed) {
	const f = createFountain({ width: 1200, height: 240, seed });
	for (let i = 0; i < 60; i++) f.step();
	f.emitEdge(600, 40, 'burst');
	for (let i = 0; i < 20; i++) {
		f.emitEdge(300 + i * 10, 2, 'move');
		f.step();
	}
	for (let i = 0; i < 25; i++) f.step();
	return f;
}

test('the same seed steps the same pixels; another seed does not', () => {
	const a = run(7);
	const b = run(7);
	assert.ok(a.count > 10, 'there are pixels to compare');
	assert.equal(snapshot(a), snapshot(b));
	assert.notEqual(snapshot(run(8)), snapshot(a));
});

test('a step defaults to the fixed 60 Hz step', () => {
	const f = createFountain({ width: 100, height: 100, rate: 0 });
	f.step();
	assert.equal(f.time, STEP);
});

test('fadeSteps: the colour first, each step darker, olive at the end', () => {
	const steps = fadeSteps('#c8ff00');
	assert.equal(steps.length, 4);
	assert.equal(steps[0], '#c8ff00');
	/** @param {string} hex @returns {number} Its summed channels. */
	const sum = (hex) => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0);
	for (let i = 1; i < steps.length; i++) assert.ok(sum(steps[i]) < sum(steps[i - 1]), `${steps[i]} is darker than ${steps[i - 1]}`);
	// Olive: red and green both well above blue, green no longer far ahead of red.
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(steps[3].slice(i, i + 2), 16));
	assert.ok(r > b && g > b && g - r < 20, `${steps[3]} is olive`);
	assert.equal(fadeSteps('#ff0000', 1).length, 1);
});

test('shadeAt walks the ramp in equal shares of life, a power-up starting hot', () => {
	assert.equal(shadeAt(0, 4), 0);
	assert.equal(shadeAt(0.24, 4), 0);
	assert.equal(shadeAt(0.25, 4), 1);
	assert.equal(shadeAt(0.6, 4), 2);
	assert.equal(shadeAt(0.99, 4), 3);
	assert.equal(shadeAt(1.5, 4), 3, 'never past the last');
	assert.equal(shadeAt(0.05, 4, true), -1, 'hot at first');
	assert.equal(shadeAt(0.2, 4, true), 0, 'then the ramp');
});

test('a pixel steps through the ramp in order and is gone by the end of its life', () => {
	const f = createFountain({ width: 400, height: 240, rate: 0, gravity: 0, split: 0, flicker: 0, seed: 3 });
	f.emitEdge(200, 1, 'move');
	const p = f.pixels[0];
	let shade = 0;
	let steps = 0;
	while (f.count && steps < 1000) {
		const now = shadeAt(p.age / p.life, 4);
		assert.ok(now >= shade, 'the shade never goes back');
		shade = now;
		f.step();
		steps++;
	}
	assert.equal(f.count, 0, 'gone');
	assert.equal(shade, 3, 'it reached the last step');
});

test('without splits a pixel shrinks a whole tier at a time, to a quarter', () => {
	const f = createFountain({ width: 400, height: 240, rate: 0, gravity: 0, split: 0, flicker: 0, seed: 11 });
	f.emitEdge(200, 1, 'move');
	const p = f.pixels[0];
	const tiers = [p.tier];
	while (f.count) {
		f.step();
		assert.equal(f.count <= 1, true, 'it never splits');
		if (f.count && p.tier !== tiers[tiers.length - 1]) tiers.push(p.tier);
	}
	for (let i = 1; i < tiers.length; i++) assert.equal(tiers[i], tiers[i - 1] + 1, 'one tier at a time');
	assert.equal(tiers[tiers.length - 1], 3, 'down to a quarter');
});

test('with split 1 every break makes two to four smaller pixels that scatter', () => {
	const f = createFountain({ width: 2000, height: 600, rise: 400, rate: 0, gravity: 0, split: 1, flicker: 0, seed: 5 });
	f.emit(1000, 300, 1, 'burst');
	const first = f.pixels[0];
	const tier = first.tier;
	while (f.count === 1) f.step();
	assert.ok(f.count >= 2 && f.count <= 4, `split into ${f.count}`);
	const pieces = f.pixels.slice(0, f.count);
	for (const q of pieces) assert.equal(q.tier, tier + 1, 'each a tier smaller');
	const xs = new Set(pieces.map((q) => Math.sign(q.vx - pieces[0].vx)));
	const ys = new Set(pieces.map((q) => q.y.toFixed(3)));
	assert.ok(xs.size > 1 || ys.size > 1, 'thrown apart, not stacked');
});

test('flickering pixels go off and on before they go', () => {
	const f = createFountain({ width: 400, height: 240, rate: 0, gravity: 0, split: 0, flicker: 1, life: 2, seed: 2 });
	f.emitEdge(200, 1, 'move');
	const p = f.pixels[0];
	let offs = 0;
	let ons = 0;
	let was = true;
	while (f.count) {
		f.step();
		if (!f.count) break;
		if (p.age / p.life < 0.45) assert.equal(p.on, true, 'steady until late in life');
		if (was && !p.on) offs++;
		if (!was && p.on) ons++;
		was = p.on;
	}
	assert.ok(offs >= 2 && ons >= 1, `flickered (${offs} offs, ${ons} ons)`);
});

test('the pool never holds more than MAX_PIXELS, splits included', () => {
	assert.equal(MAX_PIXELS, 400);
	const f = createFountain({ width: 3000, height: 600, rate: 50, split: 1, seed: 9 });
	assert.equal(f.emit(1500, 590, 1000, 'burst'), MAX_PIXELS, 'an emit stops at the cap');
	assert.equal(f.count, MAX_PIXELS);
	for (let i = 0; i < 120; i++) {
		f.emitEdge((i * 37) % 3000, 20, 'burst');
		f.step();
		assert.ok(f.count <= MAX_PIXELS, `${f.count} alive`);
	}
	f.clear();
	assert.equal(f.count, 0);
});

test('pixels fall back into the edge and are gone, and gravity 0 lets them float', () => {
	const f = createFountain({ width: 400, height: 240, rate: 0, life: 30, split: 0, flicker: 0, seed: 4 });
	f.emitEdge(200, 10, 'ambient');
	for (let i = 0; i < 600 && f.count; i++) f.step();
	assert.equal(f.count, 0, 'all landed');
	const g = createFountain({ width: 400, height: 240, rate: 0, gravity: 0, spread: 0, drift: 0, split: 0, life: 3, seed: 4 });
	g.emitEdge(200, 1, 'ambient');
	const y0 = g.pixels[0].y;
	for (let i = 0; i < 30; i++) g.step();
	assert.ok(g.pixels[0].y < y0 - 20, 'still rising');
});

test('the ambient trickle scales with the width and the rate', () => {
	const count = (width, rate) => {
		const f = createFountain({ width, height: 240, rate, life: 30, gravity: 0, spread: 0, drift: 0, split: 0, seed: 1 });
		for (let i = 0; i < 60; i++) f.step();
		return f.count;
	};
	assert.equal(count(1000, 0), 0);
	assert.equal(count(1000, 10), 10, 'ten a second for 1,000px');
	assert.equal(count(2000, 10), 20);
});

test('tierSizes: whole device pixels, a double block down to a quarter', () => {
	assert.deepEqual(tierSizes(8, 1), [16, 8, 4, 2]);
	assert.deepEqual(tierSizes(8, 2), [32, 16, 8, 4]);
	assert.deepEqual(tierSizes(7, 1.5), [22, 11, 6, 3]);
	assert.deepEqual(tierSizes(2, 1), [4, 2, 1, 1], 'at least a pixel');
});

test('pixelRect snaps to the grid of the size, rows counted up from the floor', () => {
	const floor = 237;
	for (const size of [16, 8, 4, 3]) {
		for (let k = 0; k < 200; k++) {
			const x = k * 3.71;
			const y = floor - k * 2.37;
			const [left, top] = pixelRect(x, y, size, floor);
			assert.equal(left % size, 0, 'columns from the left');
			assert.equal((floor - top) % size, 0, 'rows up from the floor');
			// The cell drawn is the one the centre is in.
			assert.ok(x >= left - 1e-9 && x <= left + size + 1e-9);
			assert.ok(y >= top - 1e-9 && y <= top + size + 1e-9);
		}
	}
	assert.deepEqual(pixelRect(4, floor - 4, 8, floor), [0, floor - 8], 'a block on the edge sits flush on it');
	// Moving less than a cell does not move the block: motion is stepped.
	assert.deepEqual(pixelRect(9, 100, 8, 200), pixelRect(15.9, 100, 8, 200));
});

test('inkedCells finds the filled cells, tops first', () => {
	// A 32 × 32 picture with a solid 16 × 16 square at the bottom left.
	const w = 32;
	const h = 32;
	const rgba = new Uint8ClampedArray(w * h * 4);
	for (let y = 16; y < 32; y++) for (let x = 0; x < 16; x++) rgba[(y * w + x) * 4 + 3] = 255;
	const { points, tops } = inkedCells(rgba, w, h, 8);
	assert.equal(points.length / 2, 4, 'two by two cells');
	assert.equal(tops, 2, 'the upper row are tops');
	assert.deepEqual([...points.slice(0, 4)], [4, 20, 12, 20], 'tops first, at their centres');
	assert.deepEqual([...points.slice(4)], [4, 28, 12, 28]);
});

test('with origins the trickle fires from them, and a press near them from them', () => {
	const f = createFountain({ width: 400, height: 240, rate: 30, gravity: 0, life: 30, split: 0, seed: 6 });
	f.setOrigins(Float32Array.from([100, 200, 300, 200]), 2);
	for (let i = 0; i < 60; i++) f.step(1e-9 + STEP);
	assert.ok(f.count > 0);
	f.clear();
	assert.equal(f.emitNear(105, 205, 5, 'ambient', 20), 5);
	assert.ok(f.pixels.slice(0, 5).every((p) => p.x === 100 && p.y === 200), 'from the origin near the point');
	assert.equal(f.emitNear(200, 50, 5, 'move', 20), 0, 'a move far from the letters fires nothing');
	assert.equal(f.emitNear(200, 50, 5, 'burst', 20), 5, 'a press far from them fires where it landed');
});

/**
 * A fountain set up as `source: 'pointer'` is.
 *
 * @param {object} [extra] More settings.
 * @returns {ReturnType<typeof createFountain>} The fountain.
 */
const pointerFountain = (extra = {}) => createFountain({ width: 1200, height: 400, cell: 10, ...POINTER_DEFAULTS, ...extra });

test('from the pointer: nothing on its own', () => {
	assert.equal(POINTER_DEFAULTS.rate, 0);
	const f = pointerFountain();
	for (let i = 0; i < 240; i++) f.step();
	assert.equal(f.count, 0);
});

test('a pointer move fires blocks where the pointer is, along the way it came', () => {
	const f = pointerFountain({ seed: 3 });
	assert.equal(f.moveTo(400, 300), 0, 'the first place only marks the pointer');
	const made = f.moveTo(440, 280);
	assert.ok(made > 0, 'the move fired');
	assert.equal(f.count, made);
	// Within the stretch from (400, 300) to (440, 280), give or take a cell.
	for (const p of f.pixels.slice(0, made)) {
		assert.ok(p.x >= 390 && p.x <= 450, `x ${p.x}`);
		assert.ok(p.y >= 270 && p.y <= 310, `y ${p.y}`);
		assert.equal(p.hot, false, 'never hot');
		assert.ok(p.tier <= 2);
	}
	// A short move fires right at the pointer.
	const g = pointerFountain({ trail: 100 });
	g.moveTo(800, 100);
	const n = g.moveTo(803, 104);
	assert.ok(n > 0);
	for (const p of g.pixels.slice(0, n)) assert.ok(Math.abs(p.x - 801.5) <= 12 && Math.abs(p.y - 102) <= 12, 'at the pointer');
});

test('blocks fired are in proportion to the distance moved, a share carried over', () => {
	const fired = (d, trail = 5) => {
		const f = pointerFountain({ trail });
		f.moveTo(100, 200);
		return f.moveTo(100 + d, 200);
	};
	assert.equal(fired(100), 5);
	assert.equal(fired(200), 10);
	assert.equal(fired(20), 1);
	assert.equal(fired(10), 0, 'half a block owed, none yet');
	// Ten small moves of 10px add up to 100px: seven blocks at the default.
	const f = pointerFountain();
	f.moveTo(100, 200);
	let total = 0;
	for (let i = 1; i <= 10; i++) total += f.moveTo(100 + i * 10, 200);
	assert.equal(total, POINTER_DEFAULTS.trail);
});

test('no move, no blocks: a still pointer, the first place after a lift', () => {
	const f = pointerFountain();
	f.moveTo(300, 200);
	for (let i = 0; i < 30; i++) {
		assert.equal(f.moveTo(300, 200), 0);
		f.step();
	}
	assert.equal(f.count, 0);
	assert.equal(f.moveTo(305, 200), 0, 'half a block owed');
	f.lift();
	assert.equal(f.moveTo(900, 50), 0, 'a jump after the pointer left fires nothing');
	assert.equal(f.moveTo(905, 50), 0, 'and what was owed before it was dropped');
	assert.equal(f.count, 0);
});

test('one move fires at most TRAIL_CAP blocks, and the pool never passes MAX_PIXELS', () => {
	const f = pointerFountain({ life: 30 });
	f.moveTo(0, 200);
	assert.equal(f.moveTo(1200, 200), TRAIL_CAP, 'a long jump is capped');
	assert.equal(f.moveTo(1200, 201), 0, 'and the excess is not saved up');
	for (let i = 0; i < 200; i++) {
		f.moveTo(i % 2 ? 0 : 1200, 200);
		assert.ok(f.count <= MAX_PIXELS, `${f.count} alive`);
	}
	assert.equal(f.count, MAX_PIXELS, 'full');
	assert.equal(f.moveTo(0, 200), 0, 'nothing more fits');
});

test('the trail pops up and out, kicked along the pointer, and is gone within its life', () => {
	const f = pointerFountain({ seed: 12, drift: 0 });
	f.moveTo(200, 300);
	for (let i = 1; i <= 40; i++) f.moveTo(200 + i * 15, 300);
	const n = f.count;
	assert.ok(n > 30);
	const pixels = f.pixels.slice(0, n);
	assert.ok(pixels.filter((p) => p.vy < 0).length > n * 0.8, 'mostly rising');
	const meanVx = pixels.reduce((s, p) => s + p.vx, 0) / n;
	assert.ok(meanVx > 30, `carried right (${meanVx.toFixed(1)} px/s)`);
	assert.ok(pixels.some((p) => p.tier === 0) && pixels.some((p) => p.tier >= 1), 'a few chunky blocks among smaller ones');
	assert.ok(pixels.every((p) => p.life <= POINTER_DEFAULTS.life), 'short lives');
	for (let i = 0; i < Math.ceil(POINTER_DEFAULTS.life / STEP) + 1; i++) f.step();
	assert.equal(f.count, 0, 'all gone within a second');
});

test('a tap fires a burst at the point, never hot', () => {
	const f = pointerFountain();
	assert.equal(f.emit(500, 250, POINTER_DEFAULTS.burst, 'tap'), POINTER_DEFAULTS.burst);
	for (const p of f.pixels.slice(0, f.count)) {
		assert.equal(p.hot, false);
		assert.ok(Math.abs(p.x - 500) < 40 && Math.abs(p.y - 250) < 40, 'near the tap');
	}
});
