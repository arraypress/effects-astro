/**
 * @module @arraypress/effects-astro/stage
 *
 * The set-up every full-canvas effect shares, so each effect is only its
 * shader and what feeds it: a WebGL context on the element's canvas, the
 * effect's program on a full-screen triangle, the canvas kept the size of
 * the element at a capped pixel ratio, frames from the page's one loop
 * (or one still frame with prefers-reduced-motion or `still`), and everything torn
 * down when the effect stops.
 *
 * Each frame: `update` (free to use the context for other passes), then
 * the effect's program is bound with `uRes` set, `uniforms` sets the
 * rest, the triangle is drawn, and `after` draws anything on top.
 */

import { getContext, createProgram, bindTriangle } from './gl.js';
import { pixelRatio, prefersReducedMotion } from './device.js';
import { animate } from './loop.js';

/** The vertex shader for a full-screen pass that works in `gl_FragCoord`. */
const CLIP = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

/**
 * @typedef {object} Stage
 * @property {WebGL2RenderingContext | WebGLRenderingContext} gl The context.
 * @property {HTMLCanvasElement} canvas The canvas.
 * @property {WebGLProgram} program The effect's program.
 * @property {(name: string) => WebGLUniformLocation | null} uniform A uniform of the effect's program.
 * @property {boolean} still True with prefers-reduced-motion or the `still` option: one frame, redrawn on changes.
 * @property {number} ratio The pixel ratio the canvas is drawn at.
 * @property {() => void} redraw Draws a frame now (for still stages after a change).
 */

/**
 * @typedef {object} StageOptions
 * @property {string} fragment The effect's fragment shader (`uRes`, the canvas size in pixels, is set for it).
 * @property {string} [vertex] A vertex shader of its own (its position attribute at location 0); the default passes the triangle through.
 * @property {boolean} [alpha=true] A transparent canvas (premultiplied), or an opaque one.
 * @property {number} [scale=1] Share of the pixel ratio to draw at.
 * @property {boolean} [webgl1=true] Accept WebGL 1 where there is no WebGL 2.
 * @property {boolean} [still=false] Draw one frame (again after each resize and
 *   redraw) and never join the loop, as with prefers-reduced-motion: for an
 *   effect used as wallpaper.
 * @property {(stage: Stage) => (() => void) | false | void} [setup] Once, after the context is made;
 *   returns a clean-up, or false when the effect cannot run here after all (the canvas is removed).
 * @property {(stage: Stage) => void} [resize] After the canvas is resized.
 * @property {(stage: Stage, now: number, dt: number) => void} [update] Each frame, before the effect's program is bound.
 * @property {(stage: Stage, now: number, dt: number) => void} [uniforms] Each frame, with the program bound: set its uniforms.
 * @property {(stage: Stage, now: number, dt: number) => void} [after] Each frame, after the effect's pass: draw on top of it.
 */

/**
 * Starts a full-canvas effect on an element (its first canvas is drawn into).
 *
 * @param {HTMLElement} el The element.
 * @param {StageOptions} options The effect.
 * @returns {{ stage: Stage | null, stop: () => void }} The stage (null without
 *   WebGL, when the canvas is removed), and a function that stops it.
 */
export function createStage(el, options) {
	const { fragment, alpha = true, scale = 1, webgl1 = true } = options;
	const canvas = el.querySelector('canvas');
	const gl = canvas && getContext(canvas, { alpha, premultipliedAlpha: true }, webgl1);
	const compiled = gl && createProgram(gl, options.vertex ?? CLIP, fragment);
	if (!canvas || !gl || !compiled) {
		canvas?.remove();
		gl?.getExtension('WEBGL_lose_context')?.loseContext();
		return { stage: null, stop: () => {} };
	}
	const triangle = bindTriangle(gl);

	/**
	 * Draws one frame.
	 *
	 * @param {number} now The time, ms.
	 * @param {number} dt Seconds since the last frame.
	 */
	const render = (now, dt) => {
		options.update?.(stage, now, dt);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, canvas.width, canvas.height);
		bindTriangle(gl, triangle);
		gl.useProgram(compiled.program);
		gl.uniform2f(compiled.uniform('uRes'), canvas.width, canvas.height);
		options.uniforms?.(stage, now, dt);
		if (alpha) {
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		options.after?.(stage, now, dt);
	};

	/** @type {Stage} */
	const stage = {
		gl,
		canvas,
		program: compiled.program,
		uniform: compiled.uniform,
		still: options.still === true || prefersReducedMotion(),
		ratio: pixelRatio(scale),
		redraw: () => render(performance.now(), 0),
	};

	gl.useProgram(compiled.program);
	const cleanup = options.setup?.(stage);
	if (cleanup === false) {
		// It cannot run here: the canvas goes, and its GPU context with it.
		canvas.remove();
		gl.getExtension('WEBGL_lose_context')?.loseContext();
		return { stage: null, stop: () => {} };
	}
	gl.useProgram(compiled.program);

	/** Sizes the canvas to the element, at the capped pixel ratio. */
	const size = () => {
		stage.ratio = pixelRatio(scale);
		canvas.width = Math.max(1, Math.round(el.clientWidth * stage.ratio));
		canvas.height = Math.max(1, Math.round(el.clientHeight * stage.ratio));
		gl.useProgram(compiled.program);
		options.resize?.(stage);
		if (stage.still) stage.redraw();
	};
	const resizer = new ResizeObserver(size);
	resizer.observe(el);
	size();

	const stopLoop = stage.still ? () => {} : animate(el, render);
	return {
		stage,
		stop: () => {
			stopLoop();
			resizer.disconnect();
			cleanup?.();
			// Gone from the page: give the GPU context back now rather than
			// whenever it is collected, as a browser keeps only so many.
			if (!el.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext();
		},
	};
}
