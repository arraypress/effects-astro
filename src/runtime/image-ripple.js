/**
 * @module @arraypress/effects-astro/image-ripple
 *
 * A photo under a skin of water. The pointer drags a wake through it and a
 * click drops a ring; the waves bend the photo as they pass, part its
 * colours a little at their fronts, and catch the light on their crests.
 * Then they die away, and the photo is left exactly as it was: still and
 * sharp.
 *
 * - The water is a height field on the GPU (height-field.js): a damped
 *   wave equation over a grid of square cells, soaked up at the edges.
 * - The photo is drawn through it (image.js), fitted like `object-fit`:
 *   each colour bent by the water's slope by its own amount, with a glint
 *   where a slope faces the light.
 *
 * Nothing runs while the water is calm: the photo is drawn once, and the
 * page's loop is joined only from the first stir to the moment the last
 * ripple has faded. With prefers-reduced-motion, without `interactive`,
 * without WebGL or float render targets, or when the photo cannot be read,
 * it removes its canvas and the plain photo under it shows.
 */

import { createStage } from './stage.js';
import { animate } from './loop.js';
import { isMobileGpu, prefersReducedMotion } from './device.js';
import { pointerIn, trail, pressAt } from './pointer.js';
import { loadImage, imageTexture, coverScale, GLSL_COVER } from './image.js';
import { createHeightField, GLSL_HEIGHT_FIELD, MAX_PUSHES } from './height-field.js';

/**
 * @typedef {object} ImageRippleConfig
 * @property {string} src The photo's URL (same origin, or served with CORS).
 * @property {number} [strength=1] How far the ripples bend the photo, 0–3.
 * @property {number} [size=1] How wide the ripples the pointer makes are, 0.3–3.
 * @property {number} [viscosity=1] How thick the water is: more settles sooner, with smaller ripples, 0.25–4.
 * @property {number} [fringe=1] How far the colours part at the wave fronts, 0–3; 0 for none.
 * @property {boolean} [interactive=true] Whether the pointer ripples it; false leaves the plain photo.
 * @property {'cover' | 'contain'} [fit='cover'] How the photo fills the element, as CSS `object-fit`.
 */

/** Simulation cells along the longer side (fewer on phones). */
const CELLS = 256;
const CELLS_MOBILE = 160;
/** Simulation steps a second, and the most in one frame. */
const RATE = 150;
const MAX_STEPS = 4;
/** The pointer's reach, element heights. */
const REACH = 0.022;
/** A stroke's push, per element height travelled. */
const STROKE = 30;
/** A dropped ring: how hard it pushes (a second), how fast it bobs and dies (s), and how long it lasts (s). */
const DROP = 36;
const DROP_PERIOD = 0.1;
const DROP_DECAY = 0.07;
const DROP_TIME = 0.32;
/** The most rings dropping at once. */
const MAX_DROPS = 6;
/** How far the slope bends the photo, element heights per unit of slope. */
const BEND = 0.0013;

/**
 * The step: the wave equation, pushes, and a band round the edge that soaks
 * the waves up, so they run on as if the water went past the frame.
 */
const STEP = `
precision highp float;
varying vec2 vUv;
${GLSL_HEIGHT_FIELD}
void main() {
	vec4 s = waveState(vUv);
	float v = s.y + waveForce(s) - wavePushes(vUv);
	float edge = min(min(vUv.x, 1.0 - vUv.x) * uAspect, min(vUv.y, 1.0 - vUv.y));
	v *= mix(0.86, uMotion.z, smoothstep(0.0, 0.06, edge));
	gl_FragColor = wavePack(s.x + v, v);
}
`;

/**
 * The render: the photo, through the water while there are waves. Red,
 * green and blue are bent by the slope by slightly different amounts, so
 * the colours part only where the water tilts (the wave fronts), and a soft
 * glint and a little shade follow the slopes that face towards and away
 * from a light at the top left. Flat water draws the photo untouched.
 */
