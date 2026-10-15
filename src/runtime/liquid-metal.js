/**
 * @module @arraypress/effects-astro/liquid-metal
 *
 * A logo made of liquid chrome. At rest it is a still, polished slab of
 * metal with rounded edges, reflecting a studio that turns slowly round
 * it, so its reflections glide. Touch it and it behaves like liquid
 * metal: the pointer dents it and ripples run out from the dent; a stroke
 * through it parts it, and it flows back behind; a click splashes it, a
 * crater with a ring wave and droplets thrown out that fall and find their
 * way back in. After any of it, surface tension pulls it back into the
 * logo's exact shape, with a last small wobble.
 *
 * - The shape is a distance field (src/runtime/shape.js) over the logo's
 *   box: its bevel, and the rest the metal returns to.
 * - The surface is a wave simulation on the GPU (liquid-metal/wave.js, on
 *   height-field.js): heights and speeds over the box, a damped wave
 *   equation with a spring back to rest. The waves tilt the surface and
 *   move its outline.
 * - The droplets are worked out on the CPU (liquid-metal/beads.js).
 * - The chrome is a reflection of a studio made in the shader
 *   (liquid-metal/shaders.js): sky, horizon, floor, softboxes and a key
 *   light, with Fresnel, the metal's colour (`tint`) and a palette's tint.
 *
 * Transparent round the logo, with a soft shadow under it. The simulation
 * sleeps once the metal has settled, and only the render runs. With
 * prefers-reduced-motion it draws one still frame; without float render
 * targets it is the still, turning chrome with nothing to push. Without
 * WebGL it removes its canvas.
 */

import { createStage } from './stage.js';
import { drawShape, distanceField, blurField } from './shape.js';
import { canHover, isMobileGpu } from './device.js';
import { pointerIn, trail, pressAt } from './pointer.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';
import { RENDER, MAX_BEADS } from './liquid-metal/shaders.js';
import { MAX_PUSHES } from './height-field.js';
import { createWave } from './liquid-metal/wave.js';
import { createField } from './liquid-metal/field.js';
import { fieldSampler, splash, stepBeads, packBeads } from './liquid-metal/beads.js';
import { metalColor, studioTints } from './liquid-metal/look.js';

/**
 * @typedef {object} LiquidMetalConfig
 * @property {string} [text] A word to make of metal.
 * @property {string} [font] Its CSS font, without the size (default: the page's, bold).
 * @property {string} [src] An image (an SVG logo) to make of metal instead.
 * @property {{ x: number, y: number, width: number, height: number }} [area]
 *   Where the logo sits, each 0–1 from the top left (default: the right half).
 * @property {number} [size=1] How much of its area the logo fills: 1 fits it, less shrinks it about the area's middle.
 * @property {string} [tint='chrome'] The metal: `chrome`, `gold`, `rose-gold`, `copper`, `black-chrome`, or a CSS hex colour.
 * @property {string[]} [colors] The studio's colours, reflected in the metal: the sky, the horizon, the floor (default a neutral studio).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`: it tints the studio.
 * @property {number} [bevel=1] How wide its rounded edges are.
 * @property {number} [viscosity=1] How thick the metal is: more settles sooner, with smaller ripples.
 * @property {number} [tension=1] How hard it pulls back into shape: more reforms sooner, with a quicker wobble.
 * @property {number} [ripple=1] How hard the pointer pushes into it.
 * @property {boolean} [interactive=true] Whether it reacts to the pointer at all.
 * @property {number} [shadow=1] The soft shadow under it; 0 for none.
 */

