/**
 * @module @arraypress/effects-astro/mesh
 *
 * A tiny builder for flat-shaded, low-poly meshes: triangles, quads, and
 * solids lofted between two rings (boxes, prisms, extruded profiles,
 * tapers), plus faceted spheres. Every triangle gets its own three
 * vertices and the normal of its face, so a mesh lights in clean flat
 * facets with no smoothing.
 *
 * A vertex is STRIDE floats: position (3), normal (3), colour (3, 0–1),
 * uv (2) and a tag (2), which a shader reads as it likes (a material and
 * a seed, say). Triangles wind anticlockwise seen from outside, so back
 * faces can be culled.
 */

/** Floats a vertex: position 3, normal 3, colour 3, uv 2, tag 2. */
export const STRIDE = 13;

/** Triangles smaller than this (twice their area) are dropped as degenerate. */
const TINY = 1e-10;

/**
 * @typedef {[number, number, number]} Vec3
 * @typedef {[number, number]} Vec2
 */

/**
 * b − a.
 *
 * @param {Vec3} a From.
 * @param {Vec3} b To.
 * @returns {Vec3} The difference.
 */
const sub = (a, b) => [b[0] - a[0], b[1] - a[1], b[2] - a[2]];

/**
 * The cross product.
 *
 * @param {Vec3} a The first.
 * @param {Vec3} b The second.
 * @returns {Vec3} a × b.
 */
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * The centre of a set of points.
 *
 * @param {Vec3[]} points The points.
 * @returns {Vec3} Their mean.
 */
function centreOf(points) {
	const c = [0, 0, 0];
	for (const p of points) for (let i = 0; i < 3; i++) c[i] += p[i] / points.length;
	return /** @type {Vec3} */ (c);
}

/**
 * Makes an empty mesh to build into.
 *
 * @returns {Mesh} The builder.
 */
export function createMesh() {
	/** @type {number[]} */
	const data = [];

	/**
	 * Adds a triangle, its normal from its winding (anticlockwise seen from
	 * the side the normal points to).
	 *
	 * @param {Vec3} a A corner.
	 * @param {Vec3} b The next.
	 * @param {Vec3} c The last.
	 * @param {Vec3} color Its colour, 0–1.
	 * @param {Vec2} [tag] Its tag.
	 * @param {[Vec2, Vec2, Vec2]} [uvs] Each corner's uv.
	 * @param {Vec3} [outside] A point inside the solid: the triangle is turned to face away from it.
	 */
	const tri = (a, b, c, color, tag = [0, 0], uvs, outside) => {
		let n = cross(sub(a, b), sub(a, c));
		const length = Math.hypot(n[0], n[1], n[2]);
		if (length < TINY) return;
		n = [n[0] / length, n[1] / length, n[2] / length];
		let corners = [a, b, c];
		let coords = uvs ?? [[0, 0], [0, 0], [0, 0]];
		if (outside) {
			const mid = centreOf(corners);
			const away = sub(outside, mid);
			if (away[0] * n[0] + away[1] * n[1] + away[2] * n[2] < 0) {
				n = [-n[0], -n[1], -n[2]];
				corners = [a, c, b];
				coords = [coords[0], coords[2], coords[1]];
			}
		}
		for (let i = 0; i < 3; i++) data.push(...corners[i], ...n, ...color, ...coords[i], ...tag);
	};

	/**
	 * Adds a quad as two triangles, a b c d anticlockwise.
	 *
	 * @param {Vec3} a A corner.
	 * @param {Vec3} b The next.
	 * @param {Vec3} c The next.
	 * @param {Vec3} d The last.
	 * @param {Vec3} color Its colour.
	 * @param {Vec2} [tag] Its tag.
	 * @param {[Vec2, Vec2, Vec2, Vec2]} [uvs] Each corner's uv.
	 * @param {Vec3} [outside] A point inside the solid, to face away from.
	 */
	const quad = (a, b, c, d, color, tag, uvs, outside) => {
		const u = uvs ?? [[0, 0], [0, 0], [0, 0], [0, 0]];
		tri(a, b, c, color, tag, [u[0], u[1], u[2]], outside);
		tri(a, c, d, color, tag, [u[0], u[2], u[3]], outside);
	};

	/**
	 * Fills a convex ring as a fan, facing away from a point.
	 *
	 * @param {Vec3[]} ring The ring.
	 * @param {Vec3} color Its colour.
	 * @param {Vec2 | undefined} tag Its tag.
	 * @param {Vec3} inside A point inside the solid.
	 */
	const cap = (ring, color, tag, inside) => {
		for (let i = 1; i < ring.length - 1; i++) tri(ring[0], ring[i], ring[i + 1], color, tag, undefined, inside);
	};

	/** @type {Mesh} */
	const mesh = {
		tri,
		quad,
		loft(a, b, color, tag, { caps = 'both' } = {}) {
			const inside = centreOf([...a, ...b]);
			let u = 0;
			for (let i = 0; i < a.length; i++) {
				const j = (i + 1) % a.length;
				const step = Math.hypot(...sub(a[i], a[j]));
				const up = Math.hypot(...sub(a[i], b[i]));
				quad(a[i], a[j], b[j], b[i], color, tag, [[u, 0], [u + step, 0], [u + step, up], [u, up]], inside);
				u += step;
			}
			if (caps === 'both' || caps === 'start') cap(a, color, tag, inside);
			if (caps === 'both' || caps === 'end') cap(b, color, tag, inside);
			return mesh;
		},
		box(min, max, color, tag, { bottom = false } = {}) {
			const [x0, y0, z0] = min;
			const [x1, y1, z1] = max;
			/** @type {Vec3[]} */
			const low = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]];
			/** @type {Vec3[]} */
			const high = low.map(([x, , z]) => /** @type {Vec3} */ ([x, y1, z]));
			return mesh.loft(low, high, color, tag, { caps: bottom ? 'both' : 'end' });
		},
		prism(polygon, y0, y1, color, tag, { bottom = false, top = 1 } = {}) {
			const c = polygon.reduce((s, [x, z]) => [s[0] + x / polygon.length, s[1] + z / polygon.length], [0, 0]);
			/** @type {Vec3[]} */
			const low = polygon.map(([x, z]) => [x, y0, z]);
			/** @type {Vec3[]} */
			const high = polygon.map(([x, z]) => [c[0] + (x - c[0]) * top, y1, c[1] + (z - c[1]) * top]);
			return mesh.loft(low, high, color, tag, { caps: bottom ? 'both' : 'end' });
		},
		extrude(profile, z0, z1, color, tag) {
			return mesh.loft(
				profile.map(([x, y]) => /** @type {Vec3} */ ([x, y, z0])),
				profile.map(([x, y]) => /** @type {Vec3} */ ([x, y, z1])),
				color,
				tag,
			);
		},
		sphere(centre, radius, color, tag, segments = 8, rings = 5, squash = 1) {
			const [cx, cy, cz] = centre;
			/**
			 * A point on the sphere.
			 *
			 * @param {number} ring From the top, 0 to `rings`.
			 * @param {number} seg Round, 0 to `segments`.
			 * @returns {Vec3} The point.
			 */
			const at = (ring, seg) => {
				const polar = (ring / rings) * Math.PI;
				const angle = (seg / segments) * Math.PI * 2 + (ring % 2) * (Math.PI / segments) * 0.5;
				const r = Math.sin(polar) * radius;
				return [cx + Math.cos(angle) * r, cy + Math.cos(polar) * radius * squash, cz + Math.sin(angle) * r];
			};
			for (let ring = 0; ring < rings; ring++) {
				for (let seg = 0; seg < segments; seg++) {
					quad(at(ring, seg), at(ring, seg + 1), at(ring + 1, seg + 1), at(ring + 1, seg), color, tag, undefined, centre);
				}
			}
			return mesh;
		},
		count: () => data.length / STRIDE,
		build: () => new Float32Array(data),
	};
	return mesh;
}

