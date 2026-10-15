/**
 * @module @arraypress/effects-astro/iso-city/plan
 *
 * The city's layout, from a seed: a grid of streets with a few segments
 * closed into pedestrian plazas (never leaving a dead end), and the blocks
 * between them filled with buildings of varied heights and rooftops, or
 * laid out as parks with paths, round trees and sometimes a pond. Lamps
 * stand at the block corners.
 *
 * Pure data, in world units (y up, the city's streets on x and z from 0
 * to `size × PITCH`): the scene module turns it into meshes, the roads
 * module into lanes. The same seed and size always give the same city.
 */

import { seededRandom } from '../random.js';

/** World units from one street's centre line to the next. */
export const PITCH = 4;
/** A street's width: two lanes. */
export const ROAD = 1;
/** The pavement's width round each block. */
export const CURB = 0.18;
/** The height of pavements and plazas above the road. */
export const SLAB = 0.045;
/** The height of a storey. */
export const STOREY = 0.2;

/**
 * @typedef {{ x0: number, z0: number, x1: number, z1: number }} Rect
 * @typedef {{ id: number, i: number, j: number, x: number, z: number }} Node
 * @typedef {{ id: number, a: number, b: number, axis: 'x' | 'z' }} Edge
 * @typedef {Rect & { y0: number, y1: number }} Part
 * @typedef {{ kind: 'box' | 'hut', x0: number, z0: number, x1: number, z1: number, y0: number, y1: number }
 *   | { kind: 'tank', x: number, z: number, r: number, y0: number, y1: number }
 *   | { kind: 'garden', x0: number, z0: number, x1: number, z1: number, y0: number }
 *   | { kind: 'solar', x0: number, z0: number, x1: number, z1: number, y0: number, rows: number }} Roof
 * @typedef {{ parts: Part[], roof: Roof[], tone: number, seed: number, glass: number }} Building
 * @typedef {{ x: number, z: number, r: number, h: number, tone: number }} Tree
 * @typedef {Rect & { kind: 'build' | 'park', plaza: Rect | null }} Block
 * @typedef {{ x: number, z: number, r: number }} Pond
 * @typedef {Rect & { axis: 'x' | 'z' }} Path
 */

/**
 * @typedef {object} CityPlan
 * @property {number} size Blocks across.
 * @property {number} extent The street grid's span, world units (size × PITCH).
 * @property {Node[]} nodes The junctions, row by row: id = j × (size + 1) + i.
 * @property {Edge[]} edges The street segments that are open.
 * @property {Edge[]} closed The segments closed into plazas.
 * @property {Block[]} blocks The blocks (two merged across a closed segment count as one).
 * @property {Building[]} buildings Every building.
 * @property {Tree[]} trees Every tree.
 * @property {Pond[]} ponds The parks' ponds.
 * @property {Path[]} paths The parks' paths.
 * @property {{ x: number, z: number }[]} lamps The street lamps.
 */

/**
 * Plans a city.
 *
 * @param {{ seed?: number, size?: number }} [options] The seed (default 7)
 *   and the blocks across (default 6, 2–12).
 * @returns {CityPlan} The plan.
 */
