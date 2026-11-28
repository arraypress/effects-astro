/**
 * @module @arraypress/effects-astro/water-surface
 *
 * A close look at moving water, as a camera on a long lens sees it from just above the surface: ripples and small waves
 * running across the frame in perspective, the sky's light lying on their backs, the deep colour in their troughs,
 * the sun breaking into hard glints and a fine sparkle on the crests, and a shallow depth of field (sharp in a band
 * across the middle, soft in front and behind). No horizon: the frame looks down into the water.
 *
 * How it is made (the techniques, not any one shader; see docs/credits.md):
 * - **Waves**: a sum of directional waves drawn from a spectrum (long, low ones to short ripples, spread about the
 *   wind), each with the deep-water dispersion relation ω = √(gk), so the long ones travel faster as real waves do
 *   (Tessendorf; Finch, GPU Gems ch. 1). Most of the height is in a few long, gentle swells about a metre long with a
 *   narrow spread and smooth sine crests; the short ripples are peaked (`exp(sin φ − 1)`) and ride the swell's faces.
 *   The frequencies are rounded to whole turns of `loop` seconds, so the water repeats exactly.
 * - **View**: a ray per pixel from a camera a little above the water, pitched down past the horizon, meeting the
 *   surface; the longest waves lift it there (a few relaxation steps), so crests stand up against what is behind.
 * - **Filtering, focus**: each wave is faded where it is smaller than the pixel's footprint plus the lens's circle of
 *   confusion at that distance, and the slope it loses goes into the roughness of the sun's highlight (Bruneton,
 *   Neyret, Holzschuch 2010: geometry → normals → BRDF). So the water out of focus turns into the soft sheen and broad
 *   glow a real lens gives, without blurring passes; in focus it is sharp.
 * - **Light**: Schlick's Fresnel mixes the reflected sky (a gradient from the bright horizon to the darker zenith,
 *   with the sun's glow) with the water's own colour (deep in the troughs, lighter where light scatters through the
 *   thin crests); the sun's highlight is a Beckmann lobe; a sparkle of tiny facets flashes where the surface is in focus.
 *   A filmic shoulder, a little haze with distance, a soft vignette, fine grain.
 *
 * Everything is a function of the time (seconds); nothing is kept between frames (`waterHeight` is the surface in
 * plain JavaScript). Opaque: it paints the whole element. Without WebGL the CSS still (`waterStill`) shows; with
 * prefers-reduced-motion it is one frame.
 */

import { createStage } from './stage.js';
import { frameNow } from './loop.js';
import { parseColor, mixOklab, toHex } from './color.js';
import { isMobileGpu, pixelRatio } from './device.js';
import { GLSL_HASH33 } from './hash-noise.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { seededRandom } from './random.js';

/**
 * @typedef {object} WaterLook
 * @property {string} deep The water's colour in the troughs.
 * @property {string} scatter The colour light takes scattering through thin crests.
 * @property {string} horizon The sky low down (the brightest part reflected on the waves' backs).
 * @property {string} zenith The sky high up.
 * @property {string} sun The sun's (or the moon's) light.
 * @property {number} power How bright the sun is.
 * @property {number} height The sun's height, degrees.
 * @property {number} exposure The filmic exposure.
 */

/**
 * @typedef {object} WaterSurfaceConfig
 * @property {'dusk' | 'teal' | 'night' | 'golden' | 'ink'} [look='dusk'] The light and the water: dusk blue-grey, deep
 *   teal, night under the moon, golden hour, black ink.
 * @property {Partial<WaterLook>} [colors] Overrides for the look's colours and light.
 * @property {number} [waves=1] The sea state: 0.5 a calm ripple, 1 a breeze, 1.6 choppy.
 * @property {number} [wind=180] Where the waves run, degrees: 180 towards the camera (crests across the frame), 90 across.
 * @property {number} [pitch=26] How far the camera looks down, degrees (18–40).
 * @property {number} [sun=-22] Where the sun is, degrees left (−) or right (+) of straight ahead.
 * @property {number} [focus=0.5] Where the sharp band is, 0 the top of the frame to 1 the bottom.
 * @property {number} [aperture=1] How shallow the focus is: 0 all sharp, 1 the reference's, 2 very soft.
 * @property {number} [sparkle=1] How many tiny glints flash on the crests in focus.
 * @property {number} [rings=1] How strong the ring of ripples spreading from a point is; 0 for none.
 * @property {number} [loop=30] The seconds after which the water repeats exactly.
 * @property {number} [speed=1] Plays the clock faster or slower; 0 for one still frame.
 * @property {number} [grain=0.03] Fine grain; 0 for none.
 * @property {number} [seed=0] Picks the waves.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null] An area dimmed behind copy.
 */

