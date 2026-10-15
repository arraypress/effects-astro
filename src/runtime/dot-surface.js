/**
 * @module @arraypress/effects-astro/dot-surface
 *
 * A halftone sea: a regular grid of round dots lying on a slowly rolling
 * sheet, seen in perspective from a little above. Columns lean and bunch
 * with the swells and rows close up into the distance. Each dot is sized
 * and lit by how the light catches the sheet where it lies, so a crest
 * turned towards the light is a run of large bright dots and a trough is
 * a field of pinpoints. The sheet fades out towards its far edge and the
 * sides; where there are no dots the canvas is transparent.
 *
 * The sheet is a few long Gerstner swells (each point rides a small orbit,
 * so crests gather the dots and troughs spread them), summed with
 * analytic slopes for exact lighting. The pointer raises a soft swell
 * where it rests; a click sends a ring out across the sheet.
 *
 * WebGL point sprites, one draw a frame: every dot is placed, lit and
 * sized on the GPU, crisp and anti-aliased at any pixel ratio, sized in
 * CSS px. Phones get a coarser grid. With prefers-reduced-motion, one
 * still frame.
 */

import { createStage } from './stage.js';
import { createPoints, GLSL_PROJECT } from './points.js';
import { GLSL_OKLAB, parseColor, toOklab } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { canHover, isMobileGpu } from './device.js';
import { pointerIn, pressAt } from './pointer.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {object} DotSurfaceConfig
 * @property {string} [color='#ff8a1f'] The dots' colour.
 * @property {string[]} [colors] A gradient instead (up to five), blended in Oklab, from near to far or left to right (see `gradient`).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors` or `color`.
 * @property {'depth' | 'width'} [gradient='depth'] Which way `colors` runs: near to far, or left to right.
 * @property {number} [pitch=10] Space between dots, CSS px, at the middle of the sheet (nearer is wider, further closer).
 * @property {number} [dot=6] The largest dot, CSS px, at the middle of the sheet.
 * @property {number} [amplitude=1] How tall the swells are: 1 a gentle roll, 2 a heavy sea, 0 flat.
 * @property {number} [speed=1] How fast the sheet rolls; 0 holds it still.
 * @property {number} [tilt=42] The camera's angle above the sheet, degrees (10 grazing, 70 nearly overhead).
 * @property {[number, number, number]} [light=[-0.5, 0.6, -0.6]] Where the light comes from: x right, y up, z into the distance.
 * @property {boolean} [interactive=true] Whether the pointer raises a swell and a click sends a ring.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area kept dim behind copy: centre (0–1 from the top left), radius (a
 *   share of the height) and depth (0–1). The middle with `{}`.
 */

/** Most colours a gradient takes. */
export const MAX_COLORS = 5;
/** Most click rings alive at once. */
const MAX_RINGS = 8;
/** Seconds a ring lasts. */
const RING_LIFE = 3.2;
/** How fast a ring runs out, sheet units a second (the frame is 2 units tall). */
const RING_SPEED = 0.6;
/** Where the sheet's far edge sits on screen when flat: clip-space y, 1 the top. */
const FAR_EDGE = 0.3;
/** Where its near edge sits: below the bottom, so it never shows. */
const NEAR_EDGE = -1.2;
/** The furthest the sheet reaches, sheet units, however low the camera. */
const MAX_FAR = 2.2;
/** The default colour: a warm orange. */
const COLOR = '#ff8a1f';

/**
 * How far into the distance a point on the flat sheet lies, given where it
 * lands on screen: GLSL_PROJECT's perspective (w = 1 + 0.45 z) undone for
 * the plane y = 0, turned `tilt` towards the camera.
 *
 * @param {number} y Clip-space height on screen, -1 (bottom) to 1.
 * @param {number} tilt The camera's angle above the sheet, radians.
 * @returns {number} Depth on the sheet (larger is further), or Infinity
 *   when that height is at or above the horizon.
 */
export function sheetDepth(y, tilt) {
	const s = Math.sin(tilt);
	const below = s - 0.45 * Math.cos(tilt) * y;
	return below > 1e-6 ? y / below : Infinity;
}

/**
 * Where a point on the screen lies on the flat sheet: the inverse of
 * `projectPoint([x, 0, z], 0, -tilt, aspect)`.
 *
 * @param {number} x Across the element, 0 (left) to 1.
 * @param {number} y Up it, 0 (bottom) to 1, as `pointerIn` gives it.
 * @param {number} tilt The camera's angle above the sheet, radians.
 * @param {number} aspect The element's width over height.
 * @returns {{ x: number, z: number } | null} Sheet coordinates, or null above the horizon.
 */
export function sheetAt(x, y, tilt, aspect) {
	const z = sheetDepth(y * 2 - 1, tilt);
	if (!Number.isFinite(z)) return null;
	const w = 1 + 0.45 * Math.cos(tilt) * z;
	return { x: (x * 2 - 1) * aspect * w, z };
}

/**
 * The sheet's grid as particle data: every dot on a square grid `spacing`
 * apart from just below the frame to the far edge, kept only where the flat
 * sheet would land on screen (with a margin for the swells). Each dot is
 * its place on the sheet (x, z), how far back it is (0 nearest, 1 the far
 * edge) and how far across the screen it lands (0 left, 1 right).
 *
 * @param {number} aspect The element's width over height.
 * @param {number} spacing Grid spacing, sheet units (the frame is 2 tall).
 * @param {number} tilt The camera's angle above the sheet, radians.
 * @returns {Float32Array} Four floats a dot.
 */
export function sheetGrid(aspect, spacing, tilt) {
	const near = sheetDepth(NEAR_EDGE, tilt);
	const far = Math.min(MAX_FAR, sheetDepth(FAR_EDGE, tilt));
	const k = 0.45 * Math.cos(tilt);
	const out = [];
	const rows = Math.max(2, Math.round((far - near) / spacing) + 1);
	for (let r = 0; r < rows; r++) {
		const z = near + r * spacing;
		const w = 1 + k * z;
		// Columns centred on the middle, wide enough to cover the frame at this depth.
		const half = Math.ceil((aspect * w * 1.12) / spacing);
		for (let c = -half; c <= half; c++) {
			const x = c * spacing;
			out.push(x, z, r / (rows - 1), (x / (aspect * w)) * 0.5 + 0.5);
		}
	}
	return new Float32Array(out);
}

/**
 * A gradient as the shader takes it: each colour in Oklab, padded to
 * MAX_COLORS by repeating the last.
 *
 * @param {string[]} colors CSS hex colours, at least one; past MAX_COLORS are dropped.
 * @returns {Float32Array} Three channels a colour, MAX_COLORS colours.
 * @throws {TypeError} When a colour is not a hex colour.
 */
export function gradientUniform(colors) {
	const list = colors.slice(0, MAX_COLORS);
	return new Float32Array(Array.from({ length: MAX_COLORS }, (_, i) => toOklab(parseColor(list[Math.min(i, list.length - 1)]))).flat());
}

/**
 * Each dot: placed on the rolling sheet, lit, sized and coloured. `p` is
 * (x, z, depth 0–1, across 0–1) from `sheetGrid`.
 */
const VERTEX = `
precision highp float;
attribute vec4 p;
uniform vec2 uRes;
uniform float uTime;
uniform float uRatio;
uniform vec2 uShift;
uniform float uTilt;
uniform float uAmp;
uniform float uDot;
uniform float uMaxPoint;
uniform vec3 uLight;
uniform vec3 uInk[${MAX_COLORS}];
uniform float uInks;
uniform float uAcross;
uniform vec4 uPointer;
uniform vec4 uRings[${MAX_RINGS}];
varying vec3 vColour;
varying float vAlpha;
varying float vSize;
${GLSL_PROJECT}
${GLSL_OKLAB}
${GLSL_QUIET}