/** Where the logo sits by default: the right half, so copy can sit on the left. */
const AREA = { x: 0.46, y: 0.08, width: 0.5, height: 0.84 };
/** The margin round the logo the simulation covers (room for swells and droplets), a share of its smaller side. */
const MARGIN = 0.14;
/** The rounded edge's width, a share of the logo's height. */
const BEVEL = 0.07;
/** The distance field's width at most, pixels: it is smooth, so the GPU's filtering does the rest. */
const FIELD = 1024;
/** Simulation cells along the box's longer side. */
const CELLS = 256;
const CELLS_MOBILE = 160;
/** Simulation steps a second, and the most in one frame. */
const RATE = 180;
const MAX_STEPS = 6;
/** How long the surface runs after the last touch before it sleeps, ms. */
const SETTLE = 7000;
/** The pointer's reach, box heights. */
const REACH = 0.035;
/** Pushes, per frame at 60 fps: a hovering pointer, a pressed one, a stroke (per box height travelled), a click, a landing droplet (per box height of its radius). */
const HOVER = 0.0035;
const PRESS = 0.016;
const STROKE = 4;
const CLICK = 0.42;
const LAND = 7;
/** Droplets a click throws (fewer on phones). */
const DROPLETS = 14;
/** How fast the studio turns, radians a second. */
const SPIN = 0.05;

/**
 * The logo's box: its area (scaled by `size` about its middle), grown by a
 * margin for the swells and droplets, and kept on the canvas.
 *
 * @param {{ x: number, y: number, width: number, height: number }} area Where the logo sits, 0–1 from the top left.
 * @param {number} size How much of its area it fills.
 * @param {number} width The canvas's width, pixels.
 * @param {number} height The canvas's height, pixels.
 * @returns {{ left: number, top: number, width: number, height: number, shape: { x: number, y: number, width: number, height: number } }}
 *   The box in canvas pixels from the top left, and the logo's area as a share of the box.
 */
export function logoBox(area, size, width, height) {
	const cx = (area.x + area.width / 2) * width;
	const cy = (area.y + area.height / 2) * height;
	const w = area.width * width * size;
	const h = area.height * height * size;
	const margin = Math.min(w, h) * MARGIN;
	const left = Math.max(0, Math.floor(cx - w / 2 - margin));
	const top = Math.max(0, Math.floor(cy - h / 2 - margin));
	const boxWidth = Math.max(1, Math.min(width, Math.ceil(cx + w / 2 + margin)) - left);
	const boxHeight = Math.max(1, Math.min(height, Math.ceil(cy + h / 2 + margin)) - top);
	return {
		left,
		top,
		width: boxWidth,
		height: boxHeight,
		shape: { x: (cx - w / 2 - left) / boxWidth, y: (cy - h / 2 - top) / boxHeight, width: w / boxWidth, height: h / boxHeight },
	};
}

