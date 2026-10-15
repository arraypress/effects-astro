/**
 * @module @arraypress/effects-astro/halo-ring
 *
 * A ring of light on a dark ground: a soft-cornered outline, sized to the
 * element with a margin, whose bright core line bleeds a little light
 * inward and a long glow outward into a wide, soft bloom. Colour travels
 * around it, looping through three colours in Oklab, while brighter and
 * dimmer stretches drift along it at their own pace, so the hottest
 * passages burn through to white.
 *
 * The outline is a rounded polygon of six corners: a hexagon, a
 * rectangle fitted to the element (with a corner at the middle of each
 * side), or (the default) a slow drift between the hexagon and a squarer
 * rectangle, its corners breathing a little and the whole turning as it
 * goes; or a circle. Its light is summed in linear light and exposed, so
 * the brightest stretches saturate to white rather than clip. The pointer
 * draws the ring a touch towards it, bends the nearest corner its way and
 * lights the stretch nearest it.
 *
 * One full-screen pass with a six-step loop for the distance; sizes are
 * worked out in device pixels, so the line stays crisp at any size or
 * pixel ratio. With prefers-reduced-motion, one still frame.
 *
 * Opaque: the effect is the whole background of what it fills. Without
 * WebGL it removes its canvas and the element's background shows.
 */

import { createStage } from './stage.js';
import { parseColor } from './color.js';
import { GLSL_NOISE, GLSL_PALETTE, GLSL_QUIET, paletteUniform, quietUniform } from './glsl.js';
import { canHover } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {'morph' | 'hexagon' | 'rect' | 'circle'} HaloShape
 */

/**
 * @typedef {object} HaloRingConfig
 * @property {string[]} [colors] Three colours looped around the ring, blended in Oklab (default amber, coral, electric blue).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {HaloShape} [shape='morph'] The outline: a rounded hexagon, a rounded rectangle fitted to the element, a circle, or a slow drift between the hexagon and a squarer rectangle.
 * @property {number} [corner=0.3] How round the corners are: 0 sharp, 1 as round as they go.
 * @property {number} [margin=0.05] Space between the ring and the element's edge, a share of its shorter side.
 * @property {number} [thickness=10] The bright core line, CSS px.
 * @property {number} [glow=1] How far and how strongly the light spreads; 0 for the bare line.
 * @property {number} [speed=1] How fast the colour travels and the shape drifts; 0 holds it still.
 * @property {string} [background='#0d0c10'] The ground.
 * @property {boolean} [interactive=true] Whether the ring leans towards the pointer and lights up near it.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area kept dim behind copy: centre (0–1 from the top left), radius (a
 *   share of the height) and depth (0–1). The middle with `{}`.
 */

/** The default colours: amber, coral and electric blue. */
const COLORS = ['#ffb020', '#ff5a6e', '#2f7bff'];
/** The default ground: near black, a touch cool. */
const BACKGROUND = '#0d0c10';
/** The clock's start, and the still frame: the hexagon, with a bright stretch on each side. */
const START = 0;
/** Corners an outline has: a hexagon's six (a rectangle's four, with one more at the middle of each side). */
const CORNERS = 6;

/**
 * The ring's sizes in pixels for a canvas: the hexagon's inradius, the
 * rectangle's half width and height, the circle's radius and the corner
 * radius. The hexagon (flat top and bottom) and circle fit inside the
 * margin; `rect` fills it; `morph`'s rectangle is a squarer one inside the
 * hexagon's bounds. On a canvas taller than wide, all but `rect` are
 * measured on their side and `upright` is set: they are turned a quarter,
 * and the hexagon and rectangle stretch along the longer side so they
 * fill a phone's screen.
 *
 * @param {number} width The canvas's width, px.
 * @param {number} height Its height, px.
 * @param {HaloShape} shape The outline.
 * @param {number} margin Space to the edge, a share of the shorter side.
 * @param {number} corner Corner roundness, 0–1.
 * @returns {{ hex: number, reach: number, box: [number, number], circle: number, corner: number, upright: boolean }}
 *   The sizes, px: `reach` is the hexagon's half length, corner to corner.
 */
