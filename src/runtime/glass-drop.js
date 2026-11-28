/**
 * @module @arraypress/effects-astro/glass-drop
 *
 * A logo arriving as liquid glass: a drop forms, lands with rings running
 * out across the ground, and spreads into a glass tile with the logo rising
 * under it (or, with `form: 'mark'`, into the logo's own shape, the logo
 * itself made of tinted glass). The glass bends what is under it, hardest
 * at its rim, splits colour there, mirrors a small studio along its bevels
 * and focuses light at its edge. It holds, then melts away, and the logo is
 * left flat on the ground at its resting size. It plays once, or loops.
 *
 * Our own construction after the idea of a logo intro in liquid glass (see
 * docs/credits.md): the glass is a height field over a signed distance —
 * a circle, a rounded square or the logo's own field, mixed as the drop
 * spreads — lit by the shared studio (./glass-optics.js).
 *
 * Over a `backdrop` photo it is clear glass: the photo shows through it,
 * magnified in its flat middle and bent hard at its bevel, the colours
 * parting there, darker in a band inside the rim, tinted the logo's colour
 * as light through tinted glass is, casting a shadow with a caustic in it.
 * `flow` swells its top slowly, like liquid, and `lightDrift` moves the light.
 *
 * Opaque: it paints its `background` everywhere. Without WebGL the canvas
 * goes and the element's background shows. With reduced motion it is one
 * still frame: the final state (the logo at rest, or the glass held).
 */

import { createStage } from './stage.js';
import { drawShape, distanceField, blurField } from './shape.js';
import { parseColor } from './color.js';
import { GLSL_STUDIO, lightVector } from './glass-optics.js';
import { DROP_SIZE, dropAt, dropLayout } from './glass-drop-plan.js';
import { loadImage, imageTexture, coverScale } from './image.js';

/**
 * @typedef {import('./glass-drop.js').GlassDropConfig} GlassDropConfig
 */

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform sampler2D uMask;
uniform sampler2D uSdf;
uniform float uSpread;
uniform vec2 uCentre;
uniform float uEdge;
uniform float uMarkBox;
uniform float uScale;
uniform float uForm;
uniform float uRadius;
uniform float uDrop;
uniform float uMorph;
uniform float uWobble;
uniform float uTime;
uniform float uRipple;
uniform float uMarkIn;
uniform float uGlass;
uniform vec3 uGround;
uniform vec3 uInk;
uniform vec3 uPlate;
uniform vec3 uLight;
uniform float uDepth;
uniform float uDispersion;
uniform float uBevel;
uniform float uHighlights;
uniform float uCaustics;
uniform float uBloom;
uniform float uRipples;
uniform float uTint;
uniform vec2 uLightDir;
uniform sampler2D uPhoto;
uniform float uHasPhoto;
uniform float uAspect;
uniform vec2 uCover;
uniform float uDim;
uniform float uSoft;
// the mip bias the backdrop is read at: soft round the glass, sharp through it (a lens brings what is behind into focus)
float gBias = 0.0;
uniform float uFlow;
uniform float uMagnify;
uniform float uShadow;
${GLSL_STUDIO}

// The logo's coverage at p (heights from the glass's middle), its box 'box' high.
float markCover(vec2 p, float box) {
	vec2 uv = p / box + 0.5;
	if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
	return texture2D(uMask, vec2(uv.x, 1.0 - uv.y)).r;
}

// The logo's signed distance, in heights, positive inside.
float markField(vec2 p) {
	vec2 uv = p / uMarkBox + 0.5;
	vec2 c = clamp(uv, 0.0, 1.0);
	float d = (texture2D(uSdf, vec2(c.x, 1.0 - c.y)).r - 0.5) * 2.0 * uSpread * uMarkBox;
	return d - length(uv - c) * uMarkBox;
}

// A rounded square's signed distance, positive inside.
float roundBox(vec2 p, float hw, float r) {
	vec2 q = abs(p) - vec2(hw - r);
	return -(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r);
}

