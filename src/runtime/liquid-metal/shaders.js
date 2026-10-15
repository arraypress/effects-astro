/**
 * @module @arraypress/effects-astro/liquid-metal/shaders
 *
 * The liquid metal's GLSL (ES 1.00): the step of its wave simulation, and
 * the render that draws the logo as polished chrome in a studio.
 *
 * Both work in the logo's box (the area round it the simulation covers):
 * `uv` 0–1 across it with y up, and distances in box heights. The shape is
 * a distance field (src/runtime/shape.js) packed in a byte texture: 0.5 at
 * the edge, rising inside. The simulation's state is a float texture: r
 * the surface's height off its rest, g its vertical speed.
 */

import { GLSL_OKLAB } from '../color.js';
import { GLSL_HEIGHT_FIELD } from '../height-field.js';

/** The most droplets the render draws. */
export const MAX_BEADS = 24;

/** The distance field, read in box heights: positive inside, negative outside. */
const FIELD = `
uniform sampler2D uSdf;
uniform float uSpread;
float field(vec2 uv) { return (texture2D(uSdf, vec2(uv.x, 1.0 - uv.y)).r - 0.5) * 2.0 * uSpread; }
`;

/**
 * One pass of a gaussian blur (`uStep` one texel along it), into a float
 * target: run across then down over the byte field, it smooths the bytes'
 * steps into ramps, which the bevel's slope would otherwise show as
 * stripes.
 */
export const SMOOTH = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uStep;
void main() {
	float sum = 0.0;
	float total = 0.0;
	for (int i = -8; i <= 8; i++) {
		float w = exp(-float(i * i) / 18.0);
		sum += texture2D(uSource, vUv + uStep * float(i)).r * w;
		total += w;
	}
	gl_FragColor = vec4(sum / total, 0.0, 0.0, 1.0);
}
`;

/**
 * One step of the wave (on src/runtime/height-field.js): a damped wave
 * equation on the height, with a spring pulling every cell back to its
 * rest (the surface tension that reforms the logo) and a little viscosity
 * smoothing the speed, so small ripples die first. Waves run only through
 * the metal (and just past its edge, where a swell pushes the outline
 * out); elsewhere they are damped away.
 */
export const STEP = `
precision highp float;
varying vec2 vUv;
uniform float uBevel;
uniform float uBulge;
${GLSL_HEIGHT_FIELD}
${FIELD}
void main() {
	vec4 s = waveState(vUv);
	float h = s.x;
	// Metal is where the shape is, or where a swell has pushed its edge out to.
	float metal = smoothstep(-uBevel * 1.5, 0.0, field(vUv) + max(h, 0.0) * uBulge);
	float v = s.y + waveForce(s) - wavePushes(vUv);
	v *= mix(0.55, uMotion.z, metal);
	h = (h + v) * mix(0.8, 1.0, metal);
	gl_FragColor = wavePack(h, v);
}
`;

/**
 * The render. The logo is a slab of metal seen from in front, a little in
 * perspective (`uLens`), so its flat face reflects a sweep of the studio:
 * sky above the horizon, floor below, with the horizon's bright line across
 * it. Its edges round over in a quarter circle (`uBevel` wide), so they
 * catch the softboxes round the room and darken where they turn away. The
 * waves tilt the surface and push the outline in or out; droplets are
 * spheres, drawn on top while they fly and melting into the edge as they
 * crawl back. Output is premultiplied: transparent round the logo, with a
 * soft shadow under it.
 */
export const RENDER = `
precision highp float;
uniform vec2 uRes;
uniform vec4 uBox;
uniform float uAspect;
uniform vec2 uSdfTexel;
uniform sampler2D uState;
uniform vec2 uStateTexel;
uniform float uWaves;
uniform float uBevel;
uniform float uBulge;
uniform float uWave;
uniform vec2 uCentre;
uniform float uLens;
uniform float uSpin;
uniform float uPx;
uniform float uShadow;
uniform vec3 uMetal;
uniform vec3 uSky;
uniform vec3 uBand;
uniform vec3 uFloor;
uniform vec4 uBeads[${MAX_BEADS}];
uniform int uBeadCount;
${FIELD}
${GLSL_OKLAB}

