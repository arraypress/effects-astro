/**
 * @module @arraypress/effects-astro/iso-city/shaders
 *
 * The city's shaders. One program draws everything: the static city (its
 * per-instance attributes left at rest), the cars and people instanced, and
 * the pin, ring and route. Light is flat: an ambient, a sky term that
 * favours faces turned up, and one sun, so every material shows three
 * tones (roof, lit wall, shaded wall). The ground takes soft shadows from
 * a baked map, walls darken towards their feet, windows are drawn from each
 * wall's window-cell uv, and everything fades into the background towards
 * the edges of the city, and behind copy (`quiet`).
 */

import { GLSL_OKLAB } from '../color.js';
import { GLSL_QUIET } from '../glsl.js';
import { MAT } from './scene.js';
import { SLAB, STOREY } from './plan.js';

/** GLSL: `vec3 backdrop(vec2 fragCoord)`, the ground behind the city, shared so the fog meets it exactly. */
const GLSL_BACKDROP = `
uniform vec3 uBackground;
uniform vec2 uRes;
vec3 backdrop(vec2 frag) {
	vec2 q = frag / uRes - vec2(0.5, 0.62);
	return uBackground * (1.0 + 0.035 * (1.0 - smoothstep(0.0, 0.7, length(q * vec2(uRes.x / uRes.y, 1.0)))));
}
`;

/** The full-screen pass under the city: the backdrop. */
export const BACKGROUND = `
precision highp float;
${GLSL_BACKDROP}
void main() { gl_FragColor = vec4(backdrop(gl_FragCoord.xy), 1.0); }
`;

/** Every mesh's vertex shader: a vertex of its own frame, turned and placed by its instance, then seen by the camera. */
export const VERTEX = `
precision highp float;
attribute vec3 p;
attribute vec3 aNormal;
attribute vec3 aColor;
attribute vec2 aUv;
attribute vec2 aTag;
attribute vec4 iPlace;
attribute vec4 iPaint;
attribute vec4 iState;
uniform mat4 uView;
uniform vec2 uShadowShift;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec2 vUv;
varying vec2 vTag;
varying vec4 vPaint;
varying vec2 vState;
void main() {
	vec3 l = p * iState.z;
	// A squash for the pickup bounce: shorter and a little wider, or taller and slimmer.
	l.y *= iState.y;
	l.xz *= 1.0 + (1.0 - iState.y) * 0.6;
	// Only taxis wear the roof sign.
	if (abs(aTag.x - ${MAT.sign}.0) < 0.5 && iPaint.w < 0.5) l = vec3(0.0);
	float c = cos(iPlace.z);
	float s = sin(iPlace.z);
	vec3 w = vec3(c * l.x - s * l.z, l.y + iPlace.w, s * l.x + c * l.z) + vec3(iPlace.x, 0.0, iPlace.y);
	if (abs(aTag.x - ${MAT.blob}.0) < 0.5) {
		// Shadows stay on the ground, fall away from the sun, and shrink as their caster rises.
		w.y = l.y;
		w.xz += uShadowShift * (0.08 + iPlace.w);
	}
	vWorld = w;
	vNormal = vec3(c * aNormal.x - s * aNormal.z, aNormal.y, s * aNormal.x + c * aNormal.z);
	vColor = aColor;
	vUv = aUv;
	vTag = aTag;
	vPaint = iPaint;
	vState = vec2(iState.x, iState.w);
	gl_Position = uView * vec4(w, 1.0);
}
`;

