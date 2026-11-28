/**
 * @module @arraypress/effects-astro/planet
 *
 * A planet seen from low orbit at sunrise, built the way the photographs from
 * orbit look rather than as a globe on a card: the camera a little above the
 * surface, so the planet is a vast dark curve across the lower part of the
 * frame; the sun just behind its limb, cresting and setting back over a slow
 * cycle; the thin layer of air along the limb lit by it (Rayleigh blue far
 * from the sun, Mie white and gold beside it, dark on the night side); the
 * near side in night, city lights on the land, a sliver of day and the sun's
 * glint on the sea where the terminator meets the limb; the planet turning
 * slowly; and, when the sun clears the limb, an anamorphic flare along the
 * horizon (the lens-flare's streak and ghosts, driven by how much of the sun
 * is showing).
 *
 * The Earth is textured from NASA's Blue Marble (day) and Black Marble
 * (night lights) imagery, both public domain (docs/credits.md): `day` is an
 * equirectangular colour map, `aux` the same size with the city lights in its
 * red channel and a water mask in its green. The other planets (a dusty red
 * one, a grey moon, a banded gas giant) are drawn from noise and need no
 * pictures.
 *
 * Every clock is in seconds and the frame is a pure function of the time
 * (nothing kept between frames), so an export can seek it; the whole picture
 * repeats every `period` seconds (`planetPeriod`): the planet turns a whole
 * number of degrees' worth that lines up, and the sun rises and sets a whole
 * number of times.
 *
 * Opaque: it paints space black everywhere. Without WebGL nothing is drawn;
 * with prefers-reduced-motion it is one still frame (the sun just clear of
 * the limb).
 */

import { createStage } from './stage.js';
import { GLSL_HASH33, GLSL_GRADIENT_NOISE } from './hash-noise.js';
import { parseColor } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { loadImage, imageTexture } from './image.js';
import * as loop from './loop.js';

/** @typedef {'earth' | 'mars' | 'moon' | 'giant'} PlanetKind */

/**
 * @typedef {object} PlanetConfig
 * @property {PlanetKind} [kind='earth'] Which planet.
 * @property {string} [day] The Earth's day map (equirectangular, same origin).
 * @property {string} [aux] The Earth's night lights (red) and water mask (green), the same size as `day`.
 * @property {number} [horizon=0.8] Where the limb crosses the middle of the frame, 0–1 from the top.
 * @property {number} [curve=1.8] How strongly the horizon curves (the camera's height): 1 low orbit, nearly flat; 3 high enough to see the globe round.
 * @property {number} [sunX=0.5] Where along the horizon the sun rises, 0–1 from the left.
 * @property {number} [tilt=0] The horizon's roll, in degrees.
 * @property {string} [air='#5b9bff'] The atmosphere's Rayleigh colour (far from the sun).
 * @property {string} [glow='#ffd9a8'] Its colour beside the sun (Mie).
 * @property {string} [streak='#7aa6ff'] The flare's streak.
 * @property {string} [ghost='#ffb36b'] The flare's ghosts' main tint.
 * @property {number} [flare=1] How strong the flare is; 0 for none.
 * @property {number} [lights=1] How bright the night side's city lights are (the Earth).
 * @property {number} [period=96] Seconds before the picture repeats (the sun rises once a period, or `rises` times).
 * @property {number} [rises=1] How many sunrises a period.
 * @property {number} [spin=6] Degrees of longitude the planet turns in a period.
 * @property {number} [longitude=-40] Which longitude faces the camera at time 0.
 * @property {number} [latitude=18] Which latitude the camera looks along (degrees north).
 * @property {number} [rise=0.05] How high the sun climbs over the limb at the top of its cycle, in heights of the frame:
 *   0.02 just clears it, 0.1 lights a broad crescent of day along the limb.
 * @property {number} [phase=0.22] Where in its cycle the sun starts (0 hidden behind the limb, 0.22 cresting, 0.5 at its
 *   highest), so a card that comes into view is already at sunrise.
 * @property {number} [grain=0.025] Fine grain; 0 for none.
 * @property {number} [seed=0] For the noise planets' patterns and the flare's ghosts.
 * @property {number} [speed=1] Plays every clock faster or slower; 0 for one still frame.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null] An area dimmed (see `quietUniform`).
 */

