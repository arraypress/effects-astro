/**
 * @module @arraypress/effects-astro/ink-field/sim
 *
 * The ink field's fluid: a small stable-fluids sim (velocity, pressure,
 * dye) that six ambient emitters keep moving and the pointer stirs.
 * Adapted from Trirat's ink shader for LumiThemes (smoke-sim.ts), itself
 * ported from a reference stable-fluids sim; its constants, emitters and
 * passes are his, unchanged.
 *
 * - Velocity and pressure live on a coarse grid (GRID cells on the short
 *   side); the dye on one DYE_SCALE times finer, for sharper edges.
 * - Forces and decay are scaled by the frame time, not the frame.
 * - The grid is a fixed size, whatever the device pixel ratio.
 * - It renders into float textures (half-float where float cannot be
 *   filtered): `createInkSim` returns null when the GPU has neither.
 *
 * Runs in WebGL 1 or 2. Every pass leaves its own program, framebuffer and
 * viewport bound: whoever draws the dye restores theirs.
 */

import { createProgram, bindTriangle, VERTEX } from '../gl.js';
import { ADVECT, DIVERGENCE, PRESSURE, GRADIENT, CURL, VORTICITY, SPLAT } from './shaders.js';

/**
 * @typedef {import('../gl.js').GL} GL
 * @typedef {import('../gl.js').Program} Program
 */

/**
 * A texture and the framebuffer that draws into it.
 *
 * @typedef {object} Target
 * @property {WebGLFramebuffer} fbo The framebuffer.
 * @property {WebGLTexture} tex The texture.
 * @property {number} w Its width, texels.
 * @property {number} h Its height, texels.
 */

/**
 * Two targets, read from one and written to the other, then swapped.
 *
 * @typedef {object} Pair
 * @property {Target} read The one read this pass.
 * @property {Target} write The one written this pass.
 * @property {() => void} swap Swaps them.
 */

/**
 * A float texture format the GPU can render to and filter.
 *
 * @typedef {object} Format
 * @property {number} internal The internal format.
 * @property {number} type The texel type.
 */

/**
 * @typedef {object} InkSim
 * @property {(width: number, height: number) => void} resize Fits the grid to
 *   a canvas's shape; rebuilds (and reseeds) the sim if the grid changed.
 * @property {(dt: number) => void} step Advances the sim by `dt` seconds, emitters included.
 * @property {(x: number, y: number, dx: number, dy: number, dt: number) => void} stir
 *   Stirs the ink at a point (0–1 across, 0–1 up) by how far the pointer
 *   just moved (dx, dy, the same units) in `dt` seconds.
 * @property {(x: number, y: number) => void} drop Drops a dollop of ink at a
 *   point (0–1 across, 0–1 up), pushed out on every side so it blooms open.
 * @property {(frames: number) => void} warm Runs `frames` steps of 1/60 s at once.
 * @property {(unit: number) => [number, number]} bindDye Binds the dye to a
 *   texture unit, for the display; returns its texel size.
 * @property {() => void} destroy Frees its textures, framebuffers, programs and buffer.
 */

/** A drop: how many pushes ring it, how hard each pushes (grid cells a second), and how much ink it holds. */
const DROP_PUSHES = 6;
const DROP_PUSH = 40;
const DROP_INK = 0.55;

/** The ambient emitters: where they orbit, and where on the palette they sit. */
const EMITTERS = [
	{ cx: 0.22, cy: 0.35, rx: 0.18, ry: 0.28, speed: 0.28, phase: 0.0 },
	{ cx: 0.78, cy: 0.3, rx: 0.18, ry: 0.25, speed: 0.24, phase: 0.17 },
	{ cx: 0.25, cy: 0.7, rx: 0.2, ry: 0.24, speed: 0.32, phase: 0.34 },
	{ cx: 0.75, cy: 0.72, rx: 0.18, ry: 0.24, speed: 0.26, phase: 0.5 },
	{ cx: 0.5, cy: 0.5, rx: 0.32, ry: 0.28, speed: 0.2, phase: 0.67 },
	{ cx: 0.5, cy: 0.18, rx: 0.38, ry: 0.14, speed: 0.35, phase: 0.84 },
];

