/**
 * @module @arraypress/effects-astro/shared-gl
 *
 * One WebGL context for many effects. A browser keeps about sixteen WebGL
 * contexts and drops the oldest past that, so a wall of thirty live cards,
 * each with its own, can only run half of them. With `shareContexts()` on,
 * every stage (./stage.js) draws in one hidden context instead and copies
 * its frame into its own canvas (a Canvas 2D one) with `drawImage`, so any
 * number can run; only what is on the screen draws.
 *
 * Effects written for a context of their own keep working: each stage gets
 * a tracked view of the shared context (`trackGL`) that remembers the state
 * it set (capabilities, blending, pixel storage, the texture bound to each
 * unit) and the resources it made. Before a stage draws, the context is put
 * back to its defaults and that stage's state laid on again; when the stage
 * stops, its resources are deleted. It is off by default: an effect on its
 * own page keeps a context of its own.
 */

import { getContext } from './gl.js';

/** Whether new stages share the one context. */
let sharing = false;

/**
 * Turns sharing on (or off) for stages started from now on.
 *
 * @param {boolean} [on=true] Share.
 */
export function shareContexts(on = true) {
	sharing = on;
}

/** @returns {boolean} Whether new stages share the one context. */
export const sharingContexts = () => sharing;

/** The most a side of the hidden canvas grows to (a card is far smaller). */
export const HOST_MAX = 4096;

/** The capabilities put back to off before each stage draws. */
const CAPS = ['BLEND', 'DEPTH_TEST', 'CULL_FACE', 'SCISSOR_TEST', 'STENCIL_TEST', 'POLYGON_OFFSET_FILL', 'SAMPLE_ALPHA_TO_COVERAGE'];

/** Calls whose last arguments are the state they set (laid on again before a stage draws). */
const STATE_CALLS = ['blendFunc', 'blendFuncSeparate', 'blendEquation', 'blendEquationSeparate', 'blendColor', 'depthFunc', 'depthMask', 'cullFace', 'frontFace', 'polygonOffset'];

/** What a stage's resources are deleted with. */
const DELETERS = {
	createTexture: 'deleteTexture',
	createBuffer: 'deleteBuffer',
	createFramebuffer: 'deleteFramebuffer',
	createRenderbuffer: 'deleteRenderbuffer',
	createProgram: 'deleteProgram',
	createShader: 'deleteShader',
	createVertexArray: 'deleteVertexArray',
};

/**
 * A tracked view of a context: calls go straight through, but the state the
 * caller sets and the resources it makes are remembered, so its state can be
 * laid on again after another user changed it, and its resources freed.
 *
 * @param {any} gl The real context.
 * @returns {{ gl: any, reset: () => void, replay: () => void, dispose: () => void, state: object }} The view
 *   (`gl`), the context put back to its defaults (`reset`), this view's state laid on (`replay`), and its
 *   resources deleted (`dispose`).
 */