/**
 * Starts liquid metal on an element: a transparent canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {LiquidMetalConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function liquidMetal(el, config) {
	let tints = studioTints(pickColors(config, []));
	const ripple = config.ripple ?? 1;
	const viscosity = config.viscosity ?? 1;
	const motion = {
		speed: 0.3,
		spring: 0.0045 * (config.tension ?? 1),
		keep: 1 - 0.01 * viscosity,
		viscosity: Math.min(0.2, 0.05 * viscosity),
	};
	const start = performance.now();
	/** @type {import('./liquid-metal/wave.js').Wave | null} */
	let wave = null;
	/** @type {import('./liquid-metal/field.js').Field | null} */
	let field = null;
	/** @type {import('./liquid-metal/beads.js').FieldSampler | null} */
	let sample = null;
	/** @type {import('./liquid-metal/beads.js').Bead[]} */
	let beads = [];
	const packed = new Float32Array(MAX_BEADS * 4);
	const pushes = new Float32Array(MAX_PUSHES * 4);
	let pushCount = 0;
	/** The box, as a share of the canvas (from the bottom left), and its size in pixels. */
	const box = { x: 0, y: 0, w: 1, h: 1, px: 1, aspect: 1 };
	let pressed = false;
	let awake = false;
	let lastStir = 0;
	let backlog = 0;
	/** Bumped on each new layout, so a slow shape drawn for an old one is dropped. */
	let generation = 0;
	/** The layout the shape was last drawn for, and the field's width then. */
	const built = { layout: '', width: 0 };
	const path = trail(el, { step: 0.008 });

	/**
	 * Queues a push for the next step.
	 *
	 * @param {number} x Across, box heights.
	 * @param {number} y Up, box heights.
	 * @param {number} radius Its reach, box heights.
	 * @param {number} strength How hard.
	 */
	const push = (x, y, radius, strength) => {
		if (pushCount >= MAX_PUSHES) return;
		pushes.set([x, y, radius, strength], pushCount * 4);
		pushCount++;
	};

	/**
	 * A point on the element in box heights.
	 *
	 * @param {number} x Across the element, 0–1.
	 * @param {number} y Up the element, 0–1.
	 * @returns {{ x: number, y: number } | null} The point, or null outside the box.
	 */
	const toBox = (x, y) => {
		const u = (x - box.x) / box.w;
		const v = (y - box.y) / box.h;
		return u < 0 || v < 0 || u > 1 || v > 1 ? null : { x: u * box.aspect, y: v };
	};

	/**
	 * A press: a splash where it lands on the metal, and the metal held
	 * down while the button is.
	 *
	 * @param {PointerEvent} e The press.
	 */
	const down = (e) => {
		const at = pressAt(el, e);
		const point = at && toBox(at.x, at.y);
		if (!point || !sample || sample(point.x, point.y).d < -0.02) return;
		pressed = true;
		push(point.x, point.y, REACH * 1.7, CLICK * ripple);
		const room = MAX_BEADS - beads.length;
		beads.push(...splash(point.x, point.y, Math.min(room, isMobileGpu() ? DROPLETS / 2 : DROPLETS), Math.min(1.5, ripple)));
	};
	/** The button let go. */
	const up = () => {
		pressed = false;
	};

	const { stage, stop } = createStage(el, {
		fragment: RENDER,
		alpha: true,
		setup({ gl, uniform, still }) {
			field = createField(gl);
			// A flat surface, for when there is no simulation.
			const flat = gl.createTexture();
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, flat);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));

			gl.uniform1i(uniform('uSdf'), 1);
			gl.uniform1i(uniform('uState'), 2);
			gl.uniform1f(uniform('uSpread'), 0.1);
			gl.uniform3fv(uniform('uMetal'), metalColor(config.tint));
			gl.uniform1f(uniform('uShadow'), config.shadow ?? 1);
			gl.uniform1f(uniform('uWave'), 0.5);

			const interactive = config.interactive !== false && !still;
			if (interactive) {
				wave = createWave(gl);
				if (wave) {
					document.addEventListener('pointerdown', down, { passive: true });
					document.addEventListener('pointerup', up, { passive: true });
					document.addEventListener('pointercancel', up, { passive: true });
				}
			}
			return () => {
				document.removeEventListener('pointerdown', down);
				document.removeEventListener('pointerup', up);
				document.removeEventListener('pointercancel', up);
				wave?.dispose();
				wave = null;
				field?.dispose();
				gl.deleteTexture(flat);
			};
		},
		resize({ gl, uniform, canvas, program }) {
			const area = config.area ?? AREA;
			const fit = logoBox(area, config.size ?? 1, canvas.width, canvas.height);
			const aspect = fit.width / fit.height;
			Object.assign(box, {
				x: fit.left / canvas.width,
				y: 1 - (fit.top + fit.height) / canvas.height,
				w: fit.width / canvas.width,
				h: fit.height / canvas.height,
				px: fit.height,
				aspect,
			});
			gl.uniform4f(uniform('uBox'), box.x, box.y, box.w, box.h);
			gl.uniform1f(uniform('uAspect'), aspect);
			gl.uniform1f(uniform('uPx'), 1 / fit.height);
			// The horizon crosses a little above the logo's middle, and the
			// face's reflection sweeps about a third of the way to the zenith.
			gl.uniform2f(uniform('uCentre'), (fit.shape.x + fit.shape.width / 2) * aspect, 1 - (fit.shape.y + fit.shape.height * 0.45));
			gl.uniform1f(uniform('uLens'), 0.6 / fit.shape.height);
			const width = Math.min(isMobileGpu() ? FIELD / 2 : FIELD, fit.width);
			const height = Math.max(1, Math.round((width * fit.height) / fit.width));
			// Only the pixel density changed (the stage easing its resolution on a
			// slow GPU): the shape, the surface and the droplets all live in the
			// box, so they stay as they are, unless the field is now too coarse.
			const layout = [box.x, box.y, box.w, box.h].map((v) => v.toFixed(3)).join();
			if (layout === built.layout && width <= built.width * 1.25) return;
			built.layout = layout;
			built.width = width;
			const bevel = BEVEL * fit.shape.height * (config.bevel ?? 1);
			const spread = Math.max(bevel * 3, 0.06);
			wave?.resize(isMobileGpu() ? CELLS_MOBILE : CELLS, aspect);
			awake = false;
			beads = [];
			sample = null;
			const mine = ++generation;
			drawShape({ text: config.text, font: config.font, src: config.src, area: fit.shape, padding: 0.06 }, width, height)
				.then((mask) => {
					if (mine !== generation) return;
					const sdf = blurField(distanceField(mask, Math.max(2, Math.round(spread * height))), width, height, width / 400);
					field?.upload(sdf, width, height);
					sample = fieldSampler(sdf, width, height, spread, aspect);
					wave?.shape({ spread, bevel, bulge: bevel * 1.6 });
					gl.useProgram(program);
					gl.uniform2f(uniform('uSdfTexel'), 1 / width, 1 / height);
					gl.uniform1f(uniform('uSpread'), spread);
					gl.uniform1f(uniform('uBevel'), bevel);
					gl.uniform1f(uniform('uBulge'), bevel * 1.6);
					if (stage?.still) stage.redraw();
				})
				.catch((error) => console.warn('[effects-astro]', error));
		},
		update({ canvas }, now, dt) {
			if (!wave || !sample) return;
			const time = dt || 1 / 60;
			const frame = time * 60;
			const shape = sample;
			// Strokes: dents along the path, by how far and how fast the pointer went.
			const points = path.read(time);
			for (const p of points) {
				const at = toBox(p.x, p.y);
				if (!at) continue;
				const speed = Math.hypot(p.dx * canvas.width, p.dy * canvas.height) / box.px;
				push(at.x, at.y, REACH, (ripple * STROKE * Math.min(speed, 4) * time) / points.length);
			}
			// The pointer resting on it presses a dimple; held down, a deep one.
			const p = pointerIn(el);
			const at = p.inside && (pressed || canHover()) ? toBox(p.x, p.y) : null;
			if (at && shape(at.x, at.y).d > -REACH) push(at.x, at.y, REACH * (pressed ? 1.2 : 1), ripple * (pressed ? PRESS : HOVER) * frame);
			// Droplets in the air or crawling home; each one landing ripples where it lands.
			beads = stepBeads(beads, time, shape, box.aspect, (x, y, size) => push(x, y, size * 2.4, ripple * LAND * size));

			if (pushCount || beads.length) {
				awake = true;
				lastStir = now;
			} else if (awake && now - lastStir > SETTLE) {
				// Settled: flatten what is left (far below a pixel) and let the simulation sleep.
				awake = false;
				wave.clear();
			}
			if (!awake) {
				backlog = 0;
				return;
			}
			backlog += time;
			let steps = 0;
			while (backlog >= 1 / RATE && steps < MAX_STEPS) {
				wave.step(motion, pushes, steps === 0 ? pushCount : 0);
				backlog -= 1 / RATE;
				steps++;
			}
			if (steps === MAX_STEPS) backlog = 0;
			if (steps) pushCount = 0;
		},
		uniforms({ gl, uniform, still }, now) {
			gl.activeTexture(gl.TEXTURE2);
			if (wave && awake) gl.bindTexture(gl.TEXTURE_2D, wave.texture());
			gl.uniform1f(uniform('uWaves'), wave && awake ? 1 : 0);
			if (wave) gl.uniform2fv(uniform('uStateTexel'), wave.texel());
			// A still frame is taken where a softbox lies across the face.
			gl.uniform1f(uniform('uSpin'), still ? 0.35 : ((now - start) / 1000) * SPIN);
			gl.uniform3fv(uniform('uSky'), tints[0]);
			gl.uniform3fv(uniform('uBand'), tints[1]);
			gl.uniform3fv(uniform('uFloor'), tints[2]);
			const count = packBeads(beads, packed);
			gl.uniform1i(uniform('uBeadCount'), count);
			if (count) gl.uniform4fv(uniform('uBeads'), packed);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		tints = studioTints(next.colors);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
