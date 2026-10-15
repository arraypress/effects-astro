/**
 * @module @arraypress/effects-astro/glass-glyph
 *
 * A character or a logo as a thick slab of bevelled glass over a dark
 * ground, lit from behind by one coloured light: four beams turning out
 * from a point like a pinwheel, sharp on one side and fading on the other,
 * dithered into halftone dots where they fade. The light stays put; the
 * slab turns slowly on its own and leans a little away from the pointer, so
 * its side walls show and the highlights slide along its bevels.
 *
 * Through the glass the beams are softened, shifted and split into colour,
 * hardest across the bevels; a bright rim runs round the outer edge and a
 * fainter crease where the bevel meets the face, both brightest where they
 * face the light, and the bevels mirror the light back.
 *
 * The lens model (edge-weighted refraction, rim, glint and fresnel) is
 * adapted from shaders.com's Glass component (MIT, © 2026 Shader Effects
 * Inc.; see LICENSE).
 *
 * Opaque: the effect is the whole background of what it fills. Without
 * WebGL it removes its canvas and the element's background shows. With
 * reduced motion it is one still frame, the slab turned a little.
 */

import { createStage } from './stage.js';
import { drawShape, distanceField, blurField } from './shape.js';
import { parseColor } from './color.js';
import { canHover } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {object} GlassGlyphConfig
 * @property {string} [text] The character or word to make of glass.
 * @property {string} [font] Its CSS font, without the size (default: the page's, bold).
 * @property {string} [src] An image (an SVG logo) to make of glass instead.
 * @property {{ x: number, y: number, width: number, height: number }} [area]
 *   Where the shape sits, each 0–1 from the top left (default: the right half).
 * @property {{ x: number, y: number }} [light] Where the beams of light cross, each 0–1 from the top left (default: two fifths of the way into the shape's area, a little below its middle).
 * @property {string[]} [colors] The light's colour, then the glass's tint (default acid green, white).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`. Its first colour lights the glass; its glint is the highlight.
 * @property {string} [background='#050505'] The ground.
 * @property {number} [refraction=1] How hard the glass bends what is behind it, most of all across its bevels.
 * @property {number} [thickness=0.035] How wide the bevel round the edge is, a share of the height.
 * @property {number} [zoom=1.04] How much the glass magnifies what is behind it.
 * @property {number} [aberration=0.6] How far the colours part where it bends; 0 for none.
 * @property {number} [frost=0] Frosted glass: how much more what is behind is blurred, 0–1.
 * @property {number} [tint=0.1] How much the glass takes the tint colour, 0–1.
 * @property {number} [highlight=0.8] The lit rims and the glints.
 * @property {number} [fresnel=0.5] How much the bevels mirror the light.
 * @property {number} [lightAngle=135] Where the light on the rims comes from, degrees (0 right, 90 top).
 * @property {number} [glow=1] How strong the coloured light behind is.
 * @property {boolean} [halftone=true] Dither the light's fading edges into dots.
 * @property {number} [sway=1] How far the slab turns on its own and away from the pointer; 0 holds it still.
 */

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform sampler2D uSdf;
uniform vec2 uSdfTexel;
uniform float uSpread;
uniform vec2 uCross;
uniform vec2 uTilt;
uniform vec3 uGlow;
uniform vec3 uTint;
uniform vec3 uGround;
uniform float uRefraction;
uniform float uBevel;
uniform float uZoom;
uniform float uAberration;
uniform float uFrost;
uniform float uTintAmount;
uniform float uHighlight;
uniform float uFresnel;
uniform vec2 uLightDir;
uniform float uGlowAmount;
uniform float uHalftone;

const float TAU = 6.2831853;
// How deep the slab is, in heights: how far its back face slides as it turns.
const float SLAB = 0.15;

// The distance field: 0.5 at the shape's edge, more inside.
float field(vec2 uv) { return texture2D(uSdf, vec2(uv.x, 1.0 - uv.y)).r; }
// How far inside the edge, in heights; negative outside.
float depthAt(vec2 uv) { return (field(uv) - 0.5) * 2.0 * uSpread; }

// One beam of the pinwheel: sharp along its axis at angle 'axis', fading
// counter-clockwise over about 'width' radians. 'edge' softens the sharp
// side, in heights.
float beam(float angle, float r, float axis, float width, float edge) {
	float s = mod(angle - axis + 3.14159265, TAU) - 3.14159265;
	float e = edge / max(r, 1e-3);
	return smoothstep(-e, e, s) * exp(-max(s, 0.0) / width);
}

// What is behind the glass: four beams turning out from where they cross,
// dithered into dots where they fade. 'soft' (0 sharp, 1 through thick
// glass) blurs the edges and the dots away.
vec3 ground(vec2 uv, float soft) {
	float aspect = uRes.x / uRes.y;
	vec2 d = (uv - uCross) * vec2(aspect, 1.0);
	float r = length(d);
	float a = atan(d.y, d.x);
	float edge = mix(1.5 / uRes.y, 0.05, soft);
	float spread = 1.0 + soft * 0.6;
	// Right and up are the main beams; down and left are their echoes.
	float b = beam(a, r, 0.0, 0.24 * spread, edge) * 1.0
		+ beam(a, r, 1.5708, 0.22 * spread, edge) * 0.85
		+ beam(a, r, -1.5708, 0.18 * spread, edge) * 0.24
		+ beam(a, r, 3.14159, 0.16 * spread, edge) * 0.18;
	// Brighter away from the crossing, and a faint haze round it.
	b *= smoothstep(0.0, 0.6, r) * 0.8 + 0.2;
	b += exp(-r * r * 12.0) * 0.04;
	b *= uGlowAmount;
	// Halftone: dots on a fine grid, as big as the light is bright, mixed in where it fades.
	vec2 cell = fract(uv * uRes / (4.0 * max(uRes.y / 760.0, 1.0))) - 0.5;
	float spot = smoothstep(0.08, -0.08, length(cell) - sqrt(clamp(b, 0.0, 1.0)) * 0.62);
	float fade = smoothstep(0.02, 0.2, b) * (1.0 - smoothstep(0.35, 0.8, b));
	b = mix(b, spot * min(b * 1.6, 1.0), fade * uHalftone * 0.5 * (1.0 - smoothstep(0.0, 0.3, soft)));
	return uGround + uGlow * b + vec3(pow(clamp(b, 0.0, 1.0), 3.0) * 0.22);
}

void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	float aspect = uRes.x / uRes.y;
	float pxH = 1.0 / uRes.y;
	vec2 toUv = vec2(1.0 / aspect, 1.0);
	vec3 back = ground(uv, 0.0);
	float d = depthAt(uv);

	// The back face: the shape slid against the turn, a slab's depth behind.
	// Between it and the front are the side walls.
	vec2 slide = -uTilt * SLAB * toUv;
	float dBack = depthAt(uv - slide);
	float wall = max(max(dBack, depthAt(uv - slide * 0.5)), d);
	if (wall < -pxH * 2.0) { gl_FragColor = vec4(back, 1.0); return; }

	float soft = clamp(0.65 + uFrost, 0.0, 1.0);
	vec3 rimTone = mix(vec3(1.0), uGlow, 0.15);
	vec3 L = normalize(vec3(uLightDir, 0.9));

	// The side walls: glass seen edge on, lit where they face the light, with
	// the back face's edge as a fainter line.
	float wallCover = clamp(wall / (pxH * 1.2), 0.0, 1.0);
	float wallLit = clamp(dot(normalize(uTilt + 1e-5), uLightDir) * 0.5 + 0.5, 0.0, 1.0);
	vec3 side = ground(uv + slide * 2.0, soft) * 0.55 + uGlow * 0.06 + vec3(0.05);
	side += rimTone * (0.08 + 0.22 * wallLit) * uHighlight;
	float backLine = clamp(1.0 - abs(dBack - pxH) / (pxH * 1.3), 0.0, 1.0);
	side += rimTone * backLine * 0.5 * uHighlight;
	vec3 col = mix(back, side, wallCover);

	// The front face.
	vec2 t = uSdfTexel * 3.0;
	vec2 grad = vec2(field(uv + vec2(t.x, 0.0)) - field(uv - vec2(t.x, 0.0)), field(uv + vec2(0.0, t.y)) - field(uv - vec2(0.0, t.y)));
	vec2 inward = grad / max(length(grad), 1e-5);
	// The bevel: steepest at the lip, a steady slope across, and flat past the crease.
	float s = clamp(d / max(uBevel, 0.002), 0.0, 1.0);
	float crease = 1.0 - smoothstep(1.0 - (pxH * 2.0) / max(uBevel, 0.002), 1.0, s);
	float slope = (0.9 + 1.6 * pow(1.0 - s, 4.0)) * crease;
	vec3 n = normalize(vec3(-inward * slope + uTilt, 1.0));

	// Through the glass: refracted by the surface, magnified about the light,
	// softened, and split into colour.
	vec3 r = refract(vec3(0.0, 0.0, -1.0), n, 0.67);
	vec2 offset = r.xy / max(-r.z, 0.2) * 0.12 * uRefraction * toUv;
	vec2 lens = uCross + (uv - uCross) / uZoom + offset;
	vec2 split = offset * uAberration * 0.3;
	float thick = mix(soft, 1.0, (1.0 - s) * 0.5);
	vec3 through = vec3(ground(lens + split, thick).r, ground(lens, thick).g, ground(lens - split, thick).b);
	// Tinted, keeping its brightness, and a touch brighter where the slab gathers the light.
	float lum = dot(through, vec3(0.299, 0.587, 0.114));
	vec3 tinted = mix(through, uTint * lum / max(dot(uTint, vec3(0.299, 0.587, 0.114)), 1e-3), uTintAmount) * 1.15;

	// The bevels mirror the light: what lies along the reflected ray, far off.
	float fres = pow(1.0 - n.z, 1.5) * uFresnel * 2.2;
	vec3 m = reflect(vec3(0.0, 0.0, -1.0), n);
	vec3 mirrored = ground(uv + m.xy * 0.45 * toUv, 1.0) * 1.3 + uGlow * 0.08 + vec3(0.16);
	vec3 face = tinted * (1.0 - fres * 0.35) + mirrored * fres;

	// The rim at the lip, the crease where the bevel meets the face, and the glints on the slope.
	float facing = clamp(dot(-inward, uLightDir) * 0.5 + 0.5, 0.0, 1.0);
	float rim = clamp(1.0 - abs(d - pxH * 1.2) / (pxH * 1.4), 0.0, 1.0);
	float seam = clamp(1.0 - abs(d - uBevel) / (pxH * 1.4), 0.0, 1.0);
	vec3 h = normalize(L + vec3(0.0, 0.0, 1.0));
	float glint = pow(max(dot(n, h), 0.0), 70.0) * (1.0 - s * 0.6);
	face += rimTone * uHighlight * (rim * (0.45 + 0.9 * facing) + seam * (0.12 + 0.4 * facing) + glint * 1.4);

	float inside = clamp(d / (pxH * 1.5), 0.0, 1.0);
	gl_FragColor = vec4(mix(col, face, smoothstep(0.0, 1.0, inside)), 1.0);
}
`;

/** The default light and tint: acid green, and clear glass. */
const COLORS = ['#c6ff00', '#ffffff'];

/** Where the shape sits by default: the right half. */
const AREA = { x: 0.45, y: 0.05, width: 0.55, height: 0.9 };

/** How far the slab turns on its own, and how much further the pointer can turn it. */
const SWAY = 0.07;
const LEAN = 0.16;

/** How far the light shifts with the pointer: a touch of parallax, no more. */
const PARALLAX = 0.012;

/**
 * Starts glass on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {GlassGlyphConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function glassGlyph(el, config) {
	let colors = pickColors(config, COLORS, (p) => [p.colors[0], p.glint]);
	const start = performance.now();
	const area = config.area ?? AREA;
	// The light's crossing, 0–1 with y up as the shader has it.
	const cross = { x: config.light?.x ?? area.x + area.width * 0.42, y: 1 - (config.light?.y ?? area.y + area.height * 0.6) };
	const sway = config.sway ?? 1;
	const tilt = { x: 0, y: 0 };
	const shift = { x: 0, y: 0 };
	/** Bumped on each resize, so a slow shape drawn for an old size is dropped. */
	let generation = 0;

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		setup({ gl, uniform }) {
			gl.uniform1i(uniform('uSdf'), 0);
			gl.uniform1f(uniform('uRefraction'), config.refraction ?? 1);
			gl.uniform1f(uniform('uBevel'), config.thickness ?? 0.035);
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
			drawShape({ text: config.text, font: config.font, src: config.src, area, padding: 0.06 }, width, height)
				.then((mask) => {
					if (mine !== generation) return;
					// Reaching well past the bevel, blurred a little so the edges' slope is smooth.
					const spread = Math.round(width / 12);
					const sdf = blurField(distanceField(mask, spread), width, height, width / 200);
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
			// A still frame is held at a moment where the slab is turned a little, so its walls show.
			const t = still ? 7 : (now - start) / 1000;
			// The slab turns slowly on its own, and leans away from the pointer, showing the wall on its side.
			const lean = p?.inside ? { x: (0.5 - p.x) * 2, y: (0.5 - p.y) * 2 } : { x: 0, y: 0 };
			const goal = {
				x: (Math.sin(t * 0.31) * 0.7 + Math.sin(t * 0.13 + 2) * 0.3) * SWAY + lean.x * LEAN,
				y: (Math.sin(t * 0.23 + 1.3) * 0.7 + Math.sin(t * 0.11) * 0.3) * SWAY * 0.7 + lean.y * LEAN * 0.6,
			};
			const ease = still ? 1 : 0.04;
			tilt.x += (goal.x * sway - tilt.x) * ease;
			tilt.y += (goal.y * sway - tilt.y) * ease;
			shift.x += (-lean.x * PARALLAX - shift.x) * ease;
			shift.y += (-lean.y * PARALLAX - shift.y) * ease;
			gl.uniform2f(uniform('uTilt'), tilt.x, tilt.y);
			gl.uniform2f(uniform('uCross'), cross.x + shift.x, cross.y + shift.y);
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