export function planCity({ seed = 7, size = 6 } = {}) {
	const n = Math.max(2, Math.min(12, Math.round(size)));
	const random = seededRandom(seed * 7919 + n * 104729 + 1);
	const extent = n * PITCH;
	/**
	 * A random number in a range.
	 *
	 * @param {number} lo The least.
	 * @param {number} hi The most.
	 * @returns {number} Between them.
	 */
	const range = (lo, hi) => lo + random() * (hi - lo);

	/** @type {Node[]} */
	const nodes = [];
	for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) nodes.push({ id: j * (n + 1) + i, i, j, x: i * PITCH, z: j * PITCH });
	/**
	 * A junction's id.
	 *
	 * @param {number} i Column.
	 * @param {number} j Row.
	 * @returns {number} The id.
	 */
	const at = (i, j) => j * (n + 1) + i;
	/** @type {Edge[]} */
	const all = [];
	for (let j = 0; j <= n; j++) {
		for (let i = 0; i <= n; i++) {
			if (i < n) all.push({ id: all.length, a: at(i, j), b: at(i + 1, j), axis: 'x' });
			if (j < n) all.push({ id: all.length, a: at(i, j), b: at(i, j + 1), axis: 'z' });
		}
	}

	// Close a few inner segments into plazas: each merges the two blocks
	// either side, a block merges once at most, and no junction is left
	// with fewer than two streets or cut off from the rest.
	const open = new Set(all.map((e) => e.id));
	const degree = new Array(nodes.length).fill(0);
	for (const e of all) {
		degree[e.a]++;
		degree[e.b]++;
	}
	/** Which blocks have merged, by `bi,bj`. */
	const merged = new Set();
	/** @type {Edge[]} */
	const closed = [];
	/**
	 * The two blocks either side of an inner segment.
	 *
	 * @param {Edge} e The segment.
	 * @returns {[string, string] | null} Their keys, or null for a segment on the edge of the grid.
	 */
	const sides = (e) => {
		const { i, j } = nodes[e.a];
		if (e.axis === 'x') return j > 0 && j < n ? [`${i},${j - 1}`, `${i},${j}`] : null;
		return i > 0 && i < n ? [`${i - 1},${j}`, `${i},${j}`] : null;
	};
	const order = shuffle(all.map((e) => e.id), random);
	const want = Math.round(n * n * 0.09);
	for (const id of order) {
		if (closed.length >= want) break;
		const e = all[id];
		const pair = sides(e);
		if (!pair || merged.has(pair[0]) || merged.has(pair[1]) || degree[e.a] < 3 || degree[e.b] < 3) continue;
		open.delete(id);
		if (!connected(nodes.length, all.filter((x) => open.has(x.id)))) {
			open.add(id);
			continue;
		}
		degree[e.a]--;
		degree[e.b]--;
		merged.add(pair[0]);
		merged.add(pair[1]);
		closed.push(e);
	}
	const edges = all.filter((e) => open.has(e.id));

	// The blocks, two merged across each closed segment.
	/** @type {Block[]} */
	const blocks = [];
	/**
	 * A block's bounds, inside the streets round it.
	 *
	 * @param {number} bi Column.
	 * @param {number} bj Row.
	 * @returns {Rect} Its bounds.
	 */
	const bounds = (bi, bj) => ({ x0: bi * PITCH + ROAD / 2, z0: bj * PITCH + ROAD / 2, x1: (bi + 1) * PITCH - ROAD / 2, z1: (bj + 1) * PITCH - ROAD / 2 });
	const centre = extent / 2;
	for (const e of closed) {
		const [a, b] = /** @type {[string, string]} */ (sides(e)).map((k) => bounds(...(/** @type {[number, number]} */ (k.split(',').map(Number)))));
		const rect = { x0: Math.min(a.x0, b.x0), z0: Math.min(a.z0, b.z0), x1: Math.max(a.x1, b.x1), z1: Math.max(a.z1, b.z1) };
		const plaza = e.axis === 'x' ? { x0: rect.x0, z0: a.z1, x1: rect.x1, z1: b.z0 } : { x0: a.x1, z0: rect.z0, x1: b.x0, z1: rect.z1 };
		blocks.push({ ...rect, kind: random() < 0.3 ? 'park' : 'build', plaza });
	}
	for (let bj = 0; bj < n; bj++) {
		for (let bi = 0; bi < n; bi++) {
			if (merged.has(`${bi},${bj}`)) continue;
			blocks.push({ ...bounds(bi, bj), kind: random() < 0.17 ? 'park' : 'build', plaza: null });
		}
	}
	if (!blocks.some((b) => b.kind === 'park')) {
		// At least one park: the block nearest the middle but one.
		const sorted = [...blocks].sort((p, q) => dist(p, centre) - dist(q, centre));
		(sorted[1] ?? sorted[0]).kind = 'park';
	}

	/** @type {Building[]} */
	const buildings = [];
	/** @type {Tree[]} */
	const trees = [];
	/** @type {Pond[]} */
	const ponds = [];
	/** @type {Path[]} */
	const paths = [];
	/** @type {{ x: number, z: number }[]} */
	const lamps = [];

	for (const block of blocks) {
		// Lamps at the corners.
		for (const [x, z] of [[block.x0, block.z0], [block.x1, block.z0], [block.x1, block.z1], [block.x0, block.z1]]) {
			if (random() < 0.8) lamps.push({ x: x + (x === block.x0 ? 0.1 : -0.1), z: z + (z === block.z0 ? 0.1 : -0.1) });
		}
		const halves = block.plaza ? splitAround(block, block.plaza) : [block];
		if (block.plaza) {
			// A tree-lined plaza down the middle.
			const p = block.plaza;
			const along = p.x1 - p.x0 > p.z1 - p.z0;
			const length = along ? p.x1 - p.x0 : p.z1 - p.z0;
			const count = Math.floor(length / 0.75);
			for (let k = 0; k < count; k++) {
				const t = (k + 0.5) / count;
				const x = along ? p.x0 + t * (p.x1 - p.x0) : (p.x0 + p.x1) / 2;
				const z = along ? (p.z0 + p.z1) / 2 : p.z0 + t * (p.z1 - p.z0);
				trees.push({ x, z, r: range(0.13, 0.17), h: SLAB, tone: random() });
			}
		}
		for (const area of halves) {
			const inner = { x0: area.x0 + CURB, z0: area.z0 + CURB, x1: area.x1 - CURB, z1: area.z1 - CURB };
			if (block.kind === 'park') park(inner);
			else for (const lot of lots(inner)) building(lot);
		}
	}

	/**
	 * Lays out a park: a path or two across it, trees, sometimes a pond.
	 *
	 * @param {Rect} r The park's grass.
	 */
	function park(r) {
		const cx = (r.x0 + r.x1) / 2;
		const cz = (r.z0 + r.z1) / 2;
		const w = 0.16;
		const cross = random() < 0.6;
		paths.push({ x0: r.x0, z0: cz - w / 2, x1: r.x1, z1: cz + w / 2, axis: 'x' });
		if (cross) paths.push({ x0: cx - w / 2, z0: r.z0, x1: cx + w / 2, z1: r.z1, axis: 'z' });
		/** @type {Pond | null} */
		let pond = null;
		if (random() < 0.45) {
			const qx = random() < 0.5 ? -1 : 1;
			const qz = cross ? (random() < 0.5 ? -1 : 1) : random() < 0.5 ? -1 : 1;
			const rad = range(0.38, 0.5);
			pond = { x: cx + qx * (r.x1 - r.x0) * 0.25, z: cz + qz * (r.z1 - r.z0) * 0.25, r: rad };
			ponds.push(pond);
		}
		const step = 0.42;
		for (let z = r.z0 + 0.22; z < r.z1 - 0.15; z += step) {
			for (let x = r.x0 + 0.22; x < r.x1 - 0.15; x += step) {
				const tx = x + range(-0.12, 0.12);
				const tz = z + range(-0.12, 0.12);
				if (Math.abs(tz - cz) < 0.26 || (cross && Math.abs(tx - cx) < 0.26)) continue;
				if (pond && Math.hypot(tx - pond.x, tz - pond.z) < pond.r + 0.22) continue;
				if (random() < 0.32) continue;
				trees.push({ x: tx, z: tz, r: range(0.15, 0.24), h: SLAB + 0.01, tone: random() });
			}
		}
	}

	/**
	 * Splits a block's ground into lots: one, two halves, three or four.
	 *
	 * @param {Rect} r The ground inside the pavement.
	 * @returns {Rect[]} The lots.
	 */
	function lots(r) {
		const mx = (r.x0 + r.x1) / 2 + range(-0.25, 0.25);
		const mz = (r.z0 + r.z1) / 2 + range(-0.25, 0.25);
		const pick = random();
		if (pick < 0.22) return [r];
		if (pick < 0.58) {
			return random() < 0.5
				? [{ ...r, x1: mx }, { ...r, x0: mx }]
				: [{ ...r, z1: mz }, { ...r, z0: mz }];
		}
		if (pick < 0.84) {
			return random() < 0.5
				? [{ ...r, x1: mx }, { x0: mx, z0: r.z0, x1: r.x1, z1: mz }, { x0: mx, z0: mz, x1: r.x1, z1: r.z1 }]
				: [{ ...r, z1: mz }, { x0: r.x0, z0: mz, x1: mx, z1: r.z1 }, { x0: mx, z0: mz, x1: r.x1, z1: r.z1 }];
		}
		return [
			{ x0: r.x0, z0: r.z0, x1: mx, z1: mz },
			{ x0: mx, z0: r.z0, x1: r.x1, z1: mz },
			{ x0: r.x0, z0: mz, x1: mx, z1: r.z1 },
			{ x0: mx, z0: mz, x1: r.x1, z1: r.z1 },
		];
	}

	/**
	 * Puts a building on a lot: a body, sometimes a set-back upper tier,
	 * and things on the roof.
	 *
	 * @param {Rect} lot The lot.
	 */
	function building(lot) {
		const gap = 0.05;
		const r = { x0: lot.x0 + gap, z0: lot.z0 + gap, x1: lot.x1 - gap, z1: lot.z1 - gap };
		const w = r.x1 - r.x0;
		const d = r.z1 - r.z0;
		const near = Math.max(0, 1 - Math.hypot((r.x0 + r.x1) / 2 - centre, (r.z0 + r.z1) / 2 - centre) / (extent * 0.6));
		const tall = random() < 0.03 + near * 0.08 && w * d > 0.6;
		const height = tall ? range(1.6, 2.4) : 0.36 + (0.35 + 0.65 * near) * random() ** 1.8 * 1.1;
		const floors = Math.max(2, Math.round(height / STOREY));
		const top = SLAB + floors * STOREY + 0.06;
		/** @type {Part[]} */
		const parts = [{ ...r, y0: SLAB, y1: top }];
		if (floors >= 6 && random() < 0.55 && w > 0.7 && d > 0.7) {
			const inset = () => range(0.1, Math.min(w, d) * 0.22);
			const upper = Math.max(1, Math.round(range(1, 3)));
			parts.push({ x0: r.x0 + inset(), z0: r.z0 + inset(), x1: r.x1 - inset(), z1: r.z1 - inset(), y0: top, y1: top + upper * STOREY + 0.04 });
		}
		const roofPart = parts[parts.length - 1];
		buildings.push({ parts, roof: roofOf(roofPart, floors), tone: random() * 2 - 1, seed: random(), glass: random() });
	}

	/**
	 * Things on a roof, kept apart: units, a tank, a stair hut, a garden or solar panels.
	 *
	 * @param {Part} p The roof's part.
	 * @param {number} floors The building's storeys.
	 * @returns {Roof[]} What stands on it.
	 */
	function roofOf(p, floors) {
		/** @type {Roof[]} */
		const out = [];
		/** @type {Rect[]} */
		const used = [];
		const edge = 0.08;
		const y = p.y1;
		/**
		 * Finds room for a footprint on the roof.
		 *
		 * @param {number} w Its width.
		 * @param {number} d Its depth.
		 * @returns {Rect | null} Where it goes, or null when there is no room.
		 */
		const place = (w, d) => {
			for (let tries = 0; tries < 8; tries++) {
				const x0 = range(p.x0 + edge, p.x1 - edge - w);
				const z0 = range(p.z0 + edge, p.z1 - edge - d);
				if (x0 < p.x0 + edge || z0 < p.z0 + edge) return null;
				const rect = { x0, z0, x1: x0 + w, z1: z0 + d };
				if (used.every((u) => rect.x1 + 0.03 < u.x0 || rect.x0 > u.x1 + 0.03 || rect.z1 + 0.03 < u.z0 || rect.z0 > u.z1 + 0.03)) {
					used.push(rect);
					return rect;
				}
			}
			return null;
		};
		const low = floors <= 4;
		const pick = random();
		if (low && pick < 0.16) {
			out.push({ kind: 'garden', x0: p.x0 + edge, z0: p.z0 + edge, x1: p.x1 - edge, z1: p.z1 - edge, y0: y });
			return out;
		}
		if (low && pick < 0.32) {
			const rect = place(Math.min(0.5, p.x1 - p.x0 - 0.2), Math.min(0.42, p.z1 - p.z0 - 0.2));
			if (rect) out.push({ kind: 'solar', ...rect, y0: y, rows: 2 + Math.floor(random() * 2) });
		}
		if (random() < 0.45) {
			const rect = place(range(0.2, 0.3), range(0.16, 0.24));
			if (rect) out.push({ kind: 'hut', ...rect, y0: y, y1: y + 0.13 });
		}
		if (random() < 0.32) {
			const r = range(0.06, 0.085);
			const rect = place(r * 2, r * 2);
			if (rect) out.push({ kind: 'tank', x: (rect.x0 + rect.x1) / 2, z: (rect.z0 + rect.z1) / 2, r, y0: y, y1: y + range(0.11, 0.16) });
		}
		const units = 1 + Math.floor(random() * 3);
		for (let k = 0; k < units; k++) {
			const rect = place(range(0.08, 0.15), range(0.08, 0.13));
			if (rect) out.push({ kind: 'box', ...rect, y0: y, y1: y + range(0.045, 0.08) });
		}
		return out;
	}

	return { size: n, extent, nodes, edges, closed, blocks, buildings, trees, ponds, paths, lamps };
}

