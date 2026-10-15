/**
 * @module @arraypress/effects-astro/glass-glyph
 *
 * A character or a logo as a pane of clear glass over a dark ground lit by
 * one coloured light. The glass is clear through its middle (a touch
 * magnified) and bends what is behind it hard at its edges, splitting the
 * colours there; a thin rim catches the light on the side facing it, a
 * glint sits on the edge's curve, and a soft glow lines the inside of the
 * edge. The light follows the pointer and drifts when there is none;
 * behind it a beam and a patch of halftone dots give the glass something
 * to bend.
 *
 * The lens model (edge-weighted refraction, rim, glint and fresnel) is
 * adapted from shaders.com's Glass component (MIT, © 2026 Shader Effects
 * Inc.; see LICENSE).
 *
 * Opaque: the effect is the whole background of what it fills. Without
 * WebGL it removes its canvas and the element's background shows.
 */

import { createStage } from './stage.js';
import { drawShape, distanceField, blurField } from './shape.js';
import { parseColor } from './color.js';
import { canHover } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';

/**
 * @typedef {object} GlassGlyphConfig
 * @property {string} [text] The character or word to make of glass.
 * @property {string} [font] Its CSS font, without the size (default: the page's, bold).
 * @property {string} [src] An image (an SVG logo) to make of glass instead.
 * @property {{ x: number, y: number, width: number, height: number }} [area]
 *   Where the shape sits, each 0–1 from the top left (default: the right half).
 * @property {string[]} [colors] The light's colour, then the glass's tint (default acid green, white).
 * @property {string} [background='#050505'] The ground.
 * @property {number} [refraction=1] How hard the glass bends what is behind it at its edges.
 * @property {number} [thickness=0.06] How far in from the edge the bending reaches, a share of the height.
 * @property {number} [zoom=1.04] How much the glass magnifies what is behind its middle.
 * @property {number} [aberration=0.6] How far the colours part where it bends; 0 for none.
 * @property {number} [frost=0] Frosted glass: how much what is behind is blurred, 0–1.
 * @property {number} [tint=0.1] How much the glass takes the tint colour, 0–1.
 * @property {number} [highlight=0.8] The lit rim and the glint.
 * @property {number} [fresnel=0.5] The soft glow just inside the edge.
 * @property {number} [lightAngle=135] Where the light comes from, degrees (0 right, 90 top).
 * @property {number} [glow=1] How strong the coloured light behind is.
 * @property {boolean} [halftone=true] The patch of dots behind the light.
 */

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uSdf;
uniform vec2 uSdfTexel;
uniform float uSpread;
uniform vec2 uLight;
uniform vec3 uGlow;
uniform vec3 uTint;
uniform vec3 uGround;
uniform float uRefraction;
uniform float uThickness;
uniform float uZoom;
uniform float uAberration;
uniform float uFrost;
uniform float uTintAmount;
uniform float uHighlight;
uniform float uFresnel;
uniform vec2 uLightDir;
uniform float uGlowAmount;
uniform float uHalftone;

// The distance field: 0.5 at the shape's edge, more inside.
float field(vec2 uv) { return texture2D(uSdf, vec2(uv.x, 1.0 - uv.y)).r; }

// What is behind the glass: the ground, the light's glow, a slanting beam,
// and the dots: the structure the glass has to bend.
vec3 ground(vec2 uv) {
	float aspect = uRes.x / uRes.y;
	vec2 d = (uv - uLight) * vec2(aspect, 1.0);
	float glow = exp(-dot(d, d) * 6.0) * uGlowAmount;
	vec3 col = uGround + uGlow * glow * 0.6;
	// A broad beam across, so straight lines run behind the glass.
	float beam = smoothstep(0.18, 0.0, abs(dot(d, normalize(vec2(1.0, 0.6))) - 0.05));
	col += uGlow * beam * 0.18 * uGlowAmount;
	// Halftone: dots on a grid, bigger where the light is brighter.
	vec2 px = uv * uRes;
	vec2 cell = fract(px / 7.0) - 0.5;
	float dots = smoothstep(0.5 * glow + 0.02, 0.5 * glow - 0.05, length(cell)) * uHalftone;
	col = mix(col, uGlow, dots * smoothstep(0.25, 0.8, glow) * 0.4);
	return col;
}

// What is behind, frosted: a few taps round the point when frost is on.
vec3 behind(vec2 uv) {
	if (uFrost <= 0.0) return ground(uv);
	vec3 sum = ground(uv);
	float r = uFrost * 0.02;
	for (int i = 0; i < 8; i++) {
		float a = float(i) * 2.39996;
		float k = sqrt((float(i) + 0.5) / 8.0);
		sum += ground(uv + vec2(cos(a), sin(a)) * r * k);
	}
	return sum / 9.0;
}

