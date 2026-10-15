/**
 * @module @arraypress/effects-astro/world-routes
 *
 * A dotted world map with routes arcing between cities: each route a
 * faint arc that a comet of light runs along, again and again, pinging
 * the city it reaches. For "sell worldwide", "customers in 40 countries".
 *
 * The map is drawn once a resize onto its own canvas, from the land grid
 * in world-land.js, and laid down each frame; the routes are a few dozen
 * strokes. Canvas 2D, no GPU needed. With prefers-reduced-motion, one
 * still frame with the comets part-way along.
 *
 * From the SugarCart site.
 */

import { createCanvas2D } from './canvas2d.js';
import { isLand, LAND } from './world-land.js';

/** Cities a route can name, as [degrees north, degrees east]. */
export const CITIES = {
	amsterdam: [52.37, 4.9],
	auckland: [-36.85, 174.76],
	bangkok: [13.76, 100.5],
	berlin: [52.52, 13.4],
	'buenos-aires': [-34.6, -58.38],
	cairo: [30.04, 31.24],
	'cape-town': [-33.92, 18.42],
	chicago: [41.88, -87.63],
	dubai: [25.2, 55.27],
	dublin: [53.35, -6.26],
	edinburgh: [55.95, -3.19],
	'hong-kong': [22.32, 114.17],
	istanbul: [41.01, 28.98],
	jakarta: [-6.2, 106.85],
	lagos: [6.52, 3.38],
	london: [51.51, -0.13],
	'los-angeles': [34.05, -118.24],
	madrid: [40.42, -3.7],
	'mexico-city': [19.43, -99.13],
	mumbai: [19.08, 72.88],
	nairobi: [-1.29, 36.82],
	'new-york': [40.71, -74.01],
	paris: [48.86, 2.35],
	'san-francisco': [37.77, -122.42],
	'sao-paulo': [-23.55, -46.63],
	seoul: [37.57, 126.98],
	shanghai: [31.23, 121.47],
	singapore: [1.35, 103.82],
	stockholm: [59.33, 18.07],
	sydney: [-33.87, 151.21],
	tokyo: [35.68, 139.69],
	toronto: [43.65, -79.38],
};

/** @typedef {keyof typeof CITIES | [number, number]} Place */

/**
 * @typedef {object} WorldRoutesConfig
 * @property {[Place, Place][]} [routes] The routes, each from a place to a place: a key of CITIES, or [degrees north, degrees east]. Default ten routes round the world.
 * @property {string} [color='#38bdf8'] The routes' colour.
 * @property {string} [land='#ffffff'] The land dots' colour.
 * @property {number} [landOpacity=0.18] The land dots' opacity.
 * @property {number} [pitch=7] Space between land dots, CSS px.
 * @property {number} [dot=1.4] A land dot's radius, CSS px.
 * @property {number} [lap=3.2] Seconds a comet takes along a route.
 * @property {number} [lift=0.3] How high the arcs bow, as a share of their length.
 */

/** @type {[Place, Place][]} */
const ROUTES = [
	['new-york', 'london'],
	['london', 'berlin'],
	['berlin', 'shanghai'],
	['shanghai', 'tokyo'],
	['tokyo', 'sydney'],
	['new-york', 'sao-paulo'],
	['london', 'mumbai'],
	['shanghai', 'singapore'],
	['paris', 'sao-paulo'],
	['toronto', 'london'],
];

/** Share of a route the comet's tail covers. */
const TAIL = 0.28;

