/**
 * @module @arraypress/effects-astro/fluid
 *
 * A real fluid, simulated on the GPU: Jos Stam's Stable Fluids, after Pavel
 * Dobryakov's WebGL-Fluid-Simulation (MIT). WebGL 2 with half-float render
 * targets, which every current browser has.
 *
 * Two fields live in textures across the element: the velocity of the
 * fluid and the dye it carries. Each step swirls the velocity (vorticity
 * confinement keeps eddies alive after a stroke ends), makes it
 * incompressible (a pressure solve), then moves both fields along it and
 * lets them fade. `splat` pushes the fluid and drops dye at a point.
 *
 * `stir` connects a fluid to the pointer: strokes push it and leave a trace
 * of ink, clicks drop a bloom that bursts open and curls. Ink colours loop
 * through a palette, blended in Oklab.
 *
 * `step` and `splat` leave their own program, framebuffer and viewport
 * bound: whoever draws the fluid restores theirs before drawing. Every
 * program here reads its one attribute, `p`, at location 0.
 *
 * @example
 * const fluid = createFluid(gl);
 * fluid?.splat(0.5, 0.5, 300, 0, [0.4, 0.1, 0.9]);
 * fluid?.step(dt);
 * fluid?.bind(3, 4); // dye on unit 3, velocity on unit 4, for your shader
 */

import { createProgram, bindTriangle } from './gl.js';
import { paletteAt } from './color.js';
import { trail, pressAt, CLICK_IGNORE } from './pointer.js';
import { canHover } from './device.js';

/** The velocity grid, cells a side: the motion is smooth, so it can be coarse. */
const SIM = 128;
/** The dye grid, cells a side: finer, as the dye is what is seen. */
const DYE = 512;
const PRESSURE_ITERATIONS = 20;
/** Pressure carried into the next solve, a share of the last. */
const PRESSURE = 0.8;

/**
 * @typedef {import('./color.js').Rgb} Rgb
 */

/**
 * @typedef {object} FluidOptions
 * @property {number} [curl=28] Swirl kept alive between strokes (vorticity confinement).
 * @property {number} [velocityFade=0.25] How fast motion dies away, per second.
 * @property {number} [inkFade=0.55] How fast the dye fades, per second.
 * @property {number} [diffusion=0] How much the dye spreads and softens as it moves, 0–1.
 */

/**
 * @typedef {object} Fluid
 * @property {(x: number, y: number, dx: number, dy: number, dye: Rgb, radius?: number) => void} splat
 *   Pushes the fluid at a point (x 0–1 across, y 0–1 up) by (dx, dy), in
 *   velocity-grid cells a second, and adds dye there ([0, 0, 0] for none).
 *   `radius` is the splat's size, a share of the height (default 0.0025).
 * @property {(dt: number) => void} step Moves the fluid on by `dt` seconds.
 * @property {(dyeUnit: number, velocityUnit: number) => void} bind Binds the
 *   dye and the velocity to texture units, for another shader to sample.
 * @property {(aspect: number) => void} resize Tells it the target's width
 *   over height, so splats stay round.
 */

/** The vertex shader every pass shares: `vUv` and its four neighbours, one texel away. */
const VERT = `
precision highp float;
attribute vec2 p;
uniform vec2 texel;
varying vec2 vUv, vL, vR, vT, vB;
void main() {
	vUv = p * 0.5 + 0.5;
	vL = vUv - vec2(texel.x, 0.0);
	vR = vUv + vec2(texel.x, 0.0);
	vT = vUv + vec2(0.0, texel.y);
	vB = vUv - vec2(0.0, texel.y);
	gl_Position = vec4(p, 0.0, 1.0);
}
`;

