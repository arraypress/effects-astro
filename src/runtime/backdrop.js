/**
 * @module @arraypress/effects-astro/backdrop
 *
 * Six animated backgrounds for a hero or a section, each one shader
 * tinted from the colour tokens it sits under: mesh-gradient, grain-gradient,
 * silk, band-lens, grid and waves. The shaders are in ./backdrops, one a
 * file.
 *
 * Colours: up to four. Those not given come from the live `--color-accent`
 * where the backdrop sits (a section can set its own): the accent itself, the accent 55% of the way to
 * `--color-bg` (a pale tint on a light page, a deep shade on a dark one),
 * the accent's hue turned +36°, and its hue turned −32° and lifted. They
 * are read when the effect starts, so a theme's accent tints every
 * backdrop with no settings, and again when `setColors` gives new ones.
 *
 * Each draws light whose alpha follows its brightness, so the page shows
 * through where it is dark. With `interactive`, it leans towards the
 * pointer.
 *
 * `static` draws one frame, at `frame` seconds, and never runs the loop:
 * for a backdrop that is wallpaper rather than a feature (a fixed,
 * full-page one is always in view, so it would otherwise never pause).
 * With prefers-reduced-motion, one frame at 0. Without WebGL, soft
 * gradients in the same colours stand in.
 *
 * Ported from @arraypress/effect-canvas-astro, which this replaces; its
 * fainter and plainer shaders were left behind (`<GlowField>` and `<Grain>`
 * do the plain glows and grain in CSS).
 */

import { createStage } from './stage.js';
import { parseColor, mixOklab } from './color.js';
import { canHover, prefersReducedMotion } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';
import { WAVES } from './backdrops/waves.js';
import { GRID } from './backdrops/grid.js';
import { MESH_GRADIENT } from './backdrops/mesh-gradient.js';
import { GRAIN_GRADIENT } from './backdrops/grain-gradient.js';
import { BAND_LENS } from './backdrops/band-lens.js';
import { SILK } from './backdrops/silk.js';
import { pickColors } from './palettes.js';

/** @typedef {import('./color.js').Rgb} Rgb */

/**
 * @typedef {'mesh-gradient' | 'grain-gradient' | 'silk' | 'band-lens' | 'grid' | 'waves'} BackdropName
 */

/**
 * @typedef {object} BackdropConfig
 * @property {BackdropName} effect Which backdrop.
 * @property {string[]} [colors] Up to four colours (hex or `rgb()`); those missing or unreadable come from `--color-accent`.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`. Its three colours and its glint as the fourth.
 * @property {number} [speed=1] How fast it moves, 0–4.
 * @property {number} [intensity=1] How strong it is (brightness and contrast, not opacity), 0–2.
 * @property {boolean} [static=false] One frame, never the loop: for a backdrop that is wallpaper.
 * @property {number} [frame=12] With `static`, the moment drawn, in seconds.
 * @property {boolean} [interactive=false] Lean towards the pointer (on devices that hover).
 */

/** Every backdrop's fragment shader, by name. */
export const BACKDROPS = {
	'mesh-gradient': MESH_GRADIENT,
	'grain-gradient': GRAIN_GRADIENT,
	silk: SILK,
	'band-lens': BAND_LENS,
	grid: GRID,
	waves: WAVES,
};

/** The accent when the page sets none: a bright green. */
const ACCENT = /** @type {Rgb} */ ([0, 0.89, 0.45]);
/** The page background when the page sets none. */
const PAGE = /** @type {Rgb} */ ([0, 0, 0]);
/** How far the smoothed pointer closes on the real one each frame. */
const EASE = 0.06;

/**
 * Reads a colour as the backdrops take it: hex (`#rgb`, `#rrggbb`) or
 * `rgb()` / `rgba()` with whole-number channels.
 *
 * @param {string} value The colour, as CSS writes it.
 * @returns {Rgb | null} Its channels, 0–1; null for anything else.
 */
export function readColor(value) {
	const s = String(value ?? '').trim();
	if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return parseColor(s);
	const rgb = s.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
	return rgb ? [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255] : null;
}

/**
 * Turns a colour's hue, keeping its saturation and lightness (in HSL).
 *
 * @param {Rgb} rgb The colour.
 * @param {number} deg Degrees to turn it by.
 * @returns {Rgb} The turned colour; a grey comes back as it was.
 */
