/**
 * @module @arraypress/effects-astro/waves
 *
 * Audio motifs drawn as light, quiet enough to sit behind copy:
 *
 *   - `signalLines`: layered waveform lines whose loudness is shaped by a
 *     slow drifting envelope (loud and quiet passages that move, as in a
 *     real track) over stacked frequencies, so it reads as audio, not
 *     smooth sweeps. The lines sit at depths: the front ones sharp, tall
 *     and bright, the back ones flatter, dimmer and out of focus, their
 *     colours fringed as a lens fringes them. Loud passages glow brighter;
 *     where lines cross, the palette's other end shimmers in. Now and then
 *     a pulse of light runs along a line, lighting the lines it passes.
 *     The pointer is a lens and a lamp: the lines part round it and catch
 *     its light.
 *   - `waveBars`: a mirrored bar waveform over its own reflection. The
 *     bars ease to a new take every couple of seconds (quick to rise, slow
 *     to fall, as a meter moves) with peak marks that hold and drop, while
 *     a playhead sweeps across lighting the bars it plays and leaving them
 *     glowing behind it. The pointer scrubs: the bars under it rise and
 *     light.
 *
 * Both are drawn in one fragment pass each, every line and bar measured
 * per pixel, so edges are smooth at any pixel ratio and light adds up as
 * light does: summed, tone-mapped (hot cores run to white), with moving
 * film grain in it and a dither so the soft glows never band. Colours are
 * a left-to-right gradient mixed in Oklab, changed live through the
 * element's `data-colors` (`setColors`); a quiet area can dim the light
 * behind a headline. Transparent where nothing is lit. Still with
 * prefers-reduced-motion; on phones the lines draw at three-quarters of
 * the pixel ratio; without WebGL, the canvas is removed and the section
 * shows.
 *
 * From the waveform-player site's hero backgrounds.
 */

import { createStage } from './stage.js';
import { mixOklab, parseColor } from './color.js';
import { canHover, isMobileGpu } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {object} SignalLinesConfig
 * @property {string} [color] One colour for every line (default: the `colors` gradient).
 * @property {string[]} [colors] Colours the lines run through from left to right, blended in Oklab (default sea-glass, ice and pale gold).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors` or `color`.
 * @property {string} [pulse='#fafafa'] The pulses' colour.
 * @property {number} [lines=7] How many lines, 2–12.
 * @property {number} [amplitude=1] How tall the waves are.
 * @property {number} [speed=1] How fast they move.
 * @property {number} [pulses=1] How often pulses run; 0 for none.
 * @property {number} [glow=1] How much light the lines and pulses give off, 0–2.
 * @property {number} [grain=0.5] Film grain in the light, 0–1.
 * @property {number} [depth=1] How far out of focus the back lines are, and how much their colours fringe; 0 for all sharp.
 * @property {number} [bend=1] How far the lines part round the pointer and how much it lights them; 0 for not at all.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area where the light dims (behind a headline): centre x/y (0–1, from
 *   the top left), radius (a share of the height) and depth (0 none, 1 dark).
 */

/**
 * @typedef {object} WaveBarsConfig
 * @property {string} [color] One colour for every bar (default: the `colors` gradient).
 * @property {string[]} [colors] Colours the bars run through from left to right, blended in Oklab (default teal, ice and apricot).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors` or `color`.
 * @property {number} [step=8] Space between bars, CSS px.
 * @property {number} [bar=3] A bar's width, CSS px.
 * @property {number} [height=0.34] The tallest bar, a share of the height either side of the middle.
 * @property {number} [every=2] Seconds between retunes.
 * @property {boolean} [sweep=true] The playhead sweeping across, lighting the bars it plays.
 * @property {number} [grain=0.4] Film grain in the light, 0–1.
 * @property {boolean} [peaks=true] Peak marks over the bars that hold, then drop, as a meter's do.
 * @property {number} [glow=1] How much light the bars and playhead give off, 0–2.
 * @property {number} [scrub=1] How much the bars under the pointer rise and light; 0 for not at all.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area where the light dims (behind a headline): centre x/y (0–1, from
 *   the top left), radius (a share of the height) and depth (0 none, 1 dark).
 */