/** The settings' defaults, shared by the shader and the JS twin. */
export const PLANET_DEFAULTS = {
	kind: /** @type {PlanetKind} */ ('earth'),
	horizon: 0.8,
	curve: 1.8,
	sunX: 0.5,
	tilt: 0,
	air: '#5b9bff',
	glow: '#ffd9a8',
	streak: '#7aa6ff',
	ghost: '#ffb36b',
	flare: 1,
	lights: 1,
	period: 96,
	rises: 1,
	spin: 6,
	longitude: -40,
	latitude: 18,
	grain: 0.025,
	seed: 0,
	rise: 0.05,
	phase: 0.22,
};

/** The kinds, in the shader's numbering. */
const KINDS = { earth: 0, mars: 1, moon: 2, giant: 3 };

/** The flare's ghosts: where each lies on the line from the sun through the frame's centre (0 the sun, 1 the centre), its radius (heights), how bright, which tint. */
const GHOSTS = [
	[1.35, 0.04, 0.03, 0],
	[1.75, 0.07, 0.025, 1],
	[0.55, 0.016, 0.12, 2],
	[2.15, 0.1, 0.012, 0],
	[1.12, 0.009, 0.2, 1],
];

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uKind;
uniform float uReady;
uniform sampler2D uDay;
uniform sampler2D uAux;
uniform float uHorizon;
uniform float uCurve;
uniform float uSunX;
uniform float uTilt;
uniform vec3 uAir;
uniform vec3 uGlow;
uniform vec3 uStreakC;
uniform vec3 uTint[3];
uniform float uFlare;
uniform float uLights;
uniform float uPeriod;
uniform float uRises;
uniform float uSpin;
uniform float uLon;
uniform float uLat;
uniform float uGrain;
uniform float uSeed;
uniform float uRise;
uniform float uPhase;
uniform float uAirK;
uniform vec2 uSunQ;
uniform float uLift;
uniform vec4 uGhost[5];
${GLSL_QUIET}
${GLSL_HASH33}
${GLSL_GRADIENT_NOISE}

const float PI = 3.14159265;

float fbm(vec2 x) {
	float v = 0.0, a = 0.5;
	for (int i = 0; i < 5; i++) { v += a * gnoise(x); x = x * 2.03 + vec2(17.1, 5.3); a *= 0.5; }
	return v;
}

// the camera: a little above a unit sphere, looking at its horizon
struct Cam { vec3 ro; vec3 fw; vec3 rt; vec3 up; float f; };

Cam camera() {
	// its height above the surface: higher shows a tighter curve
	float alt = 0.035 * uCurve * uCurve;
	vec3 ro = vec3(0.0, 1.0 + alt, 0.0);
	float dip = acos(1.0 / (1.0 + alt));            // how far below level the horizon lies
	float f = 1.6;                                   // the lens: focal length in heights
	// pitch down so the horizon lands at uHorizon in the middle of the frame
	float want = (uHorizon - 0.5);                   // heights below the middle
	float pitch = dip - atan(want / f);
	vec3 fw = normalize(vec3(0.0, -sin(pitch), -cos(pitch)));
	float roll = uTilt * PI / 180.0;
	vec3 rt0 = vec3(1.0, 0.0, 0.0);
	vec3 up0 = normalize(cross(rt0, fw));
	vec3 rt = cos(roll) * rt0 + sin(roll) * up0;
	vec3 up = cos(roll) * up0 - sin(roll) * rt0;
	return Cam(ro, fw, rt, up, f);
}

// the ray through a point on the frame (x, y in heights from the middle, y up)
vec3 rayAt(Cam c, vec2 q) { return normalize(c.fw * c.f + c.rt * q.x + c.up * q.y); }

