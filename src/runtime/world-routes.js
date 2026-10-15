/**
 * @module @arraypress/effects-astro/world-routes
 *
 * A dotted world map with routes arcing between cities: each route a
 * faint arc that comets of light run along, again and again, pinging the
 * city they reach. For "sell worldwide", "customers in 40 countries", or,
 * with a `home`, "shipped from here to everywhere".
 *
 * The cities, routes and colours come from world-plan.js; the map from
 * world-map.js, a region fitted to the box and drawn once a resize into
 * strips that a drifting map pans across; the names' places from
 * world-labels.js. Each frame lays the strips down and draws a few dozen
 * strokes over them. Canvas 2D, no GPU needed. Hovering a city or a route
 * brightens it and names it (not through a link or a button). With
 * prefers-reduced-motion, one still frame with the comets part-way along.
 *
 * From the SugarCart site.
 */

import { createCanvas2D } from './canvas2d.js';
import { canHover } from './device.js';
import { watchColors } from './mount.js';
import { CLICK_IGNORE, pointerIn } from './pointer.js';
import { fitView, greatCircle, paintLand, project, regionBounds } from './world-map.js';
import { placeLabels } from './world-labels.js';
import { CITIES, RAMP, planRoutes } from './world-plan.js';

export { CITIES };

/** @typedef {import('./world-plan.js').Place} Place */
/** @typedef {import('./world-plan.js').RouteSpec} RouteSpec */

/**
 * @typedef {object} WorldRoutesConfig
 * @property {RouteSpec[]} [routes] The routes: `[from, to]`, a place (from `home`), or `{ from, to, color, label, speed, width, dashed }`. Default ten routes round the world, or from `home` to ten cities round the world.
 * @property {Place} [home] A hub: routes with no `from` start here, and it is marked out.
 * @property {string} [color='#38bdf8'] The routes' colour.
 * @property {string[]} [colors] A palette in place of `color`: each city takes the next colour (a home city the first, kept to itself), and a route the colour of where it ends.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {boolean} [gradient=false] Blend each route from its origin's colour to its destination's, in Oklab.
 * @property {string} [land='#ffffff'] The land dots' and the names' colour.
 * @property {number} [landOpacity=0.18] The land dots' opacity.
 * @property {number} [pitch=7] Space between land dots, CSS px.
 * @property {number} [dot=1.4] A land dot's radius, CSS px.
 * @property {'round' | 'square'} [dotShape='round'] The land dots' shape.
 * @property {boolean | number} [graticule=false] Faint lines of latitude and longitude: true for every 30°, or the degrees between them.
 * @property {import('./world-map.js').RegionName | 'routes' | import('./world-map.js').Bounds} [region='world'] What the map shows.
 * @property {'contain' | 'cover'} [fit='contain'] Show all of the region, or fill the box with it.
 * @property {number} [drift=0] Pan the map east this many degrees a second (negative for west), round and round the world.
 * @property {number} [lap=3.2] Seconds a comet takes along a route.
 * @property {number} [lift] How high the arcs bow, a share of their length: 0.3, or 0.08 with a great-circle `curve`.
 * @property {'bow' | 'great-circle'} [curve='bow'] Arcs that bow up between the cities, or that follow the shortest way over the globe.
 * @property {number} [arcOpacity=0.14] The faint arcs' opacity.
 * @property {boolean} [dashed=false] Dash the faint arcs, the dashes running from origin to destination.
 * @property {number} [width=2.2] The comets' width, CSS px; the faint arcs are a line half as wide.
 * @property {number} [tail=0.28] A comet's length, a share of its route.
 * @property {number} [glow=10] The glow round a comet's head, CSS px.
 * @property {number} [comets=1] Comets on each route at once.
 * @property {number} [ping=17] How wide the ring a landing comet opens grows, CSS px; 0 for none.
 * @property {boolean} [markers=true] Mark the cities with a dot.
 * @property {number} [markerSize=2.2] A city dot's radius, CSS px.
 * @property {boolean} [halo=false] A soft halo breathing round every city (the home city always has one).
 * @property {boolean} [labels=false] Name the cities, leaving out names that would overlap.
 * @property {string} [font='500 11px system-ui, sans-serif'] The names' CSS font.
 * @property {boolean} [interactive=true] Hovering a city or a route brightens it and names it.
 */