/** The fragment shaders, one per pass. */
const PASSES = {
	splat: `
precision highp float;
varying vec2 vUv;
uniform sampler2D target;
uniform float aspect;
uniform vec3 colour;
uniform vec2 point;
uniform float radius;
void main() {
	vec2 d = vUv - point;
	d.x *= aspect;
	vec3 base = texture2D(target, vUv).xyz;
	gl_FragColor = vec4(base + exp(-dot(d, d) / radius) * colour, 1.0);
}`,
	advect: `
precision highp float;
varying vec2 vUv;
uniform sampler2D velocity;
uniform sampler2D source;
uniform vec2 velocityTexel;
uniform float dt;
uniform float dissipation;
void main() {
	vec2 from = vUv - dt * texture2D(velocity, vUv).xy * velocityTexel;
	gl_FragColor = texture2D(source, from) / (1.0 + dissipation * dt);
}`,
	curl: `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D velocity;
void main() {
	float l = texture2D(velocity, vL).y;
	float r = texture2D(velocity, vR).y;
	float t = texture2D(velocity, vT).x;
	float b = texture2D(velocity, vB).x;
	gl_FragColor = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
}`,
	vorticity: `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D velocity;
uniform sampler2D curl;
uniform float strength;
uniform float dt;
void main() {
	float l = texture2D(curl, vL).x;
	float r = texture2D(curl, vR).x;
	float t = texture2D(curl, vT).x;
	float b = texture2D(curl, vB).x;
	float c = texture2D(curl, vUv).x;
	vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
	force /= length(force) + 1e-4;
	force *= strength * c;
	force.y *= -1.0;
	vec2 v = texture2D(velocity, vUv).xy + force * dt;
	gl_FragColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}`,
	divergence: `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D velocity;
void main() {
	float l = texture2D(velocity, vL).x;
	float r = texture2D(velocity, vR).x;
	float t = texture2D(velocity, vT).y;
	float b = texture2D(velocity, vB).y;
	vec2 c = texture2D(velocity, vUv).xy;
	// The walls reflect: what would flow out comes back.
	if (vL.x < 0.0) l = -c.x;
	if (vR.x > 1.0) r = -c.x;
	if (vT.y > 1.0) t = -c.y;
	if (vB.y < 0.0) b = -c.y;
	gl_FragColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}`,
	diffuse: `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D source;
uniform float amount;
void main() {
	vec4 c = texture2D(source, vUv);
	vec4 around = (texture2D(source, vL) + texture2D(source, vR) + texture2D(source, vT) + texture2D(source, vB)) * 0.25;
	gl_FragColor = mix(c, around, amount);
}`,
	scale: `
precision highp float;
varying vec2 vUv;
uniform sampler2D source;
uniform float value;
void main() { gl_FragColor = value * texture2D(source, vUv); }`,
	pressure: `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D pressure;
uniform sampler2D divergence;
void main() {
	float l = texture2D(pressure, vL).x;
	float r = texture2D(pressure, vR).x;
	float t = texture2D(pressure, vT).x;
	float b = texture2D(pressure, vB).x;
	float div = texture2D(divergence, vUv).x;
	gl_FragColor = vec4((l + r + b + t - div) * 0.25, 0.0, 0.0, 1.0);
}`,
	gradient: `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D pressure;
uniform sampler2D velocity;
void main() {
	float l = texture2D(pressure, vL).x;
	float r = texture2D(pressure, vR).x;
	float t = texture2D(pressure, vT).x;
	float b = texture2D(pressure, vB).x;
	vec2 v = texture2D(velocity, vUv).xy - vec2(r - l, t - b);
	gl_FragColor = vec4(v, 0.0, 1.0);
}`,
};

/**
 * Sets a fluid up on a WebGL 2 context.
 *
 * @param {WebGL2RenderingContext} gl The context, shared with whatever draws the fluid.
 * @param {FluidOptions} [options] Its character.
 * @returns {Fluid | null} The fluid, or null where half-float targets cannot be drawn to.
 */