export function trackGL(gl) {
	const state = {
		/** @type {Map<number, boolean>} */
		caps: new Map(),
		/** @type {Map<string, any[]>} */
		calls: new Map(),
		/** @type {Map<number, number>} */
		store: new Map(),
		/** @type {Map<number, Map<number, any>>} unit → target → texture */
		units: new Map(),
		active: gl.TEXTURE0,
		/** @type {[string, any][]} */
		made: [],
	};
	/** @type {Map<PropertyKey, Function>} */
	const bound = new Map();
	const wrap = (name, fn) => {
		if (name === 'enable' || name === 'disable')
			return (cap) => {
				state.caps.set(cap, name === 'enable');
				return fn.call(gl, cap);
			};
		if (STATE_CALLS.includes(name))
			return (...args) => {
				state.calls.set(name, args);
				// a blend set one way forgets the other way's
				if (name === 'blendFunc') state.calls.delete('blendFuncSeparate');
				if (name === 'blendFuncSeparate') state.calls.delete('blendFunc');
				if (name === 'blendEquation') state.calls.delete('blendEquationSeparate');
				if (name === 'blendEquationSeparate') state.calls.delete('blendEquation');
				return fn.apply(gl, args);
			};
		if (name === 'pixelStorei')
			return (pname, value) => {
				state.store.set(pname, value);
				return fn.call(gl, pname, value);
			};
		if (name === 'activeTexture')
			return (unit) => {
				state.active = unit;
				return fn.call(gl, unit);
			};
		if (name === 'bindTexture')
			return (target, texture) => {
				if (!state.units.has(state.active)) state.units.set(state.active, new Map());
				state.units.get(state.active).set(target, texture);
				return fn.call(gl, target, texture);
			};
		if (name in DELETERS)
			return (...args) => {
				const made = fn.apply(gl, args);
				if (made) state.made.push([name, made]);
				return made;
			};
		return fn.bind(gl);
	};
	const view = new Proxy(gl, {
		get(target, key) {
			const value = target[key];
			if (typeof value !== 'function') return value;
			if (!bound.has(key)) bound.set(key, wrap(String(key), value));
			return bound.get(key);
		},
	});
	return {
		gl: view,
		state,
		reset() {
			for (const cap of CAPS) if (gl[cap] !== undefined) gl.disable(gl[cap]);
			gl.blendFunc(gl.ONE, gl.ZERO);
			gl.blendEquation(gl.FUNC_ADD);
			gl.depthMask(true);
			gl.colorMask(true, true, true, true);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
			gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		},
		replay() {
			for (const [cap, on] of state.caps) (on ? gl.enable : gl.disable).call(gl, cap);
			for (const [name, args] of state.calls) gl[name](...args);
			for (const [pname, value] of state.store) gl.pixelStorei(pname, value);
			for (const [unit, targets] of state.units) {
				gl.activeTexture(unit);
				for (const [target, texture] of targets) gl.bindTexture(target, texture);
			}
			gl.activeTexture(state.active);
		},
		dispose() {
			for (const [name, made] of state.made.splice(0)) {
				const del = gl[DELETERS[name]];
				if (typeof del === 'function') del.call(gl, made);
			}
			state.units.clear();
		},
	};
}

/** The hidden canvas and its context, made on first use. */
let host = null;

/**
 * The shared context, made on first use (null without WebGL, or once it was lost).
 *
 * @returns {{ canvas: HTMLCanvasElement, gl: any } | null} The hidden canvas and its context.
 */
function hostContext() {
	if (host) return host.lost ? null : host;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 1;
	const gl = getContext(canvas, { alpha: true, premultipliedAlpha: true, antialias: false });
	if (!gl) return null;
	host = { canvas, gl, lost: false };
	canvas.addEventListener('webglcontextlost', () => {
		if (host) host.lost = true;
	});
	return host;
}

/**
 * A stage's place in the shared context: its tracked view of the context, and
 * the steps around each of its frames (`begin`: the hidden canvas big enough,
 * the context in this stage's state; `end`: the frame copied into the stage's
 * own canvas). Null when there is no WebGL, or the stage's canvas can't take
 * a Canvas 2D context (it has a WebGL one already).
 *
 * @param {HTMLCanvasElement} canvas The stage's own canvas.
 * @returns {{ gl: any, begin: (w: number, h: number) => void, end: (w: number, h: number) => void, opaque: () => void, dispose: () => void } | null} The place.
 */
export function sharedPlace(canvas) {
	const h = hostContext();
	if (!h) return null;
	const out = canvas.getContext('2d');
	if (!out) return null;
	const view = trackGL(h.gl);
	const { gl } = h;
	return {
		gl: view.gl,
		begin(w, hgt) {
			const W = Math.min(HOST_MAX, Math.max(h.canvas.width, w)),
				H = Math.min(HOST_MAX, Math.max(h.canvas.height, hgt));
			if (W !== h.canvas.width || H !== h.canvas.height) {
				h.canvas.width = W;
				h.canvas.height = H;
			}
			view.reset();
			view.replay();
		},
		/** For an opaque stage: the alpha is 1 and stays 1, whatever the shader writes. */
		opaque() {
			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.colorMask(true, true, true, false);
		},
		end(w, hgt) {
			gl.colorMask(true, true, true, true);
			out.globalCompositeOperation = 'copy';
			// the frame was drawn at the bottom left of the hidden canvas (WebGL's origin)
			out.drawImage(h.canvas, 0, h.canvas.height - hgt, w, hgt, 0, 0, w, hgt);
		},
		dispose: () => view.dispose(),
	};
}