/** SignalLines' default colours: sea-glass, ice and pale gold. */
const LINE_COLORS = ['#4fd1c5', '#d6ecff', '#f2c58a'];
/** WaveBars' default colours: teal, ice and apricot. */
const BAR_COLORS = ['#2dd4bf', '#d6ecff', '#f6b26b'];
/** Most pulses running at once. */
const PULSES = 4;
/** The gradient texture's width: plenty for a smooth blend across any screen. */
const GRADIENT = 256;
/** Texture unit of the colour gradient. */
const INK_UNIT = 0;
/** Texture unit of the bars' heights. */
const BARS_UNIT = 1;

/**
 * GLSL shared by both: the colour gradient (`ink(u)`, linear light, u 0–1
 * from the left), the quiet area (GLSL_QUIET), and `present(light)`, which
 * tone-maps summed light, lays moving grain in it, dithers it and writes it
 * premultiplied, its alpha its brightest channel, so what is not lit stays
 * transparent.
 */
const GLSL_LIGHT = `${GLSL_QUIET}
uniform sampler2D uInk;
uniform float uSeed;
uniform float uGrain;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 ink(float u) { return pow(texture2D(uInk, vec2(clamp(u, 0.0, 1.0), 0.5)).rgb, vec3(2.2)); }
vec4 present(vec3 light) {
	light *= mix(1.0 - uQuiet.w, 1.0, quietOpen((gl_FragCoord.xy - 0.5 * uRes) / uRes.y));
	// A soft toe: faint light fades smoothly to nothing rather than to a grey edge.
	light = light * light / (light + 0.003);
	if (max(light.r, max(light.g, light.b)) < 0.00001) return vec4(0.0);
	light *= 1.0 + (hash(gl_FragCoord.xy + uSeed) - 0.5) * uGrain;
	vec3 c = pow(1.0 - exp(-light), vec3(1.0 / 2.2));
	c = clamp(c + (hash(gl_FragCoord.yx + uSeed * 1.7) - 0.5) / 255.0, 0.0, 1.0);
	return vec4(c, max(c.r, max(c.g, c.b)));
}
`;

/**
 * SignalLines' pass: every line measured at every pixel, with its pulses,
 * the pointer's lens and lamp, and a sheen where lines cross.
 *
 * @param {number} lines How many lines (a loop bound, so compiled in).
 * @returns {string} GLSL.
 */