/** The looks. */
export const WATER_LOOKS = {
	dusk: { deep: '#05192b', scatter: '#1d6a90', horizon: '#c3d2dc', zenith: '#4d7896', sun: '#ffe2bd', power: 4, height: 10, exposure: 1.6 },
	teal: { deep: '#03211f', scatter: '#0f6d64', horizon: '#8cc3bb', zenith: '#1b4a4c', sun: '#fff4dc', power: 3.6, height: 20, exposure: 1.3 },
	night: { deep: '#050c16', scatter: '#173250', horizon: '#3d5274', zenith: '#0e1828', sun: '#dfe8ff', power: 3, height: 16, exposure: 1.7 },
	golden: { deep: '#16120c', scatter: '#5b3f1b', horizon: '#e2a564', zenith: '#40364a', sun: '#ffcf8a', power: 4.2, height: 11, exposure: 1.25 },
	ink: { deep: '#080808', scatter: '#2a2a2a', horizon: '#808080', zenith: '#1e1e1e', sun: '#ffffff', power: 3.6, height: 15, exposure: 1.5 },
};

/** The settings' defaults. */
export const WATER_DEFAULTS = {
	look: 'dusk',
	waves: 1.15,
	wind: 180,
	pitch: 13,
	sun: -20,
	focus: 0.5,
	aperture: 1,
	sparkle: 1,
	loop: 30,
	speed: 1,
	grain: 0.022,
	seed: 0,
};

/** The most waves the shader sums, and how many of the longest also lift the surface. */
export const MAX_WAVES = 24;
export const GEOMETRY_WAVES = 6;
/** The camera: height above the water (metres) and the vertical field of view (degrees). */
const EYE = 0.62;
const FOV = 13; // a long lens: the whole frame looks along the water at a low angle, the swells stacked in rows
/** Gravity, for the dispersion relation. */
const G = 9.81;

/**
 * The settings filled with the defaults, and the look with its overrides.
 *
 * @param {WaterSurfaceConfig} config The settings.
 */
export function waterSettings(config = {}) {
	const o = { ...WATER_DEFAULTS, ...config };
	const look = { ...(WATER_LOOKS[o.look] ?? WATER_LOOKS.dusk), ...(config.colors ?? {}) };
	return { ...o, pitch: Math.min(40, Math.max(18, o.pitch)), loop: Math.max(4, o.loop), lookColors: look };
}

/**
 * The waves, longest first: each its direction (unit, on the water), wavenumber k (radians a metre), amplitude
 * (metres), angular frequency (radians a second, whole turns of `loop`) and phase. Seeded: the same settings give the
 * same water.
 *
 * @param {WaterSurfaceConfig} config The settings.
 * @param {number} [count=MAX_WAVES] How many.
 * @returns {{ dir: [number, number], k: number, amp: number, omega: number, phase: number }[]} The waves.
 */