// The glass's signed distance now: the drop, becoming the tile or the logo, its edge still rippling.
float glassField(vec2 p) {
	float drop = uDrop - length(p);
	float target = uForm < 0.5 ? roundBox(p, uEdge * 0.5, uEdge * uRadius) : markField(p);
	float a = atan(p.y, p.x);
	float wave = sin(a * 3.0 + uTime * 5.0) * 0.6 + sin(a * 5.0 - uTime * 7.3) * 0.4;
	return mix(drop, target, uMorph) + wave * uWobble * (uDrop * 0.1 + uEdge * 0.012 * clamp(uMorph, 0.0, 1.0));
}

// The bevel's reach now: the whole drop while it is a drop, the set bevel once it has spread.
float bevelNow() {
	float shape = uForm < 0.5 ? uEdge : uMarkBox;
	return max(mix(uDrop, uBevel * shape, clamp(uMorph, 0.0, 1.0)), 1e-4);
}

// The glass's height, 0 at its edge rising to 1 past the bevel: a quarter round, so the rim is steep.
float heightAt(float g, float b) {
	float s = clamp(g / b, 0.0, 1.0);
	return sqrt(s * (2.0 - s));
}

// A slow swell over the glass's top, like liquid still settling: a height to add inside the bevel.
float flowAt(vec2 p) {
	if (uFlow <= 0.0) return 0.0;
	float t = uTime;
	return uFlow * 0.05 * (sin(p.x * 17.0 + t * 0.9) * cos(p.y * 13.0 - t * 0.7) + 0.6 * sin((p.x + p.y) * 23.0 - t * 1.3));
}

// The ground: its colour, a faint pool of light about the middle, and the rings the drop sent out.
vec3 ground(vec2 p) {
	vec3 col = uGround + (uLight - uGround) * 0.03 * uGlass * exp(-dot(p, p) * 5.0);
	if (uHasPhoto > 0.5) {
		// a photo behind the glass, covering the element as CSS 'cover' does, dimmed so the glass reads over it
		vec2 sp = p + uCentre;
		vec2 uv = (vec2(sp.x / uAspect, 1.0 - sp.y) - 0.5) * uCover + 0.5;
		col = texture2D(uPhoto, clamp(uv, 0.001, 0.999), gBias).rgb * uDim;
	}
	if (uRipple > 0.0) {
		float r = length(p);
		for (int k = 0; k < 3; k++) {
			float age = uRipple - float(k) * 0.32;
			if (age <= 0.0) continue;
			float at = uDrop * 1.1 + age * 0.42;
			float w = 0.004 + age * 0.006;
			float ring = exp(-pow((r - at) / w, 2.0));
			col += mix(uLight, uInk, 0.35) * ring * exp(-age * 1.6) * 0.28 * uRipples / (1.0 + float(k));
		}
	}
	return col;
}

// What lies under the glass (and, once it melts, what is left): the ground, the tile's plate, the logo.
vec3 scene(vec2 p, float plateCover) {
	vec3 col = ground(p);
	col = mix(col, uPlate, plateCover * uGlass);
	return mix(col, uInk, markCover(p, uMarkBox * uScale) * uMarkIn);
}

