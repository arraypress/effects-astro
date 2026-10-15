/**
 * @module @arraypress/effects-astro/ocean
 *
 * Open sea to the horizon, as a hero background: the camera a few metres
 * above the water looking out, a sky with the sun (or the moon) low over
 * it, and the light doing what it does on real water. Wind-driven waves
 * at every scale from a long swell to ripples, sunlight glowing through
 * thin crests, a glittering path under the sun, whitecaps on a rough sea,
 * high cloud in the sky and in its reflection, and haze into a soft,
 * true horizon. `time` sets the hour: dawn, noon, sunset or a moonlit
 * night.
 *
 * One fragment shader (./ocean/shader.js) over waves made once on the CPU
 * (./ocean/waves.js); each frame only moves their phases on, eases the
 * camera and sets a few uniforms. The pointer moves the camera a few
 * metres, so the near water slides past the far (parallax). It draws at
 * most one and a half pixels per CSS pixel; phones get fewer waves, march
 * steps and pixels; the stage lowers the resolution while frames run slow. With prefers-reduced-motion, one still frame.
 *
 * Opaque: the effect is the whole background of what it fills. Without
 * WebGL it removes its canvas and the element's background (the scene as
 * a gradient, `oceanBackdrop`) shows.
 */

import { createStage } from './stage.js';
import { parseColor } from './color.js';
import { canHover, isMobileGpu, pixelRatio } from './device.js';
import { quietUniform } from './glsl.js';
import { watchColors } from './mount.js';
import { pointerIn } from './pointer.js';
import { oceanLook } from './ocean/presets.js';
import { oceanShader } from './ocean/shader.js';
import { oceanView, sunDirection } from './ocean/view.js';
import { wavePhases, waveSet } from './ocean/waves.js';

/**
 * @typedef {object} OceanConfig
 * @property {'dawn' | 'noon' | 'sunset' | 'night'} [time='sunset'] The time of day: the sun, the sky's colours and the water's (`night` has a moon and stars).
 * @property {number} [waves=1] The sea state: 0 glassy, 1 a fresh breeze, 2 rough with whitecaps.
 * @property {number} [wind=30] Where the waves run, degrees 0–360: 0 straight towards the viewer, 90 from left to right.
 * @property {number} [speed=1] How fast the sea moves; 0 holds it still.
 * @property {number} [height=4] How high the camera is above the water, metres, 1–20 (raised as far as the waves need).
 * @property {number} [horizon=0.3] Where the horizon sits, 0–1 up the frame.
 * @property {boolean} [clouds=true] Soft high cloud in the sky and its reflection.
 * @property {{ x?: number, y?: number } | null} [sun=null] Where the sun (or moon) sits instead of the time's place: 0–1 across and up the frame.
 * @property {string[]} [colors] Tints, kept to each part's lightness: the sky, the water and the light.
 * @property {string} [palette] A shared palette by name (PALETTES; any case) to tint with, when there are no `colors`.
 * @property {boolean} [interactive=true] Whether the camera drifts with the pointer.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area dimmed behind copy: centre (0–1 from the top left), radius (a
 *   share of the height) and depth (0–1). The middle with `{}`.
 */

/** The full budget, and a phone's: waves, those that shape the surface, march and false-position steps, and the most pixels per CSS pixel drawn. */
const DESKTOP = { waves: 28, geometry: 8, steps: 14, refine: 6, ratio: 1.5 };
const MOBILE = { waves: 18, geometry: 6, steps: 10, refine: 3, ratio: 1.05 };
/** How far the camera moves with the pointer at the frame's edge: metres sideways and up. */
const SWAY = 6;
const RISE = 0.7;
/** How quickly the camera follows the pointer, per second. */
const EASE = 1.4;
/** Where the sea's clock starts, seconds: the waves already built up (the still frame too). */
const START = 40;
/** How fast the clouds drift with the wind, sky units a second. */
const DRIFT = 0.004;
/** How much high cloud there is with `clouds`, 0–1. */
const COVER = 0.8;

