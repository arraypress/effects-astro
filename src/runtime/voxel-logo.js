/**
 * @module @arraypress/effects-astro/voxel-logo
 *
 * A logo built of cubes: the shape is cut into a grid, each filled cell
 * extruded into a short column of voxels, and the solid rocks slowly in
 * perspective, turning towards the pointer. Faces are lit by which way
 * they point, every cube is outlined where it meets the next, and the
 * whole is dithered down to two inks, the way a one-colour print or an
 * old screen would show it. Optionally (`markers`), crosshair markers
 * ring the solid, tracking it as it turns.
 *
 * Each pixel's ray is walked through the voxel grid on the GPU (a
 * DDA, cell to cell), so the solid is exact at any size.
 *
 * Opaque: the effect is the whole background of what it fills. Without
 * WebGL it removes its canvas and the element's background shows.
 */

import { createStage } from './stage.js';
import { drawShape } from './shape.js';
import { createTrackers } from './trackers.js';
import { projectPoint } from './points.js';
import { parseColor } from './color.js';
import { canHover } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';

/**
 * @typedef {object} VoxelLogoConfig
 * @property {string} [text] A character or word to build in cubes.
 * @property {string} [font] Its CSS font, without the size (default: the page's, bold).
 * @property {string} [src] An image (an SVG logo) to build instead.
 * @property {{ x: number, y: number, width: number, height: number }} [area]
 *   Where the solid sits, each 0–1 from the top left (default: the right half).
 * @property {string[]} [colors] The ink, then the paper (default mint on near-black).
 * @property {number} [size=1.3] How large the solid is in its area (1 just fits when face-on).
 * @property {number} [cells=28] Cubes across the shape.
 * @property {number} [depth=4] Cubes deep.
 * @property {number} [dither=2] The dither's pixel size, CSS px; 0 for smooth shading.
 * @property {number} [markers=0] Tracking markers ringing the solid (try 6); 0 for none.
 * @property {number} [rock=1] How far it rocks and turns towards the pointer.
 */

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uMask;
uniform vec3 uGrid;
uniform vec2 uTurn;
uniform vec4 uArea;
uniform vec3 uInk;
uniform vec3 uPaper;
uniform float uDither;
uniform float uSize;

// Is the cell at (x, y, z) filled? Columns of the shape, uGrid.z deep.
bool filled(vec3 c) {
	if (c.x < 0.0 || c.y < 0.0 || c.z < 0.0 || c.x >= uGrid.x || c.y >= uGrid.y || c.z >= uGrid.z) return false;
	return texture2D(uMask, vec2((c.x + 0.5) / uGrid.x, 1.0 - (c.y + 0.5) / uGrid.y)).r > 0.5;
}

vec3 turnY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
vec3 turnX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }

// The ordered dither's threshold at a pixel: a 4 x 4 Bayer matrix.
float bayer(vec2 px) {
	vec2 p = mod(floor(px), 4.0);
	float i = p.y * 4.0 + p.x;
	vec4 row = p.y < 1.0 ? vec4(0.0, 8.0, 2.0, 10.0) : p.y < 2.0 ? vec4(12.0, 4.0, 14.0, 6.0) : p.y < 3.0 ? vec4(3.0, 11.0, 1.0, 9.0) : vec4(15.0, 7.0, 13.0, 5.0);
	float v = p.x < 1.0 ? row.x : p.x < 2.0 ? row.y : p.x < 3.0 ? row.z : row.w;
	return (v + 0.5) / 16.0;
}

// How light the solid is at a pixel: 0 where there is none.
float shade(vec2 uv) {
	// The area the solid fills, as a square view onto the grid, centred.
	vec2 local = (uv - uArea.xy) / uArea.zw * 2.0 - 1.0;
	float size = max(uGrid.x, uGrid.y);
	vec2 aspect = vec2(uArea.z * uRes.x, uArea.w * uRes.y);
	local *= aspect / max(aspect.x, aspect.y);
	// A camera in front, a little perspective; the grid turned about its centre.
	vec3 origin = vec3(local * 0.5 * size * 1.15 / uSize, -size * 2.2);
	vec3 dir = normalize(vec3(local * 0.12, 1.0));
	vec3 centre = uGrid * 0.5;
	origin = turnX(turnY(origin, -uTurn.x), -uTurn.y) + centre;
	dir = turnX(turnY(dir, -uTurn.x), -uTurn.y);
	// Into the grid's box.
	vec3 inv = 1.0 / dir;
	vec3 t0 = (vec3(0.0) - origin) * inv;
	vec3 t1 = (uGrid - origin) * inv;
	vec3 tmin = min(t0, t1);
	vec3 tmax = max(t0, t1);
	float enter = max(max(tmin.x, tmin.y), tmin.z);
	float leave = min(min(tmax.x, tmax.y), tmax.z);
	if (leave < max(enter, 0.0)) return 0.0;
	vec3 pos = origin + dir * (max(enter, 0.0) + 1e-3);
	vec3 cell = floor(pos);
	vec3 step_ = sign(dir);
	vec3 delta = abs(inv);
	vec3 side = (step_ * (cell - pos) + step_ * 0.5 + 0.5) * delta;
	vec3 normal = -step_ * vec3(greaterThanEqual(tmin, vec3(enter)));
	for (int i = 0; i < 160; i++) {
		if (filled(cell)) {
			// Lit by the way the face points, and outlined where cubes meet.
			vec3 n = normalize(turnY(turnX(normal, uTurn.y), uTurn.x));
			float light = 0.35 + 0.65 * max(dot(n, normalize(vec3(-0.4, 0.6, -0.7))), 0.0);
			vec3 hit = origin + dir * (dot(side - delta, vec3(equal(abs(normal), vec3(1.0)))) - 1e-3);
			vec3 f = fract(hit);
			vec2 face = abs(normal.x) > 0.5 ? f.yz : abs(normal.y) > 0.5 ? f.xz : f.xy;
			float edge = min(min(face.x, 1.0 - face.x), min(face.y, 1.0 - face.y));
			return light * smoothstep(0.03, 0.09, edge);
		}
		if (side.x < side.y && side.x < side.z) {
			cell.x += step_.x; side.x += delta.x; normal = vec3(-step_.x, 0.0, 0.0);
		} else if (side.y < side.z) {
			cell.y += step_.y; side.y += delta.y; normal = vec3(0.0, -step_.y, 0.0);
		} else {
			cell.z += step_.z; side.z += delta.z; normal = vec3(0.0, 0.0, -step_.z);
		}
		if (cell.x < -1.0 || cell.y < -1.0 || cell.z < -1.0 || cell.x > uGrid.x || cell.y > uGrid.y || cell.z > uGrid.z) break;
	}
	return 0.0;
}

