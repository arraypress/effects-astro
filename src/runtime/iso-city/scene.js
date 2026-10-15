/**
 * @module @arraypress/effects-astro/iso-city/scene
 *
 * The city's meshes, built once from its plan: tarmac, pavements with
 * rounded corners, lane markings and zebra crossings, buildings with
 * windows (drawn by the shader from each wall's uv, counted in window
 * cells) and cluttered roofs, parks with paths, ponds and round trees, and
 * lamps. Then the pieces that move: a car shaped roughly like a modern
 * electric saloon (a low wedge, a fastback glass cabin, flush wheels, light
 * bars front and back, a roof sign the taxis show), a person, a pin, and
 * the ribbon a taxi's route is drawn with.
 *
 * Each vertex's tag is its material (MAT) and a seed; the shader does the rest.
 */

import { createMesh } from '../mesh.js';
import { BOX } from './roads.js';
import { CURB, PITCH, ROAD, SLAB, STOREY } from './plan.js';

/** The materials, as the shader reads them from a vertex's tag. */
export const MAT = Object.freeze({
	plain: 0,
	wall: 1,
	glass: 2,
	body: 3,
	head: 4,
	tail: 5,
	sign: 6,
	accent: 7,
	lamp: 8,
	water: 9,
	route: 10,
	blob: 11,
	glow: 12,
	beam: 13,
	ring: 14,
});

/** A window cell's width on a wall. */
const WINDOW = 0.19;
/** How high road markings lie over the tarmac. */
const MARK_Y = 0.004;

/**
 * @typedef {import('../color.js').Rgb} Rgb
 * @typedef {import('../mesh.js').Mesh} Mesh
 * @typedef {import('../mesh.js').Vec2} Vec2
 * @typedef {import('../mesh.js').Vec3} Vec3
 * @typedef {import('./plan.js').CityPlan} CityPlan
 * @typedef {import('./plan.js').Rect} Rect
 * @typedef {import('./look.js').Look} Look
 */

/**
 * A rectangle with rounded corners, as a polygon.
 *
 * @param {Rect} r The rectangle.
 * @param {number} radius The corners' radius.
 * @param {number} [steps=4] Segments a corner.
 * @returns {Vec2[]} The polygon (x, z).
 */
export function roundedRect(r, radius, steps = 4) {
	/** @type {Vec2[]} */
	const out = [];
	const corners = [
		[r.x1 - radius, r.z1 - radius, 0],
		[r.x0 + radius, r.z1 - radius, Math.PI / 2],
		[r.x0 + radius, r.z0 + radius, Math.PI],
		[r.x1 - radius, r.z0 + radius, (Math.PI * 3) / 2],
	];
	for (const [cx, cz, start] of corners) {
		for (let k = 0; k <= steps; k++) {
			const a = start + (k / steps) * (Math.PI / 2);
			out.push([cx + Math.cos(a) * radius, cz + Math.sin(a) * radius]);
		}
	}
	return out;
}

/**
 * A regular polygon round a point.
 *
 * @param {number} x The centre's x.
 * @param {number} z The centre's z.
 * @param {number} r The radius.
 * @param {number} sides How many sides.
 * @returns {Vec2[]} The polygon.
 */
function ngon(x, z, r, sides) {
	return Array.from({ length: sides }, (_, k) => /** @type {Vec2} */ ([x + Math.cos((k / sides) * Math.PI * 2) * r, z + Math.sin((k / sides) * Math.PI * 2) * r]));
}

/**
 * A flat quad lying on the ground, facing up.
 *
 * @param {Mesh} mesh The mesh.
 * @param {number} x0 Its least x.
 * @param {number} z0 Its least z.
 * @param {number} x1 Its greatest x.
 * @param {number} z1 Its greatest z.
 * @param {number} y Its height.
 * @param {Rgb} color Its colour.
 * @param {Vec2} [tag] Its tag.
 */
function flat(mesh, x0, z0, x1, z1, y, color, tag) {
	mesh.quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], color, tag, [[-1, -1], [-1, 1], [1, 1], [1, -1]], [x0, y - 1, z0]);
}

/**
 * The static city: everything that never moves, as one opaque mesh, and
 * the lamps' pools of light, drawn added on at night.
 *
 * @param {CityPlan} plan The plan.
 * @param {Look} look The colours.
 * @returns {{ solid: Float32Array, glow: Float32Array }} The two meshes.
 */
