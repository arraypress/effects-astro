import type { GL } from './gl.js';

/** The most pushes one step takes. */
export const MAX_PUSHES: number;

/**
 * GLSL (ES 1.00) for a step shader: `waveState(uv)` (height, speed and the
 * Laplacian of each), `waveForce(s)` (wave, spring and viscosity),
 * `wavePushes(uv)` (how far the pushes press a cell down) and
 * `wavePack(h, v)` (the new state, clamped). Declares `uState`, `uTexel`,
 * `uAspect`, `uMotion`, `uPush` and `uPushes`.
 */
export const GLSL_HEIGHT_FIELD: string;

/** How the surface moves, per step. */
export interface WaveMotion {
	/** Wave speed squared, cells a step (at most 0.5). */
	speed: number;
	/** The pull back to rest. */
	spring: number;
	/** The share of speed kept each step. */
	keep: number;
	/** How much neighbouring speeds even out. */
	viscosity: number;
}

/** A wave surface on the GPU: heights (r) and speeds (g) in a pair of float targets. */
export interface HeightField {
	/** The step's program. */
	program: WebGLProgram;
	/** A uniform of the step. */
	uniform(name: string): WebGLUniformLocation | null;
	/** Sizes the grid: `longSide` cells along the box's longer side, square cells; cleared. */
	resize(longSide: number, aspect: number): void;
	/** One step. `pushes` holds x, y (box heights), radius and strength for each of `count` pushes (at most MAX_PUSHES). */
	step(motion: WaveMotion, pushes: Float32Array, count: number): void;
	/** Flattens the surface. */
	clear(): void;
	/** The current state. */
	texture(): WebGLTexture;
	/** One cell, as a share of the box. */
	texel(): [number, number];
	/** Whether the state is filtered linearly (else nearest). */
	linear: boolean;
	/** Frees its targets, program and buffer. */
	dispose(): void;
}

/** Sets up a height field with a step shader built on GLSL_HEIGHT_FIELD; null without drawable float textures or when the step does not compile. Uses texture unit 0. */
export function createHeightField(gl: GL, step: string): HeightField | null;
