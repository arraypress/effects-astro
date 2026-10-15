/**
 * @module @arraypress/effects-astro/ascii-rain
 *
 * A data readout drawn in text characters, in one of two patterns:
 *
 *   - `cloud` (the default): streams of data, short dashes and blocks of
 *     glyphs gathered into a loose cloud with dark space around it, each
 *     row sliding sideways at its own pace, glyphs flickering as they
 *     pass. `speed={0}` holds one frame, and then no loop runs at all.
 *   - `waves`: data rain on a rippling surface. Streaks of
 * light run along lanes on a surface seen in perspective (each lane at its
 * own pace, bright at the head and fading behind), the surface rolls in
 * slow waves that bend the lanes and are lit along their slopes, and the
 * whole is rasterised into character cells, a brighter glyph for a
 * brighter cell. Each streak fades out at both ends through hollow bars to
 * faint ones. Blue bleeds out to the left of every glyph and red to the
 * right, so a bar shades blue, white, red across, like a cheap lens.
 *
 * Each cell's ray is marched onto the wave surface (16 steps, refined), so
 * the waves occlude and foreshorten as a real surface would.
 *
 * In `waves`, the pointer sends ripples through the surface and a click
 * drops a ring that runs outward. A quiet area keeps either off the copy.
 *
 * Clear where there is no rain, so it lays over any background. Without
 * WebGL nothing is drawn; with prefers-reduced-motion it is one still frame.
 */

import { createStage } from './stage.js';
import { GLSL_NOISE, GLSL_PALETTE, GLSL_QUIET, paletteUniform, quietUniform } from './glsl.js';
import { GLSL_GLYPHS, createGlyphs } from './glyphs.js';
import { canHover } from './device.js';
import { pointerIn, pressAt } from './pointer.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {object} AsciiRainConfig
 * @property {string[]} [colors] Three CSS hex colours the glyphs take, the brightest nearly white. Default a cool cyan and green.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {number} [glitch=1] How often rows jump sideways for a moment, their colours splitting wider; 0 for never.
 * @property {string} [glyphs='data'] A character set (`data`: hollow and solid bars; `bars`, `ascii`,
 *   `blocks`, `binary`, `boxes`) or the characters themselves, darkest first.
 * @property {number} [cell=14] A character cell's height in CSS px.
 * @property {number} [aspect] A cell's width over its height (default 1 for `data`, 0.6 for type).
 * @property {number} [angle=0] Which way the streaks run, in degrees: 0 rightwards, 90 down, 180 left, 270 up.
 * @property {number} [lines=40] Streak lanes across the surface.
 * @property {number} [trail=0.3] A streak's length, as a share of the gap between them (0–1).
 * @property {number} [density=0.7] How many lanes have a streak at any time, 0–1.
 * @property {number} [width=0.9] A lane's streak width, as a share of the lane (0–1).
 * @property {'cloud' | 'waves'} [pattern='cloud'] A still cloud of data, or streaks running on a rippling surface.
 * @property {number} [speed=1] How fast it moves: the rows stream, or the streaks run; 0 for one still frame.
 * @property {number} [variance=0.6] How much each lane's speed differs (0 all alike, 1 very different).
 * @property {number} [ripple=1] How tall the surface's waves are; 0 for flat.
 * @property {number} [waves=1] How close together the waves are.
 * @property {number} [tilt=58] How far the surface leans back, in degrees (0 face-on, 80 nearly edge-on).
 * @property {number} [zoom=1] How much of the surface fills the frame (larger is closer).
 * @property {number} [lighting=1] How strongly the waves are lit and shaded; 0 for flat.
 * @property {number} [aberration=3] How far blue bleeds left and red right of each glyph, in CSS px; 0 for none.
 * @property {boolean} [interactive=true] With `waves`, whether the pointer ripples the surface and a click drops a ring.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area kept clear: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 * @property {string} [font] The font the glyphs are drawn in (a monospace stack by default).
 */

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uCell;
uniform float uTime;
uniform vec2 uPtr;
uniform float uActive;
uniform vec3 uClick;
uniform vec2 uDir;
uniform float uLines;
uniform float uTrail;
uniform float uDensity;
uniform float uWidth;
uniform float uVariance;
uniform float uRipple;
uniform float uWaves;
uniform float uTilt;
uniform float uZoom;
uniform float uLighting;
uniform float uAberration;
uniform float uPattern;
uniform float uGlitch;
${GLSL_NOISE}
${GLSL_PALETTE}
${GLSL_QUIET}
${GLSL_GLYPHS}