export function cityMesh(plan, look) {
	const mesh = createMesh();
	const glow = createMesh();
	const E = plan.extent;
	const far = E + 40;

	// Tarmac under the grid, and land round it at pavement height.
	flat(mesh, -ROAD / 2, -ROAD / 2, E + ROAD / 2, E + ROAD / 2, 0, look.roads);
	const ring = [
		{ x0: -40, z0: -40, x1: far, z1: -ROAD / 2 },
		{ x0: -40, z0: E + ROAD / 2, x1: far, z1: far },
		{ x0: -40, z0: -ROAD / 2, x1: -ROAD / 2, z1: E + ROAD / 2 },
		{ x0: E + ROAD / 2, z0: -ROAD / 2, x1: far, z1: E + ROAD / 2 },
	];
	for (const r of ring) mesh.box([r.x0, 0, r.z0], [r.x1, SLAB, r.z1], look.pavement);

	// Blocks: a pavement slab with rounded corners, and a park's grass on it.
	for (const block of plan.blocks) {
		mesh.prism(roundedRect(block, 0.22), 0, SLAB, look.pavement);
		if (block.kind === 'park') {
			const inset = CURB * 0.6;
			mesh.prism(roundedRect({ x0: block.x0 + inset, z0: block.z0 + inset, x1: block.x1 - inset, z1: block.z1 - inset }, 0.14), SLAB, SLAB + 0.012, look.parks);
			if (block.plaza) {
				const p = block.plaza;
				flat(mesh, p.x0, p.z0, p.x1, p.z1, SLAB + 0.0125, look.path);
			}
		}
	}
	for (const path of plan.paths) flat(mesh, path.x0, path.z0, path.x1, path.z1, SLAB + 0.0135, look.path);
	for (const pond of plan.ponds) {
		mesh.prism(ngon(pond.x, pond.z, pond.r + 0.05, 14), SLAB, SLAB + 0.03, look.path);
		mesh.prism(ngon(pond.x, pond.z, pond.r, 14), SLAB + 0.03, SLAB + 0.031, look.water, [MAT.water, 0]);
	}

	// Markings: dashed centre lines, and zebra crossings and stop lines where three or more streets meet.
	const degree = plan.nodes.map(() => 0);
	for (const e of plan.edges) {
		degree[e.a]++;
		degree[e.b]++;
	}
	for (const e of plan.edges) {
		const a = plan.nodes[e.a];
		const along = e.axis === 'x';
		/**
		 * A quad on the road, in the segment's own terms.
		 *
		 * @param {number} t0 From, along the segment from junction `a`'s centre.
		 * @param {number} t1 To.
		 * @param {number} w0 From, across it (right of the way from `a` is +).
		 * @param {number} w1 To.
		 * @param {Rgb} color Its colour.
		 */
		const mark = (t0, t1, w0, w1, color) => {
			if (along) flat(mesh, a.x + t0, a.z + w0, a.x + t1, a.z + w1, MARK_Y, color);
			else flat(mesh, a.x - w1, a.z + t0, a.x - w0, a.z + t1, MARK_Y, color);
		};
		const ends = [degree[e.a] >= 3, degree[e.b] >= 3];
		const start = BOX + (ends[0] ? 0.42 : 0.12);
		const stop = PITCH - BOX - (ends[1] ? 0.42 : 0.12);
		const dash = 0.2;
		const gap = 0.15;
		const count = Math.floor((stop - start + gap) / (dash + gap));
		const first = start + (stop - start - (count * (dash + gap) - gap)) / 2;
		for (let k = 0; k < count; k++) mark(first + k * (dash + gap), first + k * (dash + gap) + dash, -0.016, 0.016, look.marking);
		for (const [end, from, dir] of /** @type {[boolean, number, number][]} */ ([[ends[0], BOX, 1], [ends[1], PITCH - BOX, -1]])) {
			if (!end) continue;
			// Zebra stripes across the road, then the stop line for the lane arriving here.
			for (let k = 0; k < 6; k++) {
				const w = -0.42 + k * 0.16;
				const t0 = from + dir * 0.06;
				const t1 = from + dir * 0.28;
				mark(Math.min(t0, t1), Math.max(t0, t1), w, w + 0.08, look.marking);
			}
			const s0 = from + dir * 0.33;
			const s1 = from + dir * 0.36;
			// The lane arriving at junction a runs b → a, on the −w side; at b, a → b, on the +w side.
			if (dir > 0) mark(s1 - 0.03, s1, -0.46, -0.02, look.marking);
			else mark(s1, s0, 0.02, 0.46, look.marking);
		}
	}

	// Lamps, and their pools of light.
	for (const l of plan.lamps) {
		mesh.box([l.x - 0.014, SLAB, l.z - 0.014], [l.x + 0.014, SLAB + 0.34, l.z + 0.014], look.lamp);
		mesh.box([l.x - 0.03, SLAB + 0.32, l.z - 0.03], [l.x + 0.03, SLAB + 0.355, l.z + 0.03], look.lamp, [MAT.lamp, 0], { bottom: true });
		flat(glow, l.x - 0.75, l.z - 0.75, l.x + 0.75, l.z + 0.75, SLAB + 0.002, [1, 0.8, 0.55], [MAT.glow, 0]);
	}

	// Trees: a trunk and a faceted crown.
	for (const tree of plan.trees) {
		const lift = tree.r * 0.75;
		mesh.box([tree.x - 0.018, tree.h, tree.z - 0.018], [tree.x + 0.018, tree.h + lift + 0.02, tree.z + 0.018], look.trunk);
		mesh.sphere([tree.x, tree.h + lift + tree.r * 0.85, tree.z], tree.r, look.trees[Math.floor(tree.tone * look.trees.length)], [MAT.plain, 0], 7, 4, 0.95);
	}

	// Buildings.
	plan.buildings.forEach((b) => {
		const pick = b.glass;
		const base = pick < 0.14 ? look.tints[0] : pick < 0.24 ? look.tints[1] : look.buildings;
		const shade = b.tone * 0.035;
		/** @type {Rgb} */
		const wall = /** @type {Rgb} */ (base.map((c) => Math.min(1, Math.max(0, c + shade))));
		const height = b.parts[0].y1 - b.parts[0].y0;
		// Window style: punched by default, ribbons on some, a curtain wall on the tall ones.
		const style = height > 1.6 && b.seed < 0.6 ? 2 : b.seed < 0.28 ? 1 : 0;
		b.parts.forEach((part) => {
			walls(mesh, part, wall, style + b.seed * 0.999);
			flat(mesh, part.x0, part.z0, part.x1, part.z1, part.y1, look.roofs);
		});
		const top = b.parts[b.parts.length - 1];
		const rim = 0.035;
		const y = top.y1;
		mesh.box([top.x0, y, top.z0], [top.x1, y + rim, top.z0 + rim], wall);
		mesh.box([top.x0, y, top.z1 - rim], [top.x1, y + rim, top.z1], wall);
		mesh.box([top.x0, y, top.z0 + rim], [top.x0 + rim, y + rim, top.z1 - rim], wall);
		mesh.box([top.x1 - rim, y, top.z0 + rim], [top.x1, y + rim, top.z1 - rim], wall);
		for (const r of b.roof) {
			if (r.kind === 'box') mesh.box([r.x0, r.y0, r.z0], [r.x1, r.y1, r.z1], look.detail);
			else if (r.kind === 'hut') mesh.box([r.x0, r.y0, r.z0], [r.x1, r.y1, r.z1], wall);
			else if (r.kind === 'tank') {
				mesh.prism(ngon(r.x, r.z, r.r, 9), r.y0, r.y1, look.detail);
				mesh.prism(ngon(r.x, r.z, r.r, 9), r.y1, r.y1 + 0.035, look.detail, undefined, { top: 0.15 });
			} else if (r.kind === 'garden') {
				mesh.box([r.x0, r.y0, r.z0], [r.x1, r.y0 + 0.018, r.z1], look.parks);
				const cx = (r.x0 + r.x1) / 2;
				const cz = (r.z0 + r.z1) / 2;
				for (const [dx, dz] of [[-0.3, -0.3], [0.3, 0.25], [-0.2, 0.3]]) {
					const sx = cx + dx * (r.x1 - r.x0);
					const sz = cz + dz * (r.z1 - r.z0);
					mesh.sphere([sx, r.y0 + 0.06, sz], 0.055, look.trees[1], [MAT.plain, 0], 6, 3);
				}
			} else if (r.kind === 'solar') {
				// Rows of panels, each a thin wedge tilted up towards the back.
				const depth = (r.z1 - r.z0) / r.rows;
				for (let k = 0; k < r.rows; k++) {
					const z0 = r.z0 + k * depth + 0.015;
					const z1 = z0 + depth - 0.04;
					/** @type {Vec3[]} */
					const low = [[r.x0, r.y0, z0], [r.x1, r.y0, z0], [r.x1, r.y0, z1], [r.x0, r.y0, z1]];
					mesh.loft(low, low.map(([x, , z]) => /** @type {Vec3} */ ([x, r.y0 + (z === z0 ? 0.015 : 0.055), z])), look.solar, [MAT.plain, 0], { caps: 'end' });
				}
			}
		}
	});
	return { solid: mesh.build(), glow: glow.build() };
}

