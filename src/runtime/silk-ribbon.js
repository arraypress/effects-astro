/**
 * @module @arraypress/effects-astro/silk-ribbon
 *
 * A wide ribbon of satin twisting across a light ground, a soft
 * out-of-focus glow of the same colours behind it. The ribbon is shaded
 * analytically in one pass: it turns about its length, so it narrows to a
 * pinch where it shows its edge and widens where it faces you; soft folds
 * run along it, gathering at each pinch, and a satin sheen picks out
 * every fold as it turns to the light. Its colour runs from the darkest
 * colour in its shadows to the lightest on its highlights, mixed in Oklab.
 *
 * The folds undulate slowly and lean towards the pointer. Reduced motion
 * gets a still frame.
 *
 * Opaque: the effect is the whole background of what it fills. Without
 * WebGL it removes its canvas and the element's background shows.
 */

import { createStage } from './stage.js';
import { GLSL_OKLAB, parseColor, toOklab } from './color.js';
import { canHover } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';
import { GLSL_NOISE, paletteUniform } from './glsl.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {object} SilkRibbonConfig
 * @property {string[]} [colors] The satin's colours, shaded from the darkest to the lightest whatever their order (default hot pink, coral, peach).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {string} [background='#f6f4f1'] The ground around the ribbon.
 * @property {'right' | 'left' | 'center'} [side='right'] Where the ribbon runs.
 * @property {number} [twist=1] How tightly it turns along its length; 0 lies flat.
 * @property {number} [folds=1] How deep the folds along it are; 0 for flat satin.
 * @property {number} [glow=1] The soft out-of-focus glow behind it; 0 for none.
 * @property {number} [speed=1] How fast the folds move.
 */

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uLean;
uniform float uLeanAt;
uniform float uSide;
uniform float uTwist;
uniform float uFolds;
uniform float uGlow;
uniform vec3 uGround;
uniform vec3 uPal[3];
${GLSL_OKLAB}
${GLSL_NOISE}

// The satin's colour for a shade 0 (in shadow) to 1 (lit), dark to light in Oklab.
vec3 satin(float k) {
	k = clamp(k, 0.0, 1.0);
	vec3 lab = k < 0.5 ? mix(uPal[0], uPal[1], smoothstep(0.0, 0.5, k)) : mix(uPal[1], uPal[2], smoothstep(0.5, 1.0, k));
	return fromOklab(lab);
}

// The ribbon's centre line, across its axis, at a point along it.
float centre(float s, float t) {
	return 0.1 * sin(s * 2.0 + t * 0.31) + 0.03 * sin(s * 3.3 - t * 0.23) + uLean * 0.03;
}

// How far the ribbon has turned about its length at a point along it.
float turn(float s, float t) {
	float lean = uLean * 0.5 * exp(-(s - uLeanAt) * (s - uLeanAt) * 3.0);
	return uTwist * (1.7 * s + 0.5 * sin(s * 1.3 + t * 0.21)) + 0.8 + 0.6 * sin(t * 0.11) + lean;
}

