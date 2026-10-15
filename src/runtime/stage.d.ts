import type { GL } from './gl.js';

/** A running full-canvas effect: its context, canvas and program. */
export interface Stage {
	gl: GL;
	canvas: HTMLCanvasElement;
	program: WebGLProgram;
	uniform(name: string): WebGLUniformLocation | null;
	/** True with prefers-reduced-motion or the `still` option: one frame, redrawn on changes. */
	still: boolean;
	/** The pixel ratio the canvas is drawn at. */
	ratio: number;
	/** Draws a frame now. */
	redraw(): void;
}

export interface StageOptions {
	/** The fragment shader; `uRes` (canvas size in pixels) is set for it. */
	fragment: string;
	/** A vertex shader of its own (position attribute at location 0). Default passes the triangle through. */
	vertex?: string;
	/** Transparent (premultiplied) or opaque canvas. Default true. */
	alpha?: boolean;
	/** Share of the pixel ratio to draw at. Default 1. */
	scale?: number;
	/** Lower the resolution while frames run slow (a weak GPU), down to half; a step that does not help is taken back and adjusting stops. Default true. */
	adaptive?: boolean;
	/** Accept WebGL 1 without WebGL 2. Default true. */
	webgl1?: boolean;
	/** Smooth the edges of geometry drawn into it (multisampling): for effects that draw meshes. Default false. */
	antialias?: boolean;
	/** One frame (redrawn after resizes and redraws), never the loop, as with reduced motion. Default false. */
	still?: boolean;
	/** Once, after the context is made; returns a clean-up, or false when the effect cannot run here (the canvas is removed). */
	setup?(stage: Stage): (() => void) | false | void;
	/** After each resize. */
	resize?(stage: Stage): void;
	/** Each frame, before the program is bound (free to run other passes). */
	update?(stage: Stage, now: number, dt: number): void;
	/** Each frame, with the program bound. */
	uniforms?(stage: Stage, now: number, dt: number): void;
	/** Each frame, after the effect's pass: draw on top of it. */
	after?(stage: Stage, now: number, dt: number): void;
}

/** Starts a full-canvas effect in `el`'s canvas. `stage` is null without WebGL (the canvas is removed). */
export function createStage(el: HTMLElement, options: StageOptions): { stage: Stage | null; stop(): void };
