import type { GL } from './gl.js';

/** A picture that fades each frame while new things are drawn into it: trails. */
export interface Feedback {
	/** Sizes it for a canvas of that many pixels (at its `scale`), cleared. */
	resize(width: number, height: number): void;
	/** One frame: the last times `fade` (0 clears, 1 keeps all), then `add` draws on top into it. Leaves the canvas bound. */
	draw(fade: number, add: () => void): void;
	/** The latest frame. */
	texture(): WebGLTexture;
	/** Its size in pixels. */
	size(): { width: number; height: number };
	/** Frees its textures, framebuffers and program. */
	dispose(): void;
}

/** Makes a feedback buffer, `scale` of the canvas's size, in half floats where possible with `precise`; null if its program does not compile. Uses texture unit 0 while drawing. */
export function createFeedback(gl: GL, options?: { scale?: number; precise?: boolean }): Feedback | null;
