/**
 * @module @arraypress/effects-astro/fluted-glass
 *
 * A pane of fluted glass over soft blooms of colour: the flutes run on a
 * slant, each nearly flat across its middle and bending hard at its seams,
 * so a bloom breaks into slices that slide as it moves. Red, green and
 * blue bend by slightly different amounts, so every seam carries a thin
 * rainbow, and a glossy highlight runs along each flute.
 *
 * The flute geometry and its highlight are adapted from shaders.com's
 * FlutedGlass component (MIT, © 2026 Shader Effects Inc.; see LICENSE).
 *
 * The main bloom follows the pointer; two more drift on their own. On a
 * light ground it reads as a gallery-white studio pane; on a dark one, as
 * stage light through glass.
 *
 * Opaque: the effect is the whole background of what it fills. Without
 * WebGL it removes its canvas and the element's background shows.
 */

import { createStage } from './stage.js';
import { parseColor } from './color.js';
import { canHover } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';
import { GLSL_NOISE } from './glsl.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {object} FlutedGlassConfig
 * @property {string[]} [colors] The blooms' colours: the one that follows the pointer first (default indigo, violet, pink).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {string} [background='#f4f4f5'] The ground behind the glass.
 * @property {number} [angle=-35] The flutes' slant, in degrees from vertical.
 * @property {number} [frequency=9] Flutes across the longer side.
 * @property {number} [softness=0.5] 0: flat flutes with sharp seams; 1: a gentle curve all across.
 * @property {number} [refraction=1.5] How hard each flute bends what is behind it.
 * @property {number} [dispersion=0.6] How far the colours part at the seams; 0 for none.
 * @property {number} [highlight=0.35] The highlight along each flute; 0 for none.
 * @property {number} [bloom=1] How strong the blooms are.
 */

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPtr;
uniform vec3 uGround;
uniform vec3 uBloom[3];
uniform float uStrength;
uniform vec2 uRibDir;
uniform float uFrequency;
uniform float uSoftness;
uniform float uRefraction;
uniform float uDispersion;
uniform float uHighlight;
${GLSL_NOISE}

// What is behind the glass: the ground and three soft blooms.
vec3 behind(vec2 uv) {
	vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
	vec2 a = (uv - uPtr) * aspect;
	vec2 b = (uv - vec2(0.3 + 0.2 * sin(uTime * 0.13), 0.65 + 0.15 * cos(uTime * 0.11))) * aspect;
	vec2 c = (uv - vec2(0.8 + 0.12 * cos(uTime * 0.09), 0.2 + 0.12 * sin(uTime * 0.15))) * aspect;
	float wa = exp(-dot(a, a) * 11.0) * 0.8;
	float wb = exp(-dot(b, b) * 6.0) * 0.35;
	float wc = exp(-dot(c, c) * 7.0) * 0.3;
	vec3 col = uGround;
	col = mix(col, uBloom[0], clamp(wa * uStrength, 0.0, 1.0));
	col = mix(col, uBloom[1], clamp(wb * uStrength, 0.0, 1.0));
	col = mix(col, uBloom[2], clamp(wc * uStrength, 0.0, 1.0));
	// Soft shadows drifting through, so the white is never flat and the
	// flutes have something to bend.
	col *= 1.0 - 0.14 * smoothstep(0.35, 0.8, noise(uv * vec2(2.2, 1.6) + uTime * 0.03));
	col *= 1.0 - 0.06 * smoothstep(0.5, 0.9, noise(uv * 5.0 - uTime * 0.05 + 3.0));
	return col;
}

void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	float aspect = uRes.x / uRes.y;
	// Across the flutes, in a square frame centred on the canvas.
	vec2 centred = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
	float across = dot(centred, uRibDir);
	float cell = (fract(across * uFrequency) - 0.5) * 2.0;
	// The flute's slope: near flat across the middle, steep at the seams.
	float slope = sign(cell) * pow(max(abs(cell), 1e-4), mix(8.0, 3.0, uSoftness));
	float shift = -slope * uRefraction * 0.5 / uFrequency;
	vec2 refracted = uv + vec2(shift * uRibDir.x / aspect, shift * uRibDir.y);
	vec2 split = vec2(shift * uRibDir.x / aspect, shift * uRibDir.y) * uDispersion * 0.5;
	vec3 col = vec3(behind(refracted + split).r, behind(refracted).g, behind(refracted - split).b);
	// A glossy highlight: Blinn over the flute's slope, stronger where it turns away.
	float nz = sqrt(1.0 - min(slope * slope, 1.0));
	float nDotH = max(slope * sin(0.2618) + nz * cos(0.2618), 0.0);
	float fresnel = 0.04 + 0.96 * pow(1.0 - nz, 5.0);
	col += pow(nDotH, 24.0) * fresnel * uHighlight * 3.0 + pow(nDotH, 160.0) * uHighlight * 0.25;
	col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.012;
	gl_FragColor = vec4(col, 1.0);
}
`;

/** The default blooms: blue, cyan, amber. */
const COLORS = ['#2563eb', '#06b6d4', '#f59e0b'];

/**
 * Starts fluted glass on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {FlutedGlassConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function flutedGlass(el, config) {
	let colors = pickColors(config, COLORS);
	const start = performance.now();
	const ptr = { x: 0.62, y: 0.55 };

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		setup({ gl, uniform }) {
			const angle = ((config.angle ?? -35) * Math.PI) / 180;
			// The direction across the flutes: the flutes themselves run at `angle` from vertical.
			gl.uniform2f(uniform('uRibDir'), Math.cos(angle), Math.sin(angle));
			gl.uniform3fv(uniform('uGround'), parseColor(config.background ?? '#f4f4f5'));
			gl.uniform1f(uniform('uStrength'), config.bloom ?? 1);
			gl.uniform1f(uniform('uRefraction'), config.refraction ?? 1.5);
			gl.uniform1f(uniform('uDispersion'), config.dispersion ?? 0.6);
			gl.uniform1f(uniform('uSoftness'), config.softness ?? 0.5);
			gl.uniform1f(uniform('uHighlight'), config.highlight ?? 0.35);
		},
		resize({ gl, uniform, canvas }) {
			// Flutes across the longer side, measured in the square frame the shader works in.
			const longer = Math.max(canvas.width, canvas.height) / canvas.height;
			gl.uniform1f(uniform('uFrequency'), (config.frequency ?? 9) / longer);
		},
		uniforms({ gl, uniform, still }, now) {
			const t = (now - start) / 1000;
			const p = !still && canHover() ? pointerIn(el) : null;
			const goal = p?.inside ? p : { x: 0.62 + Math.sin(t * 0.2) * 0.1, y: 0.55 + Math.cos(t * 0.17) * 0.1 };
			ptr.x += (goal.x - ptr.x) * 0.04;
			ptr.y += (goal.y - ptr.y) * 0.04;
			gl.uniform1f(uniform('uTime'), t);
			gl.uniform2f(uniform('uPtr'), ptr.x, ptr.y);
			gl.uniform3fv(uniform('uBloom'), new Float32Array([0, 1, 2].flatMap((i) => parseColor(colors[i % colors.length]))));
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		colors = next.colors;
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