void main() {
	float t = uTime;
	// Centred, in units of the height; on a narrow screen, of a shorter
	// height, so the ribbon keeps its shape and fits the width.
	float zoom = min(uRes.x / uRes.y / 1.5, 1.0);
	vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (uRes.y * zoom);
	float aspect = uRes.x / (uRes.y * zoom);
	p.x *= uSide < 0.0 ? -1.0 : 1.0;
	// The ribbon's axis leans right as it rises; along it s, across it x.
	vec2 origin = vec2(abs(uSide) * max(aspect * 0.5 - 0.42, 0.12), 0.0);
	vec2 axis = normalize(vec2(0.42, 1.0));
	vec2 side = vec2(axis.y, -axis.x);
	vec2 q = p - origin;
	float s = dot(q, axis);
	float x = dot(q, side);
	float eps = 1.5 / (uRes.y * zoom);

	// The ground, and the glow: a wide blurred ribbon behind, warmer on its
	// near side, as if a second length of the same silk were out of focus.
	vec3 col = uGround;
	float gx = x - 0.02 - 0.08 * sin(s * 1.4 - t * 0.17);
	float gw = 0.44 + 0.06 * sin(s * 2.1 + t * 0.19);
	float glow = smoothstep(gw + 0.3, gw - 0.1, abs(gx)) * uGlow;
	col = mix(col, satin(0.62 - 0.55 * smoothstep(-0.45, 0.2, gx) + 0.06 * sin(s * 2.0 + t * 0.2)), glow);

	// The ribbon: half its width shows as it turns, never quite none.
	float c = centre(s, t);
	float a = turn(s, t);
	float facing = cos(a);
	float hw = 0.36 * sqrt(facing * facing + 0.004);
	float dx = x - c;
	// A soft shadow on the glow beside the ribbon.
	col *= 1.0 - 0.1 * glow * smoothstep(hw + 0.2, hw, abs(dx - 0.03));
	float inside = smoothstep(hw + eps, hw - eps, abs(dx));
	if (inside > 0.0) {
		// Across the cloth, -1 to 1, the same thread wherever it turns.
		float v = dx / hw * sign(facing);
		// Folds along the length: their slope tilts the normal about the axis.
		float fold = uFolds * (0.6 * cos(v * 6.5 + s * 1.2 + t * 0.4) + 0.35 * cos(v * 10.0 - s * 2.0 - t * 0.33));
		float phi = a + atan(fold * 1.6);
		// The normal, in screen terms; turned to face the viewer on the back.
		vec3 n = vec3(-sin(phi) * side, cos(phi));
		n.z = abs(n.z);
		n.xy *= sign(facing);
		n.xy += axis * 0.12 * sin(s * 2.6 + v * 1.5 - t * 0.3);
		n = normalize(n);
		// Light from the upper left, from the upper right on the back, so both faces show their folds.
		vec3 light = normalize(vec3(-0.8 * sign(facing), 0.3, 0.3));
		vec3 view = vec3(0.0, 0.0, 1.0);
		// Wrapped light, so no fold goes flat in shadow.
		float diffuse = dot(n, light) * 0.5 + 0.5;
		float k = pow(diffuse, 3.4);
		// Faint streaks woven along the length.
		k += 0.12 * (noise(vec2(v * 4.0, s * 0.7 + t * 0.03)) - 0.5);
		vec3 silk = satin(k);
		// The satin sheen: a broad glow and a tighter highlight off each fold.
		float nh = max(dot(n, normalize(light + view)), 0.0);
		float sheen = pow(nh, 12.0) * 0.25 + pow(nh, 60.0) * 0.3;
		silk = mix(silk, fromOklab(uPal[2]) + 0.05, clamp(sheen, 0.0, 1.0));
		// A slightly lighter rolled hem.
		silk = mix(silk, satin(k + 0.25), smoothstep(0.88, 1.0, abs(v)) * 0.5);
		col = mix(col, silk, inside);
	}
	col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0 * 1.5;
	gl_FragColor = vec4(col, 1.0);
}
`;

/** The default satin: hot pink, coral, peach. */
const COLORS = ['#e2357a', '#f0906a', '#f5d0a4'];

/** Where each `side` puts the ribbon, for `uSide`. */
const SIDES = { right: 1, left: -1, center: 0 };

/**
 * Colours sorted dark to light, as the satin shades them.
 *
 * @param {string[]} colors CSS hex colours.
 * @returns {string[]} The first three, darkest first.
 */
const byLightness = (colors) =>
	[0, 1, 2]
		.map((i) => colors[i % colors.length])
		.sort((a, b) => toOklab(parseColor(a))[0] - toOklab(parseColor(b))[0]);

/**
 * Starts a silk ribbon on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {SilkRibbonConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function silkRibbon(el, config) {
	let pal = paletteUniform(byLightness(pickColors(config, COLORS)));
	const start = performance.now();
	const speed = config.speed ?? 1;
	const side = SIDES[config.side ?? 'right'] ?? 1;
	const lean = { x: 0, at: 0 };

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		setup({ gl, uniform }) {
			gl.uniform3fv(uniform('uGround'), parseColor(config.background ?? '#f6f4f1'));
			gl.uniform1f(uniform('uSide'), side);
			gl.uniform1f(uniform('uTwist'), config.twist ?? 1);
			gl.uniform1f(uniform('uFolds'), config.folds ?? 1);
			gl.uniform1f(uniform('uGlow'), config.glow ?? 1);
		},
		uniforms({ gl, uniform, still }, now) {
			const t = ((now - start) / 1000) * speed;
			const p = !still && canHover() ? pointerIn(el) : null;
			// The folds lean towards the pointer, easing back when it leaves.
			const goal = p?.inside ? { x: p.x - 0.5, at: p.y - 0.5 } : { x: 0, at: lean.at };
			lean.x += (goal.x - lean.x) * 0.03;
			lean.at += (goal.at - lean.at) * 0.03;
			// Eight seconds in, where the first (and the still) frame shows a twist.
			gl.uniform1f(uniform('uTime'), t + 8);
			// The shader mirrors a left-hand ribbon, so the lean is mirrored with it.
			gl.uniform1f(uniform('uLean'), side < 0 ? -lean.x : lean.x);
			gl.uniform1f(uniform('uLeanAt'), lean.at);
			gl.uniform3fv(uniform('uPal'), pal);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		pal = paletteUniform(byLightness(next.colors));
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
