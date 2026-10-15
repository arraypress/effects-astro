/**
 * @module @arraypress/effects-astro/rain-on-glass/shader
 *
 * The rain on glass fragment shader. Drops are procedural, one per cell of
 * a few grids: small beads that swell and dry where they sit, and larger
 * runners that slide down tall cells along wandering paths, clearing a
 * trail that beads up and fogs over behind them. Each drop is a little
 * fisheye lens, showing the photo sharp and upside down; between them the
 * photo is the soft, bokeh'd copy under a veil of condensation.
 */

import { GLSL_NOISE } from '../glsl.js';
import { GLSL_COVER } from '../image.js';

/** The fragment shader. */
export const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uUnit;
uniform vec2 uCover;
uniform sampler2D uPhoto;
uniform sampler2D uSoft;
uniform sampler2D uWipe;
uniform float uRain;
uniform float uFog;
uniform float uClearBias;
uniform vec3 uTint;
uniform float uShow;
${GLSL_NOISE}
${GLSL_COVER}

// The drop that covers this pixel most so far: how much, where in it the
// pixel sits (centre 0, rim 1), and its centre in glass units.
float lensCover;
vec2 lensAt;
vec2 lensCentre;

vec3 hash3(vec2 p) { return vec3(hash(p), hash(p + 19.19), hash(p + 47.31)); }

// A box coordinate (0–1, y up) to the photo's (cropped to cover, y down).
vec2 photoUv(vec2 uv) {
	vec2 c = coverUv(uv, uCover);
	return vec2(c.x, 1.0 - c.y);
}

// Offers a drop to this pixel; it is kept when it covers the pixel more
// than the last. squash < 1 draws its top out into a tail.
void offer(vec2 q, vec2 centre, float radius, float squash) {
	if (radius < 1e-4) return;
	vec2 o = (q - centre) / radius;
	o.y *= o.y > 0.0 ? squash : 1.0;
	float cover = clamp((1.0 - length(o)) * radius * uUnit / 1.5, 0.0, 1.0);
	if (cover > lensCover) {
		lensCover = cover;
		lensAt = o;
		lensCentre = centre;
	}
}

// Beads: at most one in each cell, which swells in, sits and dries away on
// a clock of its own. keep shrinks them where the glass was just cleared.
void beads(vec2 q, float cell, float seed, float amount, float keep) {
	vec2 id = floor(q / cell);
	vec3 h = hash3(id + seed);
	if (h.x > amount) return;
	float life = fract(uTime * (0.015 + 0.03 * h.y) + h.z);
	float grow = smoothstep(0.0, 0.2, life) * smoothstep(1.0, 0.85, life);
	float radius = (0.08 + 0.2 * h.y * h.y) * cell * grow * keep;
	vec2 centre = (id + 0.3 + 0.4 * hash3(id + seed + 7.0).xy) * cell;
	offer(q, centre, radius, 0.9);
}

// A runner's x in its cell at height y (both 0–1): a lazy wander, the same
// for the drop and for the trail it leaves.
float path(float y, vec3 h) {
	return 0.5 + 0.17 * sin(y * (4.0 + 5.0 * h.y) + h.z * 6.283) + 0.06 * sin(y * 17.0 + h.x * 40.0);
}