export function ringSize(width, height, shape, margin, corner) {
	const m = Math.min(width, height) * margin;
	const halfW = Math.max(1, width / 2 - m);
	const halfH = Math.max(1, height / 2 - m);
	const upright = shape !== 'rect' && height > width;
	const across = Math.max(halfW, halfH);
	const tall = Math.min(halfW, halfH);
	// A regular flat-topped hexagon is √3/2 as tall as it is wide.
	const hex = Math.min(tall, across * (Math.sqrt(3) / 2));
	const reach = upright ? Math.max(hex * (2 / Math.sqrt(3)), across * 0.85) : hex * (2 / Math.sqrt(3));
	/** @type {[number, number]} */
	const box = shape === 'rect' ? [halfW, halfH] : [upright ? reach * 0.92 : Math.min(across, hex * 1.08), hex * 0.86];
	const shorter = shape === 'rect' || shape === 'circle' ? tall : shape === 'hexagon' ? hex : box[1];
	return { hex, reach, box, circle: tall, corner: Math.min(1, Math.max(0, corner)) * shorter * 0.98, upright };
}

/**
 * How far the outline is from the hexagon to the rectangle at a moment,
 * 0–1. Only `morph` changes, easing between them.
 *
 * @param {HaloShape} shape The outline.
 * @param {number} time The ring's clock, seconds.
 * @returns {number} 0 the hexagon, 1 the rectangle.
 */
export function shapeBlend(shape, time) {
	if (shape === 'rect') return 1;
	if (shape !== 'morph') return 0;
	// Eased twice, so it lingers at each end and passes quickly through the in-between.
	const k = 0.5 - 0.5 * Math.cos(time * 0.2);
	const e = k * k * (3 - 2 * k);
	return e * e * (3 - 2 * e);
}

/**
 * The outline's corners, counter-clockwise from the right, before its
 * corners are rounded: the hexagon's and the rectangle's (with a corner
 * at the middle of each side, so the two match up) blended, each pulled
 * in by the corner radius so the rounded shape keeps its size.
 *
 * @param {{ hex: number, reach: number, box: [number, number], corner: number }} size From `ringSize`.
 * @param {number} blend 0 the hexagon, 1 the rectangle.
 * @returns {Float32Array} Two floats a corner, CORNERS corners, px from the centre.
 */
export function outline(size, blend) {
	const c = size.corner;
	const r = Math.max(0, size.hex - c);
	// A hexagon's corners turn through 60°: rounding by c pulls each one in 2c/√3.
	const R = Math.max(0, size.reach - c * (2 / Math.sqrt(3)));
	const slant = R - r / Math.sqrt(3);
	const a = Math.max(0, size.box[0] - c);
	const b = Math.max(0, size.box[1] - c);
	const hexagon = [R, 0, slant, r, -slant, r, -R, 0, -slant, -r, slant, -r];
	const rect = [a, 0, a, b, -a, b, -a, 0, -a, -b, a, -b];
	return new Float32Array(hexagon.map((v, i) => v + (rect[i] - v) * blend));
}

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uGround;
uniform vec2 uCorners[${CORNERS}];
uniform float uCircle;
uniform float uCorner;
uniform vec2 uCentre;
uniform float uTurn;
uniform float uWidth;
uniform float uGlow;
uniform vec3 uPtr;
${GLSL_PALETTE}
${GLSL_NOISE}
${GLSL_QUIET}

