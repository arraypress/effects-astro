/**
 * @module @arraypress/effects-astro/ink
 *
 * Ink in water, over whatever is behind it: the fluid of ./fluid.js drawn
 * on a transparent canvas. The pointer stirs it and trails ink, a click
 * drops a bloom that bursts open and curls; where there is no ink the
 * canvas is clear, so it lays over a hero, a card or an image.
 *
 * The colours change by setting the element's `data-colors` attribute to
 * JSON `{ "colors": [hex, …] }` (see `setColors` in the package index).
 *
 * Needs WebGL 2; without it (and with prefers-reduced-motion) the canvas
 * is removed and nothing is drawn.
 */

import { createStage } from './stage.js';
import { parseColor } from './color.js';
import { prefersReducedMotion } from './device.js';
import { watchColors } from './mount.js';
import { createFluid, stir } from './fluid.js';
import { PALETTES, pickColors } from './palettes.js';

/**
 * @typedef {object} InkConfig
 * @property {string[]} [colors] The ink's colours, as CSS hex, looped through as it is laid (default the palette's, or Peacock's).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {number} [trail=0.35] How much ink a stroke leaves, 0 for none (strokes still push).
 * @property {boolean} [drops=true] Whether a click or tap drops a bloom of ink.
 * @property {number} [force=1] How hard the pointer pushes.
 * @property {number} [curl=28] Swirl kept alive between strokes.
 * @property {number} [fade=0.55] How fast the ink fades, per second.
 * @property {number} [diffusion=0.35] How much the ink spreads and softens as it moves, 0–1.
 * @property {number} [radius=1] The size of a stroke's splats and of a drop, 1 as standard.
 * @property {number} [momentum=0.25] How fast the motion dies away, per second (lower flows on longer).
 * @property {number} [opacity=1] The ink's strongest cover, 0–1.
 * @property {string} [ignore] Clicks on these are theirs, not the ink's (default: links, buttons, form fields, `[data-effect-ignore]`).
 */

/** Shows the ink: its colour at full strength, as opaque as there is ink. */
const SHOW = `
precision highp float;
uniform vec2 uRes;
uniform sampler2D uDye;
uniform float uOpacity;
void main() {
	vec3 dye = texture2D(uDye, gl_FragCoord.xy / uRes).rgb;
	float ink = max(dye.r, max(dye.g, dye.b));
	float cover = (1.0 - exp(-ink * 2.5)) * uOpacity;
	// Premultiplied, as the canvas composites.
	gl_FragColor = vec4(dye / max(ink, 1e-4) * cover, cover);
}
`;

/**
 * Starts ink on an element: a transparent canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {InkConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function ink(el, config) {
	// Ink is motion or nothing: with reduced motion there is nothing to show.
	if (prefersReducedMotion()) {
		el.querySelector('canvas')?.remove();
		return () => {};
	}
	/** @type {import('./fluid.js').Fluid | null} */
	let fluid = null;
	/** @type {ReturnType<typeof stir> | null} */
	let stirrer = null;

	const { stage, stop } = createStage(el, {
		fragment: SHOW,
		scale: 0.5,
		webgl1: false,
		setup({ gl, uniform, program }) {
			fluid = gl instanceof WebGL2RenderingContext ? createFluid(gl, { curl: config.curl, inkFade: config.fade, diffusion: config.diffusion ?? 0.35, velocityFade: config.momentum }) : null;
			if (!fluid) return false;
			gl.useProgram(program);
			gl.uniform1i(uniform('uDye'), 3);
			gl.uniform1f(uniform('uOpacity'), config.opacity ?? 1);
			const s = stir(fluid, el, {
				colors: pickColors(config, [...PALETTES.Peacock.colors]).map(parseColor),
				trail: config.trail ?? 0.35,
				drops: config.drops,
				force: config.force,
				radius: config.radius,
				ignore: config.ignore,
			});
			stirrer = s;
			return () => s.destroy();
		},
		resize({ canvas }) {
			fluid?.resize(canvas.width / canvas.height);
		},
		update(_stage, _now, dt) {
			stirrer?.update(dt);
			if (dt > 0) fluid?.step(dt);
			fluid?.bind(3, 4);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => stirrer?.setColors(next.colors.map(parseColor)));
	return () => {
		stop();
		unwatch();
	};
}
