/**
 * @module @arraypress/effects-astro/ink-field/shaders
 *
 * The ink field's GLSL (ES 1.00): the passes of its stable-fluids sim, and
 * the display that draws the dye as ink in water, lit by a lamp.
 *
 * Adapted from Trirat's ink shader for LumiThemes (smoke-sim.ts), itself
 * ported from a reference stable-fluids sim (Jos Stam's Stable Fluids). The
 * GLSL is his, unchanged: the display's noise is glsl.js's `GLSL_NOISE`,
 * which is the same code, and every pass uses gl.js's `VERTEX`, which is his
 * vertex shader with its precision written out.
 *
 * Velocity is in grid cells per second; `uTxl` converts cells to uv.
 *
 * Dye channels: r is the ink's density, g its density times a palette
 * phase, b its density times a stripe pattern. The display maps the phase
 * through the live palette, so new colours reach ink already on screen.
 */

import { GLSL_NOISE } from '../glsl.js';

/** Moves a quantity along the velocity, and lets it decay by `uDiss`. */
export const ADVECT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVel, uQty;
uniform vec2 uTxl;
uniform float uDt, uDiss;
void main() {
	vec2 v = texture2D(uVel, vUv).xy;
	vec2 at = clamp(vUv - v * uTxl * uDt, 0.0, 1.0);
	gl_FragColor = uDiss * texture2D(uQty, at);
}
`;

/** The velocity's divergence: how much flows out of each cell. */
export const DIVERGENCE = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVel;
uniform vec2 uTxl;
void main() {
	float l = texture2D(uVel, vUv - vec2(uTxl.x, 0.0)).x;
	float r = texture2D(uVel, vUv + vec2(uTxl.x, 0.0)).x;
	float b = texture2D(uVel, vUv - vec2(0.0, uTxl.y)).y;
	float t = texture2D(uVel, vUv + vec2(0.0, uTxl.y)).y;
	gl_FragColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}
`;

/** One Jacobi iteration of the pressure solve. */
export const PRESSURE = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPres, uDiv;
uniform vec2 uTxl;
void main() {
	float l = texture2D(uPres, vUv - vec2(uTxl.x, 0.0)).x;
	float r = texture2D(uPres, vUv + vec2(uTxl.x, 0.0)).x;
	float b = texture2D(uPres, vUv - vec2(0.0, uTxl.y)).x;
	float t = texture2D(uPres, vUv + vec2(0.0, uTxl.y)).x;
	float d = texture2D(uDiv, vUv).x;
	gl_FragColor = vec4((l + r + b + t - d) * 0.25, 0.0, 0.0, 1.0);
}
`;

/** Subtracts the pressure's gradient, leaving the velocity divergence-free. */
export const GRADIENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPres, uVel;
uniform vec2 uTxl;
void main() {
	float l = texture2D(uPres, vUv - vec2(uTxl.x, 0.0)).x;
	float r = texture2D(uPres, vUv + vec2(uTxl.x, 0.0)).x;
	float b = texture2D(uPres, vUv - vec2(0.0, uTxl.y)).x;
	float t = texture2D(uPres, vUv + vec2(0.0, uTxl.y)).x;
	gl_FragColor = vec4(texture2D(uVel, vUv).xy - 0.5 * vec2(r - l, t - b), 0.0, 1.0);
}
`;