/** Every mesh's fragment shader: its material, lit, fogged, premultiplied. */
export const FRAGMENT = `
precision highp float;
${GLSL_BACKDROP}
${GLSL_OKLAB}
${GLSL_QUIET}
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec2 vUv;
varying vec2 vTag;
varying vec4 vPaint;
varying vec2 vState;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uSky;
uniform vec3 uEye;
uniform vec3 uAccent;
uniform vec3 uWindow;
uniform float uNight;
uniform float uTime;
uniform float uPixel;
uniform sampler2D uShadow;
uniform vec3 uShadowRect;
uniform vec4 uFog;
uniform vec4 uRoute;
uniform float uPulse;

float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }

// Flat light: ambient, sky (more for faces turned up), and the sun unless shadowed.
vec3 lit(vec3 base, vec3 n, float shade) {
	float sun = max(dot(n, uSun), 0.0) * (1.0 - shade);
	return base * (uAmbient * (1.0 - 0.22 * shade) + uSky * (0.55 + 0.45 * n.y) + uSunColor * sun);
}

// 1 inside a box of a cell (lo to hi), softened by about a pixel.
float pane(vec2 f, vec2 lo, vec2 hi, vec2 soft) {
	vec2 a = smoothstep(lo - soft, lo + soft, f) * (1.0 - smoothstep(hi - soft, hi + soft, f));
	return a.x * a.y;
}

void main() {
	float mat = floor(vTag.x + 0.5);
	vec3 n = normalize(vNormal);
	float shade = 0.0;
	if (vWorld.y < 0.1 && mat < 1.5) {
		shade = texture2D(uShadow, (vWorld.xz - uShadowRect.xy) * uShadowRect.z).r * (1.0 - smoothstep(0.06, 0.1, vWorld.y));
	}
	vec3 col;
	float alpha = 1.0;
	float added = 0.0;
	if (mat == ${MAT.plain}.0) {
		col = lit(vColor, n, shade);
	} else if (mat == ${MAT.wall}.0) {
		// Walls darken a little towards the pavement.
		float ao = mix(0.8, 1.0, smoothstep(${SLAB}, ${SLAB + 0.32}, vWorld.y));
		vec3 wall = lit(vColor, n, shade) * ao;
		float style = floor(vTag.y);
		float seed = fract(vTag.y);
		vec2 f = fract(vUv);
		vec2 cell = floor(vUv);
		vec2 soft = vec2(uPixel / 0.19, uPixel / ${STOREY}) * 0.9;
		bool shop = vWorld.y < ${SLAB + STOREY};
		float w;
		if (shop) w = pane(f, vec2(0.07, 0.12), vec2(0.93, 0.8), soft);
		else if (style < 0.5) w = pane(f, vec2(0.24, 0.3), vec2(0.76, 0.8), soft);
		else if (style < 1.5) w = pane(vec2(0.5, f.y), vec2(0.0, 0.32), vec2(1.0, 0.78), soft);
		else w = pane(f, vec2(0.05, 0.08), vec2(0.95, 0.94), soft);
		w *= step(0.0, vUv.y);
		// Too small to draw sharply: an even tone instead of shimmering panes.
		float size = min(0.19, ${STOREY}) / uPixel;
		float sharp = smoothstep(2.5, 4.5, size);
		w = mix(0.3, w, sharp);
		vec3 glass = lit(mix(vColor, vec3(0.5, 0.6, 0.68), 0.45), n, shade) * (0.84 + 0.1 * f.y);
		if (uNight > 0.5) {
			float on = step(hash(cell + seed * 61.0 + n.xz * 7.0), shop ? 0.55 : 0.2 + seed * 0.45);
			vec3 warm = uWindow * (0.75 + 0.35 * hash(cell * 1.7 + seed));
			glass = mix(glass * 0.6, warm, on * mix(0.5, 1.0, sharp));
		}
		col = mix(wall, glass, w);
	} else if (mat == ${MAT.glass}.0) {
		vec3 r = reflect(-uSun, n);
		float spec = pow(max(dot(r, uEye), 0.0), 14.0);
		float rim = pow(1.0 - max(dot(n, uEye), 0.0), 2.0);
		col = lit(vColor, n, 0.0) + spec * 0.5 * (1.0 - uNight * 0.7) + rim * uSky * 0.6;
	} else if (mat == ${MAT.body}.0) {
		vec3 r = reflect(-uSun, n);
		col = lit(vPaint.rgb, n, 0.0) + pow(max(dot(r, uEye), 0.0), 10.0) * 0.12;
	} else if (mat == ${MAT.head}.0) {
		col = mix(lit(vec3(0.96), n, 0.0), vec3(1.4, 1.35, 1.25), uNight);
	} else if (mat == ${MAT.tail}.0) {
		col = mix(lit(vColor, n, 0.0), vColor * 1.4, max(uNight * 0.8, vState.x));
	} else if (mat == ${MAT.sign}.0) {
		col = mix(lit(vColor, n, 0.0), vec3(1.25, 1.2, 1.05), uNight);
	} else if (mat == ${MAT.accent}.0) {
		col = lit(uAccent, n, 0.0) + uAccent * 0.15 * uNight;
	} else if (mat == ${MAT.lamp}.0) {
		col = mix(lit(vColor, n, 0.0), vec3(1.3, 1.1, 0.8), uNight);
	} else if (mat == ${MAT.water}.0) {
		float ripple = sin(vWorld.x * 9.0 + uTime * 0.9) * sin(vWorld.z * 7.0 - uTime * 0.7);
		col = lit(vColor, n, shade) * (1.0 + 0.04 * ripple) + smoothstep(0.75, 1.0, ripple) * 0.08;
	} else if (mat == ${MAT.route}.0) {
		// A dashed line flowing towards the pin, shown from the taxi (trim) to as far as it has been drawn (reveal).
		float d = vUv.x;
		float edge = 1.0 - smoothstep(0.55, 1.0, abs(vUv.y));
		float dash = smoothstep(0.0, 0.08, fract((d - uTime * 0.55) / 0.26)) * (1.0 - smoothstep(0.55, 0.63, fract((d - uTime * 0.55) / 0.26)));
		float shown = smoothstep(uRoute.x, uRoute.x + 0.25, d) * (1.0 - smoothstep(uRoute.y - 0.15, uRoute.y, d));
		alpha = edge * shown * mix(0.35, 1.0, dash) * uRoute.z;
		col = uAccent * alpha;
		added = 0.0;
	} else if (mat == ${MAT.blob}.0) {
		float r = length(vUv);
		alpha = (1.0 - smoothstep(0.25, 1.0, r)) * mix(0.32, 0.55, uNight) * (1.0 - vState.y);
		col = vec3(0.0);
	} else if (mat == ${MAT.glow}.0) {
		float r = length(vUv);
		float g = pow(max(0.0, 1.0 - r), 2.2) * uNight;
		col = vColor * g * 0.55;
		alpha = 0.0;
		added = 1.0;
	} else if (mat == ${MAT.beam}.0) {
		float g = pow(1.0 - vUv.x, 1.6) * (1.0 - smoothstep(0.35, 1.0, abs(vUv.y))) * uNight;
		col = vColor * g * 0.7;
		alpha = 0.0;
		added = 1.0;
	} else {
		// The pin's ring: one pulse spreading out, and a faint resting circle.
		float r = length(vUv);
		float wave = 1.0 - smoothstep(0.0, 0.06, abs(r - uPulse * 0.95));
		float rest = 1.0 - smoothstep(0.0, 0.035, abs(r - 0.42));
		alpha = (wave * (1.0 - uPulse) * 0.8 + rest * 0.5) * uRoute.z;
		col = uAccent * alpha;
	}

	// Fog towards the city's edges, and behind copy.
	vec2 e = abs(vWorld.xz - uFog.xy);
	float far = pow(pow(e.x, 4.0) + pow(e.y, 4.0), 0.25);
	float fog = smoothstep(uFog.z, uFog.w, far);
	vec2 q = (gl_FragCoord.xy / uRes - 0.5) * vec2(uRes.x / uRes.y, 1.0);
	fog = max(fog, (1.0 - quietOpen(q)) * uQuiet.w);
	// Haze towards the top of the screen, which is further away.
	fog = max(fog, smoothstep(0.6, 1.08, gl_FragCoord.y / uRes.y) * 0.4);
	vec3 bg = backdrop(gl_FragCoord.xy);
	if (mat >= ${MAT.route}.0) {
		gl_FragColor = vec4(col * (1.0 - fog), alpha * (1.0 - fog) * (1.0 - added));
	} else {
		gl_FragColor = vec4(oklabMix(clamp(col, 0.0, 1.0), bg, fog), 1.0);
	}
}
`;
