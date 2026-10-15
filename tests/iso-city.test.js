import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededRandom } from '../src/runtime/random.js';
import { createMesh, STRIDE } from '../src/runtime/mesh.js';
import { isoCamera, ISO_PITCH } from '../src/runtime/iso-camera.js';
import { planCity, connected, firstHit, PITCH, ROAD } from '../src/runtime/iso-city/plan.js';
import { buildRoads, findRoute, lanePoint, nearestStreet, routePoints, exits, LANE, BOX } from '../src/runtime/iso-city/roads.js';
import { createTraffic, GAP, CAR_LENGTH } from '../src/runtime/iso-city/traffic.js';
import { hull, shadowShift } from '../src/runtime/iso-city/shadows.js';
import { cityLook, DAY } from '../src/runtime/iso-city/look.js';
import { INSTANCE, bounce, carInstances, peopleInstances, pinStates } from '../src/runtime/iso-city/figures.js';
import { parseColor } from '../src/runtime/color.js';

/**
 * Asserts two numbers match to within a tolerance.
 *
 * @param {number} actual The number got.
 * @param {number} expected The number wanted.
 * @param {number} [within=1e-6] How close is close enough.
 */
const near = (actual, expected, within = 1e-6) => assert.ok(Math.abs(actual - expected) <= within, `${actual} ≉ ${expected}`);

test('a seeded generator repeats for its seed and differs between seeds', () => {
	const a = seededRandom(42);
	const b = seededRandom(42);
	const c = seededRandom(43);
	const first = Array.from({ length: 5 }, a);
	assert.deepEqual(first, Array.from({ length: 5 }, b));
	assert.notDeepEqual(first, Array.from({ length: 5 }, c));
	for (const v of first) assert.ok(v >= 0 && v < 1);
});

test('a box is five faces of flat, outward normals; with a bottom, six', () => {
	const mesh = createMesh().box([0, 0, 0], [1, 2, 3], [1, 1, 1]);
	assert.equal(mesh.count(), 30);
	const data = mesh.build();
	assert.equal(data.length, 30 * STRIDE);
	for (let v = 0; v < 30; v++) {
		const o = v * STRIDE;
		const [px, py, pz, nx, ny, nz] = data.slice(o, o + 6);
		near(Math.hypot(nx, ny, nz), 1);
		// Outward: from the centre towards the vertex, along the normal.
		assert.ok((px - 0.5) * nx + (py - 1) * ny + (pz - 1.5) * nz > 0);
	}
	assert.equal(createMesh().box([0, 0, 0], [1, 1, 1], [1, 1, 1], undefined, { bottom: true }).count(), 36);
});

test('triangles wind anticlockwise about their normal, and degenerate ones are dropped', () => {
	const mesh = createMesh();
	mesh.tri([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 0, 0], [3, 0.5]);
	mesh.tri([0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 0, 0]);
	const d = mesh.build();
	assert.equal(mesh.count(), 3);
	assert.deepEqual([...d.slice(3, 6)], [0, 0, 1]);
	assert.deepEqual([...d.slice(11, 13)], [3, 0.5]);
});

test('a loft gives its sides uv in distance round and up, and a sphere faces out', () => {
	const mesh = createMesh().prism([[0, 0], [2, 0], [2, 1], [0, 1]], 0, 3, [1, 1, 1]);
	const d = mesh.build();
	let maxU = 0;
	let maxV = 0;
	for (let v = 0; v < mesh.count(); v++) {
		maxU = Math.max(maxU, d[v * STRIDE + 9]);
		maxV = Math.max(maxV, d[v * STRIDE + 10]);
	}
	near(maxU, 6);
	near(maxV, 3);
	const ball = createMesh().sphere([1, 1, 1], 0.5, [1, 1, 1]).build();
	for (let v = 0; v < ball.length / STRIDE; v += 3) {
		const o = v * STRIDE;
		assert.ok((ball[o] - 1) * ball[o + 3] + (ball[o + 1] - 1) * ball[o + 4] + (ball[o + 2] - 1) * ball[o + 5] > 0);
	}
});