export function createFluid(gl, { curl = 28, velocityFade = 0.25, inkFade = 0.55, diffusion = 0 } = {}) {
	if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null;

	/** @type {Record<string, import('./gl.js').Program>} */
	const passes = {};
	for (const [name, fragment] of Object.entries(PASSES)) {
		const pass = createProgram(gl, VERT, fragment);
		if (!pass) return null;
		passes[name] = pass;
	}

	/**
	 * Makes one half-float target, cleared.
	 *
	 * @param {number} size Cells a side.
	 * @returns {{ texture: WebGLTexture, fbo: WebGLFramebuffer, size: number } | null}
	 *   The target, or null if it cannot be drawn to.
	 */
	const target = (size) => {
		const texture = /** @type {WebGLTexture} */ (gl.createTexture());
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, size, size, 0, gl.RGBA, gl.HALF_FLOAT, null);
		const fbo = /** @type {WebGLFramebuffer} */ (gl.createFramebuffer());
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
		gl.viewport(0, 0, size, size);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
		return { texture, fbo, size };
	};

	/**
	 * Makes a read/write pair of targets: read from one, write the other, swap.
	 *
	 * @param {number} size Cells a side.
	 * @returns {{ read: NonNullable<ReturnType<typeof target>>, write: NonNullable<ReturnType<typeof target>>, swap: () => void } | null}
	 *   The pair, or null if a target cannot be drawn to.
	 */
	const pair = (size) => {
		const a = target(size);
		const b = target(size);
		if (!a || !b) return null;
		const p = {
			read: a,
			write: b,
			swap() {
				[p.read, p.write] = [p.write, p.read];
			},
		};
		return p;
	};

	const velocity = pair(SIM);
	const dye = pair(DYE);
	const pressure = pair(SIM);
	const divergence = target(SIM);
	const curlField = target(SIM);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	if (!velocity || !dye || !pressure || !divergence || !curlField) return null;

	const triangle = bindTriangle(gl);
	let aspect = 1;

	/**
	 * Runs one pass into a target.
	 *
	 * @param {string} name The pass.
	 * @param {{ fbo: WebGLFramebuffer, size: number }} into Where it draws.
	 * @param {(u: (n: string) => WebGLUniformLocation | null, tex: (n: string, t: { texture: WebGLTexture }) => void) => void} set
	 *   Sets its uniforms; `tex` binds a target's texture to a sampler.
	 */
	const run = (name, into, set) => {
		const { program, uniform } = passes[name];
		gl.useProgram(program);
		let unit = 0;
		set(uniform, (n, t) => {
			gl.activeTexture(gl.TEXTURE0 + unit);
			gl.bindTexture(gl.TEXTURE_2D, t.texture);
			gl.uniform1i(uniform(n), unit++);
		});
		gl.uniform2f(uniform('texel'), 1 / into.size, 1 / into.size);
		gl.bindFramebuffer(gl.FRAMEBUFFER, into.fbo);
		gl.viewport(0, 0, into.size, into.size);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	};

	/**
	 * Adds a gaussian of a value to one field.
	 *
	 * @param {NonNullable<ReturnType<typeof pair>>} field The field.
	 * @param {number} x Across, 0–1.
	 * @param {number} y Up, 0–1.
	 * @param {Rgb} value What is added at the centre.
	 * @param {number} radius Its size.
	 */
	const stamp = (field, x, y, value, radius) => {
		run('splat', field.write, (u, tex) => {
			tex('target', field.read);
			gl.uniform1f(u('aspect'), aspect);
			gl.uniform2f(u('point'), x, y);
			gl.uniform3f(u('colour'), value[0], value[1], value[2]);
			gl.uniform1f(u('radius'), radius);
		});
		field.swap();
	};

	/**
	 * Advects one field along the velocity, fading it.
	 *
	 * @param {NonNullable<ReturnType<typeof pair>>} field The field.
	 * @param {number} dt Seconds.
	 * @param {number} fade Its fade, per second.
	 */
	const advect = (field, dt, fade) => {
		run('advect', field.write, (u, tex) => {
			tex('velocity', velocity.read);
			tex('source', field.read);
			gl.uniform2f(u('velocityTexel'), 1 / SIM, 1 / SIM);
			gl.uniform1f(u('dt'), dt);
			gl.uniform1f(u('dissipation'), fade);
		});
		field.swap();
	};

	return {
		splat(x, y, dx, dy, colour, radius = 0.0025) {
			bindTriangle(gl, triangle);
			// Wide targets stretch the field across: keep the splat round.
			const r = radius * Math.max(aspect, 1);
			stamp(velocity, x, y, [dx, dy, 0], r);
			if (colour[0] || colour[1] || colour[2]) stamp(dye, x, y, colour, r);
		},

		step(dt) {
			bindTriangle(gl, triangle);
			gl.disable(gl.BLEND);
			run('curl', curlField, (_, tex) => tex('velocity', velocity.read));
			run('vorticity', velocity.write, (u, tex) => {
				tex('velocity', velocity.read);
				tex('curl', curlField);
				gl.uniform1f(u('strength'), curl);
				gl.uniform1f(u('dt'), dt);
			});
			velocity.swap();
			run('divergence', divergence, (_, tex) => tex('velocity', velocity.read));
			run('scale', pressure.write, (u, tex) => {
				tex('source', pressure.read);
				gl.uniform1f(u('value'), PRESSURE);
			});
			pressure.swap();
			for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
				run('pressure', pressure.write, (_, tex) => {
					tex('pressure', pressure.read);
					tex('divergence', divergence);
				});
				pressure.swap();
			}
			run('gradient', velocity.write, (_, tex) => {
				tex('pressure', pressure.read);
				tex('velocity', velocity.read);
			});
			velocity.swap();
			advect(velocity, dt, velocityFade);
			advect(dye, dt, inkFade);
			// Diffusion: the dye bleeds into its neighbours, by the second.
			if (diffusion > 0) {
				run('diffuse', dye.write, (u, tex) => {
					tex('source', dye.read);
					gl.uniform1f(u('amount'), Math.min(1, diffusion * dt * 30));
				});
				dye.swap();
			}
		},

		bind(dyeUnit, velocityUnit) {
			gl.activeTexture(gl.TEXTURE0 + dyeUnit);
			gl.bindTexture(gl.TEXTURE_2D, dye.read.texture);
			gl.activeTexture(gl.TEXTURE0 + velocityUnit);
			gl.bindTexture(gl.TEXTURE_2D, velocity.read.texture);
		},

		resize(a) {
			aspect = a;
		},
	};
}

