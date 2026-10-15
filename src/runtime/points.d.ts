import type { GL, Program } from './gl.js';

/** GLSL: `rotateX`, `rotateY` and `vec4 project(vec3 v, float aspect)` for a small 3D scene. */
export const GLSL_PROJECT: string;

/** GLSL_PROJECT in JavaScript: where a scene point lands, 0–1 from the top left, after turning `turnY` then `turnX`. */
export function projectPoint(v: [number, number, number], turnY: number, turnX: number, aspect: number): { x: number; y: number };

/** A point renderer: soft round dots, added together. */
export interface Points {
	program: Program;
	/** Draws once, or with `aberration` > 0 three times, red, green and blue that many canvas px apart; `draw` sets uniforms before each. */
	passes(aberration: number, draw: () => void): void;
	/** Replaces the particle data, four floats a particle (attribute `p`). */
	upload(data: Float32Array): void;
	count(): number;
	bind(): void;
}

/** Makes a point renderer from the effect's vertex shader; null (reason in the console) if it does not compile. */
export function createPoints(gl: GL, vertex: string): Points | null;