// Signed distance to the polygon through uCorners (negative inside), px.
float polygon(vec2 p) {
	float d = dot(p - uCorners[0], p - uCorners[0]);
	float side = 1.0;
	for (int i = 0; i < ${CORNERS}; i++) {
		vec2 v = uCorners[i];
		vec2 u = i == 0 ? uCorners[${CORNERS - 1}] : uCorners[i - 1];
		vec2 e = u - v;
		vec2 w = p - v;
		vec2 off = w - e * clamp(dot(w, e) / max(dot(e, e), 1e-6), 0.0, 1.0);
		d = min(d, dot(off, off));
		// Crossings of a ray to the right: odd is inside.
		bool up = p.y >= v.y, down = p.y < u.y, left = e.x * w.y > e.y * w.x;
		if ((up && down && left) || (!up && !down && !left)) side = -side;
	}
	return side * sqrt(d);
}

void main() {
	vec2 p = gl_FragCoord.xy - 0.5 * uRes - uCentre;
	float s = sin(uTurn), co = cos(uTurn);
	vec2 q = mat2(co, s, -s, co) * p;

	// Signed distance to the outline, px: negative inside.
	float d = uCircle > 0.0 ? length(q) - uCircle : polygon(q) - uCorner;

	// Around the ring, 0–1: colour travels one way, brightness drifts the other.
	float around = atan(p.y, p.x) / 6.2831853;
	float a = around * 6.2831853;
	float t = uTime;
	float shorter = min(uRes.x, uRes.y);
	vec3 tint = oklabToLinear(pal(around - t * 0.07 + d / shorter * 0.4));
	float swell = 0.5 + 0.5 * sin(2.0 * a + t * 0.45 + 0.9 * sin(a - t * 0.27));
	float bright = 0.05 + 1.2 * swell * swell * swell + 0.35 * pow(0.5 + 0.5 * sin(3.0 * a - t * 0.6), 3.0);

	// Near the pointer, the ring burns hotter.
	vec2 toPtr = gl_FragCoord.xy - uPtr.xy;
	bright *= 1.0 + uPtr.z * 1.4 * exp(-dot(toPtr, toPtr) / (shorter * shorter * 0.1));

	// The light: a crisp core line with a short bleed inward, then a glow
	// outward that hands over to a long, soft bloom.
	float w = uWidth;
	float g = uGlow * shorter;
	float core = exp(-(d * d) / (w * w));
	float inner = exp(min(d, 0.0) / (w * 1.6));
	float outer = d > 0.0 ? exp(-d / max(g * 0.07, w)) : inner;
	float bloom = d > 0.0 ? exp(-d / max(g * 0.1, w)) : exp(d / max(g * 0.045, w));
	float light = bright * (core * 0.7 + outer * 1.2 + bloom * 0.38 * min(uGlow, 1.0)) * 3.0;

	// Kept dim behind copy.
	vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
	light *= mix(1.0 - uQuiet.w, 1.0, quietOpen(uv));

	vec3 lin = oklabToLinear(uGround) + (1.0 - exp(-tint * light));
	vec3 col = oklabToSrgb(lin);
	// A breath of dither, so the long glows do not band.
	col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
	gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Starts a halo ring on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {HaloRingConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function haloRing(el, config) {
	const shape = config.shape ?? 'morph';
	const speed = config.speed ?? 1;
	const interactive = config.interactive !== false;
	let palette = paletteUniform(pickColors(config, COLORS));
	let time = START;
	/** The ring's sizes, from the last resize. @type {ReturnType<typeof ringSize> | null} */
	let size = null;
	/** The pointer's pull: where it is heading (tx, ty), where it is (x, y), 0–1 from the bottom left, and how strong (on, 0–1). */
	const lean = { tx: 0.5, ty: 0.5, x: 0.5, y: 0.5, on: 0 };

	/**
	 * Follows the pointer: the lean eases towards it, and fades when it leaves.
	 *
	 * @param {number} dt Seconds since the last frame.
	 */
	const follow = (dt) => {
		const p = pointerIn(el);
		if (p.inside) {
			if (lean.on < 0.01) Object.assign(lean, { x: p.x, y: p.y });
			lean.tx = p.x;
			lean.ty = p.y;
		}
		const k = 1 - Math.exp(-dt * 3);
		lean.x += (lean.tx - lean.x) * k;
		lean.y += (lean.ty - lean.y) * k;
		lean.on += ((p.inside ? 1 : 0) - lean.on) * (1 - Math.exp(-dt * 2));
	};

	/**
	 * Lets the outline breathe and reach for the pointer: with `morph`, each
	 * corner drifts in and out a little on its own; the corner nearest the
	 * pointer is drawn a little towards it.
	 *
	 * @param {Float32Array} corners From `outline`, changed in place.
	 * @param {number} w The canvas's width, px.
	 * @param {number} h Its height, px.
	 * @param {number} cx The ring's centre, px right of the canvas's.
	 * @param {number} cy And px above it.
	 * @param {number} turn The ring's turn, radians, as the shader applies it.
	 * @returns {Float32Array} The corners.
	 */
	const bend = (corners, w, h, cx, cy, turn) => {
		const reach = Math.min(w, h) * 0.45;
		// The pointer in the outline's own frame, as the shader turns it.
		const px = lean.x * w - w / 2 - cx;
		const py = lean.y * h - h / 2 - cy;
		const s = Math.sin(turn);
		const c = Math.cos(turn);
		const qx = c * px - s * py;
		const qy = s * px + c * py;
		for (let i = 0; i < CORNERS; i++) {
			const breathe = shape === 'morph' ? 1 + 0.03 * Math.sin(time * 0.37 + i * 2.3) : 1;
			let x = corners[i * 2] * breathe;
			let y = corners[i * 2 + 1] * breathe;
			const near = lean.on * Math.exp(-((qx - x) ** 2 + (qy - y) ** 2) / (reach * reach));
			x += (qx - x) * 0.08 * near;
			y += (qy - y) * 0.08 * near;
			corners[i * 2] = x;
			corners[i * 2 + 1] = y;
		}
		return corners;
	};

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		setup({ gl, uniform }) {
			gl.uniform3fv(uniform('uGround'), parseColor(config.background ?? BACKGROUND));
		},
		resize({ gl, uniform, canvas, ratio }) {
			size = ringSize(canvas.width, canvas.height, shape, config.margin ?? 0.05, config.corner ?? 0.3);
			gl.uniform1f(uniform('uCircle'), shape === 'circle' ? size.circle : 0);
			gl.uniform1f(uniform('uCorner'), size.corner);
			gl.uniform1f(uniform('uWidth'), Math.max(0.5, config.thickness ?? 10) * ratio);
		},
		uniforms({ gl, uniform, canvas, still }, _now, dt) {
			if (!still) {
				time += dt * speed;
				if (interactive && canHover()) follow(dt);
			}
			const { width: w, height: h } = canvas;
			const shorter = Math.min(w, h);
			// The ring leans a little towards the pointer and turns with it; `morph` also sways on its own.
			const pull = 0.035 * lean.on;
			const cx = (lean.x - 0.5) * shorter * pull;
			const cy = (lean.y - 0.5) * shorter * pull;
			const sway = shape === 'morph' ? 0.32 * Math.sin(time * 0.13) : 0;
			const turn = shape === 'rect' ? 0 : sway + (lean.x - 0.5) * 0.12 * lean.on + (size?.upright ? Math.PI / 2 : 0);
			if (size) gl.uniform2fv(uniform('uCorners'), bend(outline(size, shapeBlend(shape, time)), w, h, cx, cy, turn));
			gl.uniform1f(uniform('uTime'), time);
			gl.uniform2f(uniform('uCentre'), cx, cy);
			gl.uniform1f(uniform('uTurn'), turn);
			gl.uniform1f(uniform('uGlow'), Math.max(0, config.glow ?? 1));
			gl.uniform3f(uniform('uPtr'), lean.x * w, lean.y * h, lean.on);
			gl.uniform3fv(uniform('uPal'), palette);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, w / h));
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