// One Gerstner swell: direction, wavelength, height (a share of the whole)
// and how fast it runs. Adds its height and slope to h, and its orbit to d.
void swell(vec2 at, vec2 dir, float len, float amp, float rate, float phase, inout vec3 h, inout vec2 d) {
	float k = 6.2831853 / len;
	float a = dot(at, dir) * k - uTime * rate + phase;
	float s = sin(a), c = cos(a);
	h += vec3(amp * s, amp * k * c * dir);
	// The orbit: towards the crest as it passes, so crests gather dots.
	d += dir * (amp * 0.8 * c);
}

// The gradient's colour at t, 0–1, in Oklab.
vec3 ink(float t) {
	float x = clamp(t, 0.0, 1.0) * (uInks - 1.0);
	float i = min(floor(x), max(uInks - 2.0, 0.0));
	vec3 a = uInk[0], b = uInk[0];
	for (int n = 0; n < ${MAX_COLORS - 1}; n++) {
		if (float(n) == i) { a = uInk[n]; b = uInk[n + 1]; }
	}
	return uInks > 1.0 ? mix(a, b, x - i) : a;
}

void main() {
	vec2 at = p.xy;
	// The swells: h is (height, slope across, slope back), in units of uAmp.
	vec3 h = vec3(0.0);
	vec2 d = vec2(0.0);
	swell(at, vec2(0.55, 0.84), 1.55, 0.40, 0.24, 0.0, h, d);
	swell(at, vec2(0.96, -0.28), 2.3, 0.30, 0.17, 1.7, h, d);
	swell(at, vec2(-0.5, 0.87), 1.05, 0.19, 0.29, 4.1, h, d);
	swell(at, vec2(0.12, -0.99), 0.72, 0.11, 0.36, 2.3, h, d);
	h *= uAmp;
	d *= uAmp;
	float lift = 0.0;
	float glow = 0.0;

	// The pointer's swell: a soft mound with a faint ring round it.
	vec2 toP = at - uPointer.xy;
	float dp = length(toP);
	float mound = exp(-dp * dp / (uPointer.w * uPointer.w)) * uPointer.z;
	float ring = 1.0 + 0.25 * cos(dp * 14.0 - uTime * 2.2);
	h.x += mound * 0.08 * ring;
	h.yz += toP * (-2.0 / (uPointer.w * uPointer.w)) * mound * 0.08;
	lift += mound * 0.22;

	// The click rings: a crest running outward, widening and fading.
	for (int n = 0; n < ${MAX_RINGS}; n++) {
		vec4 r = uRings[n];
		if (r.w <= 0.0) continue;
		vec2 off = at - r.xy;
		float dist = length(off) + 1e-4;
		float radius = r.z * ${RING_SPEED.toFixed(2)};
		float width = 0.09 + r.z * 0.05;
		float o = (dist - radius) / width;
		if (abs(o) > 3.0) continue;
		float g = exp(-o * o) * r.w;
		h.x += g * 0.035;
		h.yz += (off / dist) * (-2.0 * o / width) * g * 0.035;
		// Dots are pushed out ahead of the crest and drawn back behind it: the grid visibly bends as it passes.
		d += (off / dist) * (-o * g * 0.03);
		glow += g;
	}

	// Lighting: how far the slope turns the sheet towards the light, from flat.
	vec3 n = normalize(vec3(-h.y, 1.0, -h.z));
	vec3 L = normalize(uLight);
	float lit = 0.48 + (dot(n, L) - L.y) * 2.1 + h.x * 2.0 + lift;
	float b = min(1.0, smoothstep(0.0, 1.0, lit) + glow * 0.5);

	// Place it: on the sheet, turned towards the camera, in perspective.
	vec3 v = vec3(at.x + d.x, h.x, at.y + d.y);
	v = rotateX(v, -uTilt);
	float aspect = uRes.x / uRes.y;
	vec4 pos = project(v, aspect);
	gl_Position = pos + vec4(uShift * pos.w, 0.0, 0.0);
	vec2 ndc = pos.xy / pos.w;

	// Fading out: into the distance, towards the sides, and in the quiet area.
	float fade = (1.0 - smoothstep(0.4, 1.0, p.z)) * (1.0 - smoothstep(0.62, 1.04, abs(ndc.x)));
	float quiet = mix(1.0 - uQuiet.w, 1.0, quietOpen(vec2(ndc.x * aspect, ndc.y) * 0.5));
	fade *= quiet;

	// Size: from a pinpoint in the troughs to the full dot on a lit crest,
	// nearer dots larger. Below a pixel and a half the sprite stays that
	// size and fades instead, so pinpoints stay round rather than flicker.
	float size = uDot * mix(0.2, 1.0, b * (0.4 + 0.6 * b)) * (1.0 + 0.3 * min(glow, 1.0)) * mix(0.55, 1.0, fade) / pos.w * uRatio;
	float shown = max(size, 1.5 * uRatio);
	vSize = min(shown, uMaxPoint - 1.0);
	gl_PointSize = vSize + 1.0;
	vAlpha = mix(0.3, 1.0, b) * fade * (size / shown) * (size / shown);

	// Colour: the gradient, lightened a touch on the brightest crests.
	vec3 lab = ink(mix(p.z, p.w, uAcross));
	lab.x += 0.07 * b * b + 0.1 * min(glow, 1.0);
	vColour = fromOklab(lab);
}
`;

/**
 * A crisp round dot `vSize` px across, anti-aliased over one pixel. Drawn
 * with the MAX blend where the context has it, so overlapping dots merge.
 */
const DOT = `
precision highp float;
varying vec3 vColour;
varying float vAlpha;
varying float vSize;
void main() {
	float r = length(gl_PointCoord - 0.5) * (vSize + 1.0);
	float a = clamp(vSize * 0.5 - r + 0.5, 0.0, 1.0) * vAlpha;
	gl_FragColor = vec4(vColour * a, a);
}
`;

/**
 * The stage's own full-screen pass has nothing to paint (the canvas is
 * transparent and cleared each frame), so its triangle sits beyond the far
 * plane and is clipped away: the dots are drawn after it.
 */
const NOTHING = {
	vertex: 'attribute vec2 p; void main() { gl_Position = vec4(p, 2.0, 1.0); }',
	fragment: 'precision mediump float; void main() { gl_FragColor = vec4(0.0); }',
};

/**
 * Starts the dot surface on an element (its first canvas is drawn into).
 *
 * @param {HTMLElement} el The element.
 * @param {DotSurfaceConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function dotSurface(el, config) {
	const tilt = ((config.tilt ?? 42) * Math.PI) / 180;
	const pitch = (config.pitch ?? 10) * (isMobileGpu() ? 1.3 : 1);
	const speed = config.speed ?? 1;
	const interactive = config.interactive !== false;
	const light = config.light ?? [-0.5, 0.6, -0.6];
	const start = !config.colors?.length && config.color ? [config.color] : pickColors(config, [COLOR]);
	let ink = gradientUniform(start);
	let inks = Math.min(MAX_COLORS, start.length);
	/** @type {import('./points.js').Points | null} */
	let points = null;
	let maxPoint = 64;
	/** The MAX blend equation, where the context has it. @type {number | null} */
	let lighter = null;
	// The sheet's own clock: it advances with `speed`, so pausing and resuming do not
	// jump. It starts where the swells have built a lit ridge (the still frame too).
	let time = 7;
	/** The pointer's swell: where on the sheet it is heading (tx, tz), where it is (x, z), and how strong (on, 0–1). */
	const swell = { tx: 0, tz: 0, x: 0, z: 0, on: 0 };
	/** @type {{ x: number, z: number, t0: number }[]} */
	const rings = [];
	const ringData = new Float32Array(MAX_RINGS * 4);

	/**
	 * Follows the pointer: the swell eases towards it, and fades when it leaves.
	 *
	 * @param {number} aspect The canvas's width over height.
	 * @param {number} dt Seconds since the last frame.
	 */
	const follow = (aspect, dt) => {
		const p = pointerIn(el);
		const at = p.inside ? sheetAt(p.x, p.y, tilt, aspect) : null;
		if (at) {
			if (swell.on < 0.01) Object.assign(swell, { x: at.x, z: at.z });
			swell.tx = at.x;
			swell.tz = at.z;
		}
		const k = 1 - Math.exp(-dt * 3);
		swell.x += (swell.tx - swell.x) * k;
		swell.z += (swell.tz - swell.z) * k;
		swell.on += ((at ? 1 : 0) - swell.on) * (1 - Math.exp(-dt * 2));
	};

	/**
	 * The live rings as `uRings` takes them: place, age and strength.
	 *
	 * @returns {Float32Array} Four floats a ring, zeros for none.
	 */
	const ringUniform = () => {
		const now = performance.now() / 1000;
		while (rings.length && now - rings[0].t0 > RING_LIFE) rings.shift();
		ringData.fill(0);
		rings.forEach((r, i) => {
			const age = now - r.t0;
			const k = 1 - age / RING_LIFE;
			ringData[i * 4] = r.x;
			ringData[i * 4 + 1] = r.z;
			ringData[i * 4 + 2] = age;
			ringData[i * 4 + 3] = k * k;
		});
		return ringData;
	};

	const { stage, stop } = createStage(el, {
		...NOTHING,
		setup({ gl }) {
			points = createPoints(gl, VERTEX, DOT);
			if (!points) return false;
			maxPoint = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
			lighter = 'MAX' in gl ? gl.MAX : (gl.getExtension('EXT_blend_minmax')?.MAX_EXT ?? null);
		},
		resize({ canvas, ratio }) {
			const height = canvas.height / ratio;
			points?.upload(sheetGrid(canvas.width / canvas.height, pitch / (height / 2), tilt));
		},
		after({ gl, canvas, ratio, still }, _now, dt) {
			if (!points) return;
			const aspect = canvas.width / canvas.height;
			if (!still) {
				time += dt * speed;
				if (interactive && canHover()) follow(aspect, dt);
			}
			const u = points.program.uniform;
			// Where dots crowd on a crest they merge rather than add up to a hot spot.
			if (lighter) gl.blendEquation(lighter);
			points.passes(0, () => {
				gl.uniform2f(u('uRes'), canvas.width, canvas.height);
				gl.uniform1f(u('uTime'), time);
				gl.uniform1f(u('uRatio'), ratio);
				gl.uniform1f(u('uTilt'), tilt);
				gl.uniform1f(u('uAmp'), 0.16 * (config.amplitude ?? 1));
				gl.uniform1f(u('uDot'), config.dot ?? 6);
				gl.uniform1f(u('uMaxPoint'), maxPoint);
				gl.uniform3f(u('uLight'), light[0], light[1], light[2]);
				gl.uniform3fv(u('uInk'), ink);
				gl.uniform1f(u('uInks'), inks);
				gl.uniform1f(u('uAcross'), config.gradient === 'width' ? 1 : 0);
				gl.uniform4f(u('uPointer'), swell.x, swell.z, swell.on, 0.36);
				gl.uniform4fv(u('uRings'), ringUniform());
				gl.uniform4f(u('uQuiet'), ...quietUniform(config.quiet, aspect));
			});
			gl.blendEquation(gl.FUNC_ADD);
		},
	});
	if (!stage) return stop;

	/** @param {PointerEvent} e The press: a ring from where it landed on the sheet. */
	const press = (e) => {
		const at = pressAt(el, e);
		const spot = at && sheetAt(at.x, at.y, tilt, el.clientWidth / (el.clientHeight || 1));
		if (!spot) return;
		rings.push({ ...spot, t0: performance.now() / 1000 });
		while (rings.length > MAX_RINGS) rings.shift();
	};
	if (interactive && !stage.still) document.addEventListener('pointerdown', press, { passive: true });

	const unwatch = watchColors(el, (next) => {
		ink = gradientUniform(next.colors);
		inks = Math.min(MAX_COLORS, next.colors.length);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
		document.removeEventListener('pointerdown', press);
	};
}