/** Where the first spread of ink is laid, 0–1 across and up. */
const SEEDS = [
	[0.15, 0.2], [0.5, 0.18], [0.85, 0.22], [0.12, 0.55], [0.45, 0.5], [0.8, 0.48],
	[0.2, 0.8], [0.55, 0.78], [0.88, 0.75], [0.35, 0.35], [0.65, 0.65], [0.5, 0.9],
];

/** Grid cells on the short side; the long side follows the aspect. */
const GRID = 80;
/** The dye lives on a finer grid than the velocity: sharper edges for the light to read. */
const DYE_SCALE = 3;
const PRESSURE_ITERATIONS = 6;
/** Velocity decays to this fraction per 1/60 s, dye to the other. */
const VELOCITY_KEEP = 0.989;
const DYE_KEEP = 0.9975;
const CURL_STRENGTH = 6;
/** How finely ink is striped as it is laid (the stripe pattern's frequency). */
const STRIPES = 110;

/**
 * The float formats this context offers for render targets, best first:
 * full float where it can be filtered, then half float.
 *
 * @param {GL} gl The context.
 * @returns {Format[]} The candidates (not yet proven complete).
 */
function floatFormats(gl) {
	/** @type {Format[]} */
	const formats = [];
	if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
		const color = gl.getExtension('EXT_color_buffer_float');
		if (color && gl.getExtension('OES_texture_float_linear')) formats.push({ internal: gl.RGBA32F, type: gl.FLOAT });
		if (color || gl.getExtension('EXT_color_buffer_half_float')) formats.push({ internal: gl.RGBA16F, type: gl.HALF_FLOAT });
		return formats;
	}
	const full = gl.getExtension('OES_texture_float');
	if (full && gl.getExtension('OES_texture_float_linear')) {
		gl.getExtension('WEBGL_color_buffer_float');
		formats.push({ internal: gl.RGBA, type: gl.FLOAT });
	}
	const half = gl.getExtension('OES_texture_half_float');
	if (half && gl.getExtension('OES_texture_half_float_linear')) {
		gl.getExtension('EXT_color_buffer_half_float');
		formats.push({ internal: gl.RGBA, type: half.HALF_FLOAT_OES });
	}
	return formats;
}

/**
 * Builds the sim, or returns null when this GPU cannot render to a float
 * (or half-float) texture it can also filter, or a pass will not compile.
 *
 * @param {GL} gl The context to draw with.
 * @returns {InkSim | null} The sim, or null.
 */
