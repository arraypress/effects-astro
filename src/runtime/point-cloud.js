/**
 * @module @arraypress/effects-astro/point-cloud
 *
 * A machine-vision scene: a word drawn as a matrix of bright dots, floating
 * among sheets of point cloud, each sheet a rippling surface scanned in
 * rows of fine dots, coloured by height. The scene sways and tilts towards
 * the pointer in perspective. Optionally (`trackers`), boxes lock onto
 * parts of the word with confidence labels, like a detector's debug view.
 *
 * Positions are worked out on the GPU from each point's place on its sheet
 * and a seed; tens of thousands of points cost one draw.
 *
 * Opaque: the effect is the whole background of what it fills. Without
 * WebGL it removes its canvas and the element's background shows.
 */

import { createStage } from './stage.js';
import { createPoints, projectPoint, GLSL_PROJECT } from './points.js';
import { drawShape, gridPoints } from './shape.js';
import { createTrackers } from './trackers.js';
import { parseColor } from './color.js';
import { canHover, isMobileGpu } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';

/**
 * @typedef {object} PointCloudConfig
 * @property {string} [text] The word drawn in dots.
 * @property {string} [font] Its CSS font, without the size (default: the page's, bold).
 * @property {string} [src] An image (an SVG logo) to draw in dots instead.
 * @property {{ x: number, y: number, width: number, height: number }} [area]
 *   Where the word sits, each 0–1 from the top left (default: across the middle).
 * @property {string[]} [colors] The word's dots, then the clouds' low and high colours (default white, deep blue, sky blue).
 * @property {string} [background='#020205'] The ground.
 * @property {number} [columns=110] Dots across the word's grid.
 * @property {number} [dot=0.72] A word dot's size, as a share of the grid's spacing.
 * @property {number} [sheets=9] How many sheets of point cloud.
 * @property {number} [pointSize=2.2] A cloud point's size, CSS px.
 * @property {number} [trackers=0] Tracker boxes locking onto the word, a detector's debug look (try 4); 0 for none.
 * @property {number} [tilt=1] How far the scene tilts towards the pointer.
 */

/** The ground: near-black, a little lighter in the middle. */
const GROUND = `
precision highp float;
uniform vec2 uRes;
uniform vec3 uGround;
uniform vec3 uGlow;
void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 d = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
	gl_FragColor = vec4(uGround + uGlow * exp(-dot(d, d) * 3.0) * 0.08, 1.0);
}
`;

/** Each point: a dot of the word (kind < 0), or a point on sheet `kind`. */
const VERTEX = `
precision highp float;
attribute vec4 p;
uniform vec2 uRes;
uniform float uTime;
uniform float uRatio;
uniform vec2 uShift;
uniform vec2 uTurn;
uniform vec3 uText;
uniform vec3 uLow;
uniform vec3 uHigh;
uniform float uTextSize;
uniform float uPointSize;
varying vec3 vColour;
varying float vAlpha;
${GLSL_PROJECT}
float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
	float aspect = uRes.x / uRes.y;
	vec3 v;
	float size;
	if (p.z < 0.0) {
		// A dot of the word, trembling very slightly.
		v = vec3((p.x * 2.0 - 1.0) * aspect, p.y * 2.0 - 1.0, 0.0);
		v.xy += 0.002 * vec2(sin(uTime * 2.0 + p.w * 50.0), cos(uTime * 1.7 + p.w * 31.0));
		vColour = uText;
		vAlpha = 1.0;
		size = uTextSize;
	} else {
		// A point on a sheet: the sheet's place, size and facing come from its index.
		float k = p.z + 1.0;
		vec3 centre = vec3((hash1(k * 1.3) - 0.5) * 2.2 * aspect, (hash1(k * 2.7) - 0.5) * 1.5, (hash1(k * 5.1) - 0.5) * 1.0);
		centre.xy += vec2(sin(uTime * 0.05 + k), cos(uTime * 0.04 + k * 2.0)) * 0.12;
		vec3 local = vec3((p.x - 0.5) * (1.4 + hash1(k * 7.7) * 1.4), (p.y - 0.5) * (0.6 + hash1(k * 9.1) * 0.8), 0.0);
		float wave = sin(p.x * 6.0 + uTime * 0.35 + k) * cos(p.y * 5.0 - uTime * 0.27 + k * 2.0) * 0.22
			+ sin((p.x + p.y) * 11.0 + k * 3.0 + uTime * 0.2) * 0.06;
		local.z = wave;
		local = rotateX(local, hash1(k * 3.3) * 2.4 - 1.2);
		local = rotateY(local, hash1(k * 4.4) * 3.0 - 1.5);
		v = centre + local;
		vColour = mix(uLow, uHigh, clamp(wave * 2.2 + 0.5, 0.0, 1.0));
		// Thinning out towards the sheet's edges, so it has no hard border.
		vAlpha = 0.95 * smoothstep(0.0, 0.18, p.x) * smoothstep(1.0, 0.82, p.x) * smoothstep(0.0, 0.25, p.y) * smoothstep(1.0, 0.75, p.y);
		size = uPointSize * (0.75 + hash1(p.w * 91.0) * 0.5);
	}
	v = rotateY(v, uTurn.x);
	v = rotateX(v, uTurn.y);
	vec4 pos = project(v, aspect);
	gl_Position = pos + vec4(uShift * pos.w, 0.0, 0.0);
	gl_PointSize = size * uRatio / pos.w;
	vAlpha *= clamp(1.25 - pos.w * 0.35, 0.25, 1.0);
}
`;