function linesFragment(lines) {
	return `
precision highp float;
#define LINES ${lines}
#define PULSES ${PULSES}
uniform vec2 uRes;
uniform float uRatio;
uniform float uTime;
uniform float uAmp;
uniform float uGlow;
uniform float uDepth;
uniform float uBend;
uniform vec3 uPointer;
uniform vec4 uPulse[PULSES];
uniform vec3 uPulseInk;
${GLSL_LIGHT}
float H;

// A line at x (CSS px): its height (CSS px, up), slope, and loudness 0.32–1.
vec3 lineAt(float L, float x) {
	float k = L / float(LINES - 1);
	float amp = H * (0.24 - 0.16 * k) * uAmp;
	float pace = 0.75 - 0.35 * k;
	float ph = L * 1.1;
	float a1 = x * 0.0032 - uTime * 0.45 + ph;
	float a2 = x * 0.0016 + uTime * 0.22;
	float u = sin(a1) * 0.7 + sin(a2) * 0.3;
	float env = 0.32 + 0.68 * abs(u);
	float dEnv = 0.68 * sign(u) * (cos(a1) * 0.00224 + cos(a2) * 0.00048);
	float b1 = x * 0.006 + uTime * pace + ph;
	float b2 = x * 0.015 - uTime * pace * 0.8 + ph * 1.5;
	float b3 = x * 0.033 + uTime * pace * 1.4 + ph;
	float shape = sin(b1) * 0.55 + sin(b2) * 0.3 + sin(b3) * 0.16;
	float dShape = cos(b1) * 0.0033 + cos(b2) * 0.0045 + cos(b3) * 0.00528;
	float y = H * 0.5 + amp * env * shape;
	float slope = amp * (dEnv * shape + env * dShape);
	// The pointer's lens: lines near it spread away from it.
	vec2 d = vec2(x, y) - uPointer.xy;
	float m = 0.6 * uBend * uPointer.z * exp(-(d.x * d.x + d.y * d.y) / 26000.0);
	return vec3(y + d.y * m, slope * (1.0 + m) - d.y * m * d.x / 13000.0, env);
}

void main() {
	H = uRes.y / uRatio;
	float W = uRes.x / uRatio;
	vec2 p = gl_FragCoord.xy / uRatio;
	vec3 light = vec3(0.0);

	// The pulses' heads: a hot point with a soft bloom and a thin flare along
	// the line, and a light that the lines near it catch.
	float heads = 0.0;
	for (int i = 0; i < PULSES; i++) {
		vec4 q = uPulse[i];
		if (q.w <= 0.0) continue;
		vec2 d = p - vec2(q.y, lineAt(q.x, q.y).x);
		float r2 = dot(d, d);
		heads += q.w * exp(-r2 / 18000.0);
		light += uPulseInk * q.w * (exp(-r2 / 10.0) * 2.0 + exp(-sqrt(r2) / 14.0) * 0.14 * uGlow + exp(-abs(d.y) / 1.2 - abs(d.x) / 36.0) * 0.22 * uGlow);
	}

	if (abs(p.y - H * 0.5) < H * 0.26 * uAmp + 200.0) {
		vec2 toLamp = p - uPointer.xy;
		float boost = 1.0 + heads * 2.4 + uPointer.z * uBend * 0.9 * exp(-dot(toLamp, toLamp) / 30000.0);
		vec3 tint = ink(p.x / W);
		float sum = 0.0;
		float squares = 0.0;
		for (int i = 0; i < LINES; i++) {
			float L = float(i);
			float k = L / float(LINES - 1);
			vec3 l = lineAt(L, p.x);
			float dist = (p.y - l.x) * inversesqrt(1.0 + l.y * l.y);
			// Depth: back lines blur (a wider core, dimmer) and fringe.
			float sigma = max(0.6 + uDepth * 3.6 * k * k, 0.55 / uRatio);
			float energy = (0.35 + 0.65 * l.z) * mix(1.0, 0.45, k) * sqrt(0.6 / sigma);
			float fringe = uDepth * (0.15 + 1.4 * k);
			vec3 o = vec3(dist - fringe, dist, dist + fringe);
			vec3 core = exp(-o * o / (2.0 * sigma * sigma));
			float halo = exp(-abs(dist) / mix(6.0, 13.0, k));
			// Pulses running along this line: a bright run with a tail behind it,
			// its front sharp on the line and soft in the light round it.
			float run = 0.0;
			float runGlow = 0.0;
			for (int j = 0; j < PULSES; j++) {
				vec4 q = uPulse[j];
				float a = q.y - p.x;
				float on = step(abs(q.x - L), 0.5) * q.w;
				float tail = exp(-max(a, 0.0) * 3.0 / max(q.z, 1.0));
				run += on * tail * exp(min(a, 0.0) / 3.0);
				runGlow += on * tail * exp(min(a, 0.0) / 24.0);
			}
			// Further back, a little cooler and greyer, as distance does.
			vec3 hue = mix(tint, vec3(0.55, 0.62, 0.72) * dot(tint, vec3(0.3, 0.55, 0.15)), k * 0.35);
			light += hue * (core * 1.35 + halo * 0.09 * uGlow) * energy * boost;
			light += uPulseInk * (run * core.g * 2.6 + runGlow * halo * 0.3 * uGlow) * mix(1.0, 0.5, k);
			float c = core.g * energy;
			sum += c;
			squares += c * c;
		}
		// Where lines cross, the palette's other end shimmers in.
		float crossing = clamp(sum * sum - squares, 0.0, 1.0);
		light += ink(fract(p.x / W + 0.5 + 0.2 * sin(uTime * 0.4 + p.x * 0.012))) * crossing * 0.7;
	}
	gl_FragColor = present(light);
}
`;
}