// A softbox: a bright panel with soft edges. at: azimuth, elevation, half
// width (radians), half height (elevation).
float softbox(float az, float el, vec4 at) {
	float da = abs(mod(az - at.x + 3.14159265, 6.2831853) - 3.14159265) / at.z;
	float de = abs(el - at.y) / at.w;
	float edge = pow(pow(da, 6.0) + pow(de, 6.0), 1.0 / 6.0);
	return smoothstep(1.0, 0.7, edge);
}

// The studio, in linear light, by the direction a reflection leaves in (y up,
// z towards the viewer): sky, a bright horizon, a dark floor, softboxes
// round the walls and a light overhead. The room turns slowly (uSpin), so
// the reflections glide.
vec3 studio(vec3 r) {
	float el = r.y;
	float az = atan(r.x, r.z) - uSpin;
	// The room is lit in front of the logo and dim behind it.
	float front = smoothstep(-0.8, 0.5, r.z);
	vec3 sky = oklabToLinear(uSky) * (0.05 + 0.75 * exp(-max(el, 0.0) * 4.0));
	vec3 ground = oklabToLinear(uFloor) * (0.008 + 0.16 * smoothstep(-0.03, -0.55, el));
	// A pool of light on the floor, a band across the lower face.
	ground += oklabToLinear(uFloor) * exp(-pow((el + 0.21) / 0.07, 2.0)) * 0.22;
	vec3 col = mix(ground, sky, smoothstep(-0.006, 0.006, el)) * mix(0.25, 1.0, front);
	col += oklabToLinear(uBand) * (exp(-abs(el - 0.004) / 0.008) * 2.2 + exp(-abs(el) / 0.07) * 0.25) * mix(0.08, 1.0, front);
	col += vec3(4.5) * softbox(az, el, vec4(-0.95, 0.4, 0.42, 0.18));
	col += vec3(6.0) * softbox(az, el, vec4(1.3, 0.16, 0.12, 0.4));
	col += vec3(2.5) * softbox(az, el, vec4(2.7, 0.25, 0.35, 0.1));
	col += vec3(2.2) * smoothstep(0.8, 0.96, el);
	return col;
}

// The key light: a small hard lamp, for the sharp glints on curves.
float key(vec3 r) {
	float a = 0.75 + uSpin;
	vec3 l = normalize(vec3(sin(a) * 0.8, 0.6, cos(a) * 0.8));
	return pow(max(dot(r, l), 0.0), 1800.0) * 60.0;
}

// The metal at a point with a normal: the studio reflected, by Fresnel's
// law (the metal's colour face on, white at grazing angles), plus a faint
// film's colour where it turns away.
vec3 metal(vec3 n, vec2 p) {
	vec3 eye = normalize(vec3((p - uCentre) * uLens, -1.0));
	vec3 r = reflect(eye, n);
	float facing = clamp(dot(n, -eye), 0.0, 1.0);
	vec3 f0 = oklabToLinear(uMetal);
	vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - facing, 5.0);
	vec3 col = (studio(r) + key(r)) * fresnel;
	float graze = pow(1.0 - facing, 3.0);
	col *= mix(vec3(1.0), 0.8 + 0.2 * cos(6.2831853 * (vec3(0.0, 0.33, 0.67) + graze * 1.3 + 0.15)), graze * 0.5);
	return col;
}

// Linear light to the screen: a filmic curve (Narkowicz's ACES fit), then sRGB.
vec3 toScreen(vec3 c) {
	c *= 0.9;
	c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
	return oklabToSrgb(c);
}

// The bevel's profile: a quarter circle from the edge (0) to the flat top
// (1); returns its height and its slope. The slope is capped just short of
// upright, so the outermost pixel does not flicker between reflections.
vec2 profile(float x) {
	x = clamp(x, 0.0, 1.0);
	float s = sqrt(max(2.0 * x - x * x, 0.012));
	return vec2(s, (1.0 - x) / s);
}