test('the iso camera puts its target in the middle, and the ground under a screen point projects back to it', () => {
	const cam = isoCamera({ target: [10, 0, 10], height: 8, aspect: 2 });
	const [x, y] = cam.project([10, 0, 10]);
	near(x, 0);
	near(y, 0);
	for (const [sx, sy] of [[0.3, -0.4], [-0.9, 0.7]]) {
		const g = cam.ground(sx, sy, 0.5);
		near(g[1], 0.5);
		const back = cam.project(g);
		near(back[0], sx, 1e-9);
		near(back[1], sy, 1e-9);
	}
	// Looking from +x +z: a point towards the camera is nearer (smaller depth); +x goes right and down.
	assert.ok(cam.project([12, 0, 12])[2] < cam.project([8, 0, 8])[2]);
	const right = cam.project([11, 0, 10]);
	assert.ok(right[0] > 0 && right[1] < 0);
	near(Math.asin(cam.eye[1]), ISO_PITCH);
	// Shifted, the picture moves and picking follows.
	const moved = isoCamera({ target: [10, 0, 10], shift: [0.3, 0] });
	near(moved.project([10, 0, 10])[0], 0.3);
	near(moved.ground(0.3, 0)[0], 10, 1e-9);
});

test('a city is the same for the same seed and size, and different for another', () => {
	const a = planCity({ seed: 7, size: 6 });
	assert.deepEqual(planCity({ seed: 7, size: 6 }), a);
	assert.notDeepEqual(planCity({ seed: 8, size: 6 }).buildings, a.buildings);
	assert.equal(a.extent, 6 * PITCH);
	assert.equal(a.nodes.length, 49);
	assert.equal(planCity({ seed: 1, size: 99 }).size, 12);
});

test('every city keeps its streets connected, with no dead ends, and closes a few into plazas', () => {
	for (let seed = 1; seed <= 25; seed++) {
		const plan = planCity({ seed, size: 3 + (seed % 6) });
		assert.ok(connected(plan.nodes.length, plan.edges));
		const degree = plan.nodes.map(() => 0);
		for (const e of plan.edges) {
			degree[e.a]++;
			degree[e.b]++;
		}
		assert.ok(degree.every((d) => d >= 2), `seed ${seed}: a dead end`);
		assert.equal(plan.edges.length + plan.closed.length, 2 * plan.size * (plan.size + 1));
		assert.ok(plan.blocks.some((b) => b.kind === 'park'));
	}
	assert.equal(connected(3, [{ a: 0, b: 1 }]), false);
});

test('buildings stand inside their blocks, clear of the streets, and are taller than they are thin', () => {
	const plan = planCity({ seed: 3, size: 6 });
	assert.ok(plan.buildings.length > 40);
	for (const b of plan.buildings) {
		const p = b.parts[0];
		const block = plan.blocks.find((k) => p.x0 >= k.x0 && p.x1 <= k.x1 && p.z0 >= k.z0 && p.z1 <= k.z1);
		assert.ok(block, 'inside a block');
		assert.equal(block.kind, 'build');
		assert.ok(p.y1 > p.y0);
		for (const part of b.parts.slice(1)) assert.ok(part.x0 >= p.x0 && part.x1 <= p.x1 && part.y0 >= p.y1 - 1e-9);
		// Off the street: no part of it within half a road of a street's centre line.
		for (const v of [p.x0, p.x1, p.z0, p.z1]) {
			const off = Math.abs(v - Math.round(v / PITCH) * PITCH);
			assert.ok(off >= ROAD / 2, `${v} is on a street`);
		}
	}
});

test('a line of sight meets the first building in its way', () => {
	const plan = planCity({ seed: 3, size: 6 });
	const p = /** @type {import('../src/runtime/iso-city/plan.js').Building} */ (plan.buildings.find((b) => b.parts.length === 1)).parts[0];
	const cx = (p.x0 + p.x1) / 2;
	const cz = (p.z0 + p.z1) / 2;
	const hit = firstHit(plan, [cx, 10, cz], [cx, 0, cz]);
	assert.ok(hit);
	near(hit[1], p.y1, 1e-9);
	assert.equal(firstHit(plan, [-5, 10, -5], [-5, 0, -5]), null);
});