// The camera: above the surface, leaning back by uTilt, looking at its middle.
vec3 camPos() { return vec3(0.0, 2.6 * sin(uTilt), -2.6 * cos(uTilt)) / uZoom; }
vec3 camDir(vec2 s) {
	vec3 forward = normalize(-camPos());
	vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
	vec3 up = cross(forward, right);
	return normalize(forward * 1.6 + right * s.x + up * s.y);
}

// Where the pointer and the last click are on the surface (where their rays meet y = 0).
vec2 onSurface(vec2 px) {
	vec2 s = (px - 0.5 * uRes) / uRes.y;
	vec3 o = camPos();
	vec3 d = camDir(s);
	return (o + d * (-o.y / min(d.y, -1e-3))).xz;
}

// The surface's height: two rolling swells, the pointer's ripples and the click's ring.
float height(vec2 q, vec2 ptr, vec2 click) {
	float f = uWaves * 1.6;
	float h = sin(q.x * f + uTime * 0.6) * cos(q.y * f * 0.8 - uTime * 0.45) * 0.6
		+ sin((q.x + q.y) * f * 1.7 + uTime * 0.9) * 0.22;
	float d = length(q - ptr);
	h += uActive * sin(d * 10.0 - uTime * 6.0) * exp(-d * 2.2) * 0.8;
	float age = uTime - uClick.z;
	float ring = length(q - click) - age * 1.3;
	h += step(0.0, age) * exp(-ring * ring * 20.0) * exp(-age * 0.8) * 1.4;
	return h * 0.18 * uRipple;
}

// The streaks on the surface: lanes across uDir, each with its own speed
// and phase; bright at the head, fading along the trail.
float streaks(vec2 q) {
	float u = dot(q, vec2(-uDir.y, uDir.x));
	float v = dot(q, uDir);
	float lane = floor(u * uLines);
	float local = fract(u * uLines);
	float r = hash(vec2(lane, 7.1));
	float pace = 1.0 + (r - 0.5) * uVariance * 2.0;
	float flow = v * 0.6 - fract(uTime * 0.25 * pace) - hash(vec2(lane, 2.3));
	float along = fract(flow);
	// Each pass of a streak is there or not, so whole lanes sit empty for a while.
	float on = step(1.0 - uDensity, hash(vec2(lane, floor(flow))));
	float x = along / max(uTrail, 1e-3);
	// A run of full brightness with soft ends, so it fades out through
	// outlines both ways; some runs are dimmer and never reach solid.
	float body = smoothstep(0.0, 0.22, x) * (1.0 - smoothstep(0.72, 1.0, x));
	float strength = 0.6 + 1.0 * hash(vec2(lane, floor(flow) + 3.7));
	float wide = 1.0 - smoothstep(uWidth * 0.5 - 0.06, uWidth * 0.5, abs(local - 0.5));
	return step(x, 1.0) * on * wide * body * strength;
}

// How bright the rain is where a pixel's ray meets the surface: marched
// through the band the waves can reach, then refined.
float rain(vec2 px) {
	vec2 s = (px - 0.5 * uRes) / uRes.y;
	vec3 o = camPos();
	vec3 d = camDir(s);
	if (d.y > -0.02) return 0.0;
	vec2 ptr = onSurface(uPtr);
	vec2 click = onSurface(uClick.xy);
	float top = 0.25 * uRipple + 0.05;
	float t0 = (top - o.y) / d.y;
	float t1 = (-top - o.y) / d.y;
	float t = t0;
	float dt = (t1 - t0) / 16.0;
	float lo = t0;
	for (int i = 0; i < 16; i++) {
		vec3 p = o + d * t;
		if (p.y < height(p.xz, ptr, click)) break;
		lo = t;
		t += dt;
	}
	float hi = t;
	for (int i = 0; i < 5; i++) {
		float mid = (lo + hi) * 0.5;
		vec3 p = o + d * mid;
		if (p.y < height(p.xz, ptr, click)) hi = mid; else lo = mid;
	}
	vec3 hit = o + d * hi;
	// Lit by the slope: light from the upper left, a sheen on the crests.
	float e = 0.02;
	float hx = height(hit.xz + vec2(e, 0.0), ptr, click) - height(hit.xz - vec2(e, 0.0), ptr, click);
	float hz = height(hit.xz + vec2(0.0, e), ptr, click) - height(hit.xz - vec2(0.0, e), ptr, click);
	vec3 n = normalize(vec3(-hx, 2.0 * e, -hz));
	float diffuse = max(dot(n, normalize(vec3(-0.5, 0.8, 0.3))), 0.0);
	// Strongly lit: crests catch the light (solid bars), troughs fall away.
	float lit = mix(1.0, 0.2 + 1.5 * diffuse * diffuse, uLighting);
	// Further away is dimmer.
	float fog = exp(-max(hi - 1.5, 0.0) * 0.35);
	return clamp(streaks(hit.xz) * lit * fog, 0.0, 1.0);
}

