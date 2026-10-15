/**
 * @module @arraypress/effects-astro/ocean/shader
 *
 * The ocean's fragment shader (GLSL ES 1.00): open sea to the horizon
 * under an analytic sky, one pass, every pixel its own ray.
 *
 * The sea is a heightfield: a sum of directional waves with sharp crests
 * and long troughs (each `exp(S·(sin θ - 1))`, a trochoid's profile), the
 * long ones drawn together at their crests as Gerstner waves are. A ray
 * strides through the band the crests and troughs can reach, each stride
 * as long as the sea could rise to meet it, then a few false-position
 * steps refine the hit; the sea's mean surface curves away
 * with the Earth, so the horizon is where it truly is, a few kilometres
 * out. The normal comes from the waves' analytic slopes. Waves too small
 * for a pixel's footprint are left out and their slopes become roughness
 * instead, so the distance never shimmers and the sun's path broadens
 * into the streaked glare real water has.
 *
 * Light: Schlick's Fresnel mixes the reflected sky (its clouds too) with
 * the deep water's own colour; sunlight glows through thin crests turned
 * from the sun; a sharp Beckmann lobe on the fine slopes makes the
 * glittering path; whitecaps break on the steepest crests; air hazes the
 * distance into the horizon's colour. Lit in linear light, tone mapped
 * with Krzysztof Narkowicz's fit of the ACES filmic curve (2015), and
 * dithered against banding.
 */

import { GLSL_OKLAB } from '../color.js';
import { GLSL_NOISE, GLSL_QUIET } from '../glsl.js';

/**
 * @typedef {object} OceanQuality
 * @property {number} waves How many waves in all.
 * @property {number} geometry How many of the longest shape the surface the march finds.
 * @property {number} steps March steps through the waves' band.
 * @property {number} refine False-position steps after the march.
 */

/**
 * The fragment shader for a quality: the loops are fixed at compile time.
 *
 * @param {OceanQuality} quality The budget.
 * @returns {string} The shader.
 */