/** The defaults: white dots, deep and sky blue clouds. */
const COLORS = ['#ffffff', '#2a2aff', '#7cc8ff'];

/**
 * The sheets of point cloud as particle data: a grid of points per sheet,
 * each with its place on the sheet, the sheet's index and a seed.
 *
 * @param {number} sheets How many sheets.
 * @param {number} columns Points across a sheet.
 * @param {number} rows Rows down a sheet.
 * @returns {number[]} Four numbers a point.
 */
function sheetData(sheets, columns, rows) {
	const out = [];
	for (let k = 0; k < sheets; k++) {
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < columns; c++) out.push(c / (columns - 1), r / (rows - 1), k, Math.random());
		}
	}
	return out;
}

/**
 * Starts a point cloud on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {PointCloudConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function pointCloud(el, config) {
	let colors = config.colors?.length ? config.colors : COLORS;
	const start = performance.now();
	const turn = { y: 0, x: 0 };
	/** @type {import('./points.js').Points | null} */
	let points = null;
	/** The word's dots (x, y pairs, 0–1, y up), for the trackers to lock onto. */
	let dots = new Float32Array(0);
	let generation = 0;
	const sheets = sheetData(config.sheets ?? 9, isMobileGpu() ? 100 : 170, isMobileGpu() ? 40 : 70);
	const trackers = (config.trackers ?? 0) > 0 ? createTrackers(el, config.trackers ?? 0) : null;
	/** What each tracker is locked onto: a box of the word in 0–1 coordinates, its label, and when it moves on. */
	const locks = Array.from({ length: config.trackers ?? 0 }, () => ({ box: [0, 0, 0, 0], label: '', until: 0 }));

	/**
	 * Locks a tracker onto a cluster of the word's dots: a random dot and its
	 * neighbours, boxed.
	 *
	 * @param {typeof locks[number]} lock The tracker's lock.
	 * @param {number} t The time, seconds.
	 */
	const relock = (lock, t) => {
		lock.until = t + 2 + Math.random() * 2.5;
		const n = dots.length / 2;
		if (!n) return;
		// A dot well away from where the other trackers are, so they do not pile up.
		let i = 0;
		for (let tries = 0; tries < 24; tries++) {
			i = Math.floor(Math.random() * n);
			const x = dots[i * 2];
			if (locks.every((other) => other === lock || Math.abs((other.box[0] + other.box[2]) / 2 - x) > 0.16)) break;
		}
		const cx = dots[i * 2];
		const cy = dots[i * 2 + 1];
		const reach = 0.05 + Math.random() * 0.06;
		let [x0, y0, x1, y1] = [cx, cy, cx, cy];
		for (let j = 0; j < n; j++) {
			const x = dots[j * 2];
			const y = dots[j * 2 + 1];
			if (Math.abs(x - cx) < reach && Math.abs(y - cy) < reach * 1.6) {
				x0 = Math.min(x0, x);
				y0 = Math.min(y0, y);
				x1 = Math.max(x1, x);
				y1 = Math.max(y1, y);
			}
		}
		lock.box = [x0 - 0.01, y0 - 0.015, x1 + 0.01, y1 + 0.015];
		lock.label = `${Math.round(70 + Math.random() * 29)}%`;
	};

	const { stage, stop } = createStage(el, {
		fragment: GROUND,
		alpha: false,
		setup({ gl, program }) {
			points = createPoints(gl, VERTEX);
			if (!points) return false;
			gl.useProgram(program);
			return () => trackers?.destroy();
		},
		resize({ canvas }) {
			const mine = ++generation;
			const width = Math.min(1024, canvas.width);
			const height = Math.max(1, Math.round((width * canvas.height) / canvas.width));
			drawShape(
				{ text: config.text, font: config.font, src: config.src, area: config.area ?? { x: 0.08, y: 0.3, width: 0.84, height: 0.3 }, padding: 0.02 },
				width,
				height,
			)
				.then((mask) => {
					if (mine !== generation || !points) return;
					dots = gridPoints(mask, Math.round((config.columns ?? 110) / (config.area?.width ?? 0.84)));
					const data = new Float32Array(sheets.length + (dots.length / 2) * 4);
					data.set(sheets);
					for (let i = 0; i < dots.length / 2; i++) {
						data.set([dots[i * 2], dots[i * 2 + 1], -1, Math.random()], sheets.length + i * 4);
					}
					points.upload(data);
					locks.forEach((lock) => (lock.until = 0));
					if (stage?.still) stage.redraw();
				})
				.catch((error) => console.warn('[effects-astro]', error));
		},
		uniforms({ gl, uniform }) {
			gl.uniform3fv(uniform('uGround'), parseColor(config.background ?? '#020205'));
			gl.uniform3fv(uniform('uGlow'), parseColor(colors[2] ?? COLORS[2]));
		},
		after({ gl, canvas, ratio, still }, now) {
			if (!points?.count()) return;
			const t = (now - start) / 1000;
			const p = !still && canHover() ? pointerIn(el) : null;
			const lean = p?.inside ? { x: (p.x - 0.5) * 2, y: (p.y - 0.5) * 2 } : { x: 0, y: 0 };
			const tilt = config.tilt ?? 1;
			turn.y += (lean.x * 0.3 * tilt + Math.sin(t * 0.1) * 0.08 - turn.y) * 0.05;
			turn.x += (-lean.y * 0.2 * tilt - turn.x) * 0.05;
			const u = points.program.uniform;
			points.passes(0, () => {
				gl.uniform2f(u('uRes'), canvas.width, canvas.height);
				gl.uniform1f(u('uTime'), t);
				gl.uniform1f(u('uRatio'), ratio);
				gl.uniform2f(u('uTurn'), turn.y, turn.x);
				gl.uniform3fv(u('uText'), parseColor(colors[0]));
				gl.uniform3fv(u('uLow'), parseColor(colors[1] ?? COLORS[1]));
				gl.uniform3fv(u('uHigh'), parseColor(colors[2] ?? COLORS[2]));
				// A word dot: a share of the grid's spacing, in CSS px.
				gl.uniform1f(u('uTextSize'), Math.max(2, (canvas.width / ratio / ((config.columns ?? 110) / (config.area?.width ?? 0.84))) * (config.dot ?? 0.72)));
				gl.uniform1f(u('uPointSize'), config.pointSize ?? 2.2);
			});

			// The trackers, boxed over the word where the shader draws it.
			if (!trackers) return;
			const aspect = canvas.width / canvas.height;
			const w = el.clientWidth;
			const h = el.clientHeight;
			locks.forEach((lock, i) => {
				if (t > lock.until) relock(lock, t);
				if (!dots.length) return trackers.place(i, null);
				const [x0, y0, x1, y1] = lock.box;
				/**
				 * Where a point of the word lands on screen.
				 *
				 * @param {number} x Across the word's canvas, 0–1.
				 * @param {number} y Up it, 0–1.
				 * @returns {{ x: number, y: number }} 0–1 from the top left.
				 */
				const corner = (x, y) => projectPoint([(x * 2 - 1) * aspect, y * 2 - 1, 0], turn.y, turn.x, aspect);
				const a = corner(x0, y1);
				const b = corner(x1, y0);
				trackers.place(i, { x: a.x * w, y: a.y * h, w: (b.x - a.x) * w, h: (b.y - a.y) * h }, lock.label);
			});
		},
	});
	if (!stage) {
		trackers?.destroy();
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