// the nearest hit on the unit sphere, or -1
float hitSphere(vec3 ro, vec3 rd) {
	float b = dot(ro, rd);
	float cc = dot(ro, ro) - 1.0;
	float h = b * b - cc;
	if (h < 0.0) return -1.0;
	float t = -b - sqrt(h);
	return t > 0.0 ? t : -1.0;
}

vec3 planetColour(vec3 n, vec3 L, vec3 rd, float t) {
	// the planet's own frame: turn it, and tip it so the camera looks along uLat
	float lon = (uLon + uSpin * t / uPeriod) * PI / 180.0;
	// the camera sits over the north pole of its own sphere: tip it so the ground under it is at latitude uLat
	float lat = (90.0 - uLat) * PI / 180.0;
	// tilt about x by the latitude, then turn about y by the longitude
	vec3 m = vec3(n.x, n.y * cos(lat) - n.z * sin(lat), n.y * sin(lat) + n.z * cos(lat));
	// the ground under the camera at longitude uLon (the map's u 0.5 is Greenwich), east to the right
	float a = atan(m.x, m.z) + lon;
	vec2 uv = vec2(fract(a / (2.0 * PI) + 0.5), acos(clamp(m.y, -1.0, 1.0)) / PI);

	float ndl = dot(n, L);
	float day = smoothstep(-0.06, 0.16, ndl);
	vec3 albedo;
	float water = 0.0;
	float city = 0.0;
	if (uKind < 0.5) {
		vec3 c = texture2D(uDay, uv).rgb;
		albedo = pow(c, vec3(2.2));
		vec3 aux = texture2D(uAux, uv).rgb;
		water = aux.g;
		// only the bright cores: city lights from orbit are sharp clusters, not a glow over the land
		city = pow(smoothstep(0.12, 0.95, aux.r), 2.4) * 1.6 * (1.0 - water);
	} else if (uKind < 1.5) {
		// a dusty red planet: dark basalt plains and bright dust, valleys
		vec2 s = uv * vec2(12.0, 6.0) + uSeed;
		float h = fbm(s) * 0.7 + fbm(s * 3.1) * 0.3;
		albedo = mix(vec3(0.16, 0.06, 0.03), vec3(0.62, 0.3, 0.16), smoothstep(-0.25, 0.35, h));
		albedo = pow(albedo, vec3(1.6));
	} else if (uKind < 2.5) {
		// a grey moon: maria and highlands, craters as soft rings of noise
		vec2 s = uv * vec2(14.0, 7.0) + uSeed;
		float h = fbm(s);
		float maria = smoothstep(0.05, -0.2, fbm(uv * vec2(4.0, 2.0) + uSeed * 1.7));
		albedo = vec3(0.32 + 0.12 * h) * mix(1.0, 0.55, maria);
		albedo = pow(albedo, vec3(1.4));
	} else {
		// a gas giant: bands by latitude, sheared by turbulence
		float y = uv.y * 18.0 + fbm(vec2(uv.x * 9.0, uv.y * 30.0) + uSeed) * 1.4;
		float band = 0.5 + 0.5 * sin(y);
		vec3 a1 = vec3(0.82, 0.64, 0.44), a2 = vec3(0.55, 0.36, 0.24), a3 = vec3(0.9, 0.84, 0.74);
		albedo = mix(mix(a2, a1, band), a3, smoothstep(0.6, 1.0, sin(y * 0.37 + 1.3)) * 0.6);
		albedo = pow(albedo, vec3(2.0));
	}

	// sunlight on the ground, reddened in the twilight band (the light comes through more air there)
	vec3 sunC = mix(vec3(1.0, 0.55, 0.3), vec3(1.0, 0.96, 0.9), smoothstep(0.0, 0.25, ndl));
	vec3 col = albedo * sunC * max(ndl, 0.0) * 1.4 * day;
	// the sun's glint on the sea: sharp where the reflected sun reaches the eye, and a wide sheen round it
	vec3 h = normalize(L - rd);
	float spec = pow(max(dot(n, h), 0.0), 900.0) * 9.0 + pow(max(dot(n, h), 0.0), 60.0) * 0.25;
	col += vec3(1.0, 0.9, 0.75) * spec * water * day;
	// the night side: city lights on the land
	vec3 lightsC = vec3(1.0, 0.72, 0.38);
	float night = 1.0 - smoothstep(-0.05, 0.08, ndl);
	col += lightsC * city * night * 1.6 * uLights;
	// the night side isn't black: moonlight and airglow show the clouds and coasts faintly
	col += albedo * vec3(0.55, 0.65, 1.0) * 0.022 * night;
	return col;
}