/** The velocity's curl. */
export const CURL = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVel;
uniform vec2 uTxl;
void main() {
	float l = texture2D(uVel, vUv - vec2(uTxl.x, 0.0)).y;
	float r = texture2D(uVel, vUv + vec2(uTxl.x, 0.0)).y;
	float b = texture2D(uVel, vUv - vec2(0.0, uTxl.y)).x;
	float t = texture2D(uVel, vUv + vec2(0.0, uTxl.y)).x;
	gl_FragColor = vec4(0.5 * (r - l - (t - b)), 0.0, 0.0, 1.0);
}
`;

/** Vorticity confinement: pushes along the curl, so eddies keep turning. */
export const VORTICITY = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVel, uCurl;
uniform vec2 uTxl;
uniform float uStrength, uDt;
void main() {
	float l = abs(texture2D(uCurl, vUv - vec2(uTxl.x, 0.0)).x);
	float r = abs(texture2D(uCurl, vUv + vec2(uTxl.x, 0.0)).x);
	float b = abs(texture2D(uCurl, vUv - vec2(0.0, uTxl.y)).x);
	float t = abs(texture2D(uCurl, vUv + vec2(0.0, uTxl.y)).x);
	float c = texture2D(uCurl, vUv).x;
	vec2 eta = normalize(vec2(t - b, r - l) + vec2(1e-5));
	vec2 f = uStrength * vec2(eta.y, -eta.x) * c;
	gl_FragColor = vec4(texture2D(uVel, vUv).xy + f * uDt, 0.0, 1.0);
}
`;

