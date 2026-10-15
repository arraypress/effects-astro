import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noiseGrad, curl } from '../src/runtime/curl.js';
import { createSwarm, disperse, setHomes, settle, stepSwarm } from '../src/runtime/swarm.js';
import { edgePoints } from '../src/runtime/shape.js';

/**
 * A seeded random source, so runs repeat.
 *
 * @param {number} seed The seed.
 * @returns {() => number} 0–1, repeatably.
 */
const seeded = (seed) => () => {
	seed = (seed * 16807) % 2147483647;
	return (seed - 1) / 2147483646;
};

test('noiseGrad is 0–1, repeatable, and its gradient matches the slope', () => {
	const h = 1e-4;
	for (const [x, y] of [[0.3, 0.7], [3.25, -1.5], [10.9, 4.1]]) {
		const [v, dx, dy] = noiseGrad(x, y);
		assert.ok(v >= 0 && v <= 1, `${v} out of range`);
		assert.deepEqual([...noiseGrad(x, y)], [v, dx, dy]);
		assert.ok(Math.abs((noiseGrad(x + h, y)[0] - noiseGrad(x - h, y)[0]) / (2 * h) - dx) < 1e-3);
		assert.ok(Math.abs((noiseGrad(x, y + h)[0] - noiseGrad(x, y - h)[0]) / (2 * h) - dy) < 1e-3);
	}
});

test('curl has no divergence: nothing piles up along it', () => {
	const h = 1e-4;
	for (const [x, y, t] of [[0.4, 0.6, 0], [2.7, 1.3, 5], [-3.1, 8.2, 12]]) {
		const div = (curl(x + h, y, t)[0] - curl(x - h, y, t)[0]) / (2 * h) + (curl(x, y + h, t)[1] - curl(x, y - h, t)[1]) / (2 * h);
		assert.ok(Math.abs(div) < 1e-3, `divergence ${div}`);
	}
});

test('curl changes over time', () => {
	assert.notDeepEqual(curl(1.2, 3.4, 0), curl(1.2, 3.4, 4));
});

test('a dispersed swarm gathers to its homes', () => {
	const random = seeded(3);
	const swarm = createSwarm(200, random);
	const homes = new Float32Array(400).map((_, i) => (i % 2 ? 0.5 : 1) + (random() - 0.5) * 0.2);
	setHomes(swarm, homes);
	disperse(swarm, 1, 0.5, 0.5, random);
	/**
	 * The mean distance of the held particles (not the loose ones) from their homes.
	 *
	 * @returns {number} The distance.
	 */
	const spread = () => {
		let sum = 0;
		let n = 0;
		for (let i = 0; i < swarm.count; i++) {
			if (swarm.grip[i] < 0.5) continue;
			sum += Math.hypot(swarm.pos[i * 2] - swarm.home[i * 2], swarm.pos[i * 2 + 1] - swarm.home[i * 2 + 1]);
			n++;
		}
		return sum / n;
	};
	const before = spread();
	for (let k = 0; k < 300; k++) stepSwarm(swarm, 1 / 60, { random });
	assert.ok(before > 0.2, `started ${before} out`);
	assert.ok(spread() < 0.04, `still ${spread()} out after five seconds`);
});

test('trading homes keeps the same set of homes', () => {
	const random = seeded(9);
	const swarm = createSwarm(100, random);
	setHomes(swarm, new Float32Array(200).map((_, i) => i));
	stepSwarm(swarm, 1 / 20, { wander: 2, random });
	assert.deepEqual([...swarm.home].sort((a, b) => a - b), [...new Float32Array(200).map((_, i) => i)]);
});

test('the pointer pushes particles away', () => {
	const random = seeded(5);
	const swarm = createSwarm(1, random);
	setHomes(swarm, new Float32Array([0, 0]));
	settle(swarm);
	stepSwarm(swarm, 1 / 60, { flow: 0, pointer: { x: 0.05, y: 0, radius: 0.15, force: 70 }, random });
	assert.ok(swarm.pos[0] < 0, `moved to ${swarm.pos[0]}`);
});

test('a zero step changes nothing', () => {
	const swarm = createSwarm(10, seeded(1));
	disperse(swarm, 0, 0, 1, seeded(2));
	const pos = [...swarm.pos];
	stepSwarm(swarm, 0);
	assert.deepEqual([...swarm.pos], pos);
});

test('edgePoints lands every point on the shape\'s edge', () => {
	const size = 40;
	const alpha = new Uint8ClampedArray(size * size);
	for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) alpha[y * size + x] = 255;
	const points = edgePoints(/** @type {any} */ ({ alpha, width: size, height: size }), 300, seeded(4));
	for (let i = 0; i < points.length; i += 2) {
		const x = Math.floor(points[i] * size);
		const y = Math.floor((1 - points[i + 1]) * size);
		assert.ok(x === 10 || x === 29 || y === 10 || y === 29, `${x}, ${y} is not on the edge`);
	}
	assert.deepEqual([...edgePoints(/** @type {any} */ ({ alpha: new Uint8ClampedArray(4), width: 2, height: 2 }), 2)], [0, 0, 0, 0]);
});

test('setHomes orders homes so neighbours in the order are neighbours on the shape', () => {
	const random = seeded(11);
	const swarm = createSwarm(2000, random);
	setHomes(swarm, new Float32Array(4000).map(() => random()));
	let far = 0;
	for (let i = 2; i < swarm.count * 2; i += 2) {
		if (Math.hypot(swarm.home[i] - swarm.home[i - 2], swarm.home[i + 1] - swarm.home[i - 1]) > 0.1) far++;
	}
	// Only the turns at the ends of the bands jump; everything else is a short step.
	assert.ok(far < 40, `${far} long steps`);
});
