/**
 * @module @arraypress/effects-astro/radiant-glass
 *
 * A cluster of frosted glass tiles, lit from behind: big soft lights drift
 * behind the glass, and each tile shows them heavily blurred and bent, so
 * it glows from inside while the ground and the gaps between the tiles
 * stay dark. Each tile has a thin rim, cool on one side and warm on the
 * other, and a soft halo of its own light round it.
 *
 * One pass and no textures: the tiles are rounded-box distance fields,
 * and the lights are gaussians, so frosting one is only widening it (a
 * blurred gaussian is a wider gaussian). Each light is a long streak
 * with a different colour along each side, as a lens splits white light;
 * they mix in Oklab and run to the hot colour where they gather, and the
 * result is dithered so the long gradients do not band.
 *
 * The lights drift on their own and shift with the pointer. Reduced
 * motion gets a still frame.
 *
 * Opaque: the effect is the whole background of what it fills. Without
 * WebGL it removes its canvas and the element's background shows.
 */

import { createStage } from './stage.js';
import { parseColor, toOklab, GLSL_OKLAB } from './color.js';
import { canHover } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';
import { GLSL_NOISE } from './glsl.js';

/**
 * @typedef {object} RadiantGlassConfig
 * @property {string[]} [colors] The lights' colours, the last the hot colour where they gather (default amber, blue, white).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`. Its colours light the glass; its glint is the hot colour.
 * @property {string} [background='#060818'] The ground.
 * @property {'cross' | 'diagonal' | 'single'} [layout='cross'] The tiles: four in a plus, three on a slant, or one large.
 * @property {'diamond' | 'square' | 'circle'} [shape='diamond'] Each tile's shape: a rounded square on its corner, square on, or round.
 * @property {'left' | 'right'} [side='left'] Which side the cluster sits on, leaving the other for the copy.
 * @property {number} [size=1] The cluster's size; 1 fills the height.
 * @property {number} [frost=1] How blurred the light through the glass is; 0 for clear.
 * @property {number} [glow=1] How strong the halo round each tile is; 0 for none.
 * @property {number} [rim=1] How bright the rim line is; 0 for none.
 * @property {number} [speed=1] How fast the lights drift.
 */

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPtr;
uniform vec3 uGround;
uniform vec3 uLights[4];
uniform vec3 uHot;
uniform vec2 uCenter;
uniform float uFlip;
uniform float uUnit;
uniform vec3 uTiles[4];
uniform float uCount;
uniform float uAngle;
uniform float uRound;
uniform float uFrost;
uniform float uGlow;
uniform float uRim;
${GLSL_OKLAB}
${GLSL_NOISE}

