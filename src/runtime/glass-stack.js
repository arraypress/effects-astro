/**
 * @module @arraypress/effects-astro/glass-stack
 *
 * A logo as a stack of tinted glass discs: the logo is cut into horizontal
 * slices, and every stretch of logo in a slice becomes a flat disc of
 * glass, seen a little from below so its underside and its front edge
 * show, in front of a lit card. The discs are tinted along a gradient from
 * the top slice to the bottom one; through them the card is bent at their
 * rounded rims, darkened where the glass is thickest, and their edges
 * mirror a small studio (./glass-optics.js). The gaps in the logo stay
 * open. On first show the discs grow from the bottom up; after that the
 * stack leans gently on its own and toward the pointer.
 *
 * Our own construction after the idea of a logo as stacked glass slabs
 * (see docs/credits.md): a 2.5D stack drawn in one pass, the slices'
 * runs read from a small texture (./slab-runs.js), nearer discs drawn over
 * farther ones.
 *
 * Over a `backdrop` photo each disc is a thick lens: the photo shows
 * through it magnified toward its middle and bent hard at its rim, the
 * colours parting there, tinted by the glass, deeper where it is thicker.
 *
 * Opaque: it paints its `background` everywhere. Without WebGL the canvas
 * goes and the element's background shows. With reduced motion it is one
 * still frame, every disc grown.
 */

import { createStage } from './stage.js';
import { drawShape } from './shape.js';
import { parseColor, mixOklab } from './color.js';
import { canHover } from './device.js';
import { pointerIn } from './pointer.js';
import { GLSL_STUDIO, lightVector } from './glass-optics.js';
import { sliceRuns, runsTexture, slabGrowth } from './slab-runs.js';
import { loadImage, imageTexture, coverScale } from './image.js';

/**
 * @typedef {import('./glass-stack.js').GlassStackConfig} GlassStackConfig
 */

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform sampler2D uRuns;
uniform sampler2D uTints;
uniform vec2 uCentre;
uniform float uEdge;
uniform float uSlices;
uniform float uFace;
uniform float uWall;
uniform vec2 uTilt;
uniform vec3 uGround;
uniform vec3 uLight;
uniform float uCardSize;
uniform float uExposure;
uniform float uAmbient;
uniform float uIor;
uniform float uDensity;
uniform float uReflect;
uniform float uOpacity;
uniform vec2 uLightDir;
uniform sampler2D uPhoto;
uniform float uHasPhoto;
uniform float uAspect;
uniform vec2 uCover;
uniform float uDim;
uniform float uDisperse;
${GLSL_STUDIO}

// The lit card behind the stack, and the ground round it.
vec3 backdrop(vec2 p) {
	if (uHasPhoto > 0.5) {
		// a photo behind the stack, covering the element, dimmed so the glass reads over it
		vec2 uv = (vec2(p.x / uAspect, 1.0 - p.y) - 0.5) * uCover + 0.5;
		return texture2D(uPhoto, clamp(uv, 0.001, 0.999)).rgb * uDim;
	}
	vec2 hs = vec2(uEdge * 0.5 * uCardSize);
	vec2 q = abs(p - uCentre) - hs + uEdge * 0.06;
	float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uEdge * 0.06;
	float on = smoothstep(uEdge * 0.012, -uEdge * 0.012, d);
	// Brighter toward its top, as a card lit from above is.
	float fall = 0.94 + 0.06 * clamp((p.y - uCentre.y) / (uEdge * uCardSize) + 0.5, 0.0, 1.0);
	vec3 card = uLight * uExposure * fall;
	vec3 ground = uGround + uLight * uAmbient * exp(-max(d, 0.0) / (uEdge * 0.12));
	return mix(ground, card, on);
}

// A slice's run at x: where along it x is (−1 left edge … 1 right edge), and whether x is in one.
vec2 runAt(float x, float slice) {
	float u = (x - (uCentre.x - uEdge * 0.5)) / uEdge;
	if (u < 0.0 || u > 1.0) return vec2(0.0, 0.0);
	vec4 t = texture2D(uRuns, vec2(u, (slice + 0.5) / uSlices));
	float along = (t.r * 255.0 * 256.0 + t.g * 255.0) / 65535.0;
	return vec2(along * 2.0 - 1.0, step(0.5, t.b));
}

