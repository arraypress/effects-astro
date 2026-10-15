/**
 * @module @arraypress/effects-astro/ink-field
 *
 * Ink in water, lit by a lamp: a small fluid sim (./ink-field/sim.js) that
 * six slow emitters keep moving across the whole field, drawn as ink
 * (./ink-field/shaders.js) whose thickness stands as a surface the lamp
 * lights. The lamp follows the pointer and rests at the upper left; moving
 * the pointer pushes the ink aside and leaves a small, faint trail of its
 * own, and a still pointer does nothing. The field dims itself in the
 * middle, behind the copy.
 *
 * Adapted from Trirat's ink shader for LumiThemes (smoke-sim.ts and its
 * LumiField driver), with his twelve palettes. The sim, the display and
 * the driver's easing are his, unchanged.
 *
 * The colours change by setting the element's `data-colors` attribute to
 * JSON `{ "colors": [three hex], "glint": "hex" }` (see `setColors` in the
 * package index); the ink, already on screen, eases to them in about a
 * second, as the palette is applied when it is drawn.
 *
 * Drawn at half the pixel ratio by default and scaled up: the field is
 * soft. With prefers-reduced-motion (or `still`), the sim is run 240 steps
 * ahead and one frame held. Without a float render target the canvas is
 * removed and the palette's colours stand in, as still pools of light.
 */

import { createStage } from './stage.js';
import { VERTEX } from './gl.js';
import { parseColor } from './color.js';
import { canHover } from './device.js';
import { watchColors } from './mount.js';
import { pointerIn, pressAt } from './pointer.js';
import { colorPools } from './pools.js';
import { createInkSim } from './ink-field/sim.js';
import { DISPLAY } from './ink-field/shaders.js';

/**
 * @typedef {object} InkPalette
 * @property {[string, string, string]} colors The three colours the ink loops through, as CSS hex.
 * @property {string} glint A highlight colour, kept for `setColors` (the ink look does not use it).
 */

/**
 * @typedef {object} InkFieldConfig
 * @property {string} [palette='Lumetri'] One of the named palettes (INK_PALETTES; any case).
 * @property {string[]} [colors] Three colours as CSS hex, in place of the palette's.
 * @property {string} [glint] A glint colour, in place of the palette's (unused by the ink look).
 * @property {boolean} [interactive=true] The pointer stirs the ink and the lamp follows it (devices that hover).
 * @property {boolean} [drops=false] A press drops ink that blooms open (not on links, buttons or fields). Off by default: on a page-wide field, stray clicks would splash.
 * @property {{ x?: number, y?: number }} [lamp] Where the lamp rests, 0–1 from the top left. Default `{ x: 0.14, y: 0.14 }`.
 * @property {boolean} [still=false] Hold one frame of settled ink and never animate, as with reduced motion.
 * @property {number} [scale=0.5] Share of the pixel ratio drawn at.
 */

/**
 * The palettes by name: three colours each, chosen bright enough to stay
 * colour, not mud, where the ink thickens and deepens them.
 *
 * @type {Readonly<Record<string, InkPalette>>}
 */
export const INK_PALETTES = Object.freeze({
	Lumetri: { colors: ['#2532ef', '#0957ff', '#f69d03'], glint: '#FFFDCF' },
	Forest: { colors: ['#2c824a', '#4e3a3a', '#31625a'], glint: '#5d8d61' },
	Cadmium: { colors: ['#f15025', '#c9783a', '#303030'], glint: '#FF6B35' },
	Peacock: { colors: ['#18d2e3', '#092eff', '#03f6b9'], glint: '#5f7eee' },
	Vermillion: { colors: ['#e31818', '#931168', '#bd5d0e'], glint: '#ff0000' },
	Barbie: { colors: ['#ff0bce', '#1bfefe', '#2d026e'], glint: '#ff00ff' },
	Uranium: { colors: ['#aaff0b', '#4d7a60', '#1b1b1b'], glint: '#04ff00' },
	Azure: { colors: ['#066aff', '#0095ff', '#0062ff'], glint: '#0080ff' },
	Ruby: { colors: ['#ff0000', '#870000', '#3b475e'], glint: '#ff0000' },
	Ultramarine: { colors: ['#0044ff', '#561616', '#005fc4'], glint: '#0037ff' },
	Saffron: { colors: ['#ffb700', '#521212', '#ffcb53'], glint: '#ff8c00' },
	Crimson: { colors: ['#ff0000', '#173a71', '#4f0000'], glint: '#ff0000' },
});