const RENDER = `
precision highp float;
uniform vec2 uRes;
uniform sampler2D uPhoto;
uniform sampler2D uState;
uniform vec2 uStateTexel;
uniform vec2 uScale;
uniform float uAspect;
uniform float uReady;
uniform float uWaves;
uniform float uBend;
uniform float uFringe;
${GLSL_COVER}

// The photo at a point of the element (y up): transparent outside it, for 'contain'.
vec4 photo(vec2 uv) {
	vec2 t = coverUv(uv, uScale);
	t.y = 1.0 - t.y;
	vec2 inside = step(vec2(0.0), t) * step(t, vec2(1.0));
	return texture2D(uPhoto, t) * inside.x * inside.y;
}

void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	if (uReady < 0.5) { gl_FragColor = vec4(0.0); return; }
	if (uWaves < 0.5) { gl_FragColor = photo(uv); return; }
	vec2 s = uStateTexel;
	// The slope, per element height.
	vec2 g = vec2(
		texture2D(uState, uv + vec2(s.x, 0.0)).r - texture2D(uState, uv - vec2(s.x, 0.0)).r,
		texture2D(uState, uv + vec2(0.0, s.y)).r - texture2D(uState, uv - vec2(0.0, s.y)).r
	) / (2.0 * s * vec2(uAspect, 1.0));
	vec2 d = g * uBend / vec2(uAspect, 1.0);
	float f = 0.12 * uFringe;
	vec4 r = photo(uv - d * (1.0 - f));
	vec4 c = photo(uv - d);
	vec4 b = photo(uv - d * (1.0 + f));
	vec3 col = vec3(r.r, c.g, b.b);
	// Light from the top left: slopes facing it brighten, those turned away
	// darken a touch, and the steepest catch a glint. Flat water adds nothing.
	vec2 light = normalize(vec2(-0.6, 0.8));
	float facing = dot(g, light) * uBend * 60.0;
	float glint = pow(clamp(facing, 0.0, 1.0), 3.0);
	col *= 1.0 + clamp(facing, -0.5, 0.5) * 0.25;
	col += vec3(1.0, 0.98, 0.94) * glint * 0.22 * c.a;
	gl_FragColor = vec4(min(col, vec3(1.0)), c.a);
}
`;

/**
 * The texture-coordinate scale that fits a picture to a box the way CSS
 * `object-fit` does, for `coverUv`: `cover` crops it to fill the box,
 * `contain` shows all of it, with room to spare.
 *
 * @param {'cover' | 'contain' | string | undefined} fit How it fits; anything else is `cover`.
 * @param {number} imageAspect The picture's width over its height.
 * @param {number} boxAspect The box's width over its height.
 * @returns {[number, number]} The scale for x and y.
 */
export function fitScale(fit, imageAspect, boxAspect) {
	if (fit !== 'contain') return coverScale(imageAspect, boxAspect);
	return boxAspect > imageAspect ? [boxAspect / imageAspect, 1] : [1, imageAspect / boxAspect];
}

/**
 * How hard a dropped ring pushes the water at an age: the surface bobs
 * down and up a few times, each smaller than the last, so the drop sends
 * out a train of rings rather than one swell.
 *
 * @param {number} age Seconds since the drop.
 * @returns {number} The push, a second (negative lifts); 0 once it is spent.
 */
export function dropForce(age) {
	if (age < 0 || age >= DROP_TIME) return 0;
	return DROP * Math.sin((2 * Math.PI * age) / DROP_PERIOD) * Math.exp(-age / DROP_DECAY);
}

/**
 * How the water moves for a viscosity, and how long its waves take to fade
 * from a strong ring to far below a pixel's worth of bend.
 *
 * @param {number} viscosity How thick the water is (1 is the default).
 * @returns {{ motion: import('./height-field.js').WaveMotion, settle: number }} The motion per step, and the time to settle, ms.
 */
export function waterMotion(viscosity) {
	const thick = Math.max(0.1, viscosity);
	const keep = 1 - 0.006 * thick;
	return {
		motion: { speed: 0.3, spring: 0, keep, viscosity: Math.min(0.1, 0.02 * thick) },
		settle: Math.min(9000, (Math.log(0.002) / (RATE * Math.log(keep))) * 1000),
	};
}

