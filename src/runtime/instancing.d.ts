import type { GL } from './gl.js';

/** Instanced drawing calls, the same on WebGL 1 and 2. */
export interface Instancing {
	/** How many instances share each value of an attribute (0: it advances every vertex). */
	divisor(location: number, divisor: number): void;
	/** Draws `count` vertices from `first`, `instances` times. */
	draw(mode: number, first: number, count: number, instances: number): void;
}

/** Instanced drawing for a context: WebGL 2's own, or ANGLE_instanced_arrays on WebGL 1; null without either. */
export function instancing(gl: GL): Instancing | null;