// The cloud: data gathered where a slow, large noise is high, and within
// that, noise squashed along the rows so it reads as short dashes and
// blocks rather than texture. Each row streams sideways at its own pace;
// the cloud itself drifts far more slowly.
float cloud(vec2 px) {
	vec2 uv = px / uRes.y;
	float pace = 0.6 + 0.8 * hash(vec2(floor(px.y / uCell.y), 3.7));
	float gather = smoothstep(0.32, 0.6, fbm(uv * 1.0 + vec2(3.1 - uTime * 0.02, 7.7)));
	float dashes = smoothstep(0.5, 0.78, fbm(vec2((uv.x - uTime * 0.35 * pace) * 3.2, uv.y * 20.0)));
	// Gaps: some cells stay dark however bright the cloud is there.
	float gap = step(0.08, hash(floor(px / uCell) + 17.0));
	// Faint cells only where a run is ending, not scattered over the dark.
	return smoothstep(0.12, 0.85, clamp(gather * dashes * gap * 2.4, 0.0, 1.0));
}

// A cell's brightness: the pattern where its centre is, flickering
// a little as a readout refreshes. The quiet area lowers it before a glyph
// is chosen, so the rain thins out there rather than turning grey.
float level(vec2 cell) {
	vec2 centre = (cell + 0.5) * uCell;
	float open = mix(1.0 - uQuiet.w, 1.0, quietOpen((centre - 0.5 * uRes) / uRes.y));
	float b = uPattern > 0.5 ? rain(centre) : cloud(centre);
	return b * (0.9 + 0.2 * hash(cell + floor(uTime * 12.0))) * open * open;
}

// How much light the glyph under a pixel gives, given the brightness of
// the pixel's own cell and its neighbours either side (lv.x left, lv.y
// own, lv.z right). Faint glyphs are dim; outlines and solids are full.
float ink(vec2 px, float column, vec3 lv) {
	float dx = floor(px.x / uCell.x) - column;
	float b = dx < -0.5 ? lv.x : (dx > 0.5 ? lv.z : lv.y);
	return glyph(fract(px / uCell), b) * (b < 0.5 ? b * 0.9 : 1.0);
}