test('every open segment has a lane each way, keeping right, joined into turns that meet them exactly', () => {
	const plan = planCity({ seed: 7, size: 4 });
	const roads = buildRoads(plan);
	assert.equal(roads.lanes.length, plan.edges.length * 2);
	for (const lane of roads.lanes) {
		assert.equal(roads.lanes[lane.reverse].reverse, lane.id);
		near(lane.length, PITCH - 2 * BOX);
		// Right of the centre line: the lane centre is LANE to the right of its heading.
		const a = roads.nodes[lane.from];
		near((lane.x - a.x) * -lane.dz + (lane.z - a.z) * lane.dx, LANE);
		for (const next of exits(roads, lane.id)) {
			const turn = roads.turn(lane.id, next);
			const start = turn.at(0);
			const end = turn.at(turn.length);
			const from = lanePoint(lane, lane.length);
			const to = lanePoint(roads.lanes[next], 0);
			near(start.x, from.x, 1e-9);
			near(start.z, from.z, 1e-9);
			near(end.x, to.x, 1e-9);
			near(end.z, to.z, 1e-9);
			assert.notEqual(turn.kind, 'back');
		}
	}
	const lane = roads.lanes.find((l) => exits(roads, l.id).length === 3);
	assert.ok(lane);
	const kinds = Object.fromEntries(exits(roads, lane.id).map((m) => [roads.turn(lane.id, m).kind, roads.turn(lane.id, m).length]));
	assert.ok(kinds.right < kinds.straight && kinds.straight < kinds.left);
});

test('routes are the shortest by road: straight ahead on the same lane, or round the block, never reversing', () => {
	const plan = planCity({ seed: 5, size: 5 });
	const roads = buildRoads(plan);
	const lane = roads.lanes[10];
	assert.deepEqual(findRoute(roads, { lane: lane.id, s: 0.5 }, { lane: lane.id, s: 2.5 }), { lanes: [lane.id], length: 2 });
	const back = findRoute(roads, { lane: lane.id, s: 2 }, { lane: lane.id, s: 1 });
	assert.ok(back && back.lanes.length >= 4 && back.lanes[0] === lane.id && back.lanes.at(-1) === lane.id);

	/**
	 * Dijkstra over lanes, for checking A* against.
	 *
	 * @param {{ lane: number, s: number }} from Start.
	 * @param {{ lane: number, s: number }} to End.
	 * @returns {number} The shortest distance.
	 */
	const dijkstra = (from, to) => {
		const dist = new Map();
		const queue = exits(roads, from.lane).map((id) => [id, roads.lanes[from.lane].length - from.s + roads.turn(from.lane, id).length]);
		for (const [id, d] of queue) dist.set(id, Math.min(dist.get(id) ?? Infinity, d));
		const done = new Set();
		while (true) {
			let best = -1;
			for (const [id, d] of dist) if (!done.has(id) && (best < 0 || d < dist.get(best))) best = id;
			if (best < 0) return Infinity;
			if (best === to.lane) return dist.get(best) + to.s;
			done.add(best);
			for (const next of exits(roads, best)) {
				const d = dist.get(best) + roads.lanes[best].length + roads.turn(best, next).length;
				if (d < (dist.get(next) ?? Infinity)) dist.set(next, d);
			}
		}
	};
	const random = seededRandom(9);
	for (let k = 0; k < 40; k++) {
		const from = { lane: Math.floor(random() * roads.lanes.length), s: random() * 2 };
		const to = { lane: Math.floor(random() * roads.lanes.length), s: random() * 2 };
		if (from.lane === to.lane) continue;
		const route = findRoute(roads, from, to);
		assert.ok(route);
		near(route.length, dijkstra(from, to), 1e-9);
		for (let i = 1; i < route.lanes.length; i++) {
			const prev = roads.lanes[route.lanes[i - 1]];
			assert.equal(roads.lanes[route.lanes[i]].from, prev.to);
			assert.notEqual(route.lanes[i], prev.reverse);
		}
		// Drawn, the route has no jumps.
		const points = routePoints(roads, route.lanes, from.s, to.s);
		for (let i = 1; i < points.length; i++) assert.ok(Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z) < 0.2);
	}
});

