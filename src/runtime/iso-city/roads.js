/**
 * @module @arraypress/effects-astro/iso-city/roads
 *
 * The city's streets as something to drive: every open segment carries a
 * lane each way (traffic keeps right), each lane runs from the edge of one
 * junction to the edge of the next, and a turn joins a lane into one
 * leaving the junction it ends at: straight across, a tight arc to the
 * right, a wide one to the left. Routes are found with A* over lanes, so a
 * car never reverses along its own street; it goes round the block.
 *
 * Headings are radians from +x towards +z. A lane's right is the kerb.
 */

import { PITCH, ROAD } from './plan.js';

/** A lane's centre, from the street's centre line. */
export const LANE = 0.25;
/** Half a junction's width: lanes stop at its edge. */
export const BOX = ROAD / 2;
/** The least a pickup can be ahead of a car on its own lane and still be reached without going round. */
export const AHEAD = 0.6;

/**
 * @typedef {object} Lane
 * @property {number} id Its index.
 * @property {number} edge The street segment it is on.
 * @property {number} from The junction it leaves.
 * @property {number} to The junction it runs to.
 * @property {number} dx Its direction, x.
 * @property {number} dz Its direction, z.
 * @property {number} heading Its heading, radians.
 * @property {number} x The x of its centre line where it starts.
 * @property {number} z The z of its centre line where it starts.
 * @property {number} length Its length.
 * @property {number} reverse The lane the other way on the same segment.
 */

/**
 * @typedef {object} Turn
 * @property {'straight' | 'right' | 'left' | 'back'} kind Which way it goes.
 * @property {number} node The junction it crosses.
 * @property {number} length Its length.
 * @property {(t: number) => { x: number, z: number, heading: number }} at The point `t` along it.
 */

/**
 * @typedef {object} Roads
 * @property {{ x: number, z: number }[]} nodes The junctions.
 * @property {Lane[]} lanes Every lane.
 * @property {number[][]} out The lanes leaving each junction.
 * @property {number[]} degree How many streets meet at each junction.
 * @property {{ id: number, a: number, b: number, axis: 'x' | 'z' }[]} edges The open segments.
 * @property {(a: number, b: number) => Turn} turn The turn from lane `a` into lane `b` (cached).
 */

/**
 * Builds the lanes of a city's streets.
 *
 * @param {{ nodes: { x: number, z: number }[], edges: { id: number, a: number, b: number, axis: 'x' | 'z' }[] }} plan The plan's junctions and open segments.
 * @returns {Roads} The roads.
 */
export function buildRoads(plan) {
	/** @type {Lane[]} */
	const lanes = [];
	/** @type {number[][]} */
	const out = plan.nodes.map(() => []);
	const degree = plan.nodes.map(() => 0);
	for (const e of plan.edges) {
		const first = lanes.length;
		for (const [from, to] of [[e.a, e.b], [e.b, e.a]]) {
			const a = plan.nodes[from];
			const b = plan.nodes[to];
			const length = Math.hypot(b.x - a.x, b.z - a.z);
			const dx = (b.x - a.x) / length;
			const dz = (b.z - a.z) / length;
			const id = lanes.length;
			lanes.push({
				id,
				edge: e.id,
				from,
				to,
				dx,
				dz,
				heading: Math.atan2(dz, dx),
				x: a.x + dx * BOX - dz * LANE,
				z: a.z + dz * BOX + dx * LANE,
				length: length - BOX * 2,
				reverse: id === first ? first + 1 : first,
			});
			out[from].push(id);
		}
		degree[e.a]++;
		degree[e.b]++;
	}
	/** @type {Map<number, Turn>} */
	const turns = new Map();
	return {
		nodes: plan.nodes,
		lanes,
		out,
		degree,
		edges: plan.edges,
		turn(a, b) {
			const key = a * lanes.length + b;
			let t = turns.get(key);
			if (!t) {
				t = makeTurn(plan.nodes[lanes[a].to], lanes[a], lanes[b]);
				turns.set(key, t);
			}
			return t;
		},
	};
}