void main() {
	// Glitches: now and then a row jumps a few cells sideways for a moment,
	// its colours split wider while it does.
	float row = floor(gl_FragCoord.y / uCell.y);
	float tick = floor(uTime * 6.0);
	float jolt = step(1.0 - 0.02 * uGlitch, hash(vec2(row, tick)));
	float cells = floor((hash(vec2(row + 7.0, tick)) - 0.5) * 8.0);
	vec2 px = gl_FragCoord.xy + vec2(cells * uCell.x * jolt, 0.0);
	vec2 cell = floor(px / uCell);
	vec3 lv = vec3(level(cell - vec2(1.0, 0.0)), level(cell), level(cell + vec2(1.0, 0.0)));
	if (max(lv.x, max(lv.y, lv.z)) < 0.01) {
		gl_FragColor = vec4(0.0);
		return;
	}
	// Each channel softened a little; red moved right and blue left, so a
	// bar shades blue, cyan, white, yellow, red across, and an outline's
	// inside fills purple.
	vec2 shift = vec2(uAberration * (1.0 + 2.0 * jolt), 0.0);
	float r = 0.0;
	float g = 0.0;
	float bl = 0.0;
	float sum = 0.0;
	for (int i = -2; i <= 2; i++) {
		float w = 3.0 - abs(float(i));
		vec2 k = vec2(float(i) * uAberration * 0.35, 0.0);
		r += w * ink(px - shift + k, cell.x, lv);
		g += w * ink(px + k, cell.x, lv);
		bl += w * ink(px + shift + k, cell.x, lv);
		sum += w;
	}
	vec2 centre = (cell + 0.5) * uCell;
	// Dim cells take the palette; the brightest go nearly white, keeping a cast of it.
	vec3 tint = mix(pal(hash(cell.yy) * 0.4 + centre.x / uRes.x * 0.4 + uTime * 0.02), vec3(1.0), smoothstep(0.3, 0.9, lv.y) * 0.7);
	vec3 col = tint * vec3(r, g, bl) / sum;
	gl_FragColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
}
`;

/** The default palette: a cool readout, cyan and green, near white where it is brightest. */
const COOL = ['#7ef9e3', '#9df3b0', '#a5e8ff'];

/**
 * Starts ASCII rain on an element: a transparent canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {AsciiRainConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function asciiRain(el, config) {
	const waves = config.pattern === 'waves';
	const speed = config.speed ?? 1;
	// A still cloud needs no loop at all: one frame, drawn again only on a resize.
	const moving = waves || speed > 0;
	const glyphs = config.glyphs ?? 'data';
	// Shapes sit in square cells; type in the usual tall ones.
	const aspect = config.aspect ?? (glyphs === 'data' ? 1 : 0.6);
	let palette = paletteUniform(pickColors(config, COOL));
	const start = performance.now();
	const ptr = { x: 0, y: 0 };
	let active = 0;
	/** The last click: where (canvas px, y up) and when (shader seconds); long ago at first. */
	const click = { x: 0, y: 0, t: -100 };
	/**
	 * The shader's clock.
	 *
	 * @param {number} now The time, ms.
	 * @returns {number} Seconds since the start, at the rain's speed.
	 */
	const clock = (now) => ((now - start) / 1000) * speed;

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		still: !moving,
		setup({ gl, uniform, still }) {
			gl.uniform1f(uniform('uPattern'), waves ? 1 : 0);
			gl.uniform1f(uniform('uGlitch'), Math.max(0, config.glitch ?? 1));
			const { count } = createGlyphs(gl, glyphs, { unit: 0, font: config.font, aspect });
			gl.uniform1i(uniform('uGlyphs'), 0);
			gl.uniform1f(uniform('uGlyphCount'), count);
			const angle = ((config.angle ?? 0) * Math.PI) / 180;
			gl.uniform2f(uniform('uDir'), Math.cos(angle), -Math.sin(angle));
			gl.uniform1f(uniform('uLines'), config.lines ?? 40);
			gl.uniform1f(uniform('uTrail'), Math.min(1, Math.max(0.02, config.trail ?? 0.3)));
			gl.uniform1f(uniform('uDensity'), Math.min(1, Math.max(0, config.density ?? 0.7)));
			gl.uniform1f(uniform('uWidth'), Math.min(1, Math.max(0.05, config.width ?? 0.9)));
			gl.uniform1f(uniform('uVariance'), config.variance ?? 0.6);
			gl.uniform1f(uniform('uRipple'), config.ripple ?? 1);
			gl.uniform1f(uniform('uWaves'), config.waves ?? 1);
			gl.uniform1f(uniform('uTilt'), (Math.min(80, Math.max(0, config.tilt ?? 58)) * Math.PI) / 180);
			gl.uniform1f(uniform('uZoom'), config.zoom ?? 1);
			gl.uniform1f(uniform('uLighting'), config.lighting ?? 1);
			if (!waves || config.interactive === false || still) return;
			/**
			 * Drops a ring where the element is pressed.
			 *
			 * @param {PointerEvent} e The press.
			 */
			const drop = (e) => {
				const at = pressAt(el, e);
				if (at && stage) Object.assign(click, { x: at.x * stage.canvas.width, y: at.y * stage.canvas.height, t: clock(performance.now()) });
			};
			document.addEventListener('pointerdown', drop);
			return () => document.removeEventListener('pointerdown', drop);
		},
		resize({ gl, uniform, canvas, ratio }) {
			const h = (config.cell ?? 14) * ratio;
			gl.uniform2f(uniform('uCell'), Math.round(h * aspect), Math.round(h));
			gl.uniform1f(uniform('uAberration'), (config.aberration ?? 3) * ratio);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, canvas.width / canvas.height));
		},
		uniforms({ gl, uniform, canvas, still }, now) {
			// The ripples follow the pointer while it is over the element.
			const p = waves && config.interactive !== false && !still && canHover() ? pointerIn(el) : null;
			if (p?.inside) {
				ptr.x += (p.x * canvas.width - ptr.x) * 0.15;
				ptr.y += (p.y * canvas.height - ptr.y) * 0.15;
			}
			active += ((p?.inside ? 1 : 0) - active) * 0.05;
			gl.uniform1f(uniform('uTime'), clock(now));
			gl.uniform2f(uniform('uPtr'), ptr.x, ptr.y);
			gl.uniform1f(uniform('uActive'), active);
			gl.uniform3f(uniform('uClick'), click.x, click.y, click.t);
			gl.uniform3fv(uniform('uPal'), palette);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		palette = paletteUniform(next.colors);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