test('the nearest street gives the lane whose kerb is on the clicked side, clear of the junctions', () => {
	const plan = planCity({ seed: 5, size: 5 });
	const roads = buildRoads(plan);
	const e = plan.edges.find((x) => x.axis === 'x');
	const a = plan.nodes[e.a];
	const below = nearestStreet(roads, a.x + 1.5, a.z + 0.4);
	const above = nearestStreet(roads, a.x + 1.5, a.z - 0.4);
	assert.ok(below && above);
	near(roads.lanes[below.lane].dx, 1);
	near(roads.lanes[above.lane].dx, -1);
	near(below.s, 1.5 - BOX);
	near(above.s, PITCH - 1.5 - BOX);
	const corner = nearestStreet(roads, a.x + 0.1, a.z + 0.3);
	assert.ok(corner && corner.s >= 0.39);
	assert.equal(nearestStreet(roads, -50, -50), null);
});

/**
 * Runs traffic for a while, checking every car's distance from every other each step.
 *
 * @param {ReturnType<typeof createTraffic>} traffic The traffic.
 * @param {number} seconds How long.
 * @param {(t: number) => void} [each] Called each step.
 * @returns {{ closest: number, laneGap: number }} The closest any two cars came, and the closest two in one lane.
 */
function drive(traffic, seconds, each) {
	let closest = Infinity;
	let laneGap = Infinity;
	for (let t = 0; t < seconds; t += 1 / 60) {
		traffic.step(1 / 60);
		each?.(t);
		const cars = traffic.cars;
		for (let i = 0; i < cars.length; i++) {
			for (let k = i + 1; k < cars.length; k++) {
				closest = Math.min(closest, Math.hypot(cars[i].x - cars[k].x, cars[i].z - cars[k].z));
				if (cars[i].phase === 'lane' && cars[k].phase === 'lane' && cars[i].lane === cars[k].lane) laneGap = Math.min(laneGap, Math.abs(cars[i].s - cars[k].s));
			}
		}
	}
	return { closest, laneGap };
}

test('cars keep their distance, never overlap, and never lock up, even crowded', () => {
	for (const [seed, count] of [[7, 14], [3, 40]]) {
		const roads = buildRoads(planCity({ seed, size: 6 }));
		const traffic = createTraffic(roads, { cars: count, taxis: 4, random: seededRandom(seed) });
		const { closest, laneGap } = drive(traffic, 90);
		assert.ok(laneGap >= GAP - 1e-6, `lane gap ${laneGap}`);
		assert.ok(closest > CAR_LENGTH * 0.75, `closest ${closest}`);
		for (const car of traffic.cars) assert.ok(car.odo > 20, `car ${car.id} drove ${car.odo}`);
	}
});

test('a called taxi drives to the pin, pulls in, picks up and moves on', () => {
	const plan = planCity({ seed: 7, size: 6 });
	const roads = buildRoads(plan);
	const traffic = createTraffic(roads, { cars: 12, taxis: 3, random: seededRandom(2) });
	drive(traffic, 2);
	const job = traffic.call(10, 9.3);
	assert.ok(job);
	assert.ok(job.car.taxi);
	assert.equal(job.state, 'going');
	assert.ok(job.points.length > 2 && job.length > 0);
	let picked = -1;
	let pulledIn = false;
	drive(traffic, 40, () => {
		if (job.state === 'pickup' && picked < 0) {
			picked = traffic.time;
			const car = job.car;
			pulledIn = car.side > LANE + 0.05;
			const pin = lanePoint(roads.lanes[job.lane], job.s);
			assert.ok(Math.hypot(car.x - pin.x, car.z - pin.z) < 0.2);
		}
	});
	assert.ok(picked > 0, 'picked up');
	assert.ok(pulledIn, 'pulled in to the kerb');
	assert.equal(job.state, 'done');
	assert.equal(job.car.job, null);
	assert.equal(traffic.call(-60, -60), null);
});