/**
 * A block's distance from a point on the city's diagonal.
 *
 * @param {Rect} r The block.
 * @param {number} c The point's x and z.
 * @returns {number} The distance from the block's centre.
 */
function dist(r, c) {
	return Math.hypot((r.x0 + r.x1) / 2 - c, (r.z0 + r.z1) / 2 - c);
}

/**
 * The two halves of a merged block either side of its plaza.
 *
 * @param {Rect} r The merged block.
 * @param {Rect} p Its plaza.
 * @returns {Rect[]} The halves.
 */
function splitAround(r, p) {
	return p.x1 - p.x0 >= p.z1 - p.z0
		? [{ ...r, z1: p.z0 }, { ...r, z0: p.z1 }]
		: [{ ...r, x1: p.x0 }, { ...r, x0: p.x1 }];
}

/**
 * Shuffles a list in place (Fisher–Yates), the same way for the same generator.
 *
 * @template T
 * @param {T[]} list The list.
 * @param {() => number} random The generator.
 * @returns {T[]} The list.
 */
function shuffle(list, random) {
	for (let i = list.length - 1; i > 0; i--) {
		const k = Math.floor(random() * (i + 1));
		[list[i], list[k]] = [list[k], list[i]];
	}
	return list;
}

/**
 * Whether every junction can reach every other along the open segments.
 *
 * @param {number} count How many junctions.
 * @param {{ a: number, b: number }[]} edges The open segments.
 * @returns {boolean} True when they are all connected.
 */