/**
 * @typedef {object} StirOptions
 * @property {Rgb[]} colors The ink's palette, looped through as it is laid.
 * @property {number} [force=1] How hard the pointer pushes the fluid.
 * @property {number} [trail=0.16] How much ink a stroke leaves, 0 for none.
 * @property {boolean} [drops=true] Whether a click or tap drops a bloom of ink.
 * @property {number} [radius=1] The size of a stroke's splats and of a drop, 1 as standard.
 * @property {string} [ignore] Clicks on these are theirs, not the fluid's (default: links, buttons,
 *   form fields and `[data-effect-ignore]`).
 */

/** How hard a stroke pushes at force 1: velocity added per element-size of travel. */
const PUSH = 5000;
/** Ink laid per 1% of the element's size travelled, at trail 1. */
const INK_PER_STEP = 0.3;

/**
 * Connects a fluid to the pointer over an element: strokes push it and leave
 * a trace of ink (with a hovering pointer), clicks and taps drop a bloom.
 *
 * @param {Fluid} fluid The fluid.
 * @param {HTMLElement} el The element it covers.
 * @param {StirOptions} options How it is stirred.
 * @returns {{ update: (dt: number) => void, setColors: (colors: Rgb[]) => void, destroy: () => void }}
 *   `update(dt)` lays the strokes since the last frame (call it before
 *   `fluid.step`); `setColors` changes the ink's palette; `destroy` stops listening.
 */
export function stir(fluid, el, options) {
	const {
		force = 1,
		trail: inkTrail = 0.16,
		drops = true,
		radius = 1,
		ignore = CLICK_IGNORE,
	} = options;
	let colors = options.colors;
	let along = Math.random();
	const strokes = canHover() ? trail(el) : null;

	/**
	 * The next colour of ink, a step further round the palette.
	 *
	 * @param {number} strength How much dye, 1 for a full drop.
	 * @returns {Rgb} The dye.
	 */
	const ink = (strength) => {
		along = (along + 0.006) % 1;
		const c = paletteAt(colors, along);
		return [c[0] * strength, c[1] * strength, c[2] * strength];
	};

	/**
	 * A drop of ink: a bloom of colour, and a ring of pushes outward with a
	 * turn to them, so it bursts open and curls.
	 *
	 * @param {PointerEvent} e The press.
	 */
	const drop = (e) => {
		const at = pressAt(el, e, ignore);
		if (!at) return;
		const { x, y } = at;
		const box = el.getBoundingClientRect();
		const aspect = box.width / box.height;
		fluid.splat(x, y, 0, 0, ink(1.1), 0.01 * radius);
		const spin = Math.random() < 0.5 ? 1 : -1;
		for (let k = 0; k < 8; k++) {
			const a = (k / 8) * Math.PI * 2;
			const cx = Math.cos(a);
			const cy = Math.sin(a);
			const vx = (cx - spin * cy * 0.7) * 520 * force;
			const vy = (cy + spin * cx * 0.7) * 520 * force;
			fluid.splat(x + (cx * 0.03 * radius) / aspect, y + cy * 0.03 * radius, vx / aspect, vy, [0, 0, 0], 0.003 * radius);
		}
	};
	if (drops) document.addEventListener('pointerdown', drop);

	return {
		update(dt) {
			if (!strokes) return;
			const time = dt || 1 / 60;
			const points = strokes.read(time);
			if (!points.length) return;
			// Ink and push go by the distance travelled, shared between the
			// stroke's splats, so a fast flick is a ribbon rather than a pile-up
			// and the amount is the same whatever the frame rate.
			const travel = Math.hypot(points[0].dx, points[0].dy) * time;
			const each = travel / points.length;
			for (const p of points) {
				/** @type {Rgb} */
				const dye = inkTrail > 0 ? ink(inkTrail * INK_PER_STEP * (each / 0.01)) : [0, 0, 0];
				const push = (PUSH * force * time) / points.length;
				fluid.splat(p.x, p.y, p.dx * push, p.dy * push, dye, 0.0025 * radius);
			}
		},
		setColors(next) {
			colors = next;
		},
		destroy() {
			document.removeEventListener('pointerdown', drop);
		},
	};
}