/** WaveBars' pass: each pixel's bar and two neighbours either side (for their glow), each over its reflection with its peak marks, and the playhead. */
const BARS_FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uRatio;
uniform sampler2D uBars;
uniform float uCount;
uniform float uStep;
uniform float uBar;
uniform float uMax;
uniform float uPlay;
uniform float uTrail;
uniform float uGlow;
uniform float uPeaks;
uniform vec2 uScrub;
${GLSL_LIGHT}

#define GAP 1.0

// A bar's height and peak mark, each 0–1, from 16 bits apiece.
vec2 barAt(float b) {
	vec4 t = texture2D(uBars, vec2((b + 0.5) / uCount, 0.5));
	return vec2(t.r * 255.0 * 256.0 + t.g * 255.0, t.b * 255.0 * 256.0 + t.a * 255.0) / 65535.0;
}

// Distance (CSS px) to a bar rising from the gap: x across from its middle,
// s up from the gap, m its length, r its radius.
float capsule(float x, float s, float m, float r) {
	return length(vec2(x, max(abs(s - m * 0.5) - (m * 0.5 - r), 0.0))) - r;
}

// Distance (CSS px) to a peak cap: as wide as a bar, 1.5px tall, rounded.
float cap(float x, float y, float r) {
	vec2 q = abs(vec2(x, y)) - vec2(r - 0.75, 0.0);
	return length(max(q, 0.0)) - 0.75;
}

// Coverage of a shape at a distance (CSS px), smoothed over a device pixel.
float edge(float d) { return clamp(0.5 - d * uRatio, 0.0, 1.0); }