void main() {
	vec2 px = gl_FragCoord.xy;
	float s = shade(px / uRes);
	// Two inks: the shade against the dither's threshold, or smooth without one.
	float ink = uDither > 0.0 ? step(bayer(px / uDither), s * 1.1) : s;
	gl_FragColor = vec4(mix(uPaper, uInk, ink), 1.0);
}
`;

/** The defaults: mint ink on near-black paper. */
const COLORS = ['#a7f3d0', '#08090a'];

/**
 * Starts a voxel logo on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {VoxelLogoConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function voxelLogo(el, config) {
	let colors = config.colors?.length ? config.colors : COLORS;
	const area = config.area ?? { x: 0.42, y: 0.04, width: 0.56, height: 0.92 };
	const start = performance.now();
	const turn = { x: 0, y: 0 };
	const markers = (config.markers ?? 0) > 0 ? createTrackers(el, config.markers ?? 0, { kind: 'marker' }) : null;
	/** The grid's size in cells, once the shape is drawn. */
	let grid = [0, 0, 0];

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		setup({ gl, uniform }) {
			gl.uniform1i(uniform('uMask'), 0);
			gl.uniform1f(uniform('uSize'), config.size ?? 1.3);
			gl.uniform4f(uniform('uArea'), area.x, 1 - area.y - area.height, area.width, area.height);
			const texture = gl.createTexture();
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([0]));
			// The shape at one pixel a cube: drawn into a square, so cubes stay cubes.
			const cells = config.cells ?? 28;
			drawShape({ text: config.text, font: config.font, src: config.src, padding: 0.04 }, cells, cells)
				.then((mask) => {
					const bytes = Uint8Array.from(mask.alpha);
					gl.activeTexture(gl.TEXTURE0);
					gl.bindTexture(gl.TEXTURE_2D, texture);
					gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, cells, cells, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
					grid = [cells, cells, config.depth ?? 4];
					if (stage?.still) stage.redraw();
				})
				.catch((error) => console.warn('[effects-astro]', error));
			return () => markers?.destroy();
		},
		resize({ gl, uniform, ratio }) {
			gl.uniform1f(uniform('uDither'), (config.dither ?? 2) * ratio);
		},
		uniforms({ gl, uniform, still }, now) {
			const t = (now - start) / 1000;
			const p = !still && canHover() ? pointerIn(el) : null;
			const rock = config.rock ?? 1;
			// A slow rock, leaning towards the pointer when there is one.
			const goal = {
				x: (Math.sin(t * 0.45) * 0.45 + (p?.inside ? (p.x - 0.5) * 0.9 : 0)) * rock,
				y: (Math.sin(t * 0.31) * 0.18 + (p?.inside ? (p.y - 0.5) * 0.5 : 0)) * rock,
			};
			turn.x += (goal.x - turn.x) * 0.05;
			turn.y += (goal.y - turn.y) * 0.05;
			gl.uniform1f(uniform('uTime'), t);
			gl.uniform3f(uniform('uGrid'), grid[0] || 1, grid[1] || 1, grid[2] || 1);
			gl.uniform2f(uniform('uTurn'), turn.x, turn.y);
			gl.uniform3fv(uniform('uInk'), parseColor(colors[0]));
			gl.uniform3fv(uniform('uPaper'), parseColor(colors[1] ?? COLORS[1]));
		},
		after({ canvas }, now) {
			if (!markers || !grid[0]) return;
			// Markers on a ring round the solid, turning with it.
			const t = (now - start) / 1000;
			const w = el.clientWidth;
			const h = el.clientHeight;
			const count = config.markers ?? 0;
			const aspect = (area.width * canvas.width) / (area.height * canvas.height);
			for (let i = 0; i < count; i++) {
				const a = (i / count) * Math.PI * 2 + t * 0.05;
				const ring = 0.62 * (config.size ?? 1.3);
				const at = projectPoint([Math.cos(a) * ring, Math.sin(a) * ring, 0], turn.x * 0.8, turn.y * 0.8, aspect);
				const x = (area.x + at.x * area.width) * w;
				const y = (area.y + at.y * area.height) * h;
				markers.place(i, { x: x - 14, y: y - 14, w: 28, h: 28 }, `${String(i + 1).padStart(2, '0')} · ${Math.round(40 + 50 * (0.5 + 0.5 * Math.sin(t * 0.7 + i)))}`);
			}
		},
	});
	if (!stage) {
		markers?.destroy();
		return stop;
	}

	const unwatch = watchColors(el, (next) => {
		colors = next.colors;
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