/** Pieces in an arc's path. */
const STEPS = 48;
/** Pieces in a comet's tail. */
const TAIL_STEPS = 16;
/** The share of a lap a comet rests for after landing, its tail drawn in. */
const REST = 0.25;
/** A strip of the map's width, CSS px (rounded to whole device px). */
const STRIP = 256;
/** How far past the box's edge something still counts as in view, CSS px (halos and names reach in). */
const MARGIN = 40;
/** The names' font when none is given. */
const FONT = '500 11px system-ui, sans-serif';

/**
 * @typedef {object} Arc
 * @property {import('./world-plan.js').PlannedRoute} route Its route.
 * @property {Float32Array} points Its path, x and y in turn, CSS px on the unpanned map.
 * @property {Float32Array} lengths How far along the path each point is, CSS px.
 * @property {number} left Its leftmost x.
 * @property {number} right Its rightmost x.
 * @property {CanvasGradient | string} stroke What its faint arc is drawn in.
 */

/**
 * A CSS colour at an opacity: hex gains an alpha pair, anything else is
 * mixed with transparent.
 *
 * @param {string} color The colour.
 * @param {number} alpha Its opacity, 0–1.
 * @returns {string} The colour with that opacity.
 */
const withAlpha = (color, alpha) =>
	/^#[0-9a-f]{6}$/i.test(color)
		? color + Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, '0')
		: `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;

/**
 * Starts the map on an element (its first canvas is drawn into).
 *
 * @param {HTMLElement} el The element.
 * @param {WorldRoutesConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function worldRoutes(el, config) {
	const LAP = config.lap ?? 3.2;
	const CURVE = config.curve === 'great-circle' ? 'great-circle' : 'bow';
	const LIFT = config.lift ?? (CURVE === 'bow' ? 0.3 : 0.08);
	const TAIL = Math.min(1, Math.max(0.02, config.tail ?? 0.28));
	const GLOW = Math.max(0, config.glow ?? 10);
	const COMETS = Math.max(0, Math.round(config.comets ?? 1));
	const PING = Math.max(0, config.ping ?? 17);
	const ARC = config.arcOpacity ?? 0.14;
	const MARK = config.markerSize ?? 2.2;
	const DRIFT = config.drift ?? 0;
	const INK = config.land ?? '#ffffff';
	const NAMES = config.font ?? FONT;
	/** @type {import('./world-map.js').LandStyle} */
	const land = {
		color: INK,
		opacity: config.landOpacity ?? 0.18,
		pitch: Math.max(2, config.pitch ?? 7),
		dot: config.dot ?? 1.4,
		shape: config.dotShape === 'square' ? 'square' : 'round',
		graticule: config.graticule === true ? 30 : Math.max(0, Number(config.graticule) || 0),
		wrap: DRIFT !== 0,
	};
	const interactive = config.interactive !== false && canHover();
	const start = performance.now();
	let plan = planRoutes(config);

	/** The view the map is drawn in, set on resize. */
	let view = fitView(regionBounds('world'), 1, 1);
	/** How tall the region is, CSS px: no arc bows higher than a share of it. */
	let regionHeight = 1;
	/** Device px a CSS px. */
	let dpr = 1;
	/** Each city's place on the unpanned map. */
	let spots = /** @type {[number, number][]} */ ([]);
	/** @type {Arc[]} */
	let arcs = [];
	/** Each city's name box, relative to the city, or null where it is left out. */
	let names = /** @type {(import('./world-labels.js').Rect | null)[]} */ ([]);
	/** Each city's name's width, and the names' height, CSS px. */
	let nameWidths = /** @type {number[]} */ ([]);
	let nameHeight = 12;
	/** The map's strips, by index across the unpanned map; null where one would be empty. */
	const strips = /** @type {Map<number, HTMLCanvasElement | null>} */ (new Map());
	/** How picked out each city and each route is by the pointer, 0–1, and how much picking out is going on at all. */
	let cityFocus = new Float32Array(0);
	let routeFocus = new Float32Array(0);
	let focused = 0;
	/** The last check for a link or button under the pointer: where, and what it found. */
	const blocked = { x: -1, y: -1, over: false };

	/**
	 * Lays the routes out on the map: each arc's path, its length along the
	 * way and the colour its faint arc is drawn in.
	 *
	 * @param {CanvasRenderingContext2D} ctx The context (for gradients).
	 */
	const layArcs = (ctx) => {
		arcs = plan.routes.map((route) => {
			const a = plan.cities[route.from];
			const b = plan.cities[route.to];
			const [ax, ay] = spots[route.from];
			const points = new Float32Array((STEPS + 1) * 2);
			if (CURVE === 'great-circle') {
				const across = view.scale * view.squash;
				greatCircle([a.lat, a.lon], [b.lat, b.lon], STEPS).forEach(([lat, lon], i) => {
					points[i * 2] = ax + (lon - a.lon) * across;
					points[i * 2 + 1] = project(view, lat, lon)[1];
				});
			} else {
				const [bx, by] = spots[route.to];
				for (let i = 0; i <= STEPS; i++) {
					points[i * 2] = ax + ((bx - ax) * i) / STEPS;
					points[i * 2 + 1] = ay + ((by - ay) * i) / STEPS;
				}
			}
			// Lift the path into an arc, highest in the middle: a bow is the quadratic curve it always was.
			const ex = points[STEPS * 2];
			const ey = points[STEPS * 2 + 1];
			const height = Math.min(Math.hypot(ex - ax, ey - ay) * LIFT, regionHeight * 0.3) * (CURVE === 'bow' ? 0.5 : 1);
			const lengths = new Float32Array(STEPS + 1);
			let left = Infinity;
			let right = -Infinity;
			for (let i = 0; i <= STEPS; i++) {
				const t = i / STEPS;
				points[i * 2 + 1] -= height * 4 * t * (1 - t);
				if (i) lengths[i] = lengths[i - 1] + Math.hypot(points[i * 2] - points[i * 2 - 2], points[i * 2 + 1] - points[i * 2 - 1]);
				left = Math.min(left, points[i * 2]);
				right = Math.max(right, points[i * 2]);
			}
			/** @type {CanvasGradient | string} */
			let stroke = route.ramp[0];
			if (route.ramp[0] !== route.ramp[RAMP]) {
				stroke = ctx.createLinearGradient(ax, ay, ex, ey);
				for (let i = 0; i <= RAMP; i += 2) stroke.addColorStop(i / RAMP, route.ramp[i]);
			}
			return { route, points, lengths, left, right, stroke };
		});
	};

	/**
	 * A city's name, ready to place.
	 *
	 * @param {number} i The city.
	 * @param {boolean} force Place it whatever it covers.
	 * @returns {import('./world-labels.js').LabelItem} The name, beside the city on the unpanned map.
	 */
	const labelItem = (i, force) => ({
		x: spots[i][0],
		y: spots[i][1],
		w: nameWidths[i],
		h: nameHeight,
		gap: MARK * (plan.cities[i].home ? 2.2 : 1.6) + 4,
		force,
	});

	/**
	 * Fits the map to the element: the view, the cities' places, the arcs and
	 * the names, and lets go of the strips drawn at the old size.
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 */
	const resize = (c) => {
		// A region fitted round the routes takes in the cities, and the great circles that rise above them.
		const places = plan.cities.map((city) => /** @type {[number, number]} */ ([city.lat, city.lon]));
		if (CURVE === 'great-circle') {
			for (const { from, to } of plan.routes) {
				const [a, b] = [plan.cities[from], plan.cities[to]];
				places.push(...greatCircle([a.lat, a.lon], [b.lat, b.lon], 8));
			}
		}
		const box = regionBounds(config.region, places);
		view = fitView(box, c.width, c.height, config.fit === 'cover' ? 'cover' : 'contain');
		regionHeight = (box.north - box.south) * view.scale;
		dpr = c.canvas.width / c.width;
		for (const canvas of strips.values()) if (canvas) canvas.width = 0;
		strips.clear();
		spots = plan.cities.map((city) => project(view, city.lat, city.lon));
		layArcs(c.ctx);
		cityFocus = new Float32Array(plan.cities.length);
		routeFocus = new Float32Array(plan.routes.length);

		c.ctx.font = NAMES;
		const m = c.ctx.measureText('Hg');
		nameHeight = Math.ceil((m.fontBoundingBoxAscent || 9) + (m.fontBoundingBoxDescent || 3));
		nameWidths = plan.cities.map((city) => c.ctx.measureText(city.name).width);
		names = plan.cities.map(() => null);
		if (!config.labels) return;
		// Home first, then the busiest cities, so the names that matter most get their place.
		const order = plan.cities
			.map((_, i) => i)
			.sort((a, b) => Number(plan.cities[b].home) - Number(plan.cities[a].home) || plan.cities[b].routes - plan.cities[a].routes);
		const dots = spots.map(([x, y]) => ({ x: x - MARK - 2, y: y - MARK - 2, w: MARK * 2 + 4, h: MARK * 2 + 4 }));
		const boxes = placeLabels(
			order.map((i) => labelItem(i, plan.cities[i].home)),
			dots,
			DRIFT ? null : { width: c.width, height: c.height },
		);
		order.forEach((i, k) => {
			const placed = boxes[k];
			names[i] = placed && { ...placed, x: placed.x - spots[i][0], y: placed.y - spots[i][1] };
		});
	};

	/**
	 * A strip of the map, drawn the first time it is needed.
	 *
	 * @param {number} i Which strip, counting from the unpanned map's left.
	 * @param {number} width A strip's width, CSS px.
	 * @param {number} height The map's height, CSS px.
	 * @returns {HTMLCanvasElement | null} The strip, or null where there is no map.
	 */
	const strip = (i, width, height) => {
		const known = strips.get(i);
		if (known !== undefined) return known;
		const left = i * width;
		const band = view.width / 2 - view.period / 2;
		const empty = !land.wrap && (left + width <= band || left >= band + view.period);
		const canvas = empty ? null : document.createElement('canvas');
		const ctx = canvas?.getContext('2d');
		if (canvas && ctx) {
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			paintLand(ctx, view, land, left, width);
		}
		const made = canvas && ctx ? canvas : null;
		strips.set(i, made);
		return made;
	};

	/**
	 * Lays the map's strips down, panned, and lets go of those panned away.
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 * @param {number} pan How far the map has drifted, CSS px.
	 */
	const drawLand = (c, pan) => {
		const width = Math.round(STRIP * dpr) / dpr;
		const first = Math.floor(pan / width);
		const last = Math.floor((pan + c.width) / width);
		for (let i = first; i <= last; i++) {
			const canvas = strip(i, width, c.height);
			if (canvas) c.ctx.drawImage(canvas, i * width - pan, 0, width, c.height);
		}
		for (const [i, canvas] of strips) {
			if (i >= first - 1 && i <= last + 1) continue;
			if (canvas) canvas.width = 0;
			strips.delete(i);
		}
	};

	/**
	 * Calls `fn` with each shift that brings something on the unpanned map
	 * into view. A still map is one turn of the world, so only shifts that
	 * land on that turn count (an arc over the date line comes in at the
	 * other side); a drifting one repeats round and round.
	 *
	 * @param {number} left Its leftmost x.
	 * @param {number} right Its rightmost x.
	 * @param {number} pan How far the map has drifted, CSS px.
	 * @param {(dx: number) => void} fn Draws it, shifted by `dx`.
	 */
	const copies = (left, right, pan, fn) => {
		const band = view.width / 2 - view.period / 2;
		const lo = land.wrap ? pan - MARGIN : Math.max(-MARGIN, band);
		const hi = land.wrap ? pan + view.width + MARGIN : Math.min(view.width + MARGIN, band + view.period);
		const from = Math.ceil((lo - right) / view.period);
		const to = Math.floor((hi - left) / view.period);
		for (let m = from; m <= to; m++) fn(m * view.period - pan);
	};

	/**
	 * A point along an arc, by distance.
	 *
	 * @param {Arc} arc The arc.
	 * @param {number} u How far along, 0–1 of its length.
	 * @returns {[number, number]} CSS px on the unpanned map.
	 */
	const along = (arc, u) => {
		const { points, lengths } = arc;
		const target = Math.min(1, Math.max(0, u)) * lengths[STEPS];
		let lo = 0;
		let hi = STEPS;
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if (lengths[mid] < target) lo = mid;
			else hi = mid;
		}
		const f = (target - lengths[lo]) / (lengths[hi] - lengths[lo] || 1);
		return [points[lo * 2] + (points[hi * 2] - points[lo * 2]) * f, points[lo * 2 + 1] + (points[hi * 2 + 1] - points[lo * 2 + 1]) * f];
	};

	/**
	 * What the pointer is on: a city (first) or a route, unless it is over
	 * a link, a button or a field.
	 *
	 * @param {number} pan How far the map has drifted, CSS px.
	 * @returns {{ city: number, route: number }} Their indices, -1 for none.
	 */
	const hovered = (pan) => {
		const none = { city: -1, route: -1 };
		if (!interactive) return none;
		const p = pointerIn(el);
		if (!p.inside) return none;
		const px = p.x * view.width;
		const py = (1 - p.y) * view.height;
		let city = -1;
		let route = -1;
		let best = Math.max(12, MARK * 4);
		spots.forEach(([x, y], i) =>
			copies(x, x, pan, (dx) => {
				const d = Math.hypot(px - x - dx, py - y);
				if (d < best) [best, city] = [d, i];
			}),
		);
		if (city < 0) {
			best = 7;
			arcs.forEach((arc, i) =>
				copies(arc.left, arc.right, pan, (dx) => {
					for (let s = 0; s < STEPS; s++) {
						const d = toSegment(px - dx, py, arc.points, s);
						if (d < best) [best, route] = [d, i];
					}
				}),
			);
		}
		if (city < 0 && route < 0) return none;
		// Only look up what is under the pointer when it has moved: the answer does not change otherwise.
		if (px !== blocked.x || py !== blocked.y) {
			const box = el.getBoundingClientRect();
			blocked.over = !!document.elementFromPoint(box.left + px, box.top + py)?.closest(CLICK_IGNORE);
			[blocked.x, blocked.y] = [px, py];
		}
		return blocked.over ? none : { city, route };
	};

	/**
	 * Eases each city's and route's highlight toward what the pointer is on.
	 *
	 * @param {{ city: number, route: number }} on What the pointer is on.
	 * @param {number} dt Seconds since the last frame.
	 */
	const ease = (on, dt) => {
		const k = 1 - Math.exp(-dt * 12);
		for (let i = 0; i < cityFocus.length; i++) cityFocus[i] += ((i === on.city ? 1 : 0) - cityFocus[i]) * k;
		for (let i = 0; i < routeFocus.length; i++) routeFocus[i] += ((i === on.route ? 1 : 0) - routeFocus[i]) * k;
		focused += ((on.city >= 0 || on.route >= 0 ? 1 : 0) - focused) * k;
	};

	/**
	 * How bright something stays while something else is picked out.
	 *
	 * @param {number} lit How picked out it is itself, 0–1.
	 * @returns {number} The share of its opacity it keeps, 0–1.
	 */
	const dim = (lit) => 1 - 0.65 * focused * (1 - lit);

	/**
	 * Writes a name, first cutting the map out from under it so it reads
	 * over the dots and arcs on any background.
	 *
	 * @param {CanvasRenderingContext2D} ctx The context, its font and alignment set.
	 * @param {string} text The name.
	 * @param {number} x Where it is anchored, CSS px across.
	 * @param {number} y Its middle, CSS px down.
	 * @param {number} alpha Its opacity.
	 */
	const write = (ctx, text, x, y, alpha) => {
		if (alpha < 0.01) return;
		ctx.globalAlpha = Math.min(1, alpha * 1.3);
		ctx.globalCompositeOperation = 'destination-out';
		ctx.strokeText(text, x, y);
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = alpha;
		ctx.fillText(text, x, y);
	};

	/**
	 * One route on the map once: its faint arc, its comets and the pings
	 * where they land.
	 *
	 * @param {CanvasRenderingContext2D} ctx The context, shifted to this copy.
	 * @param {Arc} arc The route.
	 * @param {number} time Seconds since the start.
	 * @param {boolean} still Whether this is the one still frame.
	 * @param {number} lit How picked out it is, 0–1.
	 */
	const drawRoute = (ctx, arc, time, still, lit) => {
		const { route, points } = arc;
		const shade = dim(lit);
		const scale = route.width / 2.2;
		ctx.globalAlpha = (ARC + (0.55 - ARC) * lit) * shade;
		ctx.strokeStyle = arc.stroke;
		ctx.lineWidth = scale * (1 + lit * 0.6);
		if (route.dashed) {
			ctx.setLineDash([4 * scale, 5 * scale]);
			ctx.lineDashOffset = still ? 0 : -time * 12;
		}
		ctx.beginPath();
		ctx.moveTo(points[0], points[1]);
		for (let i = 1; i <= STEPS; i++) ctx.lineTo(points[i * 2], points[i * 2 + 1]);
		ctx.stroke();
		if (route.dashed) ctx.setLineDash([]);

		// Each comet runs out, lets its tail follow it in, then rests a beat; several share a lap evenly.
		for (let j = 0; j < COMETS; j++) {
			const lap = (((time * route.speed) / LAP + route.offset + j / COMETS) % 1 + 1) % 1;
			const phase = lap * (1 + TAIL + REST);
			const head = Math.min(1, phase);
			const tail = Math.max(0, phase - TAIL);
			if (tail < 1) {
				for (let s = 0; s < TAIL_STEPS; s++) {
					const t0 = tail + ((head - tail) * s) / TAIL_STEPS;
					const t1 = tail + ((head - tail) * (s + 1)) / TAIL_STEPS;
					const [x0, y0] = along(arc, t0);
					const [x1, y1] = along(arc, t1);
					const k = (s + 1) / TAIL_STEPS;
					ctx.globalAlpha = k * k * shade;
					ctx.strokeStyle = route.ramp[Math.round(t1 * RAMP)];
					ctx.lineWidth = (0.6 + k * 1.6) * scale * (1 + lit * 0.3);
					ctx.beginPath();
					ctx.moveTo(x0, y0);
					ctx.lineTo(x1, y1);
					ctx.stroke();
				}
			}
			if (head < 1) {
				const [hx, hy] = along(arc, head);
				const color = route.ramp[Math.round(head * RAMP)];
				ctx.globalAlpha = shade;
				if (GLOW > 0) {
					const r = GLOW * 1.3;
					const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
					glow.addColorStop(0, withAlpha(color, 0.6));
					glow.addColorStop(0.35, withAlpha(color, 0.2));
					glow.addColorStop(1, withAlpha(color, 0));
					ctx.fillStyle = glow;
					ctx.fillRect(hx - r, hy - r, r * 2, r * 2);
				}
				ctx.fillStyle = route.cores[Math.round(head * RAMP)];
				ctx.beginPath();
				ctx.arc(hx, hy, 2.4 * scale * (1 + lit * 0.2), 0, Math.PI * 2);
				ctx.fill();
			}
			// A ring opening where the comet lands.
			const ping = (phase - 1) / 0.45;
			if (PING > 0 && ping > 0 && ping < 1) {
				ctx.globalAlpha = (1 - ping) * 0.8 * shade;
				ctx.strokeStyle = route.ramp[RAMP];
				ctx.lineWidth = 1.2;
				ctx.beginPath();
				ctx.arc(points[STEPS * 2], points[STEPS * 2 + 1], MARK + 1 + ping * Math.max(0, PING - MARK - 1), 0, Math.PI * 2);
				ctx.stroke();
			}
		}
	};

	/**
	 * One city once: its halo (always for the home city), its ring (home),
	 * and its dot.
	 *
	 * @param {CanvasRenderingContext2D} ctx The context.
	 * @param {number} i The city.
	 * @param {number} x Where it is, CSS px across.
	 * @param {number} y Where it is, CSS px down.
	 * @param {number} time Seconds since the start.
	 * @param {boolean} still Whether this is the one still frame.
	 * @param {number} lit How picked out it is, 0–1.
	 */
	const drawCity = (ctx, i, x, y, time, still, lit) => {
		const city = plan.cities[i];
		const shade = dim(lit);
		const size = MARK * (city.home ? 1.45 : 1) * (1 + lit * 0.45);
		ctx.globalAlpha = shade;
		if (config.halo || city.home) {
			const breath = still ? 0.5 : 0.5 + 0.5 * Math.sin(time * 2.2 + i * 1.7);
			const r = size * (3.2 + breath * 1.8) * (city.home ? 1.3 : 1);
			const halo = ctx.createRadialGradient(x, y, 0, x, y, r);
			halo.addColorStop(0, withAlpha(city.color, 0.28 + 0.22 * breath));
			halo.addColorStop(1, withAlpha(city.color, 0));
			ctx.fillStyle = halo;
			ctx.fillRect(x - r, y - r, r * 2, r * 2);
		}
		if (city.home) {
			ctx.globalAlpha = 0.55 * shade;
			ctx.strokeStyle = city.color;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.arc(x, y, size * 2.4, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.globalAlpha = 0.95 * shade;
		ctx.fillStyle = city.color;
		ctx.beginPath();
		ctx.arc(x, y, size, 0, Math.PI * 2);
		ctx.fill();
	};

	/**
	 * One frame: the map, the routes, the cities and their names, and the
	 * name of the route under the pointer.
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 * @param {number} now The time, ms.
	 * @param {number} dt Seconds since the last frame.
	 */
	const draw = (c, now, dt) => {
		const { ctx, still } = c;
		const time = still ? LAP * 0.6 : (now - start) / 1000;
		const pan = still ? 0 : Math.round(time * DRIFT * view.scale * view.squash * dpr) / dpr;
		ctx.clearRect(0, 0, c.width, c.height);
		ctx.globalAlpha = 1;
		drawLand(c, pan);
		if (!still) ease(hovered(pan), dt);
		// A route is picked out with either of its cities, and both its cities with it.
		const shine = arcs.map(({ route }, r) => Math.max(routeFocus[r], cityFocus[route.from], cityFocus[route.to]));
		const lit = Array.from(cityFocus);
		arcs.forEach(({ route }, r) => {
			lit[route.from] = Math.max(lit[route.from], shine[r]);
			lit[route.to] = Math.max(lit[route.to], shine[r]);
		});

		ctx.save();
		if (!land.wrap) {
			ctx.beginPath();
			ctx.rect(view.width / 2 - view.period / 2, 0, view.period, c.height);
			ctx.clip();
		}
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		arcs.forEach((arc, r) => {
			copies(arc.left, arc.right, pan, (dx) => {
				ctx.translate(dx, 0);
				drawRoute(ctx, arc, time, still, shine[r]);
				ctx.translate(-dx, 0);
			});
		});
		ctx.restore();

		if (config.markers !== false) {
			spots.forEach(([x, y], i) => copies(x, x, pan, (dx) => drawCity(ctx, i, x + dx, y, time, still, lit[i])));
		}

		// The names: those placed on resize, and the one under the pointer wherever it fits.
		ctx.font = NAMES;
		ctx.fillStyle = INK;
		ctx.strokeStyle = '#000';
		ctx.lineWidth = 4;
		ctx.lineJoin = 'round';
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'left';
		const bounds = { width: c.width, height: c.height };
		spots.forEach(([x, y], i) => {
			const own = names[i];
			const forced = !own && cityFocus[i] > 0.01 ? placeLabels([labelItem(i, true)], [], bounds)[0] : null;
			const box = own ?? (forced && { ...forced, x: forced.x - x, y: forced.y - y });
			if (!box) return;
			const base = own ? (plan.cities[i].home ? 0.92 : 0.66) : 0;
			const alpha = (base + (1 - base) * cityFocus[i]) * dim(lit[i]);
			copies(x, x, pan, (dx) => write(ctx, plan.cities[i].name, x + dx + box.x, y + box.y + box.h / 2, alpha));
		});
		ctx.textAlign = 'center';
		arcs.forEach((arc, r) => {
			if (routeFocus[r] < 0.01) return;
			const [x, y] = along(arc, 0.5);
			copies(x, x, pan, (dx) => write(ctx, arc.route.label, x + dx, y - nameHeight, routeFocus[r]));
		});
		ctx.globalAlpha = 1;
	};

	const { c, stop } = createCanvas2D(el, { draw, resize });
	if (!c) return stop;
	const unwatch = watchColors(el, (next) => {
		plan = planRoutes({ ...config, colors: next.colors });
		layArcs(c.ctx);
		if (c.still) draw(c, performance.now(), 0);
	});
	return () => {
		stop();
		unwatch();
		for (const canvas of strips.values()) if (canvas) canvas.width = 0;
		strips.clear();
	};
}

/**
 * How far a point is from one piece of a path.
 *
 * @param {number} px The point, CSS px across.
 * @param {number} py The point, CSS px down.
 * @param {Float32Array} points The path, x and y in turn.
 * @param {number} s The piece: from point `s` to point `s + 1`.
 * @returns {number} The distance, CSS px.
 */
function toSegment(px, py, points, s) {
	const ax = points[s * 2];
	const ay = points[s * 2 + 1];
	const bx = points[s * 2 + 2] - ax;
	const by = points[s * 2 + 3] - ay;
	const t = Math.min(1, Math.max(0, ((px - ax) * bx + (py - ay) * by) / (bx * bx + by * by || 1)));
	return Math.hypot(px - ax - bx * t, py - ay - by * t);
}