export function waterWaves(config = {}, count = MAX_WAVES) {
	const o = waterSettings(config);
	const rnd = seededRandom(Math.round(o.seed * 1000) + 17);
	const n = Math.max(1, Math.min(MAX_WAVES, count));
	const longest = 1.25,
		shortest = 0.024;
	const out = [];
	for (let i = 0; i < n; i++) {
		const f = n === 1 ? 0 : i / (n - 1);
		// wavelengths spaced evenly in log between the longest and the shortest, a little jittered
		const lambda = longest * Math.pow(shortest / longest, f) * (0.9 + rnd() * 0.2);
		const k = (2 * Math.PI) / lambda;
		// a swell is a long, smooth, rounded form running close to one heading, so its few long waves keep a narrow spread
		// (their crests curve as they cross rather than chop); the fine ripples ride it, running with it, a little wider
		const spread = (f < 0.3 ? 0.22 : 0.28 + 0.32 * f) * (rnd() * 2 - 1);
		const a = ((o.wind + 90) * Math.PI) / 180 + spread;
		const dir = /** @type {[number, number]} */ ([Math.cos(a), Math.sin(a)]);
		// the spectrum: most of the height in swells about a metre long (big and gentle: low steepness, so they read as
		// rounded backs, not chop), little between, and wind ripples a few centimetres long riding them
		const swell = Math.exp(-Math.pow(Math.log(lambda / 0.6), 2) / 0.6);
		const mid = Math.exp(-Math.pow(Math.log(lambda / 0.16), 2) / 0.5);
		const ripple = Math.exp(-Math.pow(Math.log(lambda / 0.05), 2) / 0.4);
		const steep = o.waves * (0.02 + 0.19 * swell + 0.06 * mid + 0.12 * ripple) * (0.8 + rnd() * 0.4);
		const amp = steep / k;
		// the crest's shape: 0 a smooth sine (a rounded swell), 1 a peaked crest over a broad trough (a ripple)
		const peaked = Math.min(1, 0.15 + 1.1 * f);
		const turns = Math.max(1, Math.round((Math.sqrt(G * k) * o.loop) / (2 * Math.PI)));
		out.push({ dir, k, amp, peaked, omega: (2 * Math.PI * turns) / o.loop, phase: rnd() * 2 * Math.PI });
	}
	return out;
}

/**
 * A wave's profile at a phase: a smooth sine (`peaked` 0, a rounded swell) blended into a peaked crest over a broad
 * trough (`peaked` 1, `exp(sin φ − 1)`), both with the same mean, so changing the blend never lifts the water.
 *
 * @param {number} ph The phase.
 * @param {number} peaked 0–1.
 * @returns {number} The profile, about 0.13–1.
 */
const profile = (ph, peaked) => 0.4658 + 0.43 * Math.sin(ph) + peaked * (Math.exp(Math.sin(ph) - 1) - 0.4658 - 0.43 * Math.sin(ph));

/**
 * The surface's height at a point and a time (metres): the shader's wave sum, unfiltered.
 *
 * @param {WaterSurfaceConfig} config The settings.
 * @param {number} x Metres across.
 * @param {number} z Metres out from the camera.
 * @param {number} t Seconds.
 * @returns {number} The height.
 */
export function waterHeight(config, x, z, t) {
	let h = 0;
	for (const w of waterWaves(config)) {
		const ph = w.k * (w.dir[0] * x + w.dir[1] * z) - w.omega * t + w.phase;
		h += w.amp * (profile(ph, w.peaked) - 0.4658);
	}
	return h;
}

