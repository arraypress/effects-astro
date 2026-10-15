import type { Vec2, Vec3 } from '../mesh.js';
import type { CityPlan, Rect } from './plan.js';
import type { Look } from './look.js';

/** The materials, as the shader reads them from a vertex's tag. */
export const MAT: Readonly<{
	plain: number; wall: number; glass: number; body: number; head: number; tail: number; sign: number; accent: number;
	lamp: number; water: number; route: number; blob: number; glow: number; beam: number; ring: number;
}>;

/** A rectangle with rounded corners, as a polygon (x, z); `steps` segments a corner (default 4). */
export function roundedRect(r: Rect, radius: number, steps?: number): Vec2[];

/** The static city as one opaque mesh, and the lamps' pools of light. */
export function cityMesh(plan: CityPlan, look: Look): { solid: Float32Array; glow: Float32Array };

/** The car in its own frame (x forward, 0.44 long): the body, and what it lays on the road (shadow, beams). */
export function carMesh(look: Look): { body: Float32Array; effects: Float32Array };

/** A person, standing. */
export function personMesh(look: Look): Float32Array;

/** The pin (its white dot turned towards `eye`) and its ring. */
export function pinMesh(eye: Vec3): { body: Float32Array; ring: Float32Array };

/** A ribbon along a route (default 0.09 wide, 0.014 up): uv x the distance along, y −1 to 1 across. */
export function ribbonMesh(points: { x: number; z: number }[], width?: number, y?: number): Float32Array;