void main() {
	float W = uRes.x / uRatio;
	float H = uRes.y / uRatio;
	vec2 p = gl_FragCoord.xy / uRatio;
	float v = p.y - H * 0.5;
	float off = (W - uCount * uStep) * 0.5;
	float i = floor((p.x - off) / uStep);
	float r = uBar * 0.5;
	// Up from the gap over the middle, and down from it into the reflection.
	float up = v - GAP;
	float down = -v - GAP;
	vec3 light = vec3(0.0);
	for (int j = -2; j <= 2; j++) {
		float b = i + float(j);
		if (b < 0.0 || b >= uCount) continue;
		vec2 bar = barAt(b);
		float bx = off + (b + 0.5) * uStep;
		float m = max(bar.x * uMax, r * 2.0);
		float dx = p.x - bx;
		// Lit by the playhead as it plays them (a tail of light behind it,
		// a glimmer just ahead), and by the pointer scrubbing.
		float behind = uPlay - bx;
		float lit = behind >= 0.0 ? exp(-behind / uTrail) : exp(behind / 9.0) * 0.6;
		lit = max(lit, uScrub.y * exp(-(bx - uScrub.x) * (bx - uScrub.x) / 2400.0) * 0.7);
		vec3 tint = ink(bx / W);
		// Unplayed bars are muted; played ones take the full colour. Each is
		// brighter towards its tip, and a played tip runs hot.
		vec3 tone = mix(vec3(dot(tint, vec3(0.3, 0.59, 0.11))), tint, 0.6) * 0.17 + tint * 1.6 * lit;
		float along = clamp(up / m, 0.0, 1.0);
		// The bar, and its reflection: dimmer, fading as it goes down.
		float d = capsule(dx, up, m, r);
		float e = capsule(dx, down, m, r);
		light += (tone * (0.55 + 0.6 * along) + vec3(0.9, 0.95, 1.0) * lit * lit * smoothstep(0.4, 1.0, along) * 0.9) * (edge(d) + exp(-max(d, 0.0) / 4.0) * 0.16 * uGlow);
		light += tone * (edge(e) + exp(-max(e, 0.0) / 4.0) * 0.1 * uGlow) * 0.36 * (1.0 - 0.8 * clamp(down / m, 0.0, 1.0));
		// The peak marks: a short cap over the bar, and its reflection.
		float mark = max(bar.y * uMax, m) + 3.5;
		vec3 markInk = mix(tint, vec3(1.0), 0.4) * (0.18 + 1.3 * lit) * uPeaks;
		light += markInk * (edge(cap(dx, up - mark, r)) + edge(cap(dx, down - mark, r)) * 0.22);
	}
	// The playhead: a fine bright line with a soft column of light round it,
	// reaching a little past the bar it is playing, dimmer in the reflection.
	float d = abs(p.x - uPlay);
	float playing = barAt(clamp(floor((uPlay - off) / uStep), 0.0, uCount - 1.0)).x * uMax;
	float reach = exp(-pow(abs(v) / (playing + 24.0), 8.0)) * (v < 0.0 ? 0.45 : 1.0);
	light += mix(ink(uPlay / W), vec3(1.0), 0.55) * reach * (exp(-d * d / 0.7) * 1.5 + (exp(-d / 7.0) * 0.1 + exp(-d / 32.0) * 0.025) * uGlow);
	gl_FragColor = present(light);
}
`;

/**
 * A left-to-right gradient through some colours, mixed in Oklab so the
 * blend does not go muddy, as sRGB bytes for a texture.
 *
 * @param {string[]} colors The colours, at least one.
 * @returns {Uint8Array} GRADIENT RGBA texels.
 * @throws {TypeError} When a colour is not hex.
 */
function gradient(colors) {
	const rgb = colors.map(parseColor);
	const bytes = new Uint8Array(GRADIENT * 4);
	for (let i = 0; i < GRADIENT; i++) {
		const at = (i / (GRADIENT - 1)) * (rgb.length - 1);
		const from = Math.min(Math.floor(at), Math.max(0, rgb.length - 2));
		const c = rgb.length > 1 ? mixOklab(rgb[from], rgb[from + 1], at - from) : rgb[0];
		bytes.set([...c.map((v) => Math.round(v * 255)), 255], i * 4);
	}
	return bytes;
}

/**
 * Makes a texture on a unit, filtered and clamped, not yet filled.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @param {number} unit Its texture unit.
 * @param {number} filter gl.LINEAR or gl.NEAREST.
 * @returns {WebGLTexture} The texture, bound on its unit.
 */
function makeTexture(gl, unit, filter) {
	const texture = /** @type {WebGLTexture} */ (gl.createTexture());
	gl.activeTexture(gl.TEXTURE0 + unit);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	return texture;
}

/**
 * The colour gradient both effects read (`uInk`): made on INK_UNIT, and
 * filled again when the element's `data-colors` changes (redrawing a still
 * frame).
 *
 * @param {import('./stage.js').Stage} stage The stage, its program bound.
 * @param {HTMLElement} el The effect's element, for `data-colors`.
 * @param {string[]} colors The colours to start with.
 * @returns {() => void} Stops following `data-colors` and frees the texture.
 */
function inkGradient(stage, el, colors) {
	const { gl, uniform } = stage;
	const texture = makeTexture(gl, INK_UNIT, gl.LINEAR);
	gl.uniform1i(uniform('uInk'), INK_UNIT);

	/**
	 * Fills the texture with a gradient through some colours.
	 *
	 * @param {string[]} next The colours.
	 */
	const fill = (next) => {
		gl.activeTexture(gl.TEXTURE0 + INK_UNIT);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRADIENT, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, gradient(next));
	};
	fill(colors);
	let started = false;
	const unwatch = watchColors(el, (next) => {
		fill(next.colors);
		if (started && stage.still) stage.redraw();
	});
	started = true;
	return () => {
		unwatch();
		gl.deleteTexture(texture);
	};
}

/**
 * The pointer over an element, eased, in CSS px from the bottom left, with
 * how present it is (0–1): it fades in as the pointer arrives and out as it
 * leaves, so nothing snaps. Only on devices that hover.
 *
 * @param {HTMLElement} el The element.
 * @param {boolean} enabled Whether to follow it at all.
 * @returns {(dt: number, width: number, height: number) => [number, number, number]} Reads it for a frame.
 */
function follower(el, enabled) {
	const on = enabled && canHover();
	/** @type {[number, number, number]} */
	const eased = [0, 0, 0];
	let placed = false;

	/**
	 * Reads the pointer for a frame.
	 *
	 * @param {number} dt Seconds since the last read.
	 * @param {number} width The element's width, CSS px.
	 * @param {number} height Its height, CSS px.
	 * @returns {[number, number, number]} x, y (CSS px, from the bottom left) and presence 0–1.
	 */
	const read = (dt, width, height) => {
		if (!on) return eased;
		const p = pointerIn(el);
		if (p.inside && !placed) {
			eased[0] = p.x * width;
			eased[1] = p.y * height;
			placed = true;
		}
		if (p.inside) {
			const k = 1 - Math.exp(-dt / 0.12);
			eased[0] += (p.x * width - eased[0]) * k;
			eased[1] += (p.y * height - eased[1]) * k;
		}
		eased[2] += ((p.inside ? 1 : 0) - eased[2]) * (1 - Math.exp(-dt / 0.35));
		if (eased[2] < 0.01 && !p.inside) placed = false;
		return eased;
	};
	return read;
}

/**
 * The colours an effect starts with: its `colors`, or its one `color`, or
 * its `palette`, or its defaults.
 *
 * @param {{ color?: string, colors?: string[], palette?: string }} config The settings.
 * @param {string[]} fallback The defaults.
 * @returns {string[]} At least one colour.
 */
function startColors(config, fallback) {
	if (!config.colors?.length && config.color) return [config.color];
	return pickColors(config, fallback);
}

/**
 * Starts signal lines on an element (its first canvas is drawn into).
 *
 * @param {HTMLElement} el The element.
 * @param {SignalLinesConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function signalLines(el, config) {
	const lines = Math.round(Math.min(12, Math.max(2, config.lines ?? 7)));
	const rate = Math.max(0, config.pulses ?? 1);
	const speed = config.speed ?? 1;
	/** @type {{ line: number, x: number, speed: number, len: number, strength: number }[]} */
	const pulses = [];
	const pulseData = new Float32Array(PULSES * 4);
	const pointer = follower(el, (config.bend ?? 1) > 0);
	// Started a little way in, so the still frame and the first are a good moment.
	const start = performance.now() - 7_300 / Math.max(speed, 0.01);

	const { stop } = createStage(el, {
		fragment: linesFragment(lines),
		scale: isMobileGpu() ? 0.75 : 1,
		setup(stage) {
			const { gl, uniform } = stage;
			gl.uniform1f(uniform('uAmp'), config.amplitude ?? 1);
			gl.uniform1f(uniform('uGlow'), Math.min(2, Math.max(0, config.glow ?? 1)));
			gl.uniform1f(uniform('uGrain'), Math.min(1, Math.max(0, config.grain ?? 0.5)) * 0.45);
			gl.uniform1f(uniform('uDepth'), Math.max(0, config.depth ?? 1));
			gl.uniform1f(uniform('uBend'), Math.max(0, config.bend ?? 1));
			gl.uniform3fv(uniform('uPulseInk'), parseColor(config.pulse ?? '#fafafa').map((c) => c ** 2.2));
			// The still frame keeps one pulse, part way along the second line.
			if (stage.still && rate > 0) pulses.push({ line: 1, x: 0, speed: 0, len: 150, strength: 1 });
			return inkGradient(stage, el, startColors(config, LINE_COLORS));
		},
		resize({ gl, uniform, canvas }) {
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, canvas.width / canvas.height));
		},
		uniforms({ gl, uniform, canvas, ratio, still }, now, dt) {
			const w = canvas.width / ratio;
			if (still && pulses[0]) pulses[0].x = w * 0.64;
			// Pulses: now and then one sets off along a line.
			if (dt && pulses.length < PULSES && Math.random() < rate * 0.9 * dt) {
				pulses.push({ line: (Math.random() * lines) | 0, x: -40, speed: 240 + Math.random() * 260, len: 90 + Math.random() * 110, strength: 0.75 + Math.random() * 0.35 });
			}
			for (let i = pulses.length - 1; i >= 0; i--) {
				pulses[i].x += pulses[i].speed * speed * dt;
				if (pulses[i].x - pulses[i].len > w) pulses.splice(i, 1);
			}
			pulseData.fill(0);
			pulses.forEach((p, i) => pulseData.set([p.line, p.x, p.len, p.strength], i * 4));
			gl.uniform1f(uniform('uRatio'), ratio);
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000) * speed);
			gl.uniform1f(uniform('uSeed'), still ? 0 : Math.random() * 100);
			gl.uniform3fv(uniform('uPointer'), still ? [0, 0, 0] : pointer(dt, w, canvas.height / ratio));
			gl.uniform4fv(uniform('uPulse'), pulseData);
		},
	});
	return stop;
}

/**
 * Starts tuning wave bars on an element (its first canvas is drawn into).
 *
 * @param {HTMLElement} el The element.
 * @param {WaveBarsConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function waveBars(el, config) {
	const step = Math.max(2, config.step ?? 8);
	const every = Math.max(0.2, config.every ?? 2) * 1000;
	const scrub = Math.max(0, config.scrub ?? 1);
	const pointer = follower(el, scrub > 0);
	/** The resting take's phases: what a still frame shows. */
	const REST = [0.6, 2.1, 1, 0.3, 0];
	/**
	 * Each bar's shown height, the take it heads for, its peak mark, how long the mark still holds, and how fast it falls.
	 *
	 * @type {{ cur: Float32Array, tgt: Float32Array, peak: Float32Array, hold: Float32Array, fall: Float32Array }}
	 */
	let bars = { cur: new Float32Array(0), tgt: new Float32Array(0), peak: new Float32Array(0), hold: new Float32Array(0), fall: new Float32Array(0) };
	let data = new Uint8Array(0);
	let lastTune = 0;
	const start = performance.now();
	/** @type {WebGLTexture | null} */
	let heights = null;

	/**
	 * A take: heights that rise and fall together over a few bars, under a
	 * broad envelope, as a real recording's do, 0.12–1.
	 *
	 * @param {number} i The bar.
	 * @param {number[]} seed Five phases for this take.
	 * @returns {number} Its height.
	 */
	const take = (i, seed) => {
		const env = 0.5 + 0.5 * Math.sin(i * 0.045 + seed[0]) * Math.sin(i * 0.021 + seed[1]);
		const detail = Math.abs(Math.sin(i * 0.5 + seed[2]) * 0.6 + Math.sin(i * 0.17 + seed[3]) * 0.4);
		const v = env * (0.45 + 0.55 * detail) * (0.8 + 0.2 * Math.sin(i * 1.7 + seed[4]));
		return Math.max(0.12, Math.min(1, 0.12 + v * 1.05));
	};

	/**
	 * Sizes the bars to a count, keeping those already there; new ones take
	 * the resting take.
	 *
	 * @param {number} count How many bars.
	 */
	const resizeBars = (count) => {
		/**
		 * One of the bars' arrays at the new length.
		 *
		 * @param {Float32Array} from The old values.
		 * @param {(i: number) => number} fill A new bar's value.
		 * @returns {Float32Array} The new values.
		 */
		const grow = (from, fill) => Float32Array.from({ length: count }, (_, i) => (i < from.length ? from[i] : fill(i)));
		bars = {
			cur: grow(bars.cur, (i) => take(i, REST)),
			tgt: grow(bars.tgt, (i) => take(i, REST)),
			peak: grow(bars.peak, (i) => Math.min(1, take(i, REST) + 0.06)),
			hold: grow(bars.hold, () => 0),
			fall: grow(bars.fall, () => 0),
		};
		data = new Uint8Array(count * 4);
	};

	/**
	 * Moves the bars on by a frame: a new take every so often, each bar quick
	 * to rise to it and slow to fall, kicked up as the playhead plays it and
	 * lifted under the pointer, and its peak mark held a moment before it drops.
	 *
	 * @param {number} now The time, ms.
	 * @param {number} dt Seconds since the last frame.
	 * @param {number} offset The first bar's left edge, CSS px.
	 * @param {number} play The playhead, CSS px across.
	 * @param {[number, number, number]} at The pointer: x, y (CSS px) and presence.
	 */
	const stepBars = (now, dt, offset, play, at) => {
		const { cur, tgt, peak, hold, fall } = bars;
		if (now - lastTune > every) {
			lastTune = now;
			const seed = Array.from({ length: 5 }, () => Math.random() * 100);
			for (let i = 0; i < tgt.length; i++) tgt[i] = take(i, seed);
		}
		const rise = 1 - Math.exp(-dt / 0.09);
		const ease = 1 - Math.exp(-dt / 0.55);
		for (let i = 0; i < cur.length; i++) {
			const x = offset + (i + 0.5) * step;
			// Lifted under the pointer, and kicked up as the playhead plays them.
			const lift = Math.max(scrub * at[2] * Math.exp(-((x - at[0]) ** 2) / 2400) * 0.35, Math.exp(-(((x - play) / (step * 2.5)) ** 2)) * 0.3);
			const goal = Math.min(1, tgt[i] + lift * (1 - tgt[i]));
			cur[i] += (goal - cur[i]) * (goal > cur[i] ? rise : ease);
			if (cur[i] >= peak[i]) {
				peak[i] = cur[i];
				hold[i] = 0.7;
				fall[i] = 0;
			} else if (hold[i] > 0) {
				hold[i] -= dt;
			} else {
				fall[i] += 0.9 * dt;
				peak[i] = Math.max(cur[i], peak[i] - fall[i] * dt);
			}
		}
	};

	/**
	 * Packs the heights and peak marks into the texture, 16 bits each.
	 *
	 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
	 */
	const upload = (gl) => {
		const { cur, peak } = bars;
		for (let i = 0; i < cur.length; i++) {
			const a = Math.round(cur[i] * 65535);
			const b = Math.round(peak[i] * 65535);
			data[i * 4] = a >> 8;
			data[i * 4 + 1] = a & 255;
			data[i * 4 + 2] = b >> 8;
			data[i * 4 + 3] = b & 255;
		}
		gl.activeTexture(gl.TEXTURE0 + BARS_UNIT);
		gl.bindTexture(gl.TEXTURE_2D, heights);
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cur.length, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
	};

	const { stop } = createStage(el, {
		fragment: BARS_FRAG,
		setup(stage) {
			const { gl, uniform } = stage;
			gl.uniform1f(uniform('uStep'), step);
			gl.uniform1f(uniform('uBar'), Math.min(step, Math.max(1, config.bar ?? 3)));
			gl.uniform1f(uniform('uGlow'), Math.min(2, Math.max(0, config.glow ?? 1)));
			gl.uniform1f(uniform('uGrain'), Math.min(1, Math.max(0, config.grain ?? 0.4)) * 0.45);
			gl.uniform1f(uniform('uPeaks'), config.peaks === false ? 0 : 1);
			gl.uniform1i(uniform('uBars'), BARS_UNIT);
			const texture = makeTexture(gl, BARS_UNIT, gl.NEAREST);
			heights = texture;
			const freeInk = inkGradient(stage, el, startColors(config, BAR_COLORS));
			return () => {
				freeInk();
				gl.deleteTexture(texture);
			};
		},
		resize({ gl, uniform, canvas, ratio }) {
			const count = Math.max(8, Math.floor(canvas.width / ratio / step));
			resizeBars(count);
			gl.activeTexture(gl.TEXTURE0 + BARS_UNIT);
			gl.bindTexture(gl.TEXTURE_2D, heights);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, count, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
			gl.uniform1f(uniform('uCount'), count);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, canvas.width / canvas.height));
		},
		uniforms({ gl, uniform, canvas, ratio, still }, now, dt) {
			const w = canvas.width / ratio;
			const h = canvas.height / ratio;
			const at = still ? /** @type {[number, number, number]} */ ([0, 0, 0]) : pointer(dt, w, h);
			// The playhead: across in about ten seconds, then a pause off the edge.
			const t = (now - start) / 1000;
			const play = config.sweep === false ? -1e5 : still ? w * 0.62 : ((t * 0.1) % 1.4) * w - w * 0.2;
			if (!still) stepBars(now, dt, (w - bars.cur.length * step) / 2, play, at);
			upload(gl);
			gl.uniform1f(uniform('uRatio'), ratio);
			gl.uniform1f(uniform('uMax'), h * (config.height ?? 0.34));
			gl.uniform1f(uniform('uPlay'), play);
			gl.uniform1f(uniform('uTrail'), w * 0.22);
			gl.uniform2f(uniform('uScrub'), at[0], at[2] * scrub);
			gl.uniform1f(uniform('uSeed'), still ? 0 : Math.random() * 100);
		},
	});
	return stop;
}