export function connected(count, edges) {
	/** @type {number[][]} */
	const next = Array.from({ length: count }, () => []);
	for (const e of edges) {
		next[e.a].push(e.b);
		next[e.b].push(e.a);
	}
	const seen = new Set([0]);
	const queue = [0];
	while (queue.length) {
		for (const m of next[/** @type {number} */ (queue.pop())]) {
			if (!seen.has(m)) {
				seen.add(m);
				queue.push(m);
			}
		}
	}
	return seen.size === count;
}

/**
 * The first building a line of sight meets: where it enters the nearest
 * part's box, walking from `from` towards `to`.
 *
 * @param {CityPlan} plan The plan.
 * @param {[number, number, number]} from Where the line starts (towards the viewer).
 * @param {[number, number, number]} to Where it ends (on the ground, say).
 * @returns {[number, number, number] | null} The point it enters, or null when it meets none.
 */
export function firstHit(plan, from, to) {
	const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
	let best = Infinity;
	for (const b of plan.buildings) {
		for (const p of b.parts) {
			let near = 0;
			let far = 1;
			const lo = [p.x0, p.y0, p.z0];
			const hi = [p.x1, p.y1, p.z1];
			for (let i = 0; i < 3 && near <= far; i++) {
				if (Math.abs(d[i]) < 1e-9) {
					if (from[i] < lo[i] || from[i] > hi[i]) near = 2;
					continue;
				}
				const t0 = (lo[i] - from[i]) / d[i];
				const t1 = (hi[i] - from[i]) / d[i];
				near = Math.max(near, Math.min(t0, t1));
				far = Math.min(far, Math.max(t0, t1));
			}
			if (near <= far && near < best) best = near;
		}
	}
	return best === Infinity ? null : [from[0] + d[0] * best, from[1] + d[1] * best, from[2] + d[2] * best];
}