void main() {
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	float aspect = uRes.x / uRes.y;
	vec2 q = vec2((px.x / uRes.y) - 0.5 * aspect, 0.5 - px.y / uRes.y);   // heights from the middle, y up
	Cam c = camera();
	vec3 rd = rayAt(c, q);

	// the sun: on the limb at uSunX, lifted by the cycle (where, found once a frame in JavaScript: sunPlace)
	float lift = uLift;
	vec2 sunQ = uSunQ;
	vec3 L = rayAt(c, sunQ);
	// how much of the sun shows over the limb (its disc is about 0.006 heights across)
	float shows = smoothstep(-0.006, 0.006, lift);

	vec3 col = vec3(0.0);
	float t = hitSphere(c.ro, rd);
	// the air: how close the ray passes to the surface, and whether that air is lit
	float b = -dot(c.ro, rd);
	vec3 near = c.ro + rd * max(b, 0.0);
	float dmin = length(near);
	float H = 0.0032 * uCurve;                       // the air's scale height (a thin layer)
	float cosSun = dot(rd, L);
	float lit = smoothstep(-0.3, 0.15, dot(normalize(near), L));
	// Mie: a forward lobe round the sun, normalised so it peaks near 1
	float g = 0.82;
	float mie = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosSun, 1.5) / ((1.0 - g * g) / pow(1.0 - g, 3.0));
	mie = pow(mie, 0.55);
	// how near the sun the air is lit: the dawn arc is bright beside the sun and fades round the limb into night
	float dawn = smoothstep(-0.35, 0.12, dot(normalize(near), L));

	if (t > 0.0) {
		vec3 p = c.ro + rd * t;
		vec3 n = normalize(p);
		if (uReady > 0.5 || uKind > 0.5) col = planetColour(n, L, rd, uTime);
		// the air seen against the ground right at the limb: a hair of blue haze over the dark curve
		// only in a hair-thin band right under the limb (from low orbit all the ground is seen obliquely, so it is measured by
		// how far below the limb the ray points, not by the angle to the ground)
		float below = max(1.0 - dmin, 0.0);
		float graze = exp(-below / (H * 0.6));
		col += (uAir * 0.35 + uGlow * mie * 1.2) * graze * dawn * uAirK;
	} else {
		// the limb's glow: a bright thin band just above the surface, a fainter halo, falling off into space
		float h = max(dmin - 1.0, 0.0);
		float band = exp(-h / H);
		float halo = exp(-h / (H * 4.0)) * 0.12;
		// the layers seen edge on at sunrise: a warm band hugging the surface beside the sun, blue above it, fading to black
		vec3 layer = mix(uGlow * vec3(1.0, 0.62, 0.38), uAir, smoothstep(0.0, H * 1.6, h));
		vec3 air = layer * (band * 0.8 + halo) * dawn;
		vec3 glow = uGlow * (band * 1.4 + halo) * mie * dawn;
		col += (air + glow) * (0.45 + 0.55 * shows) * uAirK;
		// the sun itself, where it shows over the limb
		float sd = acos(clamp(cosSun, -1.0, 1.0));
		col += vec3(1.0, 0.97, 0.92) * (smoothstep(0.0042, 0.0028, sd) * 6.0 + exp(-sd * sd / 0.00009) * 1.2) * shows;
	}

	// the flare: the lens-flare's streak, veil and ghosts round the sun, as strong as the sun is showing
	if (uFlare > 0.0 && shows > 0.001) {
		vec2 p2 = vec2(q.x, -q.y), s2 = vec2(sunQ.x, -sunQ.y);
		vec2 d = p2 - s2;
		float pw = uFlare * shows;
		float along = abs(d.x) / (1.7 * aspect);
		float fall = 1.0 / (1.0 + along * along * 7.0) * smoothstep(1.0, 0.15, along);
		float w = 0.0055;
		col += uStreakC * (exp(-abs(d.y) / (w * 3.5)) * 0.5 + exp(-abs(d.y) / w) * 0.7) * fall * pw;
		col += vec3(1.0) * exp(-abs(d.y) / w) * fall * fall * 0.8 * pw;
		// the veil round the sun: tight; a lens in space scatters little
		col += uStreakC * (exp(-dot(d, d) * 260.0) * 0.4 + exp(-length(d) * 18.0) * 0.05) * pw;
		vec2 axis = -s2;
		for (int i = 0; i < 5; i++) {
			vec4 gh = uGhost[i];
			vec2 gc = s2 + axis * gh.x;
			float rr = length((p2 - gc) / vec2(0.78, 1.0)) / gh.y;
			vec3 tint = gh.w < 0.5 ? uTint[0] : (gh.w < 1.5 ? uTint[1] : uTint[2]);
			col += tint * (smoothstep(1.0, 0.82, rr) * 0.45 + smoothstep(0.7, 0.97, rr) * smoothstep(1.06, 0.97, rr) * 0.4) * gh.z * pw;
		}
	}

	col = mix(vec3(0.0), col, mix(1.0 - uQuiet.w, 1.0, quietOpen(vec2(q.x, q.y))));
	col = 1.0 - exp(-col * 1.15);                      // a filmic shoulder
	col = pow(col, vec3(1.0 / 2.2));
	col += (hash33(vec3(px, floor(uTime * 24.0))).x - 0.5) * uGrain;
	gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * The settings, filled with the defaults.
 *
 * @param {PlanetConfig} config The settings.
 * @returns {typeof PLANET_DEFAULTS & PlanetConfig & { speed: number }} The settings.
 */
