/**
 * @module @arraypress/effects-astro/glass-plates
 *
 * A logo cut from thick sheets of glass, laid one over another: the logo's
 * shape as two to four plates of clear or tinted glass, each a little down
 * and across from the one behind, over a photo. Every plate shows its edge
 * (the green-blue band real glass shows through its thickness, brightest
 * along the top), bends and magnifies the photo through its face, its
 * colour deepening where plates overlap, a hairline lip and a dark band
 * inside its rim, and a soft streak of reflected light across it. The
 * stack casts a shadow on the photo. On first show the plates slide apart
 * from one; after that they drift slowly, so the refraction shifts.
 *
 * Over the shared studio of the glass logos (./glass-optics.js); the logo's
 * field is read from a small distance field, so each plate is one texture
 * read per sample.
 *
 * Opaque: it paints its photo (or its `background`) everywhere. Without
 * WebGL the canvas goes and the element's background shows. With reduced
 * motion it is one still frame, the plates apart.
 */

import { createStage } from './stage.js';
import { drawShape, distanceField, blurField } from './shape.js';
import { parseColor, mixOklab } from './color.js';
import { GLSL_STUDIO, lightVector } from './glass-optics.js';
import { loadImage, imageTexture, coverScale } from './image.js';

/** The most plates. */
const MAX_PLATES = 4;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform sampler2D uSdf;
uniform float uSpread;
uniform vec2 uCentre;
uniform float uBox;
uniform float uPlates;
uniform vec2 uStep;
uniform vec2 uSide;
uniform float uBevel;
uniform vec3 uTint[${MAX_PLATES}];
uniform vec3 uEdgeTint;
uniform vec3 uGround;
uniform vec3 uLight;
uniform vec2 uLightDir;
uniform float uDensity;
uniform float uBend;
uniform float uDisperse;
uniform float uStreak;
uniform float uShadow;
uniform sampler2D uPhoto;
uniform float uHasPhoto;
uniform float uAspect;
uniform vec2 uCover;
uniform float uDim;
uniform float uSoft;
${GLSL_STUDIO}

// The backdrop at p (heights, origin bottom left), at a mip bias: the photo covering the element, or the ground.
vec3 backdrop(vec2 p, float bias) {
	if (uHasPhoto < 0.5) return uGround;
	vec2 uv = (vec2(p.x / uAspect, 1.0 - p.y) - 0.5) * uCover + 0.5;
	return texture2D(uPhoto, clamp(uv, 0.001, 0.999), bias).rgb * uDim;
}

// The logo's signed distance at q (heights from the box's middle), positive inside.
float field(vec2 q) {
	vec2 uv = q / uBox + 0.5;
	vec2 c = clamp(uv, 0.0, 1.0);
	float d = (texture2D(uSdf, vec2(c.x, 1.0 - c.y)).r - 0.5) * 2.0 * uSpread * uBox;
	return d - length(uv - c) * uBox;
}

// A plate's height over its face: 0 at its edge, 1 past the bevel, a quarter round so the lip is steep.
float height(float g) {
	float s = clamp(g / uBevel, 0.0, 1.0);
	return sqrt(s * (2.0 - s));
}