void main() {
	vec2 p = gl_FragCoord.xy / uRes.y;
	float px = 1.0 / uRes.y;
	vec3 col = backdrop(p);
	float pitch = uEdge / uSlices;
	float top = uCentre.y + uEdge * 0.5;
	float here = floor((top - p.y) / pitch);
	vec3 view = vec3(0.0, 0.0, -1.0);

	// The slices that can reach this pixel, the farthest (highest) first, so nearer discs cover them.
	for (int k = -2; k <= 2; k++) {
		float slice = here + float(k);
		if (slice < 0.0 || slice >= uSlices) continue;
		vec4 tint = texture2D(uTints, vec2((slice + 0.5) / uSlices, 0.5));
		float grow = tint.a * 1.25;
		if (grow <= 0.001) continue;
		float yc = top - (slice + 0.5) * pitch;
		// The stack leans: each slice slides with its height, and the discs open or close a little.
		float shift = uTilt.x * (yc - uCentre.y) * 0.45;
		vec2 run = runAt(p.x - shift, slice);
		if (run.y < 0.5) continue;
		float q = run.x / grow;
		if (abs(q) >= 1.0) continue;
		float vr = pitch * uFace * (1.0 + uTilt.y * 0.3) * min(grow, 1.0);
		float wall = pitch * uWall * min(grow, 1.0);
		float halfH = vr * sqrt(1.0 - q * q);
		float dy = p.y - yc;

		vec3 c = tint.rgb;
		if (abs(dy) <= halfH + px) {
			// The underside: a flat disc whose rim rounds over, so the card bends at its edge.
			float r = sqrt(q * q + (dy * dy) / (vr * vr));
			float roll = pow(clamp(r, 0.0, 1.0), 4.0);
			vec3 n = normalize(vec3(vec2(q, dy / vr) * roll * 1.6, 1.0));
			// over a photo the disc is a thick lens: it magnifies what is behind toward its middle and bends it hard at
			// the rim, the colours parting as far as it bends
			vec2 bend = n.xy * (uIor - 1.0) * pitch * mix(1.4, 3.2, uHasPhoto);
			vec2 lensed = p + (vec2(q * pitch * 2.2, dy) * -0.18) * uHasPhoto;
			float path = 1.0 + 1.1 * roll;
			vec3 split = vec3(1.0 + uDisperse, 1.0, 1.0 - uDisperse);
			vec3 behind = vec3(backdrop(lensed - bend * split.x).r, backdrop(lensed - bend).g, backdrop(lensed - bend * split.z).b);
			vec3 through = behind * pow(c, vec3(uDensity * path)) * (1.0 + 0.25 * uHasPhoto);
			float fres = schlick(n.z, 0.04);
			vec3 mirrored = studio(reflect(view, n), uLightDir, uLight);
			vec3 face = through * (1.0 - fres * 0.5) + mirrored * (fres * 1.4 + 0.05) * (0.4 + uReflect);
			// A darker band just inside the rim gives the disc its edge; a bright hairline at the very lip.
			face *= 1.0 - 0.16 * smoothstep(0.8, 0.96, r) * (1.0 - smoothstep(0.96, 1.0, r));
			face += uLight * 0.35 * smoothstep(0.955, 0.995, r) * (0.5 + uReflect);
			// Light carried through the disc gathers toward its far (lower) edge.
			face += through * 0.22 * smoothstep(0.1, 0.85, -dy / vr) * (1.0 - q * q);
			float cover = clamp((halfH - abs(dy)) / px + 0.5, 0.0, 1.0);
			col = mix(col, face, cover * uOpacity);
		} else if (dy > halfH && dy <= halfH + wall + px) {
			// The front edge: glass seen through its thickness, deeper in colour, rounder toward the middle,
			// with light caught along the line where it meets the top.
			float h = (dy - halfH) / max(wall, 1e-5);
			float shade = 0.5 + 0.5 * (1.0 - q * q);
			vec3 edge = backdrop(p) * pow(c, vec3(uDensity * 2.6)) * shade;
			edge += uLight * (0.45 * smoothstep(0.65, 1.0, h) + 0.12 * smoothstep(0.35, 0.0, h)) * (0.5 + uReflect);
			float cover = clamp((halfH + wall - dy) / px + 0.5, 0.0, 1.0);
			col = mix(col, edge, cover * min(1.0, uOpacity + 0.1));
		}
	}
	gl_FragColor = vec4(col, 1.0);
}
`;

/** The defaults: our "lagoon" glass, aqua to deep blue, on white. */
const DEFAULTS = Object.freeze({
	colors: ['#bff3ff', '#5ad1f0', '#1f8fe0', '#2140c8'],
	background: '#ffffff',
	light: '#ffffff',
	slabs: 22,
	phase: 0.5,
	band: 0.35,
	depth: 0.55,
	thickness: 0.35,
	ior: 1.45,
	reflectivity: 0.3,
	density: 0.9,
	opacity: 0.92,
	exposure: 1.1,
	ambient: 0.05,
	cardSize: 1.15,
	logoScale: 0.73,
	lightAngle: 115,
	tilt: 1,
	sway: 0.5,
	intro: true,
	introDuration: 1.6,
	delay: 0,
	speed: 1,
	dim: 0.78,
	dispersion: 0.35,
});

/** The finest the logo is sliced, in columns. */
const COLUMNS = 1024;

/**
 * The tint of each slice: the colours as a gradient from the top slice to the bottom one, blended in Oklab.
 *
 * @param {string[]} colors Two to six colours, top first.
 * @param {number} slices How many slices.
 * @returns {Array<[number, number, number]>} RGB 0–1, a slice each.
 */
export function sliceTints(colors, slices) {
	const rgb = colors.map(parseColor);
	return Array.from({ length: slices }, (_, i) => {
		const x = (slices > 1 ? i / (slices - 1) : 0) * (rgb.length - 1);
		const a = Math.min(Math.floor(x), rgb.length - 1);
		const b = Math.min(a + 1, rgb.length - 1);
		return /** @type {[number, number, number]} */ (mixOklab(rgb[a], rgb[b], x - a));
	});
}

/**
 * Where the stack sits: a square box `logoScale` of the area's shorter
 * side, centred in it. The logo fills the box as an image fills a square
 * (an SVG logo's viewBox), so a still drawn in the same box lines up.
 *
 * @param {{ area?: { x: number, y: number, width: number, height: number }, logoScale?: number }} config The settings.
 * @param {number} aspect The element's width over its height.
 * @returns {{ centre: { x: number, y: number }, edge: number }} Its middle (0–1 from the top left) and its edge, a share of the height.
 */
export function stackLayout(config, aspect) {
	const area = config.area ?? { x: 0, y: 0, width: 1, height: 1 };
	return {
		centre: { x: area.x + area.width / 2, y: area.y + area.height / 2 },
		edge: Math.min(area.width * aspect, area.height) * (config.logoScale ?? DEFAULTS.logoScale),
	};
}

/**
 * Starts the glass stack on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {GlassStackConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function glassStack(el, config) {
	const c = { ...DEFAULTS, ...config };
	const slices = Math.max(4, Math.min(64, Math.round(c.slabs)));
	const colors = c.colors?.length >= 2 ? c.colors : c.colors?.length === 1 ? [c.colors[0], c.colors[0]] : DEFAULTS.colors;
	const tints = sliceTints(colors, slices);
	const tintBytes = new Uint8Array(slices * 4);
	tints.forEach((t, i) => tintBytes.set([t[0] * 255, t[1] * 255, t[2] * 255, 0], i * 4));
	const start = performance.now();
	const tilt = { x: 0, y: 0 };
	let generation = 0;
	let runsTex = /** @type {WebGLTexture | null} */ (null);
	let tintTex = /** @type {WebGLTexture | null} */ (null);
	/** The last growth written, so the tints are uploaded only while the discs grow. */
	let grown = -1;
	/** The backdrop photo's texture, its aspect, and the element's, once known. */
	let photo = /** @type {WebGLTexture | null} */ (null);
	let photoAspect = 1;
	let boxAspect = 1;
	let alive = true;

	/**
	 * A nearest-filtered, edge-clamped texture on a unit.
	 *
	 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
	 * @param {number} unit The texture unit.
	 * @returns {WebGLTexture | null} The texture.
	 */
	const nearest = (gl, unit) => {
		const t = gl.createTexture();
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, t);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
		return t;
	};

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		setup({ gl, uniform }) {
			runsTex = nearest(gl, 0);
			tintTex = nearest(gl, 1);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, slices, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, tintBytes);
			gl.uniform1i(uniform('uRuns'), 0);
			gl.uniform1i(uniform('uTints'), 1);
			gl.uniform1f(uniform('uSlices'), slices);
			// The camera's height sets how open the discs are and how much of their front edge shows.
			gl.uniform1f(uniform('uFace'), Math.max(0.05, Math.min(1.4, c.depth)));
			gl.uniform1f(uniform('uWall'), Math.max(0, Math.min(1, c.thickness)));
			gl.uniform3fv(uniform('uGround'), parseColor(c.background));
			gl.uniform3fv(uniform('uLight'), parseColor(c.light));
			gl.uniform1f(uniform('uCardSize'), c.cardSize);
			gl.uniform1f(uniform('uExposure'), c.exposure);
			gl.uniform1f(uniform('uAmbient'), c.ambient);
			gl.uniform1f(uniform('uIor'), c.ior);
			gl.uniform1f(uniform('uDensity'), c.density);
			gl.uniform1f(uniform('uReflect'), c.reflectivity);
			gl.uniform1f(uniform('uOpacity'), Math.max(0, Math.min(1, c.opacity)));
			gl.uniform2fv(uniform('uLightDir'), lightVector(c.lightAngle));
			gl.uniform1i(uniform('uPhoto'), 2);
			gl.uniform1f(uniform('uHasPhoto'), 0);
			gl.uniform1f(uniform('uDim'), c.dim);
			gl.uniform1f(uniform('uDisperse'), Math.max(0, Math.min(1, c.dispersion)) * 0.25);
			return () => gl.deleteTexture(photo);
		},
		resize({ gl, uniform, canvas }) {
			const aspect = canvas.width / canvas.height;
			boxAspect = aspect;
			gl.uniform1f(uniform('uAspect'), aspect);
			gl.uniform2fv(uniform('uCover'), coverScale(photoAspect, aspect));
			const layout = stackLayout(c, aspect);
			gl.uniform2f(uniform('uCentre'), layout.centre.x * aspect, 1 - layout.centre.y);
			gl.uniform1f(uniform('uEdge'), layout.edge);
			const size = Math.max(64, Math.min(COLUMNS, Math.round(layout.edge * canvas.height)));
			const mine = ++generation;
			drawShape({ text: c.text, font: c.font, src: c.src, padding: 0 }, size, size)
				.then((mask) => {
					if (mine !== generation) return;
					const runs = sliceRuns(mask, slices, { phase: c.phase, band: c.band, min: Math.max(2, Math.round(size * 0.025)) });
					gl.activeTexture(gl.TEXTURE0);
					gl.bindTexture(gl.TEXTURE_2D, runsTex);
					gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, slices, 0, gl.RGBA, gl.UNSIGNED_BYTE, runsTexture(runs, size));
					if (stage?.still) stage.redraw();
				})
				.catch((error) => console.warn('[effects-astro]', error));
		},
		uniforms({ gl, uniform, still }, now) {
			const seconds = (now - start) / 1000;
			const t = (seconds - c.delay) * c.speed;
			// The discs grow from the bottom up; the tints texture carries each one's size.
			const done = still || !c.intro || t >= c.introDuration + 0.1;
			if (!(done && grown === 1)) {
				for (let i = 0; i < slices; i++) tintBytes[i * 4 + 3] = Math.round((done ? 1 : Math.max(0, Math.min(1.25, slabGrowth(i, slices, t, c.introDuration)))) * 204);
				gl.activeTexture(gl.TEXTURE1);
				gl.bindTexture(gl.TEXTURE_2D, tintTex);
				gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, slices, 1, gl.RGBA, gl.UNSIGNED_BYTE, tintBytes);
				grown = done ? 1 : 0;
			}
			// It leans on its own, slowly, and toward the pointer.
			const p = !still && canHover() ? pointerIn(el) : null;
			const lean = p?.inside ? { x: (p.x - 0.5) * 2, y: (p.y - 0.5) * 2 } : { x: 0, y: 0 };
			const drift = still ? { x: 0.35, y: 0 } : { x: Math.sin(seconds * 0.37) * 0.8 + Math.sin(seconds * 0.17 + 1) * 0.2, y: Math.sin(seconds * 0.29 + 2) };
			const goal = { x: (drift.x * c.sway + lean.x * c.tilt) * 0.12, y: (drift.y * c.sway + lean.y * c.tilt) * 0.12 };
			const ease = still ? 1 : 0.05;
			tilt.x += (goal.x - tilt.x) * ease;
			tilt.y += (goal.y - tilt.y) * ease;
			gl.uniform2f(uniform('uTilt'), tilt.x, tilt.y);
			if (photo) {
				gl.activeTexture(gl.TEXTURE2);
				gl.bindTexture(gl.TEXTURE_2D, photo);
			}
		},
	});
	if (stage && c.backdrop) {
		loadImage(c.backdrop)
			.then((image) => {
				if (!alive) return;
				const { gl, uniform, program } = stage;
				gl.activeTexture(gl.TEXTURE2);
				photo = imageTexture(gl, image);
				photoAspect = image.naturalWidth / image.naturalHeight;
				gl.useProgram(program);
				gl.uniform1f(uniform('uHasPhoto'), 1);
				gl.uniform2fv(uniform('uCover'), coverScale(photoAspect, boxAspect));
				stage.redraw();
			})
			.catch((error) => console.warn('[effects-astro]', error));
	}
	return () => {
		alive = false;
		stop();
	};
}