/**
 * @typedef {object} Mesh
 * @property {(a: Vec3, b: Vec3, c: Vec3, color: Vec3, tag?: Vec2, uvs?: [Vec2, Vec2, Vec2], outside?: Vec3) => void} tri
 *   Adds a triangle (anticlockwise seen from its front; with `outside`, turned to face away from that point).
 * @property {(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: Vec3, tag?: Vec2, uvs?: [Vec2, Vec2, Vec2, Vec2], outside?: Vec3) => void} quad
 *   Adds a quad as two triangles.
 * @property {(a: Vec3[], b: Vec3[], color: Vec3, tag?: Vec2, options?: { caps?: 'both' | 'start' | 'end' | 'none' }) => Mesh} loft
 *   Adds a convex solid between two rings of as many points: a quad between each pair of edges
 *   (its uv: distance round ring `a`, and up the side), and the rings filled as caps.
 * @property {(min: Vec3, max: Vec3, color: Vec3, tag?: Vec2, options?: { bottom?: boolean }) => Mesh} box
 *   Adds an axis-aligned box between two corners; no bottom face unless asked.
 * @property {(polygon: Vec2[], y0: number, y1: number, color: Vec3, tag?: Vec2, options?: { bottom?: boolean, top?: number }) => Mesh} prism
 *   Adds a convex polygon (x, z) raised from y0 to y1; `top` scales the top ring about its centre (0 makes a pyramid).
 * @property {(profile: Vec2[], z0: number, z1: number, color: Vec3, tag?: Vec2) => Mesh} extrude
 *   Adds a convex profile (x, y) pushed from z0 to z1.
 * @property {(centre: Vec3, radius: number, color: Vec3, tag?: Vec2, segments?: number, rings?: number, squash?: number) => Mesh} sphere
 *   Adds a faceted sphere (default 8 segments, 5 rings); `squash` scales it vertically.
 * @property {() => number} count Vertices so far.
 * @property {() => Float32Array} build The vertices, STRIDE floats each.
 */