function settings(config) {
	return { ...PLANET_DEFAULTS, speed: 1, ...config };
}

/**
 * How many seconds before the picture repeats exactly (the loop an export records).
 *
 * @param {PlanetConfig} config The settings.
 * @returns {number} Seconds.
 */
export function planetPeriod(config) {
	return settings(config).period;
}

/**
 * The sun's height over the limb at a time (heights; under 0 it is still behind the planet): the shader's `sunLift`.
 *
 * @param {PlanetConfig} config The settings.
 * @param {number} [time=0] Seconds (already at its speed).
 * @returns {number} Heights.
 */
export function sunLift(config, time = 0) {
	const o = settings(config);
	const c = ((((time * o.rises) / o.period + o.phase) % 1) + 1) % 1;
	const ss = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ x) => {
		const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
		return k * k * (3 - 2 * k);
	};
	const rise = ss(0.08, 0.42, c) * (1 - ss(0.62, 0.96, c));
	return -0.018 + (o.rise + 0.018) * rise;
}

/**
 * Where the sun is on the frame at a time, in heights from the middle (y up), and its height over the limb: the
 * shader's camera and limb, worked out once a frame here rather than for every pixel.
 *
 * @param {PlanetConfig} config The settings.
 * @param {number} aspect Width over height.
 * @param {number} [time=0] Seconds (already at its speed).
 * @returns {{ x: number, y: number, lift: number }} The sun's place and lift.
 */