test('parked traffic stands still at the kerb', () => {
	const roads = buildRoads(planCity({ seed: 7, size: 5 }));
	const traffic = createTraffic(roads, { cars: 10, parked: true, random: seededRandom(1) });
	const before = traffic.cars.map((c) => [c.x, c.z]);
	traffic.step(1);
	assert.deepEqual(traffic.cars.map((c) => [c.x, c.z]), before);
	assert.equal(traffic.cars.length, 10);
});

test('shadows fall away from the sun, and a hull wraps its points', () => {
	const [dx, dz] = shadowShift([-0.5, 1, 0.5], 2);
	near(dx, 1);
	near(dz, -1);
	const h = hull([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5], [0.2, 0.8]]);
	assert.equal(h.length, 4);
	assert.ok(h.every(([x, y]) => (x === 0 || x === 1) && (y === 0 || y === 1)));
});

test('the look takes colours, a palette softened, or the defaults, and the accent for the taxis', () => {
	const day = cityLook({});
	assert.deepEqual(day.buildings, parseColor(DAY.colors[0]));
	assert.deepEqual(day.accent, parseColor(DAY.accent));
	assert.equal(day.night, false);
	const own = cityLook({ colors: ['#ffffff', '#00ff00', '#000000'], accent: '#ff0000' });
	assert.deepEqual(own.parks, [0, 1, 0]);
	assert.deepEqual(own.accent, [1, 0, 0]);
	const palette = cityLook({ palette: 'barbie' });
	// Softened: the buildings stay light.
	assert.ok(palette.buildings.every((c) => c > 0.7));
	assert.ok(cityLook({ night: true }).buildings.every((c) => c < 0.4));
});

test('pins drop in with a bounce, bob while the taxi comes, and pop away at the pickup', () => {
	near(bounce(0), 0);
	near(bounce(1), 1);
	assert.ok(bounce(0.8) < 1);
	const job = /** @type {any} */ ({ state: 'going', since: 10 });
	const [dropping] = pinStates([job], 10);
	const [landed] = pinStates([job], 11);
	assert.ok(dropping.lift > 0.8 && dropping.scale < 0.7);
	assert.ok(landed.lift < 0.05 && Math.abs(landed.scale - 1) < 1e-9);
	job.state = 'pickup';
	assert.equal(pinStates([job], 10.2)[0].fade < 1, true);
	assert.equal(pinStates([job], 10.5).length, 0);
	job.state = 'done';
	assert.equal(pinStates([job], 10.1).length, 0);
});

test('every car is an instance, taxis in the accent; a rider waits at each pin and people cross while cars wait', () => {
	const roads = buildRoads(planCity({ seed: 7, size: 5 }));
	const traffic = createTraffic(roads, { cars: 6, taxis: 2, random: seededRandom(4) });
	const out = new Float32Array(6 * INSTANCE);
	carInstances(traffic.cars, { accent: [1, 0.5, 0], neutrals: [[0.2, 0.2, 0.2]] }, out);
	assert.deepEqual([...out.slice(4, 8)], [1, 0.5, 0, 1]);
	assert.deepEqual([...out.slice(INSTANCE * 5 + 4, INSTANCE * 5 + 8)].map((v) => Math.round(v * 10) / 10), [0.2, 0.2, 0.2, 0]);
	assert.equal(peopleInstances(traffic, roads).length, 0);
	traffic.call(6, 4.3);
	traffic.crossings.set(roads.nodes.findIndex((_, i) => roads.degree[i] === 4), { start: 0, until: 2 });
	const people = peopleInstances(traffic, roads);
	assert.ok(people.length >= 2 * INSTANCE && people.length % INSTANCE === 0);
});