/** The palette when none is named, or the name is not one. */
const DEFAULT_PALETTE = 'Lumetri';
/** The water's colour where there is no ink: the display adds it to every pixel. */
const GROUND = '#08080a';
/** Where the lamp rests without a pointer, 0–1 from the top left. */
const LAMP_REST = { x: 0.14, y: 0.14 };
/** Steps run ahead for the still frame, and the clock it is drawn at. */
const STILL_FRAMES = 240;
const STILL_TIME = 40;
/** Rebuilding the sim on every pixel of a window drag would thrash: wait this long, ms. */
const RESIZE_WAIT = 150;
/** The longest step the sim takes, seconds: after a stall it resumes rather than jumps. */
const MAX_STEP = 0.033;
/** Share of the way to its target the pointer eases, and the lamp, per 1/60 s. */
const POINTER_EASE = 0.06;
const LAMP_EASE = 0.035;
/** The colours' easing time constant, seconds: about a second to new colours. */
const COLOR_EASE = 0.35;

/**
 * A palette by name, in any case.
 *
 * @param {string | undefined} name The name.
 * @returns {InkPalette | undefined} The palette, or undefined when there is none by that name.
 */
export function inkPalette(name) {
	if (!name) return undefined;
	const key = Object.keys(INK_PALETTES).find((k) => k.toLowerCase() === String(name).toLowerCase());
	return key ? INK_PALETTES[key] : undefined;
}

/**
 * Three colours from a list, looped where it has fewer.
 *
 * @param {string[]} colors At least one colour.
 * @returns {string[]} Three colours.
 */
function three(colors) {
	return [0, 1, 2].map((i) => colors[i % colors.length]);
}

/**
 * The settings an ink field runs with: its colours (the named palette, or
 * the colours given over it) and every default filled in.
 *
 * @param {InkFieldConfig} [config] The config.
 * @returns {{ colors: string[], glint: string, lamp: { x: number, y: number }, interactive: boolean, drops: boolean, still: boolean, scale: number }}
 *   Three colours and a glint, the lamp's rest (0–1 from the top left), and the rest.
 */
export function inkFieldSettings(config = {}) {
	const palette = inkPalette(config.palette) ?? INK_PALETTES[DEFAULT_PALETTE];
	return {
		colors: config.colors?.length ? three(config.colors) : [...palette.colors],
		glint: config.glint ?? palette.glint,
		lamp: { x: config.lamp?.x ?? LAMP_REST.x, y: config.lamp?.y ?? LAMP_REST.y },
		interactive: config.interactive !== false,
		drops: config.drops === true,
		still: config.still === true,
		scale: config.scale ?? 0.5,
	};
}

/**
 * The stand-in without a float render target: the colours as still pools
 * of light on the water's colour.
 *
 * @param {string[]} colors The colours.
 * @returns {string} A CSS `background`.
 */
export function inkFallback(colors) {
	return colorPools(colors, GROUND);
}

/**
 * The colours as the display takes them: three, then the glint.
 *
 * @param {string[]} colors Three hex colours.
 * @param {string} glint A hex colour.
 * @returns {Float32Array} Twelve channels, 0–1.
 */
function channels(colors, glint) {
	return new Float32Array([...colors, glint].flatMap(parseColor));
}