/** Adds a soft round splat to a field: velocity in xy, or ink laid in stripes. */
export const SPLAT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uAt;
uniform vec3 uVal;
uniform vec2 uStripe;
uniform float uRad, uAsp;
void main() {
	vec2 d = vUv - uAt;
	d.x *= uAsp;
	float g = exp(-dot(d, d) / (uRad * uRad));
	// Z is laid down in stripes (angle, frequency): layers inside the ink that
	// the flow then stretches into folds. Velocity splats put nothing in Z.
	vec2 dir = vec2(cos(uStripe.x), sin(uStripe.x));
	float s = 0.5 + 0.5 * sin(dot(d, dir) * uStripe.y + uStripe.x * 7.0);
	gl_FragColor = vec4(texture2D(uSrc, vUv).xyz + g * vec3(uVal.xy, uVal.z * s), 1.0);
}
`;

/**
 * Ink in water, lit by the palette. The dye is read as the amount of ink in
 * the light's path: soft pale veils where it is thin, deep saturated cores
 * where it is thick, clear water between. It stands as a surface, lit by one
 * lamp (a point above the plane): wrapped diffuse, soft shade from ink in
 * front, light coming through the thin parts, and only the faintest sheen.
 * The glint colour is unused here.
 *
 * Tunable, at the top: BUMP (how steep the ink's surface is), LAMP_Z (how
 * high the lamp hangs), AMBIENT (light left on the shadowed side) and SHEEN.
 */
export const DISPLAY = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uDye;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uPal[3];
uniform vec3 uGlint;
uniform vec2 uDyeTxl;
uniform vec2 uLight;

// Tunable: how steep the ink's surface is, how high the lamp hangs, how much
// of the ambient light is left on the shadowed side, and the (very soft) sheen.
const float BUMP = 0.05;
const float LAMP_Z = 0.5;
const float AMBIENT = 0.38;
const float SHEEN = 0.08;

// How much ink stands at a point: its amount and its layers.
float thick(vec2 q) {
	vec4 d = texture2D(uDye, q);
	return 0.75 * d.r + 0.5 * d.b;
}

${GLSL_NOISE}
vec3 pal(float t) {
	float x = fract(t) * 3.0;
	float k = smoothstep(0.0, 1.0, fract(x));
	if (x < 1.0) return mix(uPal[0], uPal[1], k);
	if (x < 2.0) return mix(uPal[1], uPal[2], k);
	return mix(uPal[2], uPal[0], k);
}

void main() {
	vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
	float t = uTime * 0.05;

	// A light warp only: the sim makes the tendrils, this roughs them a little.
	vec2 w = vec2(fbm(uv * 3.2 + vec2(0.0, t * 2.0)), fbm(uv * 3.2 + vec2(5.2, -t * 2.0))) - 0.5;
	vec4 dye = texture2D(uDye, vUv + w * 0.014);

	// How much ink is in the light's path. Clear water stays clear (the floor),
	// thin ink is a pale veil, thick ink is deep and nearly opaque.
	float ink = 1.0 - exp(-dye.r * 2.1);
	ink = smoothstep(0.02, 1.0, ink);
	// The layers inside the ink (Z of the dye, as a share of what is there).
	float stri = clamp(dye.b / max(dye.r, 1e-3), 0.0, 1.2);
	ink *= 0.72 + 0.4 * stri;
	ink *= 0.94 + 0.12 * fbm(uv * 6.0 + w * 3.0 + t * 2.0);

	// The ink as a surface: its thickness is the height, and the lamp lights
	// it. Sampled a texel and a half out, so the dye's grid does not show.
	vec2 q = vUv + w * 0.014;
	vec2 e = 1.5 * uDyeTxl;
	float h = thick(q);
	vec2 slope = vec2(thick(q + vec2(e.x, 0.0)) - thick(q - vec2(e.x, 0.0)),
	                  thick(q + vec2(0.0, e.y)) - thick(q - vec2(0.0, e.y))) / (2.0 * e);
	vec3 n = normalize(vec3(-slope * BUMP, 1.0));

	float aspect = uRes.x / uRes.y;
	vec2 lamp = (uLight - 0.5) * vec2(aspect, 1.0);
	vec3 toLamp = vec3(lamp - uv, LAMP_Z);
	float lampDist = length(toLamp);
	vec3 l = toLamp / lampDist;

	// Wrapped diffuse, so the far side of a fold is dim, not black.
	float diffuse = pow(clamp(dot(n, l) * 0.5 + 0.5, 0.0, 1.0), 1.5);
	float reach = 0.55 + 0.9 / (1.0 + 2.2 * lampDist * lampDist);

	// Ink in front of the lamp shades the ink behind it: three taps toward it.
	vec2 toward = normalize(l.xy + 1e-4) * vec2(1.0 / aspect, 1.0);
	float blocked = 0.0;
	blocked += max(thick(q + toward * 0.012) - h - 0.02, 0.0);
	blocked += max(thick(q + toward * 0.028) - h - 0.04, 0.0);
	blocked += max(thick(q + toward * 0.055) - h - 0.06, 0.0);
	float shade = exp(-blocked * 2.2);

	// Ink deepens as it thickens: the colour is raised to a power, which
	// darkens and saturates it, the way a thicker column of dye does.
	float phase = dye.g / max(dye.r, 1e-4);
	vec3 base = pal(phase + 0.1 * (fbm(uv * 2.4 + w * 2.0) - 0.5));
	vec3 albedo = pow(base, vec3(0.75 + 1.0 * ink));
	vec3 col = albedo * ink * (AMBIENT + 1.05 * diffuse * shade * reach);

	// Light through the thin parts: a glow where the ink is half there.
	col += base * (4.0 * ink * (1.0 - ink)) * 0.22 * shade * reach;

	// A broad, soft sheen on the lit side, not a highlight.
	vec3 hv = normalize(l + vec3(0.0, 0.0, 1.0));
	col += vec3(1.0, 0.92, 0.95) * pow(max(dot(n, hv), 0.0), 10.0) * SHEEN * ink * shade;

	// The water itself: a faint, slow glow the ink sits in, pushed aside by it.
	vec3 water = mix(pal(t * 0.6 + 0.15 * uv.y), pal(t * 0.6 + 0.5 + 0.2 * fbm(uv * 1.3)), 0.5);
	col += water * 0.07 * (1.0 - ink);

	// Dim behind the copy, and towards the corners.
	float copy = smoothstep(0.05, 0.8, length((uv - vec2(0.0, 0.02)) * vec2(1.05, 1.0)));
	col *= mix(0.3, 1.0, copy);
	col *= 1.0 - 0.45 * dot(uv * 0.55, uv * 0.55);

	// Grain, so the dark ramps do not band.
	col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.035;

	gl_FragColor = vec4(max(col, 0.0) + vec3(0.031, 0.031, 0.039), 1.0);
}
`;