const FRAG = (n) => `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uLoop;
uniform vec4 uWave[${MAX_WAVES}];   // dir.xy, k, amp
uniform vec3 uWaveT[${MAX_WAVES}];  // omega, phase, peaked
uniform float uCount;
uniform float uPitch;
uniform float uTanH;
uniform float uEye;
uniform float uFocusD;
uniform float uAperture;
uniform float uSparkle;
uniform float uGrain;
uniform vec3 uSunDir;
uniform vec3 uDeep;
uniform vec3 uScatter;
uniform vec3 uHorizonC;
uniform vec3 uZenithC;
uniform vec3 uSunC;
uniform float uPower;
uniform float uExposure;
uniform vec4 uRing;
${GLSL_QUIET}
${GLSL_HASH33}

// one wave's height and slope at a point on the water: a smooth sine (a rounded swell) blended into a peaked crest over
// a broad trough (a ripple) by wt.z; both have the same mean
vec3 wave(vec4 w, vec3 wt, vec2 xz, float t) {
	float ph = w.z * dot(w.xy, xz) - wt.x * t + wt.y;
	float sn = sin(ph), cs = cos(ph);
	float e = exp(sn - 1.0);
	float prof = mix(0.4658 + 0.43 * sn, e, wt.z);
	float dprof = mix(0.43 * cs, e * cs, wt.z);
	return vec3(w.w * (prof - 0.4658), w.w * w.z * dprof * w.xy);
}

float liftAt(vec2 xz, float t) {
	float h = 0.0;
	for (int i = 0; i < ${GEOMETRY_WAVES}; i++) h += wave(uWave[i], uWaveT[i], xz, t).x;
	return h;
}

void main() {
	vec2 frag = vec2(gl_FragCoord.x, gl_FragCoord.y);
	vec2 p = (frag - 0.5 * uRes) / uRes.y;           // y up, heights from the centre
	float t = mod(uTime, uLoop);

	// the camera's ray, pitched down past the horizon
	vec3 dc = normalize(vec3(p.x * 2.0 * uTanH, p.y * 2.0 * uTanH, 1.0));
	float cp = cos(uPitch), sp = sin(uPitch);
	vec3 dir = vec3(dc.x, dc.y * cp - dc.z * sp, dc.y * sp + dc.z * cp);
	float down = max(-dir.y, 0.02);

	// where it meets the water, the long waves lifting the surface (a few relaxation steps)
	float d = uEye / down;
	vec2 xz = dir.xz * d;
	for (int j = 0; j < 3; j++) {
		float h = liftAt(xz, t);
		d = (uEye - h) / down;
		xz = dir.xz * d;
	}

	// the footprint each wave is filtered at: the pixel's, and the lens's circle of confusion there
	float pix = d * 2.0 * uTanH / uRes.y;
	float coc = uAperture * 0.034 * abs(1.0 - uFocusD / d) * d * 2.0 * uTanH;
	float r = sqrt(pix * pix + coc * coc);
	vec2 along = normalize(dir.xz);
	float stretch = inversesqrt(max(down, 0.12));

	vec2 slope = vec2(0.0);
	float lost = 0.0;                                 // slope variance the filter took out: goes into roughness
	float crest = 0.0;
	vec2 swellSlope = vec2(0.0);                      // the long waves' slope: the ripples ride it
	vec2 wind = uWave[0].xy;
	for (int i = 0; i < ${n}; i++) {
		if (float(i) >= uCount) break;
		vec4 w = uWave[i];
		float ri = r * mix(1.0, stretch, abs(dot(w.xy, along)));
		float kr = w.z * ri;
		float f = exp(-0.5 * kr * kr);
		vec3 hs = wave(w, uWaveT[i], xz, t);
		// fine ripples gather on the swell's forward faces and thin on its backs, so they read as riding it
		float ride = i < ${GEOMETRY_WAVES} ? 1.0 : clamp(0.85 + 5.0 * dot(swellSlope, wind), 0.4, 1.7);
		if (i < ${GEOMETRY_WAVES}) swellSlope += hs.yz * f;
		slope += hs.yz * f * ride;
		crest += hs.x * f * ride;
		float ak = w.w * w.z * ride;
		lost += 0.5 * ak * ak * (1.0 - f * f);
	}
	// a slow ring of ripples spreading from a point out on the water, as a drop or a fish leaves (curved crests among
	// the straight ones)
	vec2 rc = xz - uRing.xy;
	float rr = length(rc);
	float rk = 26.0;
	float rph = rk * rr - uRing.z * t;
	float re = exp(sin(rph) - 1.0);
	float ramp = uRing.w * exp(-rr * 1.4) / (1.0 + rr * 2.0);
	float rf0 = exp(-0.5 * pow(rk * r, 2.0));
	slope += ramp * rk * re * cos(rph) * (rc / max(rr, 1e-3)) * rf0;
	crest += ramp * (re - 0.4658) * rf0;
	vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
	vec3 v = -dir;
	float nv = max(dot(n, v), 0.001);

	// the sky reflected: the bright horizon low down, the darker zenith above, the sun's glow
	vec3 rf = reflect(dir, n);
	float up = clamp(rf.y, 0.0, 1.0);
	// a steep sky gradient near the horizon: at the long lens's low angle the slopes mirror bands of it, so each ripple
	// shows as light against dark
	vec3 sky = mix(uHorizonC, uZenithC, pow(up, 0.32));
	float sunAlign = max(dot(rf, uSunDir), 0.0);
	sky += uSunC * (pow(sunAlign, 18.0) * 0.35 + pow(sunAlign, 4.0) * 0.12);
	sky = mix(uHorizonC * 0.5, sky, smoothstep(-0.12, 0.03, rf.y)); // a ray turned back into the water by a steep face

	// the water's own colour: deep in the troughs, lit where light scatters through a thin crest
	float thin = clamp(crest * 18.0 + 0.45, 0.0, 1.0);
	float through = pow(max(dot(-v, uSunDir), 0.0), 3.0) * 0.6 + 0.4;
	vec3 body = mix(uDeep, uScatter, thin * thin * through);

	float fres = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
	vec3 col = mix(body, sky, fres);

	// the sun's highlight: a Beckmann lobe, rough where the filter took detail out (out of focus it spreads soft)
	vec3 hv = normalize(uSunDir + v);
	float nh = max(dot(n, hv), 0.0);
	float m2 = 0.0016 + lost * 2.0 + 0.0011 * d * (1.0 + uAperture) + 90.0 * pix * pix;   // far and soft water: a broader, dimmer glint
	float c2 = nh * nh;
	float tan2 = (1.0 - c2) / max(c2, 1e-4);
	float D = exp(-tan2 / m2) / (3.14159 * m2 * c2 * c2);
	float nl = max(dot(n, uSunDir), 0.0);
	vec3 spec = uSunC * uPower * fres * D * nl / (4.0 * nv);
	col += min(spec * 0.09, vec3(1.1));

	// the sparkle: tiny facets flashing, only where the water is in focus (a blur turns them into the sheen above)
	vec2 cell = floor(xz * 70.0);
	vec3 hz = hash33(vec3(cell, floor(t * 7.0)));
	vec3 nm = normalize(n + vec3(hz.x - 0.5, 0.0, hz.y - 0.5) * 0.3);
	vec2 inCell = fract(xz * 70.0) - (0.2 + 0.6 * hash33(vec3(cell, 3.7)).xy);
	float dot0 = exp(-dot(inCell, inCell) * 90.0);   // a point of light, not the whole facet
	float flash = pow(max(dot(nm, hv), 0.0), 650.0) * step(0.28, hz.z) * dot0;
	float sharp = exp(-pow(r * 150.0, 2.0));
	float facing = 0.6 + 0.8 * clamp(crest * 20.0 + 0.5, 0.0, 1.0);   // crests catch it more than troughs
	col += uSunC * flash * sharp * facing * uSparkle * uPower * 1.4;

	// a little haze with distance, a soft vignette
	col = mix(col, mix(uHorizonC, uZenithC, 0.5) * 0.9, 1.0 - exp(-d * 0.012));
	vec2 qc = vec2(p.x, p.y);
	col *= mix(1.0 - uQuiet.w, 1.0, quietOpen(qc));
	float vig = 1.0 - 0.32 * dot(p, p);
	col *= vig;

	col = 1.0 - exp(-col * uExposure);
	col += (hash33(vec3(frag, floor(uTime * 24.0))).x - 0.5) * uGrain;
	gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * The ring of ripples: where it starts on the water (metres across and out), how fast it spreads (whole turns of the
 * loop) and how high. Seeded.
 *
 * @param {ReturnType<typeof waterSettings>} o The settings.
 * @returns {{ x: number, z: number, omega: number, amp: number }} The ring.
 */
export function ringOf(o) {
	const rnd = seededRandom(Math.round(o.seed * 1000) + 91);
	const d = focusDistance(o) * (0.8 + rnd() * 0.5);
	const turns = Math.max(1, Math.round((5.5 * o.loop) / (2 * Math.PI)));
	return { x: (rnd() - 0.5) * d * 0.5, z: d, omega: (2 * Math.PI * turns) / o.loop, amp: 0.007 * o.waves * (o.rings ?? 1) };
}

/**
 * Where the sharp band is: the distance along the ray at that height up the frame, through the middle.
 *
 * @param {ReturnType<typeof waterSettings>} o The settings.
 * @returns {number} Metres.
 */
export function focusDistance(o) {
	const tanH = Math.tan(((FOV / 2) * Math.PI) / 180);
	const y = (0.5 - Math.min(1, Math.max(0, o.focus))) * 2 * tanH;
	const len = Math.hypot(y, 1);
	const pitch = (o.pitch * Math.PI) / 180;
	const dy = (y * Math.cos(pitch) - Math.sin(pitch)) / len;
	return EYE / Math.max(-dy, 0.02);
}

/**
 * The sun's direction: in front of the camera, a little to one side, low.
 *
 * @param {ReturnType<typeof waterSettings>} o The settings.
 * @returns {[number, number, number]} A unit vector (x right, y up, z out).
 */
export function sunDirection(o) {
	const el = (o.lookColors.height * Math.PI) / 180;
	const az = (o.sun * Math.PI) / 180;
	return [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
}

/**
 * A CSS `background` that stands for the water before the shader starts and without WebGL: the sky's light lying on
 * the far water, the deep colour nearer (`waterStillSvg` lays the ripples over it).
 *
 * @param {WaterSurfaceConfig} config The settings.
 * @returns {string} The CSS background.
 */
export function waterStill(config = {}) {
	const l = waterSettings(config).lookColors;
	const mix = (/** @type {string} */ a, /** @type {string} */ b, /** @type {number} */ t) => toHex(mixOklab(parseColor(a), parseColor(b), t));
	return `linear-gradient(180deg, ${mix(l.horizon, l.scatter, 0.6)}, ${mix(l.scatter, l.deep, 0.35)} 42%, ${l.deep})`;
}

/**
 * The same still as an inline SVG, closer to the live frame: ripples from fractal noise stretched across the frame,
 * lit from the sun's side (the waves' backs catching the sky), the deep colour in the troughs, sharp in a band across
 * the middle and soft above and below it, as the lens's focus is. For a page to lay under the canvas.
 *
 * @param {WaterSurfaceConfig} config The settings.
 * @param {string} id A unique id for its filters.
 * @returns {string} The SVG.
 */
export function waterStillSvg(config = {}, id = 'water') {
	const o = waterSettings(config);
	const l = o.lookColors;
	const seed = Math.round((o.seed * 997) % 1000);
	const mix = (/** @type {string} */ a, /** @type {string} */ b, /** @type {number} */ t) => toHex(mixOklab(parseColor(a), parseColor(b), t));
	// the far water carries the sky's light, but darker than the sky itself; the near water its own deep colour
	const far = mix(l.horizon, l.scatter, 0.6),
		mid = mix(l.scatter, l.deep, 0.35);
	const az = 270 + o.sun;
	const sharpTop = Math.round(Math.max(10, (o.focus - 0.22) * 100)),
		sharpBot = Math.round(Math.min(90, (o.focus + 0.22) * 100));
	// (the element's background is the CSS still, `waterStill`: the water's gradient; this lays the ripples over it, once
	// blurred and screened everywhere, once sharp in the band the lens is focused on)
	return (
		`<svg class="wc-noise wc-water" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>` +
		`<filter id="${id}s" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency=".006 .034" numOctaves="3" seed="${seed}"/>` +
		`<feSpecularLighting surfaceScale="5" specularConstant="1.1" specularExponent="22" lighting-color="${l.sun}"><feDistantLight azimuth="${az}" elevation="${l.height + 8}"/></feSpecularLighting>` +
		`<feComposite in2="SourceGraphic" operator="arithmetic" k2=".42" k3=".12"/></filter>` +
		`<filter id="${id}b"><feGaussianBlur stdDeviation="5"/></filter>` +
		`<linearGradient id="${id}m" x2="0" y2="1"><stop offset="${sharpTop - 12}%"/><stop offset="${sharpTop}%" stop-color="#fff"/><stop offset="${sharpBot}%" stop-color="#fff"/><stop offset="${sharpBot + 12}%"/></linearGradient>` +
		`<mask id="${id}k"><rect width="400" height="500" fill="url(#${id}m)"/></mask>` +
		`<rect id="${id}w" width="400" height="500" fill="${mid}" filter="url(#${id}s)"/></defs>` +
		`<g filter="url(#${id}b)" opacity=".6" style="mix-blend-mode:screen"><use href="#${id}w"/></g>` +
		`<g mask="url(#${id}k)" style="mix-blend-mode:screen"><use href="#${id}w"/></g></svg>`
	);
}


/**
 * Starts the water on an element (its first canvas is drawn into).
 *
 * @param {HTMLElement} el The element.
 * @param {WaterSurfaceConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function waterSurface(el, config = {}) {
	const o = waterSettings(config);
	const mobile = isMobileGpu();
	const count = mobile ? 16 : MAX_WAVES;
	const waves = waterWaves(config, MAX_WAVES);
	const start = frameNow();
	// where the clock starts in the loop, so two cards on the same settings differ
	const offset = (o.seed * 7.31) % o.loop;
	const rgb = (/** @type {string} */ c) => parseColor(c);

	const { stage, stop } = createStage(el, {
		fragment: FRAG(count),
		alpha: false,
		scale: Math.min(1, (mobile ? 1 : 1.5) / pixelRatio()),
		still: o.speed <= 0,
		setup({ gl, uniform: u }) {
			const a = new Float32Array(MAX_WAVES * 4);
			const b = new Float32Array(MAX_WAVES * 3);
			waves.forEach((w, i) => {
				a.set([w.dir[0], w.dir[1], w.k, w.amp], i * 4);
				b.set([w.omega, w.phase, w.peaked], i * 3);
			});
			gl.uniform4fv(u('uWave[0]'), a);
			gl.uniform3fv(u('uWaveT[0]'), b);
			gl.uniform1f(u('uCount'), count);
			gl.uniform1f(u('uLoop'), o.loop);
			gl.uniform1f(u('uPitch'), (o.pitch * Math.PI) / 180);
			gl.uniform1f(u('uTanH'), Math.tan(((FOV / 2) * Math.PI) / 180));
			gl.uniform1f(u('uEye'), EYE);
			gl.uniform1f(u('uFocusD'), focusDistance(o));
			gl.uniform1f(u('uAperture'), Math.max(0, o.aperture));
			gl.uniform1f(u('uSparkle'), Math.max(0, o.sparkle));
			gl.uniform1f(u('uGrain'), o.grain);
			gl.uniform3fv(u('uSunDir'), sunDirection(o));
			const l = o.lookColors;
			gl.uniform3fv(u('uDeep'), rgb(l.deep));
			gl.uniform3fv(u('uScatter'), rgb(l.scatter));
			gl.uniform3fv(u('uHorizonC'), rgb(l.horizon));
			gl.uniform3fv(u('uZenithC'), rgb(l.zenith));
			gl.uniform3fv(u('uSunC'), rgb(l.sun));
			gl.uniform1f(u('uPower'), l.power);
			gl.uniform1f(u('uExposure'), l.exposure);
			const ring = ringOf(o);
			gl.uniform4f(u('uRing'), ring.x, ring.z, ring.omega, ring.amp);
		},
		resize({ gl, uniform: u }) {
			const w = Math.max(1, el.clientWidth),
				h = Math.max(1, el.clientHeight);
			gl.uniform4f(u('uQuiet'), ...quietUniform(config.quiet, w / h));
		},
		uniforms({ gl, uniform: u }, now) {
			gl.uniform1f(u('uTime'), waterTime(o, now - start) + offset);
		},
	});
	if (!stage) return stop;
	return stop;
}

/**
 * The water's clock at a moment: seconds, at its speed (the loop wraps it in the shader). A pure function, so a
 * recording can ask for any frame.
 *
 * @param {WaterSurfaceConfig} config The settings.
 * @param {number} elapsedMs Milliseconds since it started.
 * @returns {number} Seconds.
 */
export function waterTime(config, elapsedMs) {
	return (elapsedMs / 1000) * Math.max(0, config.speed ?? 1);
}
