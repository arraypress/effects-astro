import type { GL } from './gl.js';

/** A float texture format a context offers for render targets. */
export interface FloatFormat {
	/** The internal format. */
	internal: number;
	/** The texel type. */
	type: number;
	/** Whether it can be filtered linearly. */
	linear: boolean;
}

/** A texture and the framebuffer that draws into it. */
export interface Target {
	texture: WebGLTexture;
	fbo: WebGLFramebuffer;
}

/** Two float targets: read one, write the other, swap. */
export interface PingPong {
	/** The target read this step. */
	read: Target;
	/** The target written this step. */
	write: Target;
	/** Swaps them, after a step. */
	swap(): void;
	/** Reallocates both at a new size, cleared; false if the GPU will not draw into them. */
	resize(width: number, height: number): boolean;
	/** Clears both to zero (leaves the canvas bound). */
	clear(): void;
	/** Their size, texels. */
	size(): { width: number; height: number };
	/** Whether they are filtered linearly (else nearest). */
	linear: boolean;
	/** Frees the textures and framebuffers. */
	dispose(): void;
}

/** The float formats a context offers for render targets, best first (full floats, then half). */
export function floatFormats(gl: GL): FloatFormat[];

/** Makes a pair of float targets, cleared; null where the GPU cannot draw into float textures. Uses texture unit 0 while allocating. */
export function createPingPong(gl: GL, width: number, height: number): PingPong | null;