export function oceanShader({ waves, geometry, steps, refine }) {
	return `
precision highp float;
#define WAVES ${waves}
#define GEO ${geometry}
#define STEPS ${steps}
#define REFINE ${refine}
#define EARTH 6371000.0
#define DRAG 0.32
#define ANISO 6.0
#define SHARP 0.09
#define PI 3.14159265
uniform vec2 uRes;
uniform vec3 uEye;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uFwd;
uniform vec2 uLens;
uniform vec4 uShape[WAVES];
uniform vec2 uMotion[WAVES];
uniform float uCrest;
uniform float uSlope;
uniform vec3 uSun;
uniform vec3 uLight;
uniform float uPower;
uniform float uSize;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uDeep;
uniform vec3 uScatter;
uniform vec3 uCloud;
uniform float uHaze;
uniform float uExposure;
uniform float uStars;
uniform float uClouds;
uniform float uFoam;
uniform float uTime;
uniform vec2 uDrift;
uniform vec2 uWind;
${GLSL_OKLAB}
${GLSL_NOISE}
${GLSL_QUIET}

// The scene's colours in linear light, converted once a pixel in main().
vec3 cZenith, cHorizon, cGlow, cLight, cDeep, cScatter, cCloud;

// Krzysztof Narkowicz's fit of the ACES filmic tone curve (2015).
vec3 aces(vec3 x) {
	return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// The sky without its clouds or sun disc: the horizon's haze rising into
// the zenith, and the sun's glow, wide and low along the horizon.
vec3 skyBase(vec3 rd) {
	float y = max(rd.y, 0.0);
	float mu = max(dot(rd, uSun), 0.0);
	// The horizon's band is deeper towards the sun, thinner away from it.
	vec3 col = mix(cHorizon, cZenith, 1.0 - exp(-y * mix(16.0, 7.0, mu * mu)));
	float low = exp(-y * 9.0);
	col += cGlow * (0.3 * pow(mu, 8.0) * (0.25 + low) + 0.5 * pow(mu, 90.0) + 0.06 * low * mu);
	return col;
}

// High cloud along a ray going up, 0–1: a warped sheet at altitude seen in
// perspective, so it crowds into streaks towards the horizon, torn into
// wisps at its edges. Reflections, blurred by the waves, take a cheaper
// warp (fine 0).
float cloudAt(vec3 rd, float fine) {
	if (uClouds <= 0.0 || rd.y <= 0.0) return 0.0;
	vec2 q = rd.xz / (rd.y + 0.04) * 0.7 + uDrift;
	q = vec2(dot(q, vec2(uWind.y, -uWind.x)), dot(q, uWind) * 1.8);
	float n = fbm(q * 0.4 + (fine > 0.0 ? fbm(q * 0.25 + 7.0) : noise(q * 0.25 + 7.0)) * 1.6);
	float cover = smoothstep(0.56 - 0.14 * uClouds, 0.8, n) * (0.5 + 0.5 * noise(q * 3.3));
	return cover * smoothstep(0.0, 0.12, rd.y);
}

// The clouds' colour along a ray: shaded underneath, their undersides lit
// warm low down, their edges bright towards the sun.
vec3 cloudColor(vec3 rd, float cover) {
	float mu = max(dot(rd, uSun), 0.0);
	float low = exp(-max(rd.y, 0.0) * 4.0);
	return cCloud + cGlow * (0.45 * low * (0.3 + 0.7 * mu)) + cLight * uPower * 0.12 * pow(mu, 14.0) * (1.3 - cover);
}

// Stars: a sparse grid of points, each a pixel or two across, twinkling.
float starsAt(vec3 rd, float pix) {
	if (uStars <= 0.0 || rd.y <= 0.0) return 0.0;
	vec2 sp = vec2(atan(rd.z, rd.x), rd.y) * 160.0;
	vec2 cell = floor(sp);
	float r = hash(cell);
	if (r < 0.982) return 0.0;
	vec2 at = vec2(hash(cell + 3.1), hash(cell + 7.7)) * 0.6 + 0.2;
	float d = length(fract(sp) - at) / (pix * 160.0);
	float twinkle = 0.7 + 0.3 * sin(uTime * (2.0 + 3.0 * r) + r * 40.0);
	return smoothstep(1.4, 0.0, d) * (r - 0.982) * 55.0 * twinkle * smoothstep(0.02, 0.25, rd.y) * uStars;
}

// The whole sky along a ray: gradient, glow, clouds, and the sun or moon.
vec3 skyColor(vec3 rd, float pix) {
	vec3 col = skyBase(rd);
	float cover = cloudAt(rd, 1.0);
	col = mix(col, cloudColor(rd, cover), cover);
	float mu = dot(rd, uSun);
	float angle = sqrt(max(2.0 * (1.0 - mu), 0.0));
	float disc = smoothstep(uSize, uSize * 0.8, angle);
	if (disc > 0.0) {
		float edge = angle / uSize;
		float limb = 1.0 - 0.45 * (1.0 - sqrt(max(1.0 - edge * edge, 0.0)));
		// The moon is mottled; the sun only darkens at its limb.
		vec3 local = rd - uSun;
		limb *= mix(1.0, 0.8 + 0.25 * noise(local.xy / uSize * 2.5 + 4.0), uStars);
		col += cLight * uPower * 0.7 * disc * limb * (1.0 - 0.9 * cover);
	}
	// The bloom a lens sees round it.
	float m = max(mu, 0.0);
	col += cLight * uPower * (0.03 * pow(m, 700.0) + 0.12 * pow(m, 7000.0)) * (1.0 - 0.7 * cover);
	col += vec3(0.8, 0.88, 1.0) * starsAt(rd, pix) * (1.0 - cover);
	return col;
}

// How far along a ray it meets the sea's mean surface raised by level, a
// sphere the Earth's size; -1 when it misses. The stable root of
// above + rd.y·t + t²/(2R) = 0.
float toLevel(vec3 ro, vec3 rd, float level) {
	float above = ro.y - level;
	float disc = rd.y * rd.y - 2.0 * above / EARTH;
	if (rd.y >= 0.0 || disc < 0.0) return -1.0;
	return 2.0 * above / (-rd.y + sqrt(disc));
}

// A pixel's footprint on the sea at distance t: the ray's heading on the
// water (xy), and the footprint across it (z) and along it (w), metres.
// Along it, the footprint stretches as the ray grazes the surface; the
// stretch is capped at ANISO times its width, or only the waves running
// across the view would survive into the distance, as a fan of stripes.
vec4 footprint(float t, vec3 rd, float pix, float grazing) {
	vec2 along = normalize(rd.xz + vec2(0.0, 1e-6));
	float stretch = t * pix / max(grazing, 0.015);
	return vec4(along, max(t * pix, stretch / ANISO), stretch);
}

// How much of a wave a footprint keeps: all of it while the wave spans
// several footprints, none once it is shorter than about four.
float keep(vec4 w, vec4 foot) {
	vec2 seen = vec2(dot(w.xy, vec2(-foot.y, foot.x)) * foot.z, dot(w.xy, foot.xy) * foot.w);
	return 1.0 - smoothstep(0.6, 1.5, w.z * length(seen));
}

// The long waves' height at p: the surface the march finds. Waves too
// small for the footprint fade out.
float seaHeight(vec2 p, vec4 foot) {
	float h = 0.0;
	for (int i = 0; i < GEO; i++) {
		vec4 w = uShape[i];
		float amp = w.w * keep(w, foot);
		if (amp <= 0.0) continue;
		vec2 m = uMotion[i];
		float a = dot(w.xy, p) * w.z + m.x;
		float e = exp(m.y * (sin(a) - 1.0));
		h += amp * (2.0 * e - 1.0);
		p -= w.xy * (m.y * cos(a) * e * amp * DRAG);
	}
	return h;
}

// The whole sea at p, seen along rd: height (x) and slope (y: dh/dx, z:
// dh/dz). The long waves come first; the short ones are then filtered by
// how the ray grazes the long waves' own slope there, so the backs of
// crests do not shimmer. The short waves swell and calm in patches, as
// gusts leave them; those too small for the footprint are left out, their
// slopes summed into rough instead. swell is the long waves alone.
vec3 seaDetail(vec2 p, vec3 rd, float t, float pix, out float rough, out vec3 swell) {
	vec3 h = vec3(0.0);
	rough = 0.0;
	vec4 foot = footprint(t, rd, pix, -rd.y);
	float gust = 0.55 + 0.9 * noise(p * 0.021 - uWind * uTime * 0.05);
	for (int i = 0; i < WAVES; i++) {
		if (i == GEO) {
			swell = h;
			foot = footprint(t, rd, pix, -dot(rd, normalize(vec3(-h.y, 1.0, -h.z))));
		}
		vec4 w = uShape[i];
		vec2 m = uMotion[i];
		float amp = w.w * (i < GEO ? 1.0 : gust);
		float kept = keep(w, foot);
		// The wave's mean square slope: (a·k)² · 0.4·S for this profile.
		float slope = amp * w.z;
		rough += slope * slope * 0.4 * m.y * (1.0 - kept);
		if (kept <= 0.0) continue;
		amp *= kept;
		float a = dot(w.xy, p) * w.z + m.x;
		float e = exp(m.y * (sin(a) - 1.0));
		float c = cos(a);
		h += vec3(amp * (2.0 * e - 1.0), (2.0 * amp * m.y * c * e * w.z) * w.xy);
		if (i < GEO) p -= w.xy * (m.y * c * e * amp * DRAG);
	}
	return h;
}

// How far a point on a ray is above the sea (negative below it).
float gap(vec3 ro, vec3 rd, float t, float pix) {
	vec3 p = ro + rd * t;
	return p.y + t * t / (2.0 * EARTH) - seaHeight(p.xz, footprint(t, rd, pix, -rd.y));
}

// Where a ray meets the sea, or -1 when it passes over to the sky: a march
// through the band the waves can reach, then false-position steps.
float marchSea(vec3 ro, vec3 rd, float pix) {
	float t0 = toLevel(ro, rd, uCrest);
	if (t0 < 0.0) return -1.0;
	float t1 = toLevel(ro, rd, -uCrest);
	// Grazing the far crests but no trough: it may pass over them to the sky.
	bool grazing = t1 < 0.0;
	if (grazing) t1 = -rd.y * EARTH;
	// Each step goes as far as the sea could rise to meet the ray, given
	// how steep the long waves get: long strides high above the water,
	// short ones as it skims a crest, so crests are not stepped over. It
	// never stalls (a share of the distance at least), and the last step is
	// the far end.
	float ta = t0;
	float fa = gap(ro, rd, t0, pix);
	float tb = t1;
	float fb = -1.0;
	bool hit = false;
	for (int i = 0; i <= STEPS; i++) {
		float t = i == STEPS ? t1 : min(ta + max(fa / (uSlope - rd.y), ta * 0.02), t1);
		float f = gap(ro, rd, t, pix);
		if (f < 0.0) {
			tb = t;
			fb = f;
			hit = true;
			break;
		}
		ta = t;
		fa = f;
		if (t >= t1) break;
	}
	if (!hit) return grazing ? -1.0 : t1;
	// Regula falsi, Illinois style: an end kept twice has its gap halved, so it converges from both sides.
	float side = 0.0;
	for (int i = 0; i < REFINE; i++) {
		float t = ta + (tb - ta) * fa / (fa - fb);
		float f = gap(ro, rd, t, pix);
		if (f < 0.0) {
			tb = t;
			fb = f;
			if (side < 0.0) fa *= 0.5;
			side = -1.0;
		} else {
			ta = t;
			fa = f;
			if (side > 0.0) fb *= 0.5;
			side = 1.0;
		}
	}
	return ta + (tb - ta) * fa / (fa - fb);
}

// The sea's colour where a ray meets it, t along.
vec3 seaColor(vec3 ro, vec3 rd, float t, float pix) {
	vec3 p = ro + rd * t;
	float rough;
	vec3 swell;
	vec3 h = seaDetail(p.xz, rd, t, pix, rough, swell);
	vec3 n = normalize(vec3(-h.y, 1.0, -h.z));
	vec3 v = -rd;
	// A ripple's back, turned from the eye, is hidden behind its own crest:
	// what the pixel sees leans towards the eye, and catches no sun.
	float facing = dot(n, v);
	n = normalize(n + v * max(0.0, 0.02 - facing));
	float nv = max(dot(n, v), 0.0);

	// Fresnel: the sky the water mirrors, against its own deep colour.
	float fresnel = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
	// Rough water mirrors the sky over a spread of heights, higher on average than a smooth sea.
	vec3 r = reflect(rd, n);
	r.y = abs(r.y) + sqrt(rough) * 0.7;
	r = normalize(r);
	float cover = cloudAt(r, 0.0);
	vec3 sky = mix(skyBase(r), cloudColor(r, cover), cover);

	// Light through the crests: thin water turned from the sun, seen against it, glows.
	float crest = clamp(swell.x / uCrest + 0.5, 0.0, 1.0);
	vec3 level = normalize(vec3(uSun.x, 0.0, uSun.z) + 1e-5);
	float against = pow(max(dot(rd, level), 0.0), 3.0);
	float thin = pow(clamp(0.5 - 0.5 * dot(uSun, n), 0.0, 1.0), 3.0);
	vec3 ambient = cZenith * 0.6 + cHorizon * 0.4;
	vec3 body = cDeep + cScatter * (ambient * (0.08 + 0.35 * crest * crest) * 0.6);
	body += cScatter * cLight * uPower * (0.4 * crest * crest * crest * crest * against * thin + 0.015 * crest * nv * nv) * smoothstep(-0.05, 0.15, uSun.y);

	// The sun's glitter: a sharp lobe on the fine slopes, broadened by those too small to see.
	vec3 hv = normalize(uSun + v);
	float nh = max(dot(n, hv), 1e-3);
	float m2 = SHARP * SHARP + rough * 0.5;
	float nh2 = nh * nh;
	float lobe = exp((nh2 - 1.0) / (m2 * nh2)) / (PI * m2 * nh2 * nh2);
	float shine = 0.02 + 0.98 * pow(1.0 - max(dot(hv, v), 0.0), 5.0);
	float nl = max(dot(n, uSun), 0.0);
	// Smith-Schlick masking, by the unresolved ripples: at grazing angles they hide one another.
	float k = SHARP * 0.8;
	float masked = nl / (nl * (1.0 - k) + k) / (nv * (1.0 - k) + k);
	vec3 glitter = cLight * uPower * lobe * shine * masked * 0.25 * smoothstep(-0.01, 0.02, facing);

	vec3 col = mix(body, sky, fresnel) + glitter;

	// Whitecaps on the steepest crests of a rough sea, torn by noise, fading as they shrink below a pixel.
	if (uFoam > 0.0) {
		float steep = swell.x / uCrest + length(swell.yz) * 0.6;
		float cap = smoothstep(0.42 - 0.14 * uFoam, 0.62 - 0.14 * uFoam, steep);
		vec2 q = p.xz - uWind * uTime * 0.6;
		float torn = noise(q * 0.3) * 0.55 + noise(q * 1.3) * 0.3 + noise(q * 4.1) * 0.15;
		// Whitecaps come and go in groups: most crests carry none.
		cap *= smoothstep(0.45, 0.72, torn) * smoothstep(0.45, 0.7, noise(q * 0.045 + 3.0)) * (1.0 - smoothstep(0.06, 0.4, t * pix));
		vec3 white = ambient * 1.1 + cLight * uPower * max(uSun.y, 0.05) * 0.35;
		col = mix(col, white, cap * 0.85);
	}

	// Haze: the air between hides the sea in the horizon's colour.
	float air = 1.0 - exp(-t / uHaze);
	return mix(col, skyBase(normalize(vec3(rd.x, 0.0, rd.z))), air);
}

void main() {
	cZenith = oklabToLinear(uZenith);
	cHorizon = oklabToLinear(uHorizon);
	cGlow = oklabToLinear(uGlow);
	cLight = oklabToLinear(uLight);
	cDeep = oklabToLinear(uDeep);
	cScatter = oklabToLinear(uScatter);
	cCloud = oklabToLinear(uCloud);

	vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
	vec3 rd = normalize(uRight * uv.x + uUp * (uv.y - uLens.y) + uFwd * uLens.x);
	float pix = 1.0 / (uLens.x * uRes.y);
	float t = marchSea(uEye, rd, pix);
	vec3 col = t < 0.0 ? skyColor(rd, pix) : seaColor(uEye, rd, t, pix);

	col = oklabToSrgb(aces(col * uExposure));
	col *= mix(1.0 - uQuiet.w, 1.0, quietOpen(uv));
	col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
	gl_FragColor = vec4(col, 1.0);
}
`;
}
