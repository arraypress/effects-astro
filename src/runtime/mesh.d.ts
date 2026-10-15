export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

/** Floats a vertex: position 3, normal 3, colour 3, uv 2, tag 2. */
export const STRIDE: number;

/** A flat-shaded mesh being built: every triangle its own vertices, with its face's normal. */
export interface Mesh {
	/** Adds a triangle (anticlockwise seen from its front; with `outside`, turned to face away from that point). Degenerate ones are dropped. */
	tri(a: Vec3, b: Vec3, c: Vec3, color: Vec3, tag?: Vec2, uvs?: [Vec2, Vec2, Vec2], outside?: Vec3): void;
	/** Adds a quad, a b c d anticlockwise, as two triangles. */
	quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: Vec3, tag?: Vec2, uvs?: [Vec2, Vec2, Vec2, Vec2], outside?: Vec3): void;
	/** Adds a convex solid between two rings of as many points: a quad between each pair of edges (uv: distance round ring `a`, and up the side), the rings filled as caps. Default caps: both. */
	loft(a: Vec3[], b: Vec3[], color: Vec3, tag?: Vec2, options?: { caps?: 'both' | 'start' | 'end' | 'none' }): Mesh;
	/** Adds an axis-aligned box between two corners; no bottom face unless `bottom`. */
	box(min: Vec3, max: Vec3, color: Vec3, tag?: Vec2, options?: { bottom?: boolean }): Mesh;
	/** Adds a convex polygon (x, z) raised from y0 to y1; `top` scales the top ring about its centre (0 makes a pyramid). */
	prism(polygon: Vec2[], y0: number, y1: number, color: Vec3, tag?: Vec2, options?: { bottom?: boolean; top?: number }): Mesh;
	/** Adds a convex profile (x, y) pushed from z0 to z1. */
	extrude(profile: Vec2[], z0: number, z1: number, color: Vec3, tag?: Vec2): Mesh;
	/** Adds a faceted sphere (default 8 segments, 5 rings); `squash` scales it vertically. */
	sphere(centre: Vec3, radius: number, color: Vec3, tag?: Vec2, segments?: number, rings?: number, squash?: number): Mesh;
	/** Vertices so far. */
	count(): number;
	/** The vertices, STRIDE floats each. */
	build(): Float32Array;
}

/** Makes an empty mesh to build into. */
export function createMesh(): Mesh;