export function createInkSim(gl) {
	/**
	 * Makes a filtered, edge-clamped texture.
	 *
	 * @param {number} w Width, texels.
	 * @param {number} h Height, texels.
	 * @param {Format} format Its format.
	 * @returns {WebGLTexture} The texture.
	 */
	const makeTexture = (w, h, format) => {
		const tex = /** @type {WebGLTexture} */ (gl.createTexture());
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, format.internal, w, h, 0, gl.RGBA, format.type, null);
		return tex;
	};

	/**
	 * Makes a render target, if the framebuffer is complete with this format.
	 *
	 * @param {number} w Width, texels.
	 * @param {number} h Height, texels.
	 * @param {Format} format Its format.
	 * @returns {Target | null} The target, or null (nothing left allocated).
	 */
	const makeTarget = (w, h, format) => {
		const tex = makeTexture(w, h, format);
		const fbo = /** @type {WebGLFramebuffer} */ (gl.createFramebuffer());
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
		const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		if (!ok) {
			gl.deleteFramebuffer(fbo);
			gl.deleteTexture(tex);
			return null;
		}
		return { fbo, tex, w, h };
	};

	/**
	 * Frees a target.
	 *
	 * @param {Target | undefined} t The target, if there is one.
	 */
	const free = (t) => {
		if (!t) return;
		gl.deleteFramebuffer(t.fbo);
		gl.deleteTexture(t.tex);
	};

	const format = floatFormats(gl).find((candidate) => {
		const probe = makeTarget(4, 4, candidate);
		free(probe ?? undefined);
		return probe !== null;
	});
	if (!format) return null;

	/** @type {Program[]} */
	const programs = [];
	/**
	 * Compiles one pass, with the shared vertex shader.
	 *
	 * @param {string} fragment The pass's fragment shader.
	 * @returns {Program | null} The program, or null (the reason in the console).
	 */
	const link = (fragment) => {
		const program = createProgram(gl, VERTEX, fragment);
		if (program) programs.push(program);
		return program;
	};

	/**
	 * Deletes every program made, and the shaders in them.
	 */
	const freePrograms = () => {
		for (const { program } of programs) {
			gl.getAttachedShaders(program)?.forEach((shader) => gl.deleteShader(shader));
			gl.deleteProgram(program);
		}
	};

	const advectP = link(ADVECT);
	const divergenceP = link(DIVERGENCE);
	const pressureP = link(PRESSURE);
	const gradientP = link(GRADIENT);
	const curlP = link(CURL);
	const vorticityP = link(VORTICITY);
	const splatP = link(SPLAT);
	if (!advectP || !divergenceP || !pressureP || !gradientP || !curlP || !vorticityP || !splatP) {
		freePrograms();
		return null;
	}

	// One triangle that covers the target, bound again before each batch of passes.
	const triangle = bindTriangle(gl);

	/**
	 * Binds a texture to a unit and points a sampler at it.
	 *
	 * @param {Program} prog The program in use.
	 * @param {string} name The sampler.
	 * @param {number} unit The texture unit.
	 * @param {WebGLTexture} tex The texture.
	 */
	const bind = (prog, name, unit, tex) => {
		gl.uniform1i(prog.uniform(name), unit);
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, tex);
	};

	/** Draws the triangle: one pass. */
	const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

	/** @type {Pair} */
	let vel;
	/** @type {Pair} */
	let dye;
	/** @type {Pair} */
	let pres;
	/** @type {Target} */
	let div;
	/** @type {Target} */
	let curl;
	let simW = 0;
	let simH = 0;
	let simTime = 0;
	/** Where each emitter was last frame, for its direction of travel. */
	let last = EMITTERS.map((e) => ({ x: e.cx, y: e.cy }));

	/**
	 * Makes a target of the sim's format; it is known to be complete.
	 *
	 * @param {number} w Width, texels.
	 * @param {number} h Height, texels.
	 * @returns {Target} The target.
	 */
	const target = (w, h) => /** @type {Target} */ (makeTarget(w, h, format));

	/**
	 * Makes a read/write pair of targets.
	 *
	 * @param {number} w Width, texels.
	 * @param {number} h Height, texels.
	 * @returns {Pair} The pair.
	 */
	const pair = (w, h) => {
		/** @type {Pair} */
		const p = {
			read: target(w, h),
			write: target(w, h),
			swap() {
				[p.read, p.write] = [p.write, p.read];
			},
		};
		return p;
	};

	/**
	 * Draws into a target from here on.
	 *
	 * @param {Target} t The target.
	 */
	const to = (t) => {
		gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
		gl.viewport(0, 0, t.w, t.h);
	};

	/**
	 * Clears a target to nothing.
	 *
	 * @param {Target} t The target.
	 */
	const clear = (t) => {
		to(t);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
	};

	/**
	 * Sets a pass's `uTxl`, one velocity-grid cell in uv.
	 *
	 * @param {Program} prog The program in use.
	 */
	const txl = (prog) => gl.uniform2f(prog.uniform('uTxl'), 1 / simW, 1 / simH);

	/**
	 * Moves a field along the velocity, decaying it.
	 *
	 * @param {Pair} field The field.
	 * @param {number} diss What it keeps of itself this step.
	 * @param {number} dt The step, seconds.
	 */
	const advect = (field, diss, dt) => {
		gl.useProgram(advectP.program);
		to(field.write);
		bind(advectP, 'uVel', 0, vel.read.tex);
		bind(advectP, 'uQty', 1, field.read.tex);
		txl(advectP);
		gl.uniform1f(advectP.uniform('uDt'), dt);
		gl.uniform1f(advectP.uniform('uDiss'), diss);
		draw();
		field.swap();
	};

	/**
	 * Adds a soft round splat to a field.
	 *
	 * @param {Pair} field The field.
	 * @param {number} x Where, 0–1 across.
	 * @param {number} y Where, 0–1 up.
	 * @param {number} a What it adds to the first channel.
	 * @param {number} b What it adds to the second.
	 * @param {number} c What it adds to the third, laid in stripes.
	 * @param {number} radius Its size, in uv of the height.
	 * @param {number} [angle=0] The stripes' angle, radians.
	 */
	const splat = (field, x, y, a, b, c, radius, angle = 0) => {
		gl.useProgram(splatP.program);
		to(field.write);
		bind(splatP, 'uSrc', 0, field.read.tex);
		gl.uniform2f(splatP.uniform('uAt'), x, y);
		gl.uniform3f(splatP.uniform('uVal'), a, b, c);
		gl.uniform2f(splatP.uniform('uStripe'), angle, STRIPES);
		gl.uniform1f(splatP.uniform('uRad'), radius);
		gl.uniform1f(splatP.uniform('uAsp'), simW / simH);
		draw();
		field.swap();
	};

	/**
	 * Puts ink of one density and palette phase at a point, laid in stripes at `angle`.
	 *
	 * @param {number} x Where, 0–1 across.
	 * @param {number} y Where, 0–1 up.
	 * @param {number} density How much ink.
	 * @param {number} phase Where on the palette, 0–1.
	 * @param {number} radius Its size, in uv of the height.
	 * @param {number} [angle=0] The stripes' angle, radians.
	 */
	const ink = (x, y, density, phase, radius, angle = 0) => splat(dye, x, y, density, density * phase, density, radius, angle);

	/** Makes the velocity divergence-free: divergence, pressure solve, gradient subtracted. */
	const project = () => {
		gl.useProgram(divergenceP.program);
		to(div);
		bind(divergenceP, 'uVel', 0, vel.read.tex);
		txl(divergenceP);
		draw();

		clear(pres.read);
		clear(pres.write);
		for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
			gl.useProgram(pressureP.program);
			to(pres.write);
			bind(pressureP, 'uPres', 0, pres.read.tex);
			bind(pressureP, 'uDiv', 1, div.tex);
			txl(pressureP);
			draw();
			pres.swap();
		}

		gl.useProgram(gradientP.program);
		to(vel.write);
		bind(gradientP, 'uPres', 0, pres.read.tex);
		bind(gradientP, 'uVel', 1, vel.read.tex);
		txl(gradientP);
		draw();
		vel.swap();
	};

	/**
	 * Vorticity confinement: the curl, then a push along it.
	 *
	 * @param {number} dt The step, seconds.
	 */
	const vorticity = (dt) => {
		gl.useProgram(curlP.program);
		to(curl);
		bind(curlP, 'uVel', 0, vel.read.tex);
		txl(curlP);
		draw();

		gl.useProgram(vorticityP.program);
		to(vel.write);
		bind(vorticityP, 'uVel', 0, vel.read.tex);
		bind(vorticityP, 'uCurl', 1, curl.tex);
		txl(vorticityP);
		gl.uniform1f(vorticityP.uniform('uStrength'), CURL_STRENGTH);
		gl.uniform1f(vorticityP.uniform('uDt'), dt);
		draw();
		vel.swap();
	};

	/**
	 * The emitters: small orbiting sources that keep the whole field alive.
	 *
	 * @param {number} dt The step, seconds.
	 */
	const emit = (dt) => {
		const frames = dt * 60;
		EMITTERS.forEach((e, i) => {
			const x = Math.min(0.95, Math.max(0.05, e.cx + Math.cos(simTime * e.speed + e.phase * 6.28) * e.rx));
			const y = Math.min(0.95, Math.max(0.05, e.cy + Math.sin(simTime * e.speed * 0.73 + e.phase * 6.28 + 1.2) * e.ry));
			const dx = x - last[i].x;
			const dy = y - last[i].y;
			const len = Math.hypot(dx, dy) + 1e-6;
			const push = (8 + 3 * Math.sin(i * 2.1)) * frames;
			splat(vel, x, y, (dx / len) * push, (dy / len) * push, 0, 0.055);
			// Each drifts a little along the palette.
			const phase = (e.phase + 0.1 * Math.sin(simTime * 0.28 + i)) % 1;
			ink(x, y, Math.min(dt * 12, 0.16) * 0.65, phase < 0 ? phase + 1 : phase, 0.055, i * 1.9 + simTime * 0.15);
			last[i] = { x, y };
		});
	};

	/** A first spread of ink, so the field is not empty before the emitters catch up. */
	const seed = () => {
		SEEDS.forEach(([x, y], i) => {
			splat(vel, x, y, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 0, 0.1);
			ink(x, y, 0.5, (i / SEEDS.length + 0.05 * Math.random()) % 1, 0.1, Math.random() * 6.28);
		});
	};

	/** Frees every field (none on the first build). */
	const freeFields = () => {
		// The fields are unset until the first build.
		for (const p of [vel, dye, pres]) {
			if (!p) continue;
			free(p.read);
			free(p.write);
		}
		free(div);
		free(curl);
	};

	/**
	 * Makes every field at a grid size, clear, and seeds it.
	 *
	 * @param {number} w Grid width, cells.
	 * @param {number} h Grid height, cells.
	 */
	const build = (w, h) => {
		freeFields();
		simW = w;
		simH = h;
		vel = pair(w, h);
		dye = pair(w * DYE_SCALE, h * DYE_SCALE);
		pres = pair(w, h);
		div = target(w, h);
		curl = target(w, h);
		[vel.read, vel.write, dye.read, dye.write].forEach(clear);
		last = EMITTERS.map((e) => ({ x: e.cx, y: e.cy }));
		seed();
	};

	/**
	 * One step of the sim.
	 *
	 * @param {number} dt The step, seconds.
	 */
	const step = (dt) => {
		const frames = dt * 60;
		simTime += dt;
		advect(vel, Math.pow(VELOCITY_KEEP, frames), dt);
		vorticity(dt);
		emit(dt);
		project();
		advect(dye, Math.pow(DYE_KEEP, frames), dt);
	};

	return {
		resize(width, height) {
			const aspect = width / height;
			const w = aspect >= 1 ? Math.round(GRID * aspect) : GRID;
			const h = aspect >= 1 ? GRID : Math.round(GRID / aspect);
			if (w === simW && h === simH) return;
			bindTriangle(gl, triangle);
			build(w, h);
		},
		step(dt) {
			bindTriangle(gl, triangle);
			step(dt);
		},
		drop(x, y) {
			bindTriangle(gl, triangle);
			// A ring of pushes outward, so the drop opens rather than sitting there.
			for (let i = 0; i < DROP_PUSHES; i++) {
				const a = (i / DROP_PUSHES) * Math.PI * 2;
				splat(vel, x + Math.cos(a) * 0.015, y + Math.sin(a) * 0.015, Math.cos(a) * DROP_PUSH, Math.sin(a) * DROP_PUSH, 0, 0.03);
			}
			ink(x, y, DROP_INK, Math.random(), 0.06, Math.random() * Math.PI * 2);
		},
		stir(x, y, dx, dy, dt) {
			const len = Math.hypot(dx, dy);
			const speed = len / Math.max(dt, 1e-3);
			// No input, no ink: the eased pointer's tail dies out here.
			if (speed < 0.04) return;
			bindTriangle(gl, triangle);
			const strength = Math.min(speed * 3.3, 1);
			const frames = dt * 60;
			splat(vel, x, y, (dx / len) * strength * 25 * frames, (dy / len) * strength * 25 * frames, 0, 0.04);
			// Smaller and fainter than the ambient ink, and it fades as the hand slows.
			const phase = 0.5 + 0.5 * Math.sin(simTime * 0.4);
			ink(x, y, 0.06 * strength * frames, phase, 0.035, simTime * 0.7);
		},
		warm(frames) {
			bindTriangle(gl, triangle);
			for (let i = 0; i < frames; i++) step(1 / 60);
		},
		bindDye(unit) {
			gl.activeTexture(gl.TEXTURE0 + unit);
			gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
			return [1 / dye.read.w, 1 / dye.read.h];
		},
		destroy() {
			freeFields();
			freePrograms();
			gl.deleteBuffer(triangle);
		},
	};
}