export function sunPlace(config, aspect, time = 0) {
	const o = settings(config);
	const alt = 0.035 * o.curve * o.curve;
	const ro = [0, 1 + alt, 0];
	const dip = Math.acos(1 / (1 + alt));
	const f = 1.6;
	const pitch = dip - Math.atan((o.horizon - 0.5) / f);
	const fw = [0, -Math.sin(pitch), -Math.cos(pitch)];
	const roll = (o.tilt * Math.PI) / 180;
	const rt0 = [1, 0, 0];
	// up0 = cross(rt0, fw)
	const up0 = [rt0[1] * fw[2] - rt0[2] * fw[1], rt0[2] * fw[0] - rt0[0] * fw[2], rt0[0] * fw[1] - rt0[1] * fw[0]];
	const n0 = Math.hypot(...up0);
	const u0 = up0.map((v) => v / n0);
	const rt = rt0.map((v, k) => Math.cos(roll) * v + Math.sin(roll) * u0[k]);
	const up = u0.map((v, k) => Math.cos(roll) * v - Math.sin(roll) * rt0[k]);
	const hits = (/** @type {number} */ x, /** @type {number} */ y) => {
		const d = [0, 1, 2].map((k) => fw[k] * f + rt[k] * x + up[k] * y);
		const n = Math.hypot(...d);
		const rd = d.map((v) => v / n);
		const b = ro[0] * rd[0] + ro[1] * rd[1] + ro[2] * rd[2];
		const cc = ro[0] * ro[0] + ro[1] * ro[1] + ro[2] * ro[2] - 1;
		const h = b * b - cc;
		return h >= 0 && -b - Math.sqrt(h) > 0;
	};
	const x = (o.sunX - 0.5) * aspect;
	let lo = -0.5,
		hi = 0.5;
	for (let i = 0; i < 24; i++) {
		const m = 0.5 * (lo + hi);
		if (hits(x, m)) lo = m;
		else hi = m;
	}
	const lift = sunLift(config, time);
	return { x, y: 0.5 * (lo + hi) + lift, lift };
}

/**
 * A CSS `background` that stands in before the shader starts and without WebGL: black space, the planet as a vast dark
 * curve across the lower frame with its thin blue limb, the sun just over it and the flare's streak along the horizon.
 *
 * @param {PlanetConfig} config The settings.
 * @returns {string} The CSS background.
 */
export function planetStill(config) {
	const o = settings(config);
	const y = Math.round(o.horizon * 1000) / 10;
	const x = Math.round(o.sunX * 1000) / 10;
	const ground = o.kind === 'giant' ? '#140e0a' : o.kind === 'mars' ? '#0e0706' : o.kind === 'moon' ? '#070707' : '#03060c';
	// the planet: an ellipse far wider than the card, its top on the horizon; a thin warm-then-blue limb along its edge
	const ry = Math.round(260 / o.curve);
	const airy = o.kind === 'moon' ? ground : o.air;
	const planet = `radial-gradient(ellipse 300% ${ry}% at 50% ${Math.round((y + ry) * 10) / 10}%, ${ground} 99.55%, ${o.glow} 99.72%, ${airy} 99.9%, ${airy}00 100.6%)`;
	// the sun on the limb, small and hot, and its streak along the horizon
	const sun = `radial-gradient(circle at ${x}% ${y - 0.8}%, #ffffff 0, #ffffffee 0.7%, ${o.glow}88 2%, ${o.glow}22 6%, transparent 14%)`;
	const streak = `radial-gradient(ellipse 70% 0.9% at ${x}% ${y - 0.8}%, #ffffff 0, ${o.streak}cc 30%, ${o.streak}00 100%)`;
	const haze = `radial-gradient(ellipse 90% 12% at ${x}% ${y}%, ${airy}33 0, transparent 70%)`;
	return [sun, streak, haze, planet, '#000000'].join(', ');
}