/**
 * Starts the ripples on an element: its first canvas is drawn into, over
 * the photo the component puts under it.
 *
 * @param {HTMLElement} el The element.
 * @param {ImageRippleConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function imageRipple(el, config) {
	if (!config.src || config.interactive === false || prefersReducedMotion()) {
		el.querySelector('canvas')?.remove();
		return () => {};
	}
	const { motion, settle } = waterMotion(config.viscosity ?? 1);
	const strength = config.strength ?? 1;
	const reach = REACH * Math.max(0.2, config.size ?? 1);
	const pushes = new Float32Array(MAX_PUSHES * 4);
	let pushCount = 0;
	/** Rings dropping: where (0–1, y up) and how long since. */
	let drops = /** @type {{ x: number, y: number, age: number }[]} */ ([]);
	/** @type {import('./height-field.js').HeightField | null} */
	let water = null;
	/** @type {WebGLTexture | null} */
	let photo = null;
	let imageAspect = 1;
	let aspect = 1;
	let ready = false;
	/** Unregisters the frame callback; set while the water moves. */
	let stopLoop = /** @type {(() => void) | null} */ (null);
	let lastStir = 0;
	let backlog = 0;
	const path = trail(el, { step: 0.006 });

	/**
	 * Queues a push for the next step.
	 *
	 * @param {number} x Across, 0–1.
	 * @param {number} y Up, 0–1.
	 * @param {number} radius Its reach, element heights.
	 * @param {number} force How hard.
	 */
	const push = (x, y, radius, force) => {
		if (pushCount >= MAX_PUSHES) return;
		pushes.set([x * aspect, y, radius, force], pushCount * 4);
		pushCount++;
	};

	/**
	 * One frame while the water moves: the pointer's wake, the steps due,
	 * a draw, and sleep once the last ripple has faded.
	 *
	 * @param {number} now The time, ms.
	 * @param {number} dt Seconds since the last frame.
	 */
	const frame = (now, dt) => {
		if (!water || !stage) return;
		const time = dt || 1 / 60;
		const points = path.read(time);
		for (const p of points) {
			if (p.x < 0 || p.y < 0 || p.x > 1 || p.y > 1) continue;
			const speed = Math.hypot(p.dx * aspect, p.dy);
			push(p.x, p.y, reach, (STROKE * Math.min(speed, 3) * time) / points.length);
		}
		drops = drops.filter((d) => (d.age += time) < DROP_TIME);
		for (const d of drops) push(d.x, d.y, reach, dropForce(d.age) * time);
		if (pushCount) lastStir = now;
		backlog += time;
		let steps = 0;
		while (backlog >= 1 / RATE && steps < MAX_STEPS) {
			water.step(motion, pushes, steps === 0 ? pushCount : 0);
			backlog -= 1 / RATE;
			steps++;
		}
		if (steps === MAX_STEPS) backlog = 0;
		if (steps) pushCount = 0;
		if (now - lastStir > settle) {
			// Calm: what is left is far below a pixel. Flatten it and stop.
			water.clear();
			stopLoop?.();
			stopLoop = null;
		}
		stage.redraw();
	};

	/** Joins the page's loop, if the water was asleep. */
	const wake = () => {
		lastStir = performance.now();
		if (stopLoop || !ready) return;
		backlog = 0;
		path.reset();
		stopLoop = animate(el, frame);
	};

	/** A move over the photo wakes the water; the frames then follow the stroke. */
	const move = () => {
		if (!stopLoop && pointerIn(el).inside) wake();
	};

	/**
	 * A press drops a ring where it lands.
	 *
	 * @param {PointerEvent} e The press.
	 */
	const down = (e) => {
		const at = pressAt(el, e);
		if (!at || !ready) return;
		if (drops.length < MAX_DROPS) drops.push({ x: at.x, y: at.y, age: 0 });
		wake();
	};

	const { stage, stop } = createStage(el, {
		fragment: RENDER,
		alpha: true,
		// Drawn on demand: once at rest, and every frame only while the water moves.
		still: true,
		setup({ gl, uniform, program }) {
			water = createHeightField(gl, STEP);
			if (!water) return false;
			gl.useProgram(program);
			gl.uniform1i(uniform('uPhoto'), 1);
			gl.uniform1i(uniform('uState'), 2);
			gl.uniform1f(uniform('uBend'), BEND * strength);
			gl.uniform1f(uniform('uFringe'), config.fringe ?? 1);
			document.addEventListener('pointermove', move, { passive: true });
			document.addEventListener('pointerdown', down, { passive: true });
			return () => {
				document.removeEventListener('pointermove', move);
				document.removeEventListener('pointerdown', down);
				stopLoop?.();
				stopLoop = null;
				water?.dispose();
				water = null;
				gl.deleteTexture(photo);
			};
		},
		resize({ gl, uniform, canvas }) {
			aspect = canvas.width / canvas.height;
			gl.uniform1f(uniform('uAspect'), aspect);
			gl.uniform2fv(uniform('uScale'), fitScale(config.fit, imageAspect, aspect));
			// Last: it binds its own program.
			water?.resize(isMobileGpu() ? CELLS_MOBILE : CELLS, aspect);
		},
		uniforms({ gl, uniform }) {
			const waves = Boolean(water && stopLoop);
			gl.uniform1f(uniform('uReady'), ready ? 1 : 0);
			gl.uniform1f(uniform('uWaves'), waves ? 1 : 0);
			if (water && waves) {
				gl.activeTexture(gl.TEXTURE2);
				gl.bindTexture(gl.TEXTURE_2D, water.texture());
				gl.uniform2fv(uniform('uStateTexel'), water.texel());
			}
		},
	});
	if (!stage) return stop;

	loadImage(config.src)
		.then((image) => {
			if (!water) return;
			const { gl, uniform, program } = stage;
			gl.activeTexture(gl.TEXTURE1);
			photo = imageTexture(gl, image, { mipmap: true });
			imageAspect = image.naturalWidth / image.naturalHeight;
			gl.useProgram(program);
			gl.uniform2fv(uniform('uScale'), fitScale(config.fit, imageAspect, aspect));
			ready = true;
			stage.redraw();
		})
		.catch((error) => {
			// The plain photo stays.
			console.warn('[effects-astro]', error);
			stop();
			stage.canvas.remove();
		});

	return stop;
}