/**
 * The point `s` along a lane, `side` from the street's centre line.
 *
 * @param {Lane} lane The lane.
 * @param {number} s How far along, from its start.
 * @param {number} [side=LANE] How far right of the centre line (LANE is the lane's middle).
 * @returns {{ x: number, z: number, heading: number }} The point and the lane's heading.
 */
export function lanePoint(lane, s, side = LANE) {
	const off = side - LANE;
	return { x: lane.x + lane.dx * s - lane.dz * off, z: lane.z + lane.dz * s + lane.dx * off, heading: lane.heading };
}

/**
 * The turn from one lane into the next across the junction between them.
 *
 * @param {{ x: number, z: number }} node The junction.
 * @param {Lane} a The lane in.
 * @param {Lane} b The lane out.
 * @returns {Turn} The turn.
 */
export function makeTurn(node, a, b) {
	const entry = { x: node.x - a.dx * BOX - a.dz * LANE, z: node.z - a.dz * BOX + a.dx * LANE };
	const exit = { x: node.x + b.dx * BOX - b.dz * LANE, z: node.z + b.dz * BOX + b.dx * LANE };
	const along = a.dx * b.dx + a.dz * b.dz;
	const crossed = a.dx * b.dz - a.dz * b.dx;
	if (along > 0.5) {
		const length = Math.hypot(exit.x - entry.x, exit.z - entry.z);
		return {
			kind: 'straight',
			node: a.to,
			length,
			at: (t) => ({ x: entry.x + a.dx * t, z: entry.z + a.dz * t, heading: a.heading }),
		};
	}
	// An arc: right turns hug the near corner, left turns sweep wide, and a
	// turn back (only where nothing else leaves) loops within the junction.
	const kind = along < -0.5 ? 'back' : crossed > 0 ? 'right' : 'left';
	const sign = kind === 'right' ? 1 : -1;
	const radius = kind === 'right' ? BOX - LANE : kind === 'left' ? BOX + LANE : LANE;
	const sweep = kind === 'back' ? Math.PI : Math.PI / 2;
	const cx = entry.x + radius * Math.cos(a.heading + (sign * Math.PI) / 2);
	const cz = entry.z + radius * Math.sin(a.heading + (sign * Math.PI) / 2);
	const start = a.heading - (sign * Math.PI) / 2;
	return {
		kind,
		node: a.to,
		length: radius * sweep,
		at(t) {
			const turned = (sign * t) / radius;
			return { x: cx + radius * Math.cos(start + turned), z: cz + radius * Math.sin(start + turned), heading: a.heading + turned };
		},
	};
}

/**
 * The shortest way by road from a point on one lane to a point on another
 * (A*, over lanes, never doubling back along a street unless nothing else
 * leaves a junction).
 *
 * @param {Roads} roads The roads.
 * @param {{ lane: number, s: number }} from Where it starts.
 * @param {{ lane: number, s: number }} to Where it ends.
 * @returns {{ lanes: number[], length: number } | null} The lanes in order
 *   (the first is `from`'s, the last `to`'s) and the distance; null when
 *   there is no way.
 */
export function findRoute(roads, from, to) {
	const { lanes } = roads;
	if (from.lane === to.lane && to.s >= from.s + AHEAD) return { lanes: [from.lane], length: to.s - from.s };
	const goal = lanes[to.lane];
	/**
	 * A lower bound on the distance from a lane's start to the goal.
	 *
	 * @param {number} id The lane.
	 * @returns {number} The straight-line distance to the goal point.
	 */
	const guess = (id) => {
		const p = lanes[id];
		const g = lanePoint(goal, to.s);
		return Math.hypot(g.x - p.x, g.z - p.z);
	};
	/** Best known distance to each lane's start, and the lane before it. */
	const best = new Map();
	const prev = new Map();
	/** @type {{ id: number, g: number, f: number }[]} */
	const open = [];
	const startLeft = lanes[from.lane].length - from.s;
	/**
	 * Offers a lane's start at a distance, keeping it if it is the best yet.
	 *
	 * @param {number} id The lane.
	 * @param {number} g The distance to its start.
	 * @param {number} before The lane it was reached from.
	 */
	const offer = (id, g, before) => {
		if (best.has(id) && best.get(id) <= g) return;
		best.set(id, g);
		prev.set(id, before);
		open.push({ id, g, f: g + guess(id) });
	};
	for (const id of exits(roads, from.lane)) offer(id, startLeft + roads.turn(from.lane, id).length, -1);
	while (open.length) {
		let k = 0;
		for (let i = 1; i < open.length; i++) if (open[i].f < open[k].f) k = i;
		const { id, g } = open.splice(k, 1)[0];
		if (g > best.get(id)) continue;
		if (id === to.lane) {
			const path = [id];
			let at = id;
			while (prev.get(at) !== -1) {
				at = prev.get(at);
				path.unshift(at);
			}
			path.unshift(from.lane);
			return { lanes: path, length: g + to.s };
		}
		for (const next of exits(roads, id)) offer(next, g + lanes[id].length + roads.turn(id, next).length, id);
	}
	return null;
}