/**
 * A building part's four walls, with uv counted in window cells (u across,
 * v down from the band under the roof) and the window style and seed in the tag.
 *
 * @param {Mesh} mesh The mesh.
 * @param {import('./plan.js').Part} part The part.
 * @param {Rgb} color The walls' colour.
 * @param {number} seed The window style (whole part) and seed (fraction).
 */
function walls(mesh, part, color, seed) {
	const { x0, z0, x1, z1, y0, y1 } = part;
	const rows = Math.floor((y1 - y0) / STOREY + 1e-6);
	const band = y1 - y0 - rows * STOREY;
	const top = rows + band / STOREY;
	/** @type {Vec3} */
	const inside = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
	/** @type {[Vec2, Vec2][]} */
	const sides = [
		[[x0, z1], [x1, z1]],
		[[x1, z1], [x1, z0]],
		[[x1, z0], [x0, z0]],
		[[x0, z0], [x0, z1]],
	];
	for (const [[ax, az], [bx, bz]] of sides) {
		const cells = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / WINDOW));
		const v0 = rows;
		const v1 = rows - top;
		mesh.quad(
			[ax, y0, az],
			[bx, y0, bz],
			[bx, y1, bz],
			[ax, y1, az],
			color,
			[MAT.wall, seed],
			[[0, v0], [cells, v0], [cells, v1], [0, v1]],
			inside,
		);
	}
}