/**
 * Starts the planet on an element: a canvas inside it (its first).
 *
 * @param {HTMLElement} el The element.
 * @param {PlanetConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function planet(el, config) {
	const o = settings(config);
	const now = /** @type {() => number} */ (/** @type {any} */ (loop).frameNow ?? (() => performance.now()));
	const start = now();
	const rgb = (/** @type {string} */ c) => parseColor(c);
	const kind = KINDS[o.kind] ?? 0;
	/** @type {WebGLTexture | null} */
	let day = null;
	/** @type {WebGLTexture | null} */
	let aux = null;
	let ready = kind !== 0;
	let aspect = 0.8;

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		still: o.speed <= 0,
		setup({ gl, uniform }) {
			gl.uniform1i(uniform('uDay'), 0);
			gl.uniform1i(uniform('uAux'), 1);
			gl.uniform1f(uniform('uKind'), kind);
			gl.uniform1f(uniform('uHorizon'), o.horizon);
			gl.uniform1f(uniform('uCurve'), o.curve);
			gl.uniform1f(uniform('uSunX'), o.sunX);
			gl.uniform1f(uniform('uTilt'), o.tilt);
			gl.uniform3fv(uniform('uAir'), rgb(o.air));
			gl.uniform3fv(uniform('uGlow'), rgb(o.glow));
			gl.uniform3fv(uniform('uStreakC'), rgb(o.streak));
			gl.uniform3fv(uniform('uTint[0]'), new Float32Array([...rgb(o.ghost), ...rgb(o.streak), 0.35, 0.95, 0.6]));
			gl.uniform1f(uniform('uFlare'), o.flare);
			gl.uniform1f(uniform('uLights'), o.lights);
			gl.uniform1f(uniform('uPeriod'), Math.max(1, o.period));
			gl.uniform1f(uniform('uRises'), Math.max(1, Math.round(o.rises)));
			gl.uniform1f(uniform('uSpin'), o.spin);
			gl.uniform1f(uniform('uLon'), o.longitude);
			gl.uniform1f(uniform('uLat'), o.latitude);
			gl.uniform1f(uniform('uGrain'), o.grain);
			gl.uniform1f(uniform('uSeed'), o.seed);
			gl.uniform1f(uniform('uRise'), o.rise);
			gl.uniform1f(uniform('uPhase'), o.phase);
			// the moon has no air: its limb is a hard edge; a gas giant's haze is thick
			gl.uniform1f(uniform('uAirK'), o.kind === 'moon' ? 0 : o.kind === 'giant' ? 1.3 : o.kind === 'mars' ? 0.55 : 1);
			gl.uniform4fv(uniform('uGhost[0]'), new Float32Array(GHOSTS.flat()));
			return () => {
				if (day) gl.deleteTexture(day);
				if (aux) gl.deleteTexture(aux);
			};
		},
		resize({ gl, uniform, canvas }) {
			aspect = canvas.width / canvas.height;
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, aspect));
		},
		uniforms({ gl, uniform }, t) {
			// a still stage (reduced motion, `speed: 0`) holds the moment the sun has just cleared the limb
			// (c = 0.5: the sun at its highest, the flare at full)
			const time = o.speed <= 0 ? ((0.5 - o.phase + 1) % 1) * (o.period / Math.max(1, Math.round(o.rises))) : ((t - start) / 1000) * o.speed;
			gl.uniform1f(uniform('uTime'), time);
			const sun = sunPlace(o, aspect, time);
			gl.uniform2f(uniform('uSunQ'), sun.x, sun.y);
			gl.uniform1f(uniform('uLift'), sun.lift);
			gl.uniform1f(uniform('uReady'), ready ? 1 : 0);
			if (day) {
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, day);
			}
			if (aux) {
				gl.activeTexture(gl.TEXTURE1);
				gl.bindTexture(gl.TEXTURE_2D, aux);
			}
		},
	});
	if (!stage || kind !== 0 || !o.day || !o.aux) return stop;

	let alive = true;
	Promise.all([loadImage(o.day), loadImage(o.aux)])
		.then(([d, a]) => {
			if (!alive) return;
			const { gl, program } = stage;
			gl.activeTexture(gl.TEXTURE0);
			day = imageTexture(gl, d, { mipmap: true });
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
			gl.activeTexture(gl.TEXTURE1);
			aux = imageTexture(gl, a, { mipmap: true });
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
			gl.useProgram(program);
			ready = true;
			stage.redraw();
		})
		.catch((error) => console.warn('[effects-astro]', error));
	return () => {
		alive = false;
		stop();
	};
}