/**
 * The lanes a car on a lane may turn into at its end: every one leaving
 * that junction but the way back, unless the way back is all there is.
 *
 * @param {Roads} roads The roads.
 * @param {number} id The lane.
 * @returns {number[]} The lanes.
 */
export function exits(roads, id) {
	const lane = roads.lanes[id];
	const all = roads.out[lane.to];
	const onward = all.filter((m) => m !== lane.reverse);
	return onward.length ? onward : all;
}

/**
 * The street nearest a point on the ground: where along it, and the lane
 * whose kerb is on the point's side.
 *
 * @param {Roads} roads The roads.
 * @param {number} x The point's x.
 * @param {number} z The point's z.
 * @param {number} [reach=2.2] How far from a street's centre line still counts.
 * @returns {{ lane: number, s: number, distance: number } | null} The lane and how far
 *   along it, kept clear of the junctions; null when no street is within reach.
 */
export function nearestStreet(roads, x, z, reach = 2.2) {
	const margin = BOX + 0.4;
	/** @type {{ lane: number, s: number, distance: number } | null} */
	let found = null;
	for (const lane of roads.lanes) {
		// Each segment is looked at once, from the lane that runs towards +x or +z.
		if (lane.dx + lane.dz < 0) continue;
		const a = roads.nodes[lane.from];
		const along = (x - a.x) * lane.dx + (z - a.z) * lane.dz;
		const t = Math.min(PITCH - margin, Math.max(margin, along));
		const px = a.x + lane.dx * t;
		const pz = a.z + lane.dz * t;
		const distance = Math.hypot(x - px, z - pz);
		if (distance > reach || (found && distance >= found.distance)) continue;
		// Right of this lane (its kerb) is +z for a lane along x, −x for one along z.
		const right = (x - px) * -lane.dz + (z - pz) * lane.dx;
		found = right >= 0 ? { lane: lane.id, s: t - BOX, distance } : { lane: lane.reverse, s: PITCH - t - BOX, distance };
	}
	return found;
}

/**
 * Points along a route, for drawing it: from `s` on its first lane, through
 * each turn, to `end` on its last.
 *
 * @param {Roads} roads The roads.
 * @param {number[]} route The lanes.
 * @param {number} s Where it starts on the first.
 * @param {number} end Where it ends on the last.
 * @param {number} [step=0.12] The most between two points.
 * @returns {{ x: number, z: number }[]} The points.
 */
export function routePoints(roads, route, s, end, step = 0.12) {
	/** @type {{ x: number, z: number }[]} */
	const points = [];
	/**
	 * Adds points along a stretch.
	 *
	 * @param {(t: number) => { x: number, z: number }} at The point `t` along it.
	 * @param {number} from Where to start.
	 * @param {number} to Where to stop.
	 */
	const walk = (at, from, to) => {
		const count = Math.max(1, Math.ceil((to - from) / step));
		for (let i = points.length ? 1 : 0; i <= count; i++) {
			const p = at(from + ((to - from) * i) / count);
			points.push({ x: p.x, z: p.z });
		}
	};
	route.forEach((id, i) => {
		const lane = roads.lanes[id];
		const from = i === 0 ? s : 0;
		const to = i === route.length - 1 ? end : lane.length;
		if (to > from) walk((t) => lanePoint(lane, t), from, to);
		if (i < route.length - 1) walk(roads.turn(id, route[i + 1]).at, 0, roads.turn(id, route[i + 1]).length);
	});
	return points;
}
