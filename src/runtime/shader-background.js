/**
 * @module @arraypress/effects-astro/shader-background
 *
 * Six animated backgrounds for a hero or a section, each one shader
 * tinted from the colour tokens it sits under: mesh-gradient, grain-gradient,
 * silk, band-lens, grid and waves. The shaders are in ./shader-backgrounds, one a
 * file.
 *
 * Colours: up to four. Those not given come from the live `--color-accent`
 * where the shader background sits (a section can set its own): the accent itself, the accent 55% of the way to
 * `--color-bg` (a pale tint on a light page, a deep shade on a dark one),
 * the accent's hue turned 30° towards yellow and lifted, and its hue
 * turned 45° away from yellow (turned in Oklab, towards the lightness where
 * each new hue is most vivid; yellows only glow when light). They
 * are read when the effect starts, so a theme's accent tints every
 * shader background with no settings, and again when `setColors` gives new ones.
 *
 * Each draws light whose alpha follows its brightness, so the page shows
 * through where it is dark. With `interactive`, it leans towards the
 * pointer.
 *
 * `static` draws one frame, at `frame` seconds, and never runs the loop:
 * for a shader background that is wallpaper rather than a feature (a fixed,
 * full-page one is always in view, so it would otherwise never pause).
 * With prefers-reduced-motion, one frame at 0. Without WebGL, soft
 * gradients in the same colours stand in.
 *
 * Ported from @arraypress/effect-canvas-astro, which this replaces; its
 * fainter and plainer shaders were left behind (`<GlowField>` and `<Grain>`
 * do the plain glows and grain in CSS).
 */

import { createStage } from './stage.js';
import { parseColor, mixOklab, toOklab, turnHue } from './color.js';
import { canHover, prefersReducedMotion } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';
import { WAVES } from './shader-backgrounds/waves.js';
import { GRID } from './shader-backgrounds/grid.js';
import { MESH_GRADIENT } from './shader-backgrounds/mesh-gradient.js';
import { GRAIN_GRADIENT } from './shader-backgrounds/grain-gradient.js';
import { BAND_LENS } from './shader-backgrounds/band-lens.js';
import { SILK } from './shader-backgrounds/silk.js';
import { pickColors } from './palettes.js';

/** @typedef {import('./color.js').Rgb} Rgb */

/**
 * @typedef {'mesh-gradient' | 'grain-gradient' | 'silk' | 'band-lens' | 'grid' | 'waves'} ShaderBackgroundName
 */

/**
 * @typedef {object} ShaderBackgroundConfig
 * @property {ShaderBackgroundName} effect Which shader background.
 * @property {string[]} [colors] Up to four colours (hex or `rgb()`); those missing or unreadable come from `--color-accent`.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`. Its three colours and its glint as the fourth.
 * @property {number} [speed=1] How fast it moves, 0–4.
 * @property {number} [intensity=1] How strong it is (brightness and contrast, not opacity), 0–2.
 * @property {boolean} [static=false] One frame, never the loop: for a shader background that is wallpaper.
 * @property {number} [frame=12] With `static`, the moment drawn, in seconds.
 * @property {boolean} [interactive=false] Lean towards the pointer (on devices that hover).
 */

/** Every shader background's fragment shader, by name. */
export const SHADER_BACKGROUNDS = {
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
/** Yellow's hue in Oklab, degrees. */
const YELLOW = 110;
/** How far the third colour turns from the accent's hue, towards yellow, degrees. */
const TOWARD = 30;
/** How far the fourth turns, away from yellow, degrees. */
const AWAY = 45;
/** How far the smoothed pointer closes on the real one each frame. */
const EASE = 0.06;

/**
 * Reads a colour as the shader backgrounds take it: hex (`#rgb`, `#rrggbb`) or
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
 * The four colours a shader background is drawn in: those given, in order (any
 * that cannot be read are skipped), and the rest from the accent.
 *
 * @param {object} from Where they come from.
 * @param {string} [from.accent] The page's `--color-accent` (default a bright green).
 * @param {string} [from.background] The page's `--color-bg` (default black).
 * @param {string[]} [from.colors] Colours given, hex or `rgb()`.
 * @returns {[Rgb, Rgb, Rgb, Rgb]} The four colours.
 */
export function shaderBackgroundPalette({ accent, background, colors = [] }) {
	const a = readColor(accent ?? '') ?? ACCENT;
	const bg = readColor(background ?? '') ?? PAGE;
	const [, la, lb] = toOklab(a);
	const hue = (Math.atan2(lb, la) * 180) / Math.PI;
	/**
	 * How far a hue sits from yellow, round the circle.
	 *
	 * @param {number} h The hue, degrees.
	 * @returns {number} Degrees, 0–180.
	 */
	const fromYellow = (h) => Math.abs(((((h - YELLOW + 180) % 360) + 360) % 360) - 180);
	// A hue nearer yellow only glows when light (dim, it is olive), so the
	// third turns a little that way and is lifted, and the fourth turns
	// further the other way and can sit deep.
	const side = fromYellow(hue + AWAY) >= fromYellow(hue - AWAY) ? 1 : -1;
	/** @type {[Rgb, Rgb, Rgb, Rgb]} */
	const derived = [a, mixOklab(a, bg, 0.55), turnHue(a, -side * TOWARD, 0.06), turnHue(a, side * AWAY)];
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
 * @param {Partial<ShaderBackgroundConfig>} config The config.
 * @returns {{ speed: number, intensity: number, frame: number }} Speed (0–4),
 *   intensity (0–2) and the still frame, in seconds.
 */
export function shaderBackgroundSettings(config) {
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
 * @param {Rgb[]} palette The shader background's colours.
 * @returns {string} A CSS `background`.
 */
export function shaderBackgroundFallback(palette) {
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
 * @param {HTMLElement} el The shader background's element.
 * @param {string[] | undefined} colors Colours given.
 * @returns {[Rgb, Rgb, Rgb, Rgb]} The four colours.
 */
function livePalette(el, colors) {
	const styles = getComputedStyle(el);
	return shaderBackgroundPalette({
		accent: styles.getPropertyValue('--color-accent'),
		background: styles.getPropertyValue('--color-bg'),
		colors,
	});
}

/**
 * Starts a shader background on an element: a canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {ShaderBackgroundConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function shaderBackground(el, config) {
	const fragment = SHADER_BACKGROUNDS[config.effect];
	if (!fragment) {
		console.warn('[effects-astro]', `No shader background "${config.effect}"`);
		return () => {};
	}
	const { speed, intensity, frame } = shaderBackgroundSettings(config);
	const reduced = prefersReducedMotion();
	let palette = livePalette(el, pickColors(config, [], (p) => [...p.colors, p.glint]));
	const start = performance.now();
	const mouse = { x: 0.5, y: 0.5, on: 0 };

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
				mouse.on += ((p.inside ? 1 : 0) - mouse.on) * EASE;
			}
			gl.uniform1f(uniform('uTime'), reduced ? 0 : still ? frame : clock(now));
			gl.uniform1f(uniform('uClock'), reduced || still ? 0 : (now - start) / 1000);
			gl.uniform2f(uniform('uMouse'), still ? 0.5 : mouse.x, still ? 0.5 : mouse.y);
			gl.uniform1f(uniform('uPointer'), still ? 0 : mouse.on);
			gl.uniform1f(uniform('uIntensity'), intensity);
			palette.forEach((c, i) => gl.uniform3fv(uniform(`uColor${i + 1}`), c));
		},
	});
	if (!stage) {
		el.style.background = shaderBackgroundFallback(palette);
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