void main() {
	vec2 uv = (gl_FragCoord.xy / uRes - uBox.xy) / uBox.zw;
	if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0); return; }
	vec2 p = uv * vec2(uAspect, 1.0);
	float d = field(uv);
	if (d < -uSpread * 0.97 && uBeadCount == 0) { gl_FragColor = vec4(0.0); return; }

	// The rest shape's slope. A distance field's gradient is a unit vector,
	// so only its direction is read: the bytes' steps do not ripple the chrome.
	vec2 e = uSdfTexel * 2.0;
	vec2 g = vec2(field(uv + vec2(e.x, 0.0)) - field(uv - vec2(e.x, 0.0)), field(uv + vec2(0.0, e.y)) - field(uv - vec2(0.0, e.y)));
	vec2 inward = g / max(length(g), 1e-6);

	// The waves: height off the rest, and its slope per box height.
	float h = 0.0;
	vec2 gh = vec2(0.0);
	if (uWaves > 0.5) {
		vec2 s = uStateTexel;
		h = texture2D(uState, uv).r;
		gh = vec2(texture2D(uState, uv + vec2(s.x, 0.0)).r - texture2D(uState, uv - vec2(s.x, 0.0)).r, texture2D(uState, uv + vec2(0.0, s.y)).r - texture2D(uState, uv - vec2(0.0, s.y)).r) / (2.0 * s * vec2(uAspect, 1.0));
	}

	// The outline, moved by the waves: a swell pushes it out, a dent pulls it in (and parts it).
	float de = d + h * uBulge;
	vec2 gde = inward + gh * uBulge;
	float bevel = uBevel;
	float shadow = uShadow * pow(clamp((field(uv + vec2(0.0, 0.014)) + h * uBulge + 0.05) / 0.06, 0.0, 1.0), 2.0) * 0.6;

	// Droplets: those crawling back melt into the edge (a smooth union, so a
	// neck of metal reaches out to them); those in the air sit on top.
	vec3 drop = vec3(0.0, 0.0, 1.0);
	float dropCover = 0.0;
	float dropTop = -1.0;
	float shade = 0.0;
	for (int i = 0; i < ${MAX_BEADS}; i++) {
		if (i >= uBeadCount) break;
		vec4 b = uBeads[i];
		vec2 off = p - b.xy;
		float len = length(off);
		if (b.w < 0.0) {
			float db = b.z - len;
			float k = b.z * 1.4;
			float m = clamp(0.5 + 0.5 * (db - de) / k, 0.0, 1.0);
			de = mix(de, db, m) + k * m * (1.0 - m);
			gde = mix(gde, -off / max(len, 1e-5), m);
			bevel = mix(bevel, b.z, m);
		} else {
			// Its shadow, cast down and wider the higher it flies.
			vec2 under = off + vec2(0.0, b.w * 0.5 + b.z * 0.4);
			shade = max(shade, exp(-dot(under, under) / (b.z * b.z * (1.2 + b.w * 60.0))) * 0.55);
			float cover = smoothstep(b.z + uPx, b.z - uPx, len);
			if (cover > 0.0 && b.w > dropTop) {
				vec2 q = off / b.z;
				drop = vec3(q, sqrt(max(1.0 - dot(q, q), 0.0)) + 0.05);
				dropCover = cover;
				dropTop = b.w;
			}
		}
	}

	// Premultiplied: the metal, a droplet over it, and the shadows under both.
	vec4 out_ = vec4(0.0);
	float cover = smoothstep(-uPx, uPx, de);
	if (cover > 0.0) {
		vec2 slope = profile(de / bevel);
		vec3 n = normalize(vec3(-(gde * slope.y + gh * uWave * bevel), 1.0));
		out_ = vec4(toScreen(metal(n, p) * (1.0 - shade)), 1.0) * cover;
	}
	if (dropCover > 0.0) out_ = vec4(toScreen(metal(normalize(drop), p)), 1.0) * dropCover + out_ * (1.0 - dropCover);
	out_.a += max(shadow, shade) * (1.0 - out_.a);
	gl_FragColor = out_;
}
`;