/**
 * Starts an ink field on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {InkFieldConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function inkField(el, config) {
	if (config.palette && !inkPalette(config.palette)) {
		console.warn('[effects-astro]', `No ink palette "${config.palette}"; using ${DEFAULT_PALETTE}`);
	}
	const settings = inkFieldSettings(config);
	let glint = settings.glint;
	/** The colours drawn now, easing towards `target`. */
	const colours = channels(settings.colors, glint);
	/** @type {Float32Array} */
	let target = colours.slice();
	/** Where the lamp rests, 0–1, y up as the shader has it. */
	const rest = { x: settings.lamp.x, y: 1 - settings.lamp.y };
	/** The lamp now, easing towards the pointer or its rest. */
	const lamp = { ...rest };
	/** The eased pointer, and where it is headed, 0–1, y up. */
	const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
	/** True while the pointer is over the element; false, nothing stirs. */
	let pointing = false;
	const hover = settings.interactive && canHover();
	let clock = 0;
	let timer = 0;
	/** The canvas size the sim was last fitted to (0 before the first fit). */
	let fitted = { width: 0, height: 0 };
	/** @type {import('./ink-field/sim.js').InkSim | null} */
	let sim = null;

	const { stage, stop } = createStage(el, {
		fragment: DISPLAY,
		vertex: VERTEX,
		alpha: false,
		scale: settings.scale,
		still: settings.still,
		setup({ gl }) {
			const made = createInkSim(gl);
			if (!made) return false;
			sim = made;
			return () => {
				clearTimeout(timer);
				made.destroy();
			};
		},
		resize(s) {
			const current = sim;
			const { width, height } = s.canvas;
			// The observer's first report repeats the size the stage started at.
			if (!current || (width === fitted.width && height === fitted.height)) return;
			/** Fits the sim to the canvas's shape; a still field settles again. */
			const fit = () => {
				current.resize(width, height);
				if (s.still) current.warm(STILL_FRAMES);
			};
			// The first fit is now, before the first frame (the stage redraws a
			// still field straight after); later ones wait for the resizing to stop.
			const first = !fitted.width;
			fitted = { width, height };
			if (first) {
				fit();
				return;
			}
			clearTimeout(timer);
			timer = window.setTimeout(() => {
				fit();
				if (s.still) s.redraw();
			}, RESIZE_WAIT);
		},
		update({ still }, _now, frameDt) {
			if (still || !sim || !frameDt) return;
			const dt = Math.min(frameDt, MAX_STEP);
			clock += dt;

			// The pointer eases, by the clock; its inertia is the ink's input.
			if (hover) {
				const p = pointerIn(el);
				if (p.inside) {
					mouse.tx = p.x;
					mouse.ty = p.y;
					// Arriving (or coming back), the pointer starts where it is:
					// no streak across the field from wherever it left.
					if (!pointing) {
						mouse.x = mouse.tx;
						mouse.y = mouse.ty;
					}
				}
				pointing = p.inside;
				const k = 1 - Math.pow(1 - POINTER_EASE, dt * 60);
				const px = mouse.x;
				const py = mouse.y;
				mouse.x += (mouse.tx - mouse.x) * k;
				mouse.y += (mouse.ty - mouse.y) * k;
				sim.stir(mouse.x, mouse.y, mouse.x - px, mouse.y - py, dt);
			}

			// The lamp trails the pointer a little slower than the pointer trails the hand.
			const goal = pointing ? { x: mouse.tx, y: mouse.ty } : rest;
			const lampEase = 1 - Math.pow(1 - LAMP_EASE, dt * 60);
			lamp.x += (goal.x - lamp.x) * lampEase;
			lamp.y += (goal.y - lamp.y) * lampEase;

			// About a second to the new colours however fast the screen draws.
			const ease = 1 - Math.exp(-dt / COLOR_EASE);
			for (let i = 0; i < colours.length; i++) colours[i] += (target[i] - colours[i]) * ease;

			sim.step(dt);
		},
		uniforms({ gl, uniform, still }) {
			if (!sim) return;
			gl.uniform1i(uniform('uDye'), 0);
			const [tx, ty] = sim.bindDye(0);
			gl.uniform1f(uniform('uTime'), still ? STILL_TIME : clock);
			gl.uniform3fv(uniform('uPal'), colours.subarray(0, 9));
			gl.uniform3fv(uniform('uGlint'), colours.subarray(9, 12));
			gl.uniform2f(uniform('uDyeTxl'), tx, ty);
			const light = still ? rest : lamp;
			gl.uniform2f(uniform('uLight'), light.x, light.y);
		},
	});

	if (!stage) {
		// No WebGL, or no float render target: the colours, still.
		el.style.background = inkFallback(settings.colors);
		const unwatch = watchColors(el, (next) => {
			el.style.background = inkFallback(three(next.colors));
		});
		return () => {
			stop();
			unwatch();
		};
	}

	// New colours: the ink heads for them. Those set before it started are
	// its colours from the first frame; a still field takes them at once.
	let started = false;
	const unwatch = watchColors(el, (next) => {
		glint = next.glint ?? glint;
		target = channels(three(next.colors), glint);
		if (!started || stage.still) colours.set(target);
		if (stage.still && started) stage.redraw();
	});
	started = true;
	if (stage.still) stage.redraw();

	/**
	 * Drops ink where the element is pressed.
	 *
	 * @param {PointerEvent} e The press.
	 */
	const press = (e) => {
		const at = pressAt(el, e);
		if (at) sim?.drop(at.x, at.y);
	};
	const drops = settings.drops && !stage.still;
	if (drops) document.addEventListener('pointerdown', press, { passive: true });

	return () => {
		stop();
		unwatch();
		if (drops) document.removeEventListener('pointerdown', press);
	};
}
