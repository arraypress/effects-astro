/**
 * @module @arraypress/effects-astro/light-field
 *
 * Liquid light: a field of light warped through itself (domain-warped
 * noise) in a palette's three colours, with thin bright caustic bands
 * glinting where it folds, and its colours split slightly at the edges as
 * light through a prism splits them. The pointer is a lens: the light
 * bends around it and brightens under it, and holding the button swells it.
 *
 * Under the light runs a real fluid (./fluid.js): the pointer stirs it, a
 * click drops a bloom of ink, and the fluid's flow pushes the light along
 * with it. Without WebGL 2 the light runs alone.
 *
 * A quiet area can be set where the light dims (behind a headline, say),
 * so the colour frames the words instead of running under them.
 *
 * The colours change by setting the element's `data-colors` attribute to
 * JSON `{ "colors": [three hex], "glint": "hex" }` (see `setColors` in the
 * package index); the light eases to them in about a second.
 *
 * Drawn at half the pixel ratio by default and scaled up: the field is
 * soft, so the saving costs nothing visible. On phones and tablets the
 * prism split is dropped (one sample a pixel rather than three).
 */

import { createStage } from './stage.js';
import { parseColor } from './color.js';
import { GLSL_NOISE, GLSL_PALETTE, GLSL_QUIET, paletteUniform, quietUniform } from './glsl.js';
import { canHover, isMobileGpu } from './device.js';
import { watchColors } from './mount.js';
import { PALETTES, findPalette, pickColors } from './palettes.js';
import { pointerIn } from './pointer.js';
import { createFluid, stir } from './fluid.js';

/**
 * @typedef {object} LightFieldConfig
 * @property {string[]} [colors] The light's three colours, as CSS hex (default the palette's, or Lumetri's).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {string} [glint] The caustic bands' colour (default the palette's, or white-gold).
 * @property {number} [speed=1] How fast the light moves.
 * @property {number} [lens=1] How strongly the pointer bends the light; 0 for not at all.
 * @property {boolean} [prism=true] Split the colours at the edges (always off on phones).
 * @property {boolean | { trail?: number, drops?: boolean, force?: number, fade?: number, diffusion?: number, radius?: number, curl?: number, ignore?: string }} [fluid=true]
 *   The fluid under the light: false for none, or its settings (see `stir`
 *   and `createFluid`; `fade` is how fast the ink fades, per second).
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area where the light dims: centre x/y (0–1, from the top left),
 *   radius (a share of the height) and depth (0 none, 1 black).
 * @property {number} [vignette=0.45] How much the corners darken, 0–1.
 * @property {number} [grain=0.035] Film grain, so dark ramps do not band.
 * @property {number} [scale=0.5] Share of the pixel ratio drawn at.
 */

/**
 * The light's fragment shader.
 *
 * @param {boolean} prism Whether to sample three times and split the colours.
 * @returns {string} GLSL.
 */