void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	float aspect = uRes.x / uRes.y;
	vec3 back = ground(uv);
	float f = field(uv);
	// How far inside the edge, in heights; negative outside.
	float depth = (f - 0.5) * 2.0 * uSpread;
	float pxH = 1.0 / uRes.y;
	float inside = clamp(depth / (pxH * 1.5), 0.0, 1.0);
	if (inside <= 0.0 && depth < -pxH * 2.0) { gl_FragColor = vec4(back, 1.0); return; }

	// Inward, as the field rises.
	vec2 t = uSdfTexel * 2.0;
	vec2 grad = vec2(field(uv + vec2(t.x, 0.0)) - field(uv - vec2(t.x, 0.0)), field(uv + vec2(0.0, t.y)) - field(uv - vec2(0.0, t.y)));
	vec2 inward = grad / max(length(grad), 1e-5);

	// Bending: strongest at the edge, gone a thickness in, so the middle is clear.
	float reach = clamp(depth / max(uThickness, 0.002), 0.0, 1.0);
	float strength = (1.0 - reach) * (1.0 - reach);
	vec2 offset = inward * 0.15 * uRefraction * strength * vec2(1.0 / aspect, 1.0);
	// Through the glass: magnified about the light a touch, bent, and split.
	vec2 lens = uLight + (uv - uLight) / uZoom + offset;
	vec2 split = offset * uAberration * 0.35;
	vec3 through = vec3(behind(lens + split).r, behind(lens).g, behind(lens - split).b);
	// Tinted, keeping its brightness.
	float lum = dot(through, vec3(0.299, 0.587, 0.114));
	vec3 tinted = mix(through, uTint * lum / max(dot(uTint, vec3(0.299, 0.587, 0.114)), 1e-3), uTintAmount);

	// The rim: a thin bright line round the edge, brightest where it faces the light.
	float facing = clamp(dot(-inward, uLightDir) * 0.5 + 0.5, 0.0, 1.0);
	float ring = clamp(1.0 - abs(depth - pxH * 1.5) / (pxH * 1.5), 0.0, 1.0);
	// The glint: Phong on the edge's slope.
	vec3 n = normalize(vec3(-inward * strength * 2.0, 1.0));
	vec3 h = normalize(vec3(uLightDir, 2.0));
	float glint = pow(max(dot(n, h), 0.0), 60.0) * strength;
	// The fresnel: a soft glow just inside the edge.
	float edge = clamp(depth / 0.012, 0.0, 1.0);
	float rim = (1.0 - edge) * (1.0 - edge) * uFresnel;

	vec3 lit = tinted + vec3(1.0) * (ring * facing * uHighlight * 1.2 + glint * uHighlight) + mix(vec3(1.0), uGlow, 0.5) * rim * 0.6;
	gl_FragColor = vec4(mix(back, lit, smoothstep(0.0, 1.0, inside)), 1.0);
}
`;

/** The default light and tint: acid green, and clear glass. */
const COLORS = ['#c6ff00', '#ffffff'];

/**
 * Starts glass on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {GlassGlyphConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function glassGlyph(el, config) {
	let colors = config.colors?.length ? config.colors : COLORS;
	const start = performance.now();
	const light = { x: 0.7, y: 0.6 };
	/** Bumped on each resize, so a slow shape drawn for an old size is dropped. */
	let generation = 0;

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		setup({ gl, uniform }) {
			gl.uniform1i(uniform('uSdf'), 0);
			gl.uniform1f(uniform('uRefraction'), config.refraction ?? 1);
			gl.uniform1f(uniform('uThickness'), config.thickness ?? 0.06);
			gl.uniform1f(uniform('uZoom'), config.zoom ?? 1.04);
			gl.uniform1f(uniform('uAberration'), config.aberration ?? 0.6);
			gl.uniform1f(uniform('uFrost'), config.frost ?? 0);
			gl.uniform1f(uniform('uTintAmount'), config.tint ?? 0.1);
			gl.uniform1f(uniform('uHighlight'), config.highlight ?? 0.8);
			gl.uniform1f(uniform('uFresnel'), config.fresnel ?? 0.5);
			gl.uniform1f(uniform('uGlowAmount'), config.glow ?? 1);
			gl.uniform1f(uniform('uHalftone'), config.halftone === false ? 0 : 1);
			const angle = ((config.lightAngle ?? 135) * Math.PI) / 180;
			gl.uniform2f(uniform('uLightDir'), Math.cos(angle), Math.sin(angle));
			gl.uniform3fv(uniform('uGround'), parseColor(config.background ?? '#050505'));
			const texture = gl.createTexture();
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			// Empty until the shape is drawn: all outside.
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([0]));
		},
		resize({ gl, uniform, canvas }) {
			// The field at up to 640 px across: it is smooth, so the GPU's filtering does the rest.
			const width = Math.min(640, canvas.width);
			const height = Math.max(1, Math.round((width * canvas.height) / canvas.width));
			const mine = ++generation;
			drawShape(
				{ text: config.text, font: config.font, src: config.src, area: config.area ?? { x: 0.45, y: 0.05, width: 0.55, height: 0.9 }, padding: 0.06 },
				width,
				height,
			)
				.then((mask) => {
					if (mine !== generation) return;
					// Reaching far enough in to round a whole stroke over, like a tube.
					// Blurred a little, so the edges' slope is smooth.
					const spread = Math.round(width / 12);
					const sdf = blurField(distanceField(mask, spread), width, height, width / 320);
					gl.activeTexture(gl.TEXTURE0);
					gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, sdf);
					gl.useProgram(stage?.program ?? null);
					gl.uniform2f(uniform('uSdfTexel'), 1 / width, 1 / height);
					// The field's reach, in heights of the canvas.
					gl.uniform1f(uniform('uSpread'), spread / height);
					if (stage?.still) stage.redraw();
				})
				.catch((error) => console.warn('[effects-astro]', error));
		},
		uniforms({ gl, uniform, still }, now) {
			const p = !still && canHover() ? pointerIn(el) : null;
			const t = (now - start) / 1000;
			// The light follows the pointer, and drifts around the shape without one.
			const goal = p?.inside ? p : { x: 0.62 + Math.sin(t * 0.21) * 0.12, y: 0.55 + Math.sin(t * 0.17 + 1) * 0.15 };
			light.x += (goal.x - light.x) * 0.05;
			light.y += (goal.y - light.y) * 0.05;
			gl.uniform1f(uniform('uTime'), t);
			gl.uniform2f(uniform('uLight'), light.x, light.y);
			gl.uniform3fv(uniform('uGlow'), parseColor(colors[0]));
			gl.uniform3fv(uniform('uTint'), parseColor(colors[1] ?? colors[0]));
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