// Runners: in each tall cell, maybe a drop that slides down in fits and
// starts, leaving a clear trail that beads up and fogs over again behind
// it. Returns how clear the trail leaves the glass here, 0–1.
float runners(vec2 q, vec2 cell, float seed, float amount) {
	float column = floor(q.x / cell.x);
	float lift = hash(vec2(column, seed)) * cell.y * 9.0;
	vec2 s = q + vec2(0.0, lift);
	vec2 id = floor(s / cell);
	vec2 at = fract(s / cell);
	vec3 h = hash3(id + seed);
	if (h.x > amount) return 0.0;

	float run = fract(uTime * (0.04 + 0.05 * h.y) + h.z);
	float k = 6.283 * (2.0 + floor(h.z * 3.0));
	float fall = run - 0.9 * sin(k * run) / k;
	float y = mix(0.92, 0.08, fall);
	float alive = smoothstep(0.0, 0.05, run) * smoothstep(1.0, 0.9, run);
	float radius = (0.14 + 0.1 * h.y) * cell.x;
	vec2 drop = (id + vec2(path(y, h), y)) * cell;
	offer(q, drop - vec2(0.0, lift), radius * alive, 0.6);

	// The trail: as wide as most of the drop, fogging over as it ages and
	// gone by the top of the cell.
	float above = (at.y - y) * cell.y;
	float across = abs(at.x - path(at.y, h)) * cell.x;
	float trail = smoothstep(radius * 1.05, radius * 0.35, across) * smoothstep(-0.2 * radius, 0.8 * radius, above) * exp(-max(above, 0.0) / 0.28) * smoothstep(1.0, 0.7, at.y) * alive;

	// The beads it leaves behind, one in each short stretch of the trail.
	float gap = radius * 1.6;
	float row = floor(s.y / gap);
	float by = (row + 0.5) * gap / cell.y - id.y;
	float hb = hash(vec2(row, id.x + seed * 3.7));
	float since = (by - y) * cell.y;
	float size = radius * (0.2 + 0.22 * hb) * step(hb, 0.7) * smoothstep(radius, radius * 2.5, since) * exp(-since / 0.35) * step(by, 0.98) * alive;
	offer(q, vec2((id.x + path(by, h) + (hb - 0.5) * 0.08) * cell.x, (row + 0.5) * gap - lift), size, 1.0);
	return trail;
}

void main() {
	if (uShow <= 0.0) {
		gl_FragColor = vec4(0.0);
		return;
	}
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 q = gl_FragCoord.xy / uUnit;
	lensCover = 0.0;
	lensAt = vec2(0.0);
	lensCentre = vec2(0.0);

	float trail = max(runners(q, vec2(0.13, 0.75), 1.0, uRain * 0.7), runners(q + vec2(0.04, 0.0), vec2(0.08, 0.45), 2.0, uRain * 0.5));
	float wipe = texture2D(uWipe, uv).r;
	float clear = clamp(max(trail, wipe), 0.0, 1.0);
	float keep = 1.0 - clear;
	beads(q, 0.075, 5.0, 0.05 + 0.3 * uRain, keep);
	beads(q, 0.034, 3.0, 0.15 + 0.6 * uRain, keep);
	beads(q, 0.014, 4.0, 0.3 + 0.55 * uRain, keep);

	// Behind the glass: the soft copy, sharper where the glass is clear,
	// under a mottled veil of condensation in the tint.
	vec2 p = photoUv(uv);
	vec3 soft = texture2D(uSoft, p).rgb;
	vec3 sharp = texture2D(uPhoto, p, uClearBias).rgb;
	vec3 col = mix(soft, sharp, clear * 0.8);
	col = max(mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, 1.25), 0.0);
	float haze = uFog * keep * (0.75 + 0.5 * noise(q * 12.0));
	col = mix(col, 1.0 - (1.0 - col) * (1.0 - uTint * 0.3), haze);
	col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), haze * 0.2);

	// A drop: a fisheye lens, the photo sharp and upside down in it, dark
	// at the rim, lit at the top and focusing a crescent at the bottom.
	float rr = dot(lensAt, lensAt);
	vec2 centre = lensCentre * uUnit / uRes;
	vec2 look = centre - lensAt * (1.0 + 0.7 * rr) * vec2(uRes.y / uRes.x, 1.0) * 0.14;
	vec3 seen = texture2D(uPhoto, photoUv(look)).rgb * 1.3 + 0.02;
	float r = sqrt(rr);
	float rim = smoothstep(0.72, 1.0, r);
	seen = mix(seen, seen * 0.3, rim * 0.8);
	float glint = smoothstep(0.24, 0.0, length(lensAt - vec2(-0.3, 0.45)));
	float crescent = smoothstep(0.5, 0.8, r) * smoothstep(0.98, 0.8, r) * smoothstep(0.1, -0.8, lensAt.y);
	seen += glint * glint * 0.6 + crescent * (0.06 + soft * 0.6 + uTint * 0.08);
	col = mix(col, seen, lensCover);

	// A soft vignette, and a little dither so the gradients do not band.
	vec2 v = uv - 0.5;
	col *= 1.0 - 0.7 * dot(v, v);
	col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 128.0;
	gl_FragColor = vec4(clamp(col, 0.0, 1.0) * uShow, uShow);
}
`;