/**
 * Starts the ocean on an element (its first canvas is drawn into).
 *
 * @param {HTMLElement} el The element.
 * @param {OceanConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function ocean(el, config) {
	const quality = isMobileGpu() ? MOBILE : DESKTOP;
	const sea = Math.min(2, Math.max(0, config.waves ?? 1));
	const waves = waveSet(sea, config.wind ?? 30, quality.waves, quality.geometry);
	const horizon = Math.min(0.95, Math.max(0.05, config.horizon ?? 0.3));
	const height = Math.max(config.height ?? 4, waves.crest * 2 + 0.6);
	const speed = config.speed ?? 1;
	const interactive = config.interactive !== false;
	let look = oceanLook(config);
	let aspect = 1;
	let time = START;
	/** Where the pointer has moved the camera, -1–1 each way. */
	const pan = { x: 0, y: 0 };

	/**
	 * Sets the uniforms that only change with the colours or the frame's shape.
	 *
	 * @param {import('./stage.js').Stage} stage The stage, its program bound.
	 */
	const setLook = ({ gl, uniform: u }) => {
		for (const [name, key] of /** @type {const} */ ([
			['uZenith', 'zenith'],
			['uHorizon', 'horizon'],
			['uGlow', 'glow'],
			['uLight', 'light'],
			['uDeep', 'deep'],
			['uScatter', 'scatter'],
			['uCloud', 'cloud'],
		])) {
			gl.uniform3fv(u(name), parseColor(look[key]));
		}
		gl.uniform1f(u('uPower'), look.power);
		gl.uniform1f(u('uSize'), look.size);
		gl.uniform1f(u('uHaze'), look.haze);
		gl.uniform1f(u('uExposure'), look.exposure);
		gl.uniform1f(u('uStars'), look.stars);
		gl.uniform3fv(u('uSun'), sunDirection(oceanView({ height, horizon, aspect }), horizon, look, config.sun));
	};

	/**
	 * Eases the camera towards where the pointer is taking it, and back to the middle when it leaves.
	 *
	 * @param {number} dt Seconds since the last frame.
	 */
	const follow = (dt) => {
		const p = pointerIn(el);
		const k = 1 - Math.exp(-dt * EASE);
		pan.x += ((p.inside ? p.x * 2 - 1 : 0) - pan.x) * k;
		pan.y += ((p.inside ? p.y * 2 - 1 : 0) - pan.y) * k;
	};

	const { stage, stop } = createStage(el, {
		fragment: oceanShader(quality),
		alpha: false,
		scale: Math.min(1, quality.ratio / pixelRatio()),
		setup(stage) {
			const { gl, uniform: u } = stage;
			gl.uniform4fv(u('uShape'), waves.shape);
			gl.uniform1f(u('uCrest'), waves.crest);
			gl.uniform1f(u('uSlope'), waves.slope);
			gl.uniform1f(u('uClouds'), config.clouds === false ? 0 : COVER);
			gl.uniform1f(u('uFoam'), Math.min(1, Math.max(0, (sea - 0.8) / 1.2)));
			gl.uniform2fv(u('uWind'), waves.wind);
		},
		resize(stage) {
			aspect = stage.canvas.width / stage.canvas.height;
			setLook(stage);
			stage.gl.uniform4f(stage.uniform('uQuiet'), ...quietUniform(config.quiet, aspect));
		},
		uniforms({ gl, uniform: u, still }, _now, dt) {
			if (!still) {
				time += dt * speed;
				if (interactive && canHover()) follow(dt);
			}
			const view = oceanView({ height, horizon, aspect, x: pan.x * SWAY, lift: pan.y * RISE });
			gl.uniform3fv(u('uEye'), view.eye);
			gl.uniform3fv(u('uRight'), view.right);
			gl.uniform3fv(u('uUp'), view.up);
			gl.uniform3fv(u('uFwd'), view.forward);
			gl.uniform2f(u('uLens'), view.focal, view.shift);
			gl.uniform2fv(u('uMotion'), wavePhases(waves, time));
			gl.uniform1f(u('uTime'), time);
			gl.uniform2f(u('uDrift'), waves.wind[0] * time * DRIFT, waves.wind[1] * time * DRIFT);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		look = oceanLook({ ...config, colors: next.colors });
		stage.gl.useProgram(stage.program);
		setLook(stage);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