/**
 * The car, in its own frame: x forward, y up, z across; 0.44 long. The
 * opaque body, and the effects drawn over the road (a soft shadow under it,
 * headlight beams and a red glow behind, the beams only at night).
 *
 * @param {Look} look The colours.
 * @returns {{ body: Float32Array, effects: Float32Array }} The two meshes.
 */
export function carMesh(look) {
	const body = createMesh();
	const paint = /** @type {Vec2} */ ([MAT.body, 0]);
	// A low wedge: flat underneath, a short sloping nose, a long hood to a squared-off tail.
	/** @type {Vec2[]} */
	const profile = [[-0.215, 0.03], [0.214, 0.03], [0.222, 0.05], [0.21, 0.068], [0.1, 0.082], [-0.2, 0.088], [-0.22, 0.076], [-0.222, 0.046]];
	body.extrude(profile, -0.1, 0.1, look.accent, paint);
	// The glass cabin: a raked windscreen, a short roof, a long fastback, tapering in towards the top.
	/** @type {[number, number][]} */
	const cabin = [[-0.19, 0.08], [0.09, 0.075], [0.0, 0.132], [-0.075, 0.13], [-0.19, 0.088]];
	/**
	 * How far out the cabin's side is at a height.
	 *
	 * @param {number} y The height.
	 * @returns {number} Its half-width.
	 */
	const half = (y) => 0.088 - ((y - 0.075) / 0.057) * 0.02;
	body.loft(
		cabin.map(([x, y]) => /** @type {Vec3} */ ([x, y, -half(y)])),
		cabin.map(([x, y]) => /** @type {Vec3} */ ([x, y, half(y)])),
		[0.11, 0.13, 0.16],
		[MAT.glass, 0],
	);
	// Flush wheels with aero covers.
	for (const x of [-0.135, 0.135]) {
		for (const side of [-1, 1]) {
			/** @type {Vec2[]} */
			const wheel = ngon(x, 0.036, 0.036, 10);
			const z0 = side * 0.072;
			const z1 = side * 0.101;
			body.extrude(wheel, Math.min(z0, z1), Math.max(z0, z1), [0.1, 0.105, 0.115]);
			const hub = side * 0.1015;
			body.extrude(ngon(x, 0.036, 0.022, 10), Math.min(hub, side * 0.095), Math.max(hub, side * 0.095), [0.52, 0.55, 0.6]);
		}
	}
	// Light bars: across the nose, and right across the tail.
	body.box([0.205, 0.058, -0.084], [0.2235, 0.065, 0.084], [1, 1, 1], [MAT.head, 0], { bottom: true });
	body.box([-0.2245, 0.066, -0.093], [-0.212, 0.075, 0.093], [0.8, 0.1, 0.12], [MAT.tail, 0], { bottom: true });
	// The taxis' roof sign.
	body.box([-0.058, 0.124, -0.042], [0.004, 0.152, 0.042], [0.97, 0.96, 0.93], [MAT.sign, 0]);

	const effects = createMesh();
	flat(effects, -0.27, -0.15, 0.27, 0.15, 0.008, [0, 0, 0], [MAT.blob, 0]);
	// Beams: wedges of light on the road ahead, uv x along (0 at the car), y across.
	effects.quad([0.21, 0.01, -0.07], [0.21, 0.01, 0.07], [1.0, 0.01, 0.32], [1.0, 0.01, -0.32], [1, 0.93, 0.78], [MAT.beam, 0], [[0, -1], [0, 1], [1, 1], [1, -1]], [0.5, -1, 0]);
	effects.quad([-0.22, 0.01, -0.09], [-0.22, 0.01, 0.09], [-0.48, 0.01, 0.14], [-0.48, 0.01, -0.14], [1, 0.12, 0.1], [MAT.beam, 0], [[0, -1], [0, 1], [1, 1], [1, -1]], [-0.3, -1, 0]);
	return { body: body.build(), effects: effects.build() };
}