export function hueRotate(rgb, deg) {
	const [r, g, b] = rgb;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return rgb;
	const d = max - min;
	const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	h = (((h / 6 + deg / 360) % 1) + 1) % 1;
	const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
	const p = 2 * l - q;
	/**
	 * One channel from its place on the hue circle.
	 *
	 * @param {number} t The place, in turns (wrapped).
	 * @returns {number} The channel, 0–1.
	 */
	const channel = (t) => {
		t = ((t % 1) + 1) % 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

/**
 * The four colours a backdrop is drawn in: those given, in order (any
 * that cannot be read are skipped), and the rest from the accent.
 *
 * @param {object} from Where they come from.
 * @param {string} [from.accent] The page's `--color-accent` (default a bright green).
 * @param {string} [from.background] The page's `--color-bg` (default black).
 * @param {string[]} [from.colors] Colours given, hex or `rgb()`.
 * @returns {[Rgb, Rgb, Rgb, Rgb]} The four colours.
 */
export function backdropPalette({ accent, background, colors = [] }) {
	const a = readColor(accent ?? '') ?? ACCENT;
	const bg = readColor(background ?? '') ?? PAGE;
	/** @type {[Rgb, Rgb, Rgb, Rgb]} */
	const derived = [
		a,
		mixOklab(a, bg, 0.55),
		hueRotate(a, 36),
		/** @type {Rgb} */ (hueRotate(a, -32).map((c) => Math.min(1, c * 1.2))),
	];
	const given = colors.map(readColor).filter((c) => c !== null);
	return /** @type {[Rgb, Rgb, Rgb, Rgb]} */ (derived.map((d, i) => given[i] ?? d));
}

/**
 * A number setting, clamped to its range.
 *
 * @param {unknown} value The setting.
 * @param {number} fallback Its default, for a missing or non-numeric one.
 * @param {number} min The lowest it may be.
 * @param {number} max The highest it may be.
 * @returns {number} The setting.
 */
function clamp(value, fallback, min, max) {
	const n = Number(value ?? fallback);
	return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/**
 * The settings that steer the shader, read and clamped.
 *
 * @param {Partial<BackdropConfig>} config The config.
 * @returns {{ speed: number, intensity: number, frame: number }} Speed (0–4),
 *   intensity (0–2) and the still frame, in seconds.
 */
export function backdropSettings(config) {
	return {
		speed: clamp(config.speed, 1, 0, 4),
		intensity: clamp(config.intensity, 1, 0, 2),
		frame: clamp(config.frame, 12, -Infinity, Infinity),
	};
}

/**
 * The stand-in without WebGL: two soft pools of the first and third
 * colours.
 *
 * @param {Rgb[]} palette The backdrop's colours.
 * @returns {string} A CSS `background`.
 */
export function fallbackBackground(palette) {
	/**
	 * A colour as CSS, at an alpha.
	 *
	 * @param {Rgb} c The colour.
	 * @param {number} alpha Its alpha.
	 * @returns {string} `rgba(…)`.
	 */
	const css = (c, alpha) => `rgba(${c.map((v) => Math.round(v * 255)).join(',')},${alpha})`;
	return [
		`radial-gradient(ellipse 55% 70% at 75% 25%, ${css(palette[0], 0.14)}, transparent 65%)`,
		`radial-gradient(ellipse 60% 70% at 20% 75%, ${css(palette[2], 0.1)}, transparent 65%)`,
	].join(',');
}

/**
 * The palette now: the accent and background tokens as the element sees
 * them (so a section can set its own), under the colours given.
 *
 * @param {HTMLElement} el The backdrop's element.
 * @param {string[] | undefined} colors Colours given.
 * @returns {[Rgb, Rgb, Rgb, Rgb]} The four colours.
 */
function livePalette(el, colors) {
	const styles = getComputedStyle(el);
	return backdropPalette({
		accent: styles.getPropertyValue('--color-accent'),
		background: styles.getPropertyValue('--color-bg'),
		colors,
	});
}

/**
 * Starts a backdrop on an element: a canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {BackdropConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function backdrop(el, config) {
	const fragment = BACKDROPS[config.effect];
	if (!fragment) {
		console.warn('[effects-astro]', `No backdrop "${config.effect}"`);
		return () => {};
	}
	const { speed, intensity, frame } = backdropSettings(config);
	const reduced = prefersReducedMotion();
	let palette = livePalette(el, pickColors(config, [], (p) => [...p.colors, p.glint]));
	const start = performance.now();
	const mouse = { x: 0.5, y: 0.5 };

	/**
	 * The shader's clock at a moment.
	 *
	 * @param {number} now The time, ms.
	 * @returns {number} Seconds since the start, times the speed.
	 */
	const clock = (now) => ((now - start) / 1000) * speed;


	const { stage, stop } = createStage(el, {
		fragment,
		still: config.static === true,
		uniforms({ gl, uniform, still }, now) {
			if (!still && config.interactive && canHover()) {
				const p = pointerIn(el);
				mouse.x += ((p.inside ? p.x : 0.5) - mouse.x) * EASE;
				mouse.y += ((p.inside ? p.y : 0.5) - mouse.y) * EASE;
			}
			gl.uniform1f(uniform('uTime'), reduced ? 0 : still ? frame : clock(now));
			gl.uniform2f(uniform('uMouse'), still ? 0.5 : mouse.x, still ? 0.5 : mouse.y);
			gl.uniform1f(uniform('uIntensity'), intensity);
			palette.forEach((c, i) => gl.uniform3fv(uniform(`uColor${i + 1}`), c));
		},
	});
	if (!stage) {
		el.style.background = fallbackBackground(palette);
		return stop;
	}


	const unwatch = watchColors(el, (next) => {
		palette = livePalette(el, next.colors);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