const fragment = (prism) => `
precision highp float;
#define PRISM ${prism ? 1 : 0}
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uPress;
uniform float uActive;
uniform float uLens;
uniform vec3 uGlint;
// The fluid: the ink it carries and its velocity; uFluid 0 without one.
uniform sampler2D uDye;
uniform sampler2D uVel;
uniform float uFluid;
uniform float uVignette;
uniform float uGrain;

${GLSL_NOISE}
// The palette in Oklab (uPal), so it loops without muddy midpoints.
${GLSL_PALETTE}
${GLSL_QUIET}
// The light at one point, pushed by the fluid's flow; its warp field out through r.
float light(vec2 uv, float t, vec2 m, vec2 flow, out vec2 r) {
	vec2 q = vec2(fbm(uv * 1.3 + vec2(0.0, t)), fbm(uv * 1.3 + vec2(5.2, -t)));
	r = vec2(fbm(uv * 1.5 + 2.2 * q + vec2(1.7, 9.2) + 0.7 * t), fbm(uv * 1.5 + 2.2 * q + vec2(8.3, 2.8) - 0.5 * t));
	// The pointer as a lens: d / (|d| + 0.2), a soft push that cannot pinch to a point.
	vec2 d = uv - m;
	float lens = exp(-dot(d, d) * 6.0) * (0.12 + 0.3 * uActive + 0.35 * uPress) * uLens;
	r += lens * d / (length(d) + 0.2);
	r += flow;
	return fbm(uv * 1.7 + 2.6 * r);
}

void main() {
	vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
	vec2 m = (uMouse - 0.5 * uRes) / uRes.y;
	float t = uTime * 0.05;

	// The fluid's velocity as a push on the light, eased so a hard flick
	// bends it a long way without tearing it.
	vec2 screen = gl_FragCoord.xy / uRes;
	vec2 vel = texture2D(uVel, screen).xy * 0.0009 * uFluid;
	vec2 flow = vel / (1.0 + length(vel));

	vec2 r;
	float f = light(uv, t, m, flow, r);
	vec3 col;
#if PRISM
	// Three samples a hair apart along the flow: red, green and blue part at the edges.
	vec2 split = 0.012 * normalize(r - 0.5 + 1e-4);
	vec2 rr, rb;
	float fr = light(uv + split, t, m, flow, rr);
	float fb = light(uv - split, t, m, flow, rb);
	col.r = pal(fr + 0.35 * length(rr) + t * 0.3).r;
	col.g = pal(f + 0.35 * length(r) + t * 0.3).g;
	col.b = pal(fb + 0.35 * length(rb) + t * 0.3).b;
#else
	col = pal(f + 0.35 * length(r) + t * 0.3);
#endif

	// Light where the field is dense, deep where it thins.
	col *= 0.18 + 1.25 * f * f;

	// Caustics: thin bright bands where the field crosses its contours.
	float bands = pow(abs(sin(f * 16.0 - t * 4.0)), 22.0);
	col += bands * mix(pal(f + 0.5), uGlint, 0.6) * 0.5 * smoothstep(0.35, 0.75, f);

	// The pointer brightens the light under it.
	vec2 d = uv - m;
	col += exp(-dot(d, d) * 9.0) * pal(t + 0.2) * (0.06 + 0.2 * uActive) * uLens;

	// The quiet area dims; ink is dimmed less (it is the visitor's own, and it does not stay).
	float open = quietOpen(uv);
	col *= mix(1.0 - uQuiet.w, 1.0, open);

	// The ink: its colour at full strength, covering as much as there is of
	// it, lit by the field beneath so it takes the light's folds.
	vec3 dye = texture2D(uDye, screen).rgb * uFluid;
	float ink = max(dye.r, max(dye.g, dye.b));
	vec3 hue = dye / max(ink, 1e-4);
	float cover = 1.0 - exp(-ink * 2.5);
	col = mix(col, hue * (0.7 + 0.8 * f) * mix(1.0 - uQuiet.w * 0.62, 1.0, open), cover * 0.9);

	col *= 1.0 - uVignette * dot(uv * 0.55, uv * 0.55);
	col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * uGrain;
	gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

/** The glint when none is given: a warm white, as sunlight through water. */
const GLINT = '#fff3c4';

/**
 * The palette and glint as the shader takes them: three Oklab colours, then
 * the glint in sRGB.
 *
 * @param {string[]} colors Three hex colours.
 * @param {string} glint A hex colour.
 * @returns {Float32Array} Twelve channels.
 */
function channels(colors, glint) {
	return new Float32Array([...paletteUniform(colors), ...parseColor(glint)]);
}

/**
 * Starts a light field on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {LightFieldConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function lightField(el, config) {
	const settings = config.fluid === false ? null : config.fluid === true || config.fluid == null ? {} : config.fluid;
	const colors = pickColors(config, [...PALETTES.Lumetri.colors]);
	let glint = config.glint ?? findPalette(config.palette)?.glint ?? GLINT;
	const colours = channels(colors, glint);
	/** @type {Float32Array} */
	let target = colours.slice();
	const mouse = { x: 0, y: 0, set: false };
	let press = 0;
	let pressTarget = 0;
	let active = 0;
	const start = performance.now() - 40_000;
	/** @type {import('./fluid.js').Fluid | null} */
	let fluid = null;
	/** @type {ReturnType<typeof stir> | null} */
	let stirrer = null;

	/**
	 * Where the lens rests without a pointer: above the middle, drifting.
	 *
	 * @param {HTMLCanvasElement} canvas The canvas.
	 * @param {number} now The time, ms.
	 * @returns {{ x: number, y: number }} Canvas pixels, y up.
	 */
	const rest = (canvas, now) => ({
		x: canvas.width * (0.5 + 0.28 * Math.sin(now * 0.00013)),
		y: canvas.height * (0.62 + 0.12 * Math.sin(now * 0.00021 + 1.1)),
	});

	const { stage, stop } = createStage(el, {
		fragment: fragment(config.prism !== false && !isMobileGpu()),
		alpha: false,
		scale: config.scale ?? 0.5,
		setup({ gl, uniform, still, program }) {
			if (settings && !still && typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
				fluid = createFluid(gl, { inkFade: settings.fade, diffusion: settings.diffusion, curl: settings.curl });
			}
			stirrer = fluid
				? stir(fluid, el, {
						colors: colors.map(parseColor),
						trail: settings?.trail,
						drops: settings?.drops,
						force: settings?.force,
						radius: settings?.radius,
						ignore: settings?.ignore,
					})
				: null;
			// Making the fluid used its own programs: back to the light's.
			gl.useProgram(program);
			gl.uniform1i(uniform('uDye'), 3);
			gl.uniform1i(uniform('uVel'), 4);
			gl.uniform1f(uniform('uFluid'), fluid ? 1 : 0);
			gl.uniform1f(uniform('uLens'), config.lens ?? 1);
			gl.uniform1f(uniform('uVignette'), config.vignette ?? 0.45);
			gl.uniform1f(uniform('uGrain'), config.grain ?? 0.035);

			if (!((config.lens ?? 1) > 0 && canHover() && !still)) return () => stirrer?.destroy();
			/** Holding the button down swells the lens. */
			const down = () => {
				pressTarget = 1;
			};
			/** Letting go lets it settle. */
			const up = () => {
				pressTarget = 0;
			};
			document.addEventListener('pointerdown', down);
			document.addEventListener('pointerup', up);
			return () => {
				stirrer?.destroy();
				document.removeEventListener('pointerdown', down);
				document.removeEventListener('pointerup', up);
			};
		},
		resize({ gl, uniform, canvas }) {
			fluid?.resize(canvas.width / canvas.height);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, canvas.width / canvas.height));
		},
		update(_stage, _now, dt) {
			if (!fluid) return;
			stirrer?.update(dt);
			if (dt > 0) fluid.step(dt);
			fluid.bind(3, 4);
		},
		uniforms({ gl, uniform, canvas, still }, now, dt) {
			const p = (config.lens ?? 1) > 0 && canHover() && !still ? pointerIn(el) : null;
			const goal = p?.inside ? { x: p.x * canvas.width, y: p.y * canvas.height } : rest(canvas, now);
			if (!mouse.set) Object.assign(mouse, goal, { set: true });
			mouse.x += (goal.x - mouse.x) * 0.06;
			mouse.y += (goal.y - mouse.y) * 0.06;
			press += (pressTarget - press) * 0.08;
			active += ((p?.inside ? 1 : 0) - active) * 0.05;
			// By the clock, not the frame: about a second to new colours however fast the screen draws.
			const ease = 1 - Math.exp(-(dt * 1000) / 350);
			for (let i = 0; i < colours.length; i++) colours[i] += (target[i] - colours[i]) * ease;
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000) * (config.speed ?? 1));
			gl.uniform2f(uniform('uMouse'), mouse.x, mouse.y);
			gl.uniform1f(uniform('uPress'), press);
			gl.uniform1f(uniform('uActive'), active);
			gl.uniform3fv(uniform('uPal'), colours.subarray(0, 9));
			gl.uniform3fv(uniform('uGlint'), colours.subarray(9, 12));
		},
	});
	if (!stage) return stop;

	// New colours: the light heads for them. Those set before it started are
	// its colours from the first frame.
	let started = false;
	const unwatch = watchColors(el, (next) => {
		glint = next.glint ?? glint;
		target = channels(next.colors, glint);
		stirrer?.setColors(next.colors.map(parseColor));
		if (!started || stage.still) colours.set(target);
		if (stage.still && started) stage.redraw();
	});
	started = true;
	if (stage.still) stage.redraw();

	return () => {
		stop();
		unwatch();
	};
}