/**
 * A person, standing: a body and a head, 0.13 tall.
 *
 * @param {Look} look The colours.
 * @returns {Float32Array} The mesh.
 */
export function personMesh(look) {
	const mesh = createMesh();
	mesh.prism(ngon(0, 0, 0.022, 7), 0, 0.085, look.person);
	mesh.sphere([0, 0.11, 0], 0.024, [0.93, 0.82, 0.72], [MAT.plain, 0], 6, 3);
	return mesh.build();
}

/**
 * The pin a call drops: a head in the accent colour with a white dot
 * facing the camera, on a point; and the ring that pulses round its foot.
 *
 * @param {Vec3} eye The direction towards the camera.
 * @returns {{ body: Float32Array, ring: Float32Array }} The two meshes.
 */
export function pinMesh(eye) {
	const body = createMesh();
	const accent = /** @type {Vec2} */ ([MAT.accent, 0]);
	body.sphere([0, 0.5, 0], 0.1, [1, 1, 1], accent, 10, 6);
	body.prism(ngon(0, 0, 0.082, 10), 0.47, 0.17, [1, 1, 1], accent, { top: 0 });
	body.sphere([eye[0] * 0.075, 0.5 + eye[1] * 0.075, eye[2] * 0.075], 0.045, [1, 1, 1], [MAT.plain, 0], 8, 5);
	const ring = createMesh();
	flat(ring, -0.42, -0.42, 0.42, 0.42, 0.006, [1, 1, 1], [MAT.ring, 0]);
	flat(ring, -0.12, -0.12, 0.12, 0.12, 0.007, [0, 0, 0], [MAT.blob, 0]);
	return { body: body.build(), ring: ring.build() };
}

/**
 * A ribbon along a route, lying just over the road: uv x is the distance
 * along it, y −1 to 1 across.
 *
 * @param {{ x: number, z: number }[]} points The route.
 * @param {number} [width=0.09] Its width.
 * @param {number} [y=0.014] Its height.
 * @returns {Float32Array} The mesh.
 */
export function ribbonMesh(points, width = 0.09, y = 0.014) {
	const mesh = createMesh();
	/** @type {[number, number][]} */
	const sides = [];
	for (let i = 0; i < points.length; i++) {
		const a = points[Math.max(0, i - 1)];
		const b = points[Math.min(points.length - 1, i + 1)];
		const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
		sides.push([(-(b.z - a.z) / len) * (width / 2), ((b.x - a.x) / len) * (width / 2)]);
	}
	let d = 0;
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1];
		const b = points[i];
		const step = Math.hypot(b.x - a.x, b.z - a.z);
		const [ax, az] = sides[i - 1];
		const [bx, bz] = sides[i];
		mesh.quad(
			[a.x - ax, y, a.z - az],
			[a.x + ax, y, a.z + az],
			[b.x + bx, y, b.z + bz],
			[b.x - bx, y, b.z - bz],
			[1, 1, 1],
			[MAT.route, 0],
			[[d, -1], [d, 1], [d + step, 1], [d + step, -1]],
			[a.x, y - 1, a.z],
		);
		d += step;
	}
	return mesh.build();
}