/**
 * Starts the map on an element (its first canvas is drawn into).
 *
 * @param {HTMLElement} el The element.
 * @param {WorldRoutesConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function worldRoutes(el, config) {
	const color = config.color ?? '#38bdf8';
	const PITCH = config.pitch ?? 7;
	const DOT = config.dot ?? 1.4;
	const LAP = config.lap ?? 3.2;
	const LIFT = config.lift ?? 0.3;
	const map = document.createElement('canvas');
	const start = performance.now();
	/** The map's place in the element: its left, top and size, CSS px. */
	const frame = { x: 0, y: 0, w: 0, h: 0 };
	/** @type {{ ax: number, ay: number, cx: number, cy: number, bx: number, by: number, offset: number }[]} */
	let arcs = [];

	/**
	 * Where a place falls in the element.
	 *
	 * @param {Place} place A city's key, or [degrees north, degrees east].
	 * @returns {[number, number] | null} CSS px across and down, or null for an unknown city.
	 */
	const project = (place) => {
		const at = typeof place === 'string' ? CITIES[place] : place;
		if (!at) return null;
		const [lat, lon] = at;
		return [frame.x + ((lon + 180) / 360) * frame.w, frame.y + ((LAND.top - lat) / (LAND.rows * LAND.step)) * frame.h];
	};

	/**
	 * A point along an arc.
	 *
	 * @param {(typeof arcs)[number]} a The arc.
	 * @param {number} t How far along, 0–1.
	 * @returns {[number, number]} CSS px across and down.
	 */
	const along = (a, t) => {
		const u = 1 - t;
		return [u * u * a.ax + 2 * u * t * a.cx + t * t * a.bx, u * u * a.ay + 2 * u * t * a.cy + t * t * a.by];
	};

	/**
	 * Fits the map to the element, draws its dots and lays out the arcs.
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 */
	const resize = (c) => {
		const aspect = 360 / (LAND.rows * LAND.step);
		frame.w = Math.min(c.width, c.height * aspect);
		frame.h = frame.w / aspect;
		frame.x = (c.width - frame.w) / 2;
		frame.y = (c.height - frame.h) / 2;

		const dpr = c.canvas.width / c.width;
		map.width = c.canvas.width;
		map.height = c.canvas.height;
		const ctx = /** @type {CanvasRenderingContext2D} */ (map.getContext('2d'));
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.fillStyle = config.land ?? '#ffffff';
		ctx.globalAlpha = config.landOpacity ?? 0.18;
		ctx.beginPath();
		for (let y = frame.y + PITCH / 2; y < frame.y + frame.h; y += PITCH) {
			for (let x = frame.x + PITCH / 2; x < frame.x + frame.w; x += PITCH) {
				const lat = LAND.top - ((y - frame.y) / frame.h) * LAND.rows * LAND.step;
				const lon = ((x - frame.x) / frame.w) * 360 - 180;
				if (!isLand(lat, lon)) continue;
				ctx.moveTo(x + DOT, y);
				ctx.arc(x, y, DOT, 0, Math.PI * 2);
			}
		}
		ctx.fill();

		arcs = (config.routes ?? ROUTES).flatMap(([from, to], i) => {
			const a = project(from);
			const b = project(to);
			if (!a || !b) return [];
			const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
			const cx = (a[0] + b[0]) / 2;
			const cy = (a[1] + b[1]) / 2 - Math.min(length * LIFT, frame.h * 0.3);
			return [{ ax: a[0], ay: a[1], cx, cy, bx: b[0], by: b[1], offset: (i * 0.37) % 1 }];
		});
	};

	/**
	 * One frame: the map, the faint arcs, the comets and the pings.
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 * @param {number} now The time, ms.
	 */
	const draw = (c, now) => {
		const { ctx } = c;
		const time = c.still ? LAP * 0.6 : (now - start) / 1000;
		ctx.clearRect(0, 0, c.width, c.height);
		ctx.globalAlpha = 1;
		ctx.drawImage(map, 0, 0, c.width, c.height);
		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.lineCap = 'round';

		for (const a of arcs) {
			ctx.globalAlpha = 0.14;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(a.ax, a.ay);
			ctx.quadraticCurveTo(a.cx, a.cy, a.bx, a.by);
			ctx.stroke();

			// A lap runs the comet out and lets its tail follow it in, then rests a beat.
			const phase = ((time / LAP + a.offset) % 1) * (1 + TAIL + 0.25);
			const head = Math.min(1, phase);
			const tail = Math.max(0, phase - TAIL);
			if (tail < 1) {
				const steps = 16;
				for (let s = 0; s < steps; s++) {
					const t0 = tail + ((head - tail) * s) / steps;
					const t1 = tail + ((head - tail) * (s + 1)) / steps;
					const [x0, y0] = along(a, t0);
					const [x1, y1] = along(a, t1);
					const k = (s + 1) / steps;
					ctx.globalAlpha = k * k;
					ctx.lineWidth = 0.6 + k * 1.6;
					ctx.beginPath();
					ctx.moveTo(x0, y0);
					ctx.lineTo(x1, y1);
					ctx.stroke();
				}
				if (head < 1) {
					const [hx, hy] = along(a, head);
					ctx.globalAlpha = 1;
					ctx.shadowColor = color;
					ctx.shadowBlur = 10;
					ctx.beginPath();
					ctx.arc(hx, hy, 2.4, 0, Math.PI * 2);
					ctx.fill();
					ctx.shadowBlur = 0;
				}
			}

			// The cities: a steady dot each end, and a ring opening where the comet lands.
			ctx.globalAlpha = 0.9;
			for (const [x, y] of [
				[a.ax, a.ay],
				[a.bx, a.by],
			]) {
				ctx.beginPath();
				ctx.arc(x, y, 2.2, 0, Math.PI * 2);
				ctx.fill();
			}
			const ping = phase - 1;
			if (ping > 0 && ping < 0.45) {
				const k = ping / 0.45;
				ctx.globalAlpha = (1 - k) * 0.8;
				ctx.lineWidth = 1.2;
				ctx.beginPath();
				ctx.arc(a.bx, a.by, 3 + k * 14, 0, Math.PI * 2);
				ctx.stroke();
			}
		}
		ctx.globalAlpha = 1;
	};

	const { stop } = createCanvas2D(el, { draw, resize });
	return stop;
}