// A rounded box's signed distance and its outward direction, in the box's frame.
vec3 roundBox(vec2 q, float b, float r) {
	vec2 s = sign(q);
	vec2 e = abs(q) - b + r;
	vec2 out_ = max(e, 0.0);
	float lo = length(out_);
	vec2 n = lo > 0.0 ? out_ / lo : (e.x > e.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
	return vec3(lo + min(max(e.x, e.y), 0.0) - r, n * s);
}

// The lights at a point, widened by a blur: their weighted colour (Oklab) and their sum.
// Each is a long soft streak turning slowly; blurring one only widens it.
vec4 lights(vec2 x, float blur) {
	vec3 lab = vec3(0.0);
	float total = 0.0, sharp = 0.0;
	float bb = blur * blur;
	for (int i = 0; i < 5; i++) {
		float k = float(i);
		// The first, the broadest and strongest, keeps to the tile nearest the copy.
		vec2 home = vec2(cos(k * 2.4) * uFlip, sin(k * 2.4)) * (0.2 + 0.1 * mod(k, 2.0));
		vec2 drift = vec2(sin(uTime * (0.21 + k * 0.037) + k * 1.7), cos(uTime * (0.17 + k * 0.029) + k * 2.3)) * (i == 0 ? 0.1 : 0.2);
		// Each leans its own way with the pointer, so the light shifts within the tiles rather than leaving them.
		vec2 at = uCenter + (home + drift + uPtr * (mod(k, 2.0) - 0.5) * (0.8 + k * 0.2)) * uUnit;
		float turn = k * 1.1 + uTime * (0.05 + k * 0.013);
		vec2 d = mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * (x - at);
		vec2 v = (i == 0 ? vec2(0.2, 0.12) : vec2(0.17 + 0.04 * mod(k, 3.0), 0.07 + 0.02 * mod(k, 2.0))) * uUnit;
		v *= v;
		vec2 w = v + bb;
		float weight = exp(-0.5 * dot(d * d, 1.0 / w)) * sqrt(v.x * v.y / (w.x * w.y)) * (i == 0 ? 1.4 : 1.0);
		// Two colours, one along each long side, as a lens splits white light;
		// weighted to the strongest light more than its share, so two meet without going grey.
		vec3 tint = mix(uLights[i - (i / 4) * 4], uLights[i - ((i + 1) / 4) * 4 + 1], smoothstep(-1.2, 1.2, d.y / sqrt(w.y)));
		lab += tint * weight * weight;
		sharp += weight * weight;
		total += weight;
	}
	return vec4(lab / max(sharp, 1e-6), total);
}

// The lights as colour: their mix, running to the hot colour as they strengthen, at their strength.
vec3 shade(vec4 l, float gain) {
	float s = l.a * gain;
	vec3 lab = l.rgb;
	// Richer where it is dim, so a fading light glows rather than greys or browns.
	lab.yz *= 1.0 + 0.45 * (1.0 - smoothstep(0.1, 0.9, s));
	lab = mix(lab, uHot, smoothstep(0.55, 1.5, s) * 0.9);
	// A steep curve: a light holds its colour, then falls away to dark.
	return fromOklab(lab) * (1.0 - exp(-pow(s, 1.6) * 2.6));
}

// Where the glass at a point of a tile looks: a touch magnified, and drawn
// in toward the cluster's middle, so every tile sees the lights.
vec2 view(vec2 x, vec2 c) { return uCenter + (c - uCenter) * 0.7 + (x - c) * 0.82; }

void main() {
	vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
	float px = 1.0 / uRes.y;
	float cs = cos(uAngle), sn = sin(uAngle);
	mat2 toTile = mat2(cs, -sn, sn, cs);

	// The nearest tile: its distance, outward direction and centre; and how far the next one is.
	float d = 1e3, next = 1e3;
	vec2 n = vec2(0.0);
	vec2 c = uCenter;
	for (int i = 0; i < 4; i++) {
		if (float(i) >= uCount) break;
		vec2 at = uCenter + uTiles[i].xy * uUnit;
		float b = 0.194 * uUnit * uTiles[i].z;
		vec3 t = roundBox(toTile * (p - at), b, b * uRound);
		if (t.x < d) { next = d; d = t.x; n = t.yz; c = at; } else next = min(next, t.x);
	}
	n = n * toTile;

	vec3 col = uGround;
	// The halo: the light just inside the nearest edge, spread and fading away
	// from it; none in the gaps, where another tile is about as near.
	if (d > 0.0) {
		vec2 edge = p - n * d;
		vec3 halo = shade(lights(view(edge, c), 0.16 * uUnit), 1.0);
		float open = smoothstep(0.0, 0.16 * uUnit, next - d);
		col += halo * exp(-d / (0.055 * uUnit)) * 0.38 * open * uGlow;
	}
	// Through the glass: the lights behind, frosted, and bent outward near the
	// edge, so the rim gathers light from beyond it. Only where there is glass.
	if (d < px) {
		float inner = max(-d, 0.0);
		float bend = 1.0 - clamp(inner / (0.07 * uUnit), 0.0, 1.0);
		bend *= bend;
		vec2 look = view(p, c) + n * bend * 0.09 * uUnit;
		vec3 glass = shade(lights(look, 0.04 * uFrost * uUnit), 1.0);
		// A dark seam just inside the rim, where the glass turns away.
		glass *= mix(0.4, 1.0, smoothstep(0.0, 0.009 * uUnit, inner));
		glass += uGround;
		// The rim: a hairline, cool on the edges facing away from the copy, warm on
		// those facing it, and brighter where the light behind is.
		float line = 1.0 - smoothstep(0.0, 1.4 * px, abs(d + 0.8 * px));
		if (line > 0.0) {
			float face = dot(n, normalize(vec2(uFlip, 0.45))) * 0.5 + 0.5;
			vec3 rimCol = fromOklab(mix(uLights[1], uLights[0], smoothstep(0.2, 0.8, face)));
			glass += (rimCol + shade(lights(p, 0.12 * uUnit), 1.0)) * 0.7 * line * uRim;
		}
		col = mix(col, glass, smoothstep(px, -px, d));
	}

	col += (hash(gl_FragCoord.xy + fract(uTime * 7.0)) - 0.5) * (1.5 / 255.0);
	gl_FragColor = vec4(col, 1.0);
}
`;

/** The default lights: amber, blue, and white where they gather. */
const COLORS = ['#ffb27a', '#4a68ff', '#fbf7ff'];

/** Each layout's tiles: x, y in units of the cluster, and a size. */
const LAYOUTS = {
	cross: [
		[0.355, 0, 1],
		[0, 0.355, 1],
		[0, -0.355, 1],
		[-0.355, 0, 1],
	],
	diagonal: [
		[-0.2, 0.34, 0.9],
		[0.14, -0.02, 1.05],
		[0.48, -0.38, 0.9],
	],
	single: [[0.12, 0, 1.7]],
};

/** Each shape: its turn in radians, and its corners' radius as a share of its half size. */
const SHAPES = {
	diamond: [Math.PI / 4, 0.38],
	square: [0, 0.3],
	circle: [0, 1],
};

/**
 * Starts radiant glass on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {RadiantGlassConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function radiantGlass(el, config) {
	const colors = pickColors(config, COLORS, (p) => [...p.colors, p.glint]);
	const start = performance.now();
	const speed = config.speed ?? 1;
	const ptr = { x: 0, y: 0 };
	const tiles = LAYOUTS[config.layout ?? 'cross'] ?? LAYOUTS.cross;
	const [angle, round] = SHAPES[config.shape ?? 'diamond'] ?? SHAPES.diamond;
	// Everything mirrors when the cluster is on the right.
	const flip = config.side === 'right' ? -1 : 1;

	/**
	 * The lights and the hot colour as the shader takes them, in Oklab: up
	 * to four lights (repeated to fill), then the hot colour.
	 *
	 * @param {string[]} list The colours, the hot one last.
	 * @returns {{ lights: Float32Array, hot: Float32Array }} The uniforms' values.
	 */
	const toUniforms = (list) => {
		const lights = list.length > 1 ? list.slice(0, -1) : list;
		return {
			lights: new Float32Array([0, 1, 2, 3].flatMap((i) => toOklab(parseColor(lights[i % lights.length])))),
			hot: new Float32Array(toOklab(parseColor(list[list.length - 1]))),
		};
	};
	let lab = toUniforms(colors);

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		setup({ gl, uniform }) {
			gl.uniform3fv(uniform('uGround'), parseColor(config.background ?? '#060818'));
			gl.uniform3fv(uniform('uTiles'), new Float32Array([0, 1, 2, 3].flatMap((i) => (tiles[i] ? [tiles[i][0] * flip, tiles[i][1], tiles[i][2]] : [0, 0, 0]))));
			gl.uniform1f(uniform('uCount'), tiles.length);
			gl.uniform1f(uniform('uFlip'), flip);
			gl.uniform1f(uniform('uAngle'), angle);
			gl.uniform1f(uniform('uRound'), round);
			gl.uniform1f(uniform('uFrost'), config.frost ?? 1);
			gl.uniform1f(uniform('uGlow'), config.glow ?? 1);
			gl.uniform1f(uniform('uRim'), config.rim ?? 1);
		},
		resize({ gl, uniform, canvas }) {
			// The cluster fills the height on a wide screen and shrinks on a narrow one,
			// its middle a little in from the edge so the outer tile is cropped.
			const aspect = canvas.width / canvas.height;
			const unit = (config.size ?? 1) * Math.min(1, Math.max(0.5, aspect / 1.68));
			const x = 0.385 * unit - aspect / 2;
			gl.uniform2f(uniform('uCenter'), x * flip, 0);
			gl.uniform1f(uniform('uUnit'), unit);
		},
		uniforms({ gl, uniform, still }, now) {
			// Started a little way in, where the lights sit well; a still frame stays there.
			const t = 8 + (still ? 0 : ((now - start) / 1000) * speed);
			const p = !still && canHover() ? pointerIn(el) : null;
			const goal = p?.inside ? { x: (p.x - 0.5) * 0.3, y: (p.y - 0.5) * 0.3 } : { x: 0, y: 0 };
			ptr.x += (goal.x - ptr.x) * 0.03;
			ptr.y += (goal.y - ptr.y) * 0.03;
			gl.uniform1f(uniform('uTime'), t);
			gl.uniform2f(uniform('uPtr'), ptr.x, ptr.y);
			gl.uniform3fv(uniform('uLights'), lab.lights);
			gl.uniform3fv(uniform('uHot'), lab.hot);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		lab = toUniforms(next.glint ? [...next.colors, next.glint] : next.colors);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