void main() {
	vec2 p = gl_FragCoord.xy / uRes.y;
	float px = 1.0 / uRes.y;
	vec3 col = backdrop(p, uSoft * uHasPhoto);
	float n = uPlates;
	vec3 trans = vec3(1.0);

	// the stack's shadow on the photo: the front plate's shape, down and across, soft
	vec2 front = uCentre + uStep * (n - 1.0) * 0.5;
	float sh = smoothstep(-uBox * 0.06, uBox * 0.02, field(p - front + uSide * 1.6 + uLightDir * uBox * 0.04));
	col *= 1.0 - 0.45 * uShadow * sh;

	for (int k = 0; k < ${MAX_PLATES}; k++) {
		if (float(k) >= n) break;
		vec2 o = uCentre + uStep * (float(k) - (n - 1.0) * 0.5);
		vec2 q = p - o;
		float g = field(q);
		float face = clamp(g / (px * 1.2) + 0.5, 0.0, 1.0);
		vec3 tint = uTint[k];

		// the edge: the plate's thickness, seen down and across from its face, where the face isn't
		float ge = max(field(q + uSide * 0.5), field(q + uSide));
		float edge = clamp(ge / (px * 1.2) + 0.5, 0.0, 1.0) * (1.0 - face);
		if (edge > 0.0) {
			// how far down the edge (0 at the face's lip, 1 at the far side), for its light: brightest along the top
			float along = clamp((field(q + uSide * 0.25) > 0.0 ? 0.25 : 0.75), 0.0, 1.0);
			vec3 e = col * mix(vec3(1.0), uEdgeTint, 0.85) * 0.55 + uEdgeTint * 0.28 + uLight * 0.22 * (1.0 - along);
			col = mix(col, e, edge * 0.96);
		}

		if (face > 0.0) {
			// the face: the photo bent through it (harder at the bevel, magnified toward its middle), the colours parting
			vec2 e2 = vec2(px * 1.5, 0.0);
			vec2 slope = vec2(height(field(q + e2.xy)) - height(field(q - e2.xy)), height(field(q + e2.yx)) - height(field(q - e2.yx))) / (2.0 * e2.x) * uBevel;
			float h = height(g);
			vec3 nrm = normalize(vec3(-slope * 0.6, 1.0));
			vec2 bend = nrm.xy * uBend * (1.0 + float(k) * 0.25) - q * 0.06 * h;
			vec3 split = vec3(1.0 + uDisperse, 1.0, 1.0 - uDisperse);
			vec3 seen = vec3(backdrop(p - bend * split.x, 0.0).r, backdrop(p - bend, 0.0).g, backdrop(p - bend * split.z, 0.0).b);
			trans *= pow(max(tint, vec3(0.02)), vec3(uDensity));
			// what is already drawn behind (lower plates, their edges) shows through, tinted; the photo, bent, over it
			vec3 body = mix(col * tint, seen * trans * 1.15, 0.6);
			// the room it mirrors: little head on, much at the bevel; a soft streak across the face; the lip and a dark band
			float fres = schlick(nrm.z, 0.04);
			vec3 view = vec3(0.0, 0.0, -1.0);
			body += studio(reflect(view, nrm), uLightDir, uLight) * (0.06 + fres * 1.4);
			vec2 across = vec2(-uLightDir.y, uLightDir.x);
			float s = dot(q, normalize(across + uLightDir * 0.6)) / uBox;
			body += uLight * uStreak * 0.16 * exp(-pow((s + 0.12) / 0.07, 2.0)) * h;
			body *= 1.0 - 0.22 * smoothstep(uBevel * 0.9, uBevel * 0.2, g) * smoothstep(0.0, px * 2.0, g);
			float lip = exp(-pow(g / (px * 1.3), 2.0));
			body += uLight * lip * (0.35 + 0.5 * max(dot(-normalize(slope + 1e-6), uLightDir), 0.0));
			col = mix(col, body, face);
		}
	}
	gl_FragColor = vec4(col, 1.0);
}
`;

/** The defaults: three plates of clear glass with a green-blue edge, over the ground. */
const DEFAULTS = Object.freeze({
	colors: ['#E8F6FF', '#CFEAF7', '#B6DCF0'],
	edge: '#5FD6B8',
	background: '#0b0b0b',
	light: '#ffffff',
	plates: 3,
	spread: 0.07,
	thickness: 0.045,
	bevel: 0.035,
	density: 0.6,
	bend: 0.022,
	dispersion: 0.35,
	streak: 1,
	shadow: 0.6,
	dim: 0.75,
	soften: 2,
	lightAngle: 120,
	drift: 1,
	intro: true,
	introDuration: 1.4,
	delay: 0,
	logoScale: 0.7,
});

/** The logo's field, in pixels across. */
const FIELD = 360;

/** Hermite ease, 0–1. */
const ease = (x) => {
	const t = Math.min(1, Math.max(0, x));
	return t * t * (3 - 2 * t);
};

/**
 * The plates' tints: the colours as a gradient from the back plate to the front one, blended in Oklab.
 *
 * @param {string[]} colors One to six colours, back first.
 * @param {number} plates How many plates.
 * @returns {Array<[number, number, number]>} RGB 0–1, a plate each.
 */
export function plateTints(colors, plates) {
	const rgb = (colors?.length ? colors : DEFAULTS.colors).map(parseColor);
	return Array.from({ length: plates }, (_, i) => {
		const x = (plates > 1 ? i / (plates - 1) : 0) * (rgb.length - 1);
		const a = Math.min(Math.floor(x), rgb.length - 1);
		const b = Math.min(a + 1, rgb.length - 1);
		return /** @type {[number, number, number]} */ (mixOklab(rgb[a], rgb[b], x - a));
	});
}

/**
 * Where plate `k` of `n` sits, as an offset from the stack's middle in shares of its box: each plate a `spread` down and
 * across from the one behind, the stack centred.
 *
 * @param {number} k The plate, 0 the back one.
 * @param {number} n How many.
 * @param {number} spread The step between plates, a share of the box.
 * @returns {{ x: number, y: number }} The offset, x right and y down.
 */
export function plateOffset(k, n, spread) {
	const t = k - (n - 1) / 2;
	return { x: t * spread, y: t * spread };
}

/**
 * Starts the glass plates on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {import('./glass-plates.js').GlassPlatesConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function glassPlates(el, config) {
	const c = { ...DEFAULTS, ...config };
	const plates = Math.max(2, Math.min(MAX_PLATES, Math.round(c.plates)));
	const tints = plateTints(c.colors, plates);
	const tintArray = new Float32Array(MAX_PLATES * 3);
	tints.forEach((t, i) => tintArray.set(t, i * 3));
	const start = performance.now();
	let generation = 0;
	let box = 0.5;
	let sdf = /** @type {WebGLTexture | null} */ (null);
	let photo = /** @type {WebGLTexture | null} */ (null);
	let photoAspect = 1;
	let boxAspect = 1;
	let alive = true;

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		setup({ gl, uniform }) {
			sdf = gl.createTexture();
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, sdf);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([0]));
			gl.uniform1i(uniform('uSdf'), 0);
			gl.uniform1i(uniform('uPhoto'), 2);
			gl.uniform1f(uniform('uHasPhoto'), 0);
			gl.uniform1f(uniform('uPlates'), plates);
			gl.uniform3fv(uniform('uTint[0]'), tintArray);
			gl.uniform3fv(uniform('uEdgeTint'), parseColor(c.edge));
			gl.uniform3fv(uniform('uGround'), parseColor(c.background));
			gl.uniform3fv(uniform('uLight'), parseColor(c.light));
			gl.uniform1f(uniform('uDensity'), c.density);
			gl.uniform1f(uniform('uDisperse'), Math.max(0, Math.min(1, c.dispersion)) * 0.25);
			gl.uniform1f(uniform('uStreak'), c.streak);
			gl.uniform1f(uniform('uShadow'), c.shadow);
			gl.uniform1f(uniform('uDim'), c.dim);
			gl.uniform1f(uniform('uSoft'), Math.max(0, Math.min(5, c.soften)));
			gl.uniform2fv(uniform('uLightDir'), lightVector(c.lightAngle));
			return () => {
				gl.deleteTexture(sdf);
				gl.deleteTexture(photo);
			};
		},
		resize({ gl, uniform, canvas }) {
			const aspect = canvas.width / canvas.height;
			boxAspect = aspect;
			const area = c.area ?? { x: 0, y: 0, width: 1, height: 1 };
			box = Math.min(area.width * aspect, area.height) * c.logoScale;
			const centre = { x: (area.x + area.width / 2) * aspect, y: 1 - (area.y + area.height / 2) };
			gl.uniform2f(uniform('uCentre'), centre.x, centre.y);
			gl.uniform1f(uniform('uBox'), box);
			gl.uniform1f(uniform('uAspect'), aspect);
			gl.uniform2fv(uniform('uCover'), coverScale(photoAspect, aspect));
			gl.uniform1f(uniform('uBevel'), c.bevel * box);
			gl.uniform1f(uniform('uBend'), c.bend);
			// the edge shows down and across from each face, as glass seen from a little above and to the left
			gl.uniform2f(uniform('uSide'), -c.thickness * box * 0.55, c.thickness * box);
			const mine = ++generation;
			drawShape({ text: c.text, font: c.font, src: c.src, padding: 0 }, FIELD, FIELD)
				.then((mask) => {
					if (mine !== generation || !stage) return;
					const spread = Math.round(FIELD / 9);
					gl.activeTexture(gl.TEXTURE0);
					gl.bindTexture(gl.TEXTURE_2D, sdf);
					gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, FIELD, FIELD, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, blurField(distanceField(mask, spread), FIELD, FIELD, FIELD / 200));
					gl.useProgram(stage.program);
					gl.uniform1f(uniform('uSpread'), spread / FIELD);
					stage.redraw();
				})
				.catch((error) => console.warn('[effects-astro]', error));
		},
		uniforms({ gl, uniform, still }, now) {
			const seconds = (now - start) / 1000;
			const t = seconds - c.delay;
			// the plates slide apart from one, then drift slowly so the refraction shifts
			const apart = still || !c.intro ? 1 : ease(t / c.introDuration);
			const sway = still ? 0 : Math.sin(seconds * 0.31) * 0.35 + Math.sin(seconds * 0.17 + 1.2) * 0.2;
			const k = c.spread * box * apart * (1 + sway * 0.25 * c.drift);
			const turn = still ? 0 : Math.sin(seconds * 0.23) * 0.18 * c.drift;
			// each plate down and across from the one behind (y is up in the shader)
			gl.uniform2f(uniform('uStep'), k * Math.cos(-0.785 + turn), k * Math.sin(-0.785 + turn));
			gl.uniform2fv(uniform('uLightDir'), lightVector(c.lightAngle + (still ? 0 : Math.sin(seconds * 0.2) * 14 * c.drift)));
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, sdf);
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
				photo = imageTexture(gl, image, { mipmap: true });
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