void main() {
	vec2 p = gl_FragCoord.xy / uRes.y - uCentre;
	float px = 1.0 / uRes.y;
	float b = bevelNow();
	float g = glassField(p);

	// The slope of the glass, from its height either side.
	vec2 e = vec2(px * 1.5, 0.0);
	float hx = heightAt(glassField(p + e.xy), b) - heightAt(glassField(p - e.xy), b);
	float hy = heightAt(glassField(p + e.yx), b) - heightAt(glassField(p - e.yx), b);
	vec2 slope = vec2(hx, hy) / (2.0 * e.x) * b;
	float inGlass = smoothstep(0.0, b, g);
	slope += vec2(flowAt(p + e.xy) - flowAt(p - e.xy), flowAt(p + e.yx) - flowAt(p - e.yx)) / (2.0 * e.x) * b * inGlass;
	float h = heightAt(g, b);
	vec3 n = normalize(vec3(-slope * uDepth * 0.55 * uGlass, 1.0));
	vec2 outward = length(slope) > 1e-5 ? -normalize(slope) : vec2(0.0);

	float cover = clamp(g / (px * 1.2) + 0.5, 0.0, 1.0);
	float plate = uForm < 0.5 ? cover : 0.0;

	// Through the glass: magnified a little, bent at the rim, the colours parting there.
	// (over a photo the bend is stronger, so it visibly bends and magnifies what is behind; the colours part as far as it bends)
	vec2 rim = n.xy * uDepth * mix(0.06, 0.11, uHasPhoto);
	vec2 lens = p * (1.0 - h * uMagnify * uGlass);
	float split = uDispersion * mix(0.3, 0.45, uHasPhoto);
	gBias = 0.0;
	vec3 through = vec3(
		scene(lens - rim * (1.0 + split), plate).r,
		scene(lens - rim, plate).g,
		scene(lens - rim * (1.0 - split), plate).b
	);
	if (uForm > 0.5) {
		// The logo made of glass: the ground through it, tinted the logo's colour, deepest where it is thickest.
		if (uHasPhoto > 0.5) {
			// clear glass over a photo: the photo through it, taking the logo's colour as light does through tinted glass
			// (deeper where it is thicker), and a touch lighter than the dimmed ground, as glass gathers light
			vec3 absorb = pow(max(uInk, vec3(0.02)), vec3((0.35 + 0.9 * h) * uTint));
			through = through * mix(vec3(1.0), absorb, uGlass) * (1.0 + 0.18 * uGlass);
		} else {
			float tint = mix(1.0, uTint * (0.75 + 0.25 * h), uGlass);
			through = mix(through, uInk * (0.82 + 0.18 * h + 0.12 * (1.0 - uGlass)), tint);
		}
	}

	// What the glass mirrors: the studio, along the bevels as they turn toward it.
	vec3 view = vec3(0.0, 0.0, -1.0);
	vec3 mirrored = studio(reflect(view, n), uLightDir, uLight);
	float fres = schlick(n.z, 0.04);
	vec3 col = through * (1.0 - fres * 0.6) + mirrored * (0.25 + fres * 1.6) * uHighlights * uGlass;

	// Thick glass goes dark in a band just inside its rim, where the view inside reflects back off the far wall.
	col *= 1.0 - 0.26 * uHasPhoto * uGlass * smoothstep(b * 0.85, b * 0.2, g) * smoothstep(0.0, px * 2.5, g);
	// The lip: a hairline brightest facing the light; light gathered just inside the rim on the far side.
	float facing = dot(outward, uLightDir);
	float lip = exp(-pow(g / (px * 1.3), 2.0));
	col += uLight * lip * (0.25 + 0.55 * max(facing, 0.0)) * uHighlights * uGlass;
	float inner = smoothstep(b * 0.9, 0.0, g) * smoothstep(0.0, px * 3.0, g);
	col += mix(uLight, uInk, 0.5) * inner * max(-facing, 0.0) * 0.32 * uCaustics * uGlass;

	// Outside: the ground, the light the glass focuses onto it on the side away from the light, and a soft bloom.
	gBias = uSoft * uHasPhoto;
	vec3 outside = scene(p, 0.0);
	// (the logo's own field stops a little way out, so its glow stays closer)
	float reach = uForm < 0.5 ? uEdge : uMarkBox * 0.4;
	float near = exp(min(g, 0.0) / (reach * 0.05 + 1e-4));
	outside += mix(uLight, uInk, 0.6) * near * max(-facing, 0.0) * 0.14 * uCaustics * uGlass;
	outside += mix(uLight, uInk, 0.5) * exp(min(g, 0.0) / (reach * 0.09 + 1e-4)) * 0.12 * uBloom * uGlass;
	if (uShadow > 0.0) {
		// its shadow on what is behind, cast away from the light, and the light the glass focuses into it
		float gs = glassField(p + uLightDir * reach * 0.07);
		float shade = smoothstep(-reach * 0.05, reach * 0.03, gs);
		outside *= 1.0 - 0.5 * uShadow * shade * uGlass;
		float gc = glassField(p + uLightDir * reach * 0.035);
		float focus = exp(-pow(gc / (reach * 0.012 + 1e-4), 2.0)) * step(g, 0.0);
		outside += mix(uLight, uInk, 0.45) * focus * 0.35 * uShadow * uCaustics * uGlass;
	}

	gl_FragColor = vec4(mix(outside, col, cover), 1.0);
}
`;

/** The defaults: a white logo under dark navy glass on black, lit from the top left. */
const DEFAULTS = Object.freeze({
	background: '#000000',
	color: '#ffffff',
	plate: '#0a1020',
	light: '#ffffff',
	radius: 0.24,
	depth: 1,
	dispersion: 1,
	bevel: 0.1,
	highlights: 1,
	caustics: 1,
	bloom: 0.5,
	ripples: 1,
	tint: 0.88,
	lightAngle: 125,
	dim: 0.82,
	flow: 0,
	magnify: 0.05,
	shadow: 0,
	lightDrift: 0,
	soften: 0,
});

/** The finest the logo's mask and field are drawn, in pixels across. */
const MASK_MAX = 1024;
const FIELD_MAX = 360;

/**
 * Uploads a one-byte-a-pixel picture to a texture unit.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @param {number} unit The texture unit.
 * @param {WebGLTexture | null} texture The texture.
 * @param {number} size Its edge, in pixels (square).
 * @param {Uint8Array | Uint8ClampedArray} data Its bytes, rows from the top.
 */
function upload(gl, unit, texture, size, data) {
	gl.activeTexture(gl.TEXTURE0 + unit);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, size, size, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data instanceof Uint8Array ? data : new Uint8Array(data.buffer));
}

/**
 * Makes an empty, smoothly filtered, edge-clamped texture on a unit.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl The context.
 * @param {number} unit The texture unit.
 * @returns {WebGLTexture | null} The texture.
 */
function texture(gl, unit) {
	const t = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0 + unit);
	gl.bindTexture(gl.TEXTURE_2D, t);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([0]));
	return t;
}

/**
 * Starts the glass drop on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {GlassDropConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function glassDrop(el, config) {
	const c = { ...DEFAULTS, ...config };
	const form = c.form === 'mark' ? 1 : 0;
	const start = performance.now();
	let generation = 0;
	/** The tile's edge in heights, from the last resize. */
	let tile = 0;
	/** The shape's textures, made in setup. */
	let mask = /** @type {WebGLTexture | null} */ (null);
	let sdf = /** @type {WebGLTexture | null} */ (null);
	/** The backdrop photo's texture, its aspect, and the element's, once known. */
	let photo = /** @type {WebGLTexture | null} */ (null);
	let photoAspect = 1;
	let boxAspect = 1;
	let alive = true;

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		setup({ gl, uniform }) {
			mask = texture(gl, 0);
			sdf = texture(gl, 1);
			gl.uniform1i(uniform('uMask'), 0);
			gl.uniform1i(uniform('uSdf'), 1);
			gl.uniform1f(uniform('uForm'), form);
			gl.uniform1f(uniform('uRadius'), Math.min(0.5, Math.max(0, c.radius)));
			gl.uniform1f(uniform('uDepth'), c.depth);
			gl.uniform1f(uniform('uDispersion'), c.dispersion);
			gl.uniform1f(uniform('uBevel'), c.bevel);
			gl.uniform1f(uniform('uHighlights'), c.highlights);
			gl.uniform1f(uniform('uCaustics'), c.caustics);
			gl.uniform1f(uniform('uBloom'), c.bloom);
			gl.uniform1f(uniform('uRipples'), c.ripples);
			gl.uniform1f(uniform('uTint'), c.tint);
			gl.uniform2fv(uniform('uLightDir'), lightVector(c.lightAngle));
			gl.uniform3fv(uniform('uGround'), parseColor(c.background));
			gl.uniform3fv(uniform('uInk'), parseColor(c.color));
			gl.uniform3fv(uniform('uPlate'), parseColor(c.plate));
			gl.uniform3fv(uniform('uLight'), parseColor(c.light));
			gl.uniform1i(uniform('uPhoto'), 2);
			gl.uniform1f(uniform('uHasPhoto'), 0);
			gl.uniform1f(uniform('uDim'), c.dim);
			gl.uniform1f(uniform('uSoft'), Math.max(0, Math.min(5, c.soften)));
			gl.uniform1f(uniform('uFlow'), Math.max(0, Math.min(2, c.flow)));
			gl.uniform1f(uniform('uMagnify'), c.magnify);
			gl.uniform1f(uniform('uShadow'), Math.max(0, Math.min(2, c.shadow)));
			return () => gl.deleteTexture(photo);
		},
		resize({ gl, uniform, canvas }) {
			const aspect = canvas.width / canvas.height;
			boxAspect = aspect;
			gl.uniform1f(uniform('uAspect'), aspect);
			gl.uniform2fv(uniform('uCover'), coverScale(photoAspect, aspect));
			const layout = dropLayout(c, aspect);
			gl.uniform2f(uniform('uCentre'), layout.centre.x * aspect, 1 - layout.centre.y);
			tile = layout.tile;
			gl.uniform1f(uniform('uEdge'), tile);
			gl.uniform1f(uniform('uMarkBox'), layout.mark);
			// The mask at the larger of the logo's two sizes, so it is never magnified.
			const big = Math.max(layout.mark, layout.rest) * canvas.height;
			const size = Math.max(64, Math.min(MASK_MAX, Math.round(big)));
			const mine = ++generation;
			const source = { text: c.text, font: c.font, src: c.src, padding: 0 };
			const shapes = [drawShape(source, size, size)];
			if (form) shapes.push(drawShape(source, FIELD_MAX, FIELD_MAX));
			Promise.all(shapes)
				.then(([full, small]) => {
					if (mine !== generation) return;
					upload(gl, 0, mask, size, full.alpha);
					if (small) {
						const spread = Math.round(FIELD_MAX / 9);
						upload(gl, 1, sdf, FIELD_MAX, blurField(distanceField(small, spread), FIELD_MAX, FIELD_MAX, FIELD_MAX / 160));
						gl.useProgram(stage?.program ?? null);
						gl.uniform1f(uniform('uSpread'), spread / FIELD_MAX);
					}
					if (stage?.still) stage.redraw();
				})
				.catch((error) => console.warn('[effects-astro]', error));
		},
		uniforms({ gl, uniform, still }, now) {
			const seconds = (now - start) / 1000;
			const s = dropAt(still ? Infinity : seconds, c);
			gl.uniform1f(uniform('uTime'), seconds);
			gl.uniform1f(uniform('uDrop'), s.drop * DROP_SIZE * tile);
			gl.uniform1f(uniform('uMorph'), s.morph);
			gl.uniform1f(uniform('uWobble'), s.wobble);
			gl.uniform1f(uniform('uRipple'), s.ripple);
			gl.uniform1f(uniform('uMarkIn'), s.markIn);
			gl.uniform1f(uniform('uGlass'), s.glass);
			gl.uniform1f(uniform('uScale'), s.scale);
			// the light drifts slowly about its angle, so the glass's rims and reflections move
			const drift = still || !c.lightDrift ? 0 : Math.sin(seconds * 0.23) * c.lightDrift * 0.7 + Math.sin(seconds * 0.11 + 1.3) * c.lightDrift * 0.3;
			gl.uniform2fv(uniform('uLightDir'), lightVector(c.lightAngle + drift));
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
