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
import { sharingContexts, sharedPlace } from './shared-gl.js';
import { pixelRatio, prefersReducedMotion } from './device.js';
import { animate, frameNow } from './loop.js';

/** Frames between looks at the frame rate, the smoothed frame time counted slow (about 45 fps), each step down, and the lowest share of the pixel ratio a step may reach. */
const ADAPT_WINDOW = 60;
const ADAPT_SLOW = 1 / 45;
const ADAPT_STEP = 0.8;
const ADAPT_FLOOR = 0.5;
/** The frame rate a slow effect asks for (drifting light, slow water): half a 60 Hz screen's work, nothing to see for it. */
export const SLOW_FPS = 30;
/** A capped stage draws a frame that comes this share of a frame early (screens tick a little unevenly). */
const SLACK = 0.25;
/** How many capped stages have started: every other one starts half a gap ahead, so they take turns. */
let gates = 0;

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
 * @property {number} [fps=0] Draw at most this many frames a second (0: every frame the page gives). A slow effect (a
 *   drifting light, a breathing field) asks for 30 and costs half as much on a 60 Hz screen, with nothing to see for it;
 *   held for a recording, every asked frame is drawn.
 * @property {boolean} [adaptive=true] Lower the resolution while frames run slow (a weak GPU), down to half; a step that does not help is taken back and adjusting stops.
 * @property {boolean} [webgl1=true] Accept WebGL 1 where there is no WebGL 2.
 * @property {boolean} [antialias=false] Smooth the edges of geometry drawn into it (multisampling): for effects that draw meshes.
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
 * A frame-rate cap: tell it each frame's time and it says whether to draw, and how much time that drawn frame covers
 * (the passed-over frames' time with its own, so nothing is lost and the effect moves at its own speed). A frame that
 * comes up to a quarter of a frame early still draws (screens tick a little unevenly), so 30 on a 60 Hz screen is every
 * other frame, never every third; a screen slower than the cap draws every frame.
 *
 * @param {number} fps The most frames a second.
 * @param {number} [lead=0] Seconds it starts ahead by: half a gap for every other capped effect on a page, so they take
 *   turns on a 60 Hz screen (half draw on each frame) and the work is spread evenly.
 * @returns {(dt: number) => number} Given the seconds since the last frame: the seconds to draw, or 0 to pass it over.
 */
export function frameGate(fps, lead = 0) {
	const gap = 1 / fps;
	let owed = lead;
	return (dt) => {
		owed += dt;
		if (owed < gap - SLACK * Math.min(dt, gap)) return 0;
		const whole = owed;
		owed = 0;
		return whole;
	};
}

/**
 * Starts a full-canvas effect on an element (its first canvas is drawn into).
 *
 * @param {HTMLElement} el The element.
 * @param {StageOptions} options The effect.
 * @returns {{ stage: Stage | null, stop: () => void }} The stage (null without
 *   WebGL, when the canvas is removed), and a function that stops it.
 */
export function createStage(el, options) {
	const { fragment, alpha = true, scale = 1, webgl1 = true, adaptive = true, antialias = false } = options;
	/** Passes frames over when capped (`fps`); null draws every frame. */
	const gate = options.fps && options.fps > 0 ? frameGate(options.fps, (gates++ % 2) * (0.5 / options.fps)) : null;
	const canvas = el.querySelector('canvas');
	// with shareContexts() on (./shared-gl.js), the effect draws in the one shared context and copies each frame into
	// its own canvas; a multisampled effect keeps a context of its own (the shared one isn't)
	const place = canvas && sharingContexts() && !antialias ? sharedPlace(canvas) : null;
	const gl = place ? place.gl : canvas && getContext(canvas, { alpha, premultipliedAlpha: true, antialias }, webgl1);
	const compiled = gl && createProgram(gl, options.vertex ?? CLIP, fragment);
	/** Gives the context back: a context of its own is lost; a shared place deletes what it made. */
	const giveBack = () => (place ? place.dispose() : gl?.getExtension('WEBGL_lose_context')?.loseContext());
	if (!canvas || !gl || !compiled) {
		canvas?.remove();
		giveBack();
		return { stage: null, stop: () => {} };
	}
	const triangle = bindTriangle(gl);
	/**
	 * How the frame rate is going: the share of the pixel ratio drawn at
	 * now, the smoothed frame time, frames since the last look, the frame
	 * time before the last step down (0 when there was none), and whether
	 * it has stopped adjusting.
	 */
	const quality = { share: 1, ema: 0, frames: 0, before: 0, settled: false };
	/** An export's hold (loop.js `holdFrames`): the pixel ratio it draws at while held (0: not held). */
	let exportRatio = 0;

	/**
	 * Lowers the resolution while frames run slow, a step at a time. A step
	 * that buys nothing means the slowness is not this canvas's (a 30 Hz
	 * screen, a busy page): it is taken back, and adjusting stops.
	 *
	 * @param {number} dt Seconds since the last frame.
	 */
	const adapt = (dt) => {
		quality.ema = quality.ema ? quality.ema * 0.9 + dt * 0.1 : dt;
		if (quality.settled || ++quality.frames < ADAPT_WINDOW) return;
		quality.frames = 0;
		if (quality.before) {
			const helped = quality.ema < quality.before * 0.9;
			quality.before = 0;
			if (!helped) {
				quality.share = Math.min(1, quality.share / ADAPT_STEP);
				quality.settled = true;
				size();
				return;
			}
		}
		if (quality.ema > ADAPT_SLOW && quality.share > ADAPT_FLOOR) {
			quality.before = quality.ema;
			quality.share = Math.max(ADAPT_FLOOR, quality.share * ADAPT_STEP);
			size();
		}
	};

	/**
	 * Draws one frame.
	 *
	 * @param {number} now The time, ms.
	 * @param {number} dt Seconds since the last frame.
	 */
	const render = (now, dt) => {
		// capped (`fps`): a frame that comes too soon after the last drawn one is passed over, its time kept for the next;
		// a still redraw (dt 0) and a recording's held frames always draw
		if (gate && dt > 0 && !exportRatio) {
			const whole = gate(dt);
			if (whole > 0) draw(now, whole, dt);
			return;
		}
		draw(now, dt, dt);
	};

	/**
	 * Draws the frame: `dt` is the time the effect has to cover, `tick` the page's own frame time (what the resolution
	 * adapts to: a capped effect's longer steps are not slow frames).
	 *
	 * @param {number} now The time, ms.
	 * @param {number} dt Seconds since the last drawn frame.
	 * @param {number} tick Seconds since the page's last frame.
	 */
	const draw = (now, dt, tick) => {
		place?.begin(canvas.width, canvas.height);
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
		} else place?.opaque();
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		options.after?.(stage, now, dt);
		place?.end(canvas.width, canvas.height);
		if (adaptive && tick > 0 && !exportRatio) adapt(tick);
	};

	/** @type {Stage} */
	const stage = {
		gl,
		canvas,
		program: compiled.program,
		uniform: compiled.uniform,
		still: options.still === true || prefersReducedMotion(),
		ratio: pixelRatio(scale),
		redraw: () => draw(frameNow(), 0, 0),
	};

	place?.begin(1, 1);
	gl.useProgram(compiled.program);
	const cleanup = options.setup?.(stage);
	if (cleanup === false) {
		// It cannot run here: the canvas goes, and its GPU context with it.
		canvas.remove();
		giveBack();
		return { stage: null, stop: () => {} };
	}
	gl.useProgram(compiled.program);

	/** Sizes the canvas to the element, at the capped pixel ratio (lowered while frames run slow). */
	const size = () => {
		// held for an export, it draws at the export's resolution (its share of it, for an effect drawn at a lower one)
		stage.ratio = exportRatio ? exportRatio * scale : pixelRatio(scale) * quality.share;
		canvas.width = Math.max(1, Math.round(el.clientWidth * stage.ratio));
		canvas.height = Math.max(1, Math.round(el.clientHeight * stage.ratio));
		place?.begin(canvas.width, canvas.height);
		gl.useProgram(compiled.program);
		options.resize?.(stage);
		if (stage.still) stage.redraw();
	};
	const resizer = new ResizeObserver(size);
	resizer.observe(el);
	size();

	const stopLoop = stage.still
		? () => {}
		: animate(el, render, {
				hold(on, ratio) {
					exportRatio = on ? ratio : 0;
					size();
				},
			});
	return {
		stage,
		stop: () => {
			stopLoop();
			resizer.disconnect();
			cleanup?.();
			// Gone from the page: give the GPU context back now rather than
			// whenever it is collected, as a browser keeps only so many. A
			// shared place always gives back what it made (the context stays).
			if (place) place.dispose();
			else if (!el.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext();
		},
	};
}
