/**
 * @module @arraypress/effects-astro/world-plan
 *
 * <WorldRoutes>'s settings turned into what it draws: the cities, each
 * once, with a name and a colour, and the routes between them, each with
 * the colours along it, its label, speed, width and dash.
 *
 * Colours: every city takes the next colour of the palette in the order
 * the cities first appear (a home city takes the first, and keeps it to
 * itself), and a route is the colour of the city it runs to; with `gradient`, it blends from its
 * origin's colour to its destination's, in Oklab. A route's own `color`
 * is its colour, and its destination's if nothing coloured that first.
 */

import { mixOklab, parseColor, toHex } from './color.js';
import { pickColors } from './palettes.js';

/** Cities a route can name, as [degrees north, degrees east]. */
export const CITIES = {
	amsterdam: [52.37, 4.9],
	athens: [37.98, 23.73],
	auckland: [-36.85, 174.76],
	bangalore: [12.97, 77.59],
	bangkok: [13.76, 100.5],
	barcelona: [41.39, 2.17],
	berlin: [52.52, 13.4],
	bogota: [4.71, -74.07],
	boston: [42.36, -71.06],
	brussels: [50.85, 4.35],
	'buenos-aires': [-34.6, -58.38],
	cairo: [30.04, 31.24],
	'cape-town': [-33.92, 18.42],
	chicago: [41.88, -87.63],
	copenhagen: [55.68, 12.57],
	delhi: [28.61, 77.21],
	denver: [39.74, -104.99],
	dubai: [25.2, 55.27],
	dublin: [53.35, -6.26],
	edinburgh: [55.95, -3.19],
	helsinki: [60.17, 24.94],
	'hong-kong': [22.32, 114.17],
	istanbul: [41.01, 28.98],
	jakarta: [-6.2, 106.85],
	johannesburg: [-26.2, 28.05],
	'kuala-lumpur': [3.14, 101.69],
	lagos: [6.52, 3.38],
	lima: [-12.05, -77.04],
	lisbon: [38.72, -9.14],
	london: [51.51, -0.13],
	'los-angeles': [34.05, -118.24],
	madrid: [40.42, -3.7],
	manchester: [53.48, -2.24],
	manila: [14.6, 120.98],
	melbourne: [-37.81, 144.96],
	'mexico-city': [19.43, -99.13],
	miami: [25.76, -80.19],
	milan: [45.46, 9.19],
	montreal: [45.5, -73.57],
	mumbai: [19.08, 72.88],
	munich: [48.14, 11.58],
	nairobi: [-1.29, 36.82],
	'new-york': [40.71, -74.01],
	osaka: [34.69, 135.5],
	oslo: [59.91, 10.75],
	paris: [48.86, 2.35],
	prague: [50.08, 14.44],
	reykjavik: [64.15, -21.94],
	riyadh: [24.71, 46.68],
	rome: [41.9, 12.5],
	'san-francisco': [37.77, -122.42],
	santiago: [-33.45, -70.67],
	'sao-paulo': [-23.55, -46.63],
	seattle: [47.61, -122.33],
	seoul: [37.57, 126.98],
	shanghai: [31.23, 121.47],
	singapore: [1.35, 103.82],
	stockholm: [59.33, 18.07],
	sydney: [-33.87, 151.21],
	taipei: [25.03, 121.57],
	tokyo: [35.68, 139.69],
	toronto: [43.65, -79.38],
	vancouver: [49.28, -123.12],
	vienna: [48.21, 16.37],
	warsaw: [52.23, 21.01],
	zurich: [47.38, 8.54],
};

/** Names that are not just the key in title case. */
const NAMES = /** @type {Record<string, string>} */ ({ bogota: 'Bogotá', reykjavik: 'Reykjavík', 'sao-paulo': 'São Paulo', zurich: 'Zürich' });

/** @typedef {keyof typeof CITIES | [number, number] | { name: string, lat: number, lon: number }} Place */

/**
 * @typedef {object} Route
 * @property {Place} [from] Where it starts. Default the home city.
 * @property {Place} to Where it ends.
 * @property {string} [color] Its colour.
 * @property {string} [label] What hovering it shows. Default "From → To".
 * @property {number} [speed] How fast its comets run, times the usual.
 * @property {number} [width] Its comets' width, CSS px.
 * @property {boolean} [dashed] Dash its faint arc.
 */

/** @typedef {[Place, Place] | Route | Place} RouteSpec */

/**
 * @typedef {object} PlanOptions
 * @property {RouteSpec[]} [routes] The routes.
 * @property {Place} [home] The city every route without a `from` starts at.
 * @property {string} [color] One colour for everything.
 * @property {string[]} [colors] A palette, used in place of `color`.
 * @property {boolean} [gradient] Blend each route from its origin's colour to its destination's.
 * @property {number} [width] The comets' width, CSS px.
 * @property {boolean} [dashed] Dash the faint arcs.
 */

/**
 * @typedef {object} PlannedCity
 * @property {string} id Its key, its name, or its coordinates.
 * @property {string} name What its label says.
 * @property {number} lat Degrees north.
 * @property {number} lon Degrees east.
 * @property {boolean} home Whether it is the home city.
 * @property {string} color Its colour.
 * @property {number} routes How many routes start or end there.
 */

/**
 * @typedef {object} PlannedRoute
 * @property {number} from The city it starts at (an index into `cities`).
 * @property {number} to The city it ends at.
 * @property {string[]} ramp Its colour from start to end, RAMP + 1 steps (all the same without a gradient).
 * @property {string[]} cores The same, nearer white, for the comets' heads.
 * @property {string} label What hovering it shows.
 * @property {number} speed How fast its comets run, times the usual.
 * @property {number} width Its comets' width, CSS px.
 * @property {boolean} dashed Whether its faint arc is dashed.
 * @property {number} offset Where in its lap it starts, 0–1, so the comets do not all leave at once.
 */

/** The routes' colour when none is given. */
export const DEFAULT_COLOR = '#38bdf8';

/** Steps in a route's colour ramp. */
export const RAMP = 16;

/**
 * Ten routes round the world: the map with no routes given.
 *
 * @type {RouteSpec[]}
 */
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

/** Where routes from a home city run when none are given. */
const SPOKES = /** @type {const} */ (['new-york', 'sao-paulo', 'lagos', 'dubai', 'mumbai', 'singapore', 'tokyo', 'sydney', 'los-angeles', 'cape-town']);

/**
 * A city's key as a name: `new-york` is New York.
 *
 * @param {string} key The key.
 * @returns {string} The name.
 */
export function cityName(key) {
	return NAMES[key] ?? key.replace(/(^|-)(\w)/g, (_, dash, c) => (dash ? ' ' : '') + c.toUpperCase());
}

/**
 * Is it a place, rather than a route?
 *
 * @param {unknown} value A route as given.
 * @returns {value is Place} True for a key, [lat, lon], or { name, lat, lon }.
 */
const isPlace = (value) =>
	typeof value === 'string' ||
	(Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') ||
	(!!value && typeof value === 'object' && !Array.isArray(value) && 'lat' in value && 'lon' in value);

/**
 * Where a place is, and what it is called.
 *
 * @param {Place | undefined} place A city's key, [lat, lon], or { name, lat, lon }.
 * @returns {{ id: string, name: string, lat: number, lon: number } | null} The place, or null for an unknown city or bad coordinates.
 */
export function resolvePlace(place) {
	if (typeof place === 'string') {
		const at = /** @type {Record<string, number[]>} */ (CITIES)[place];
		return at ? { id: place, name: cityName(place), lat: at[0], lon: at[1] } : null;
	}
	if (Array.isArray(place)) {
		const [lat, lon] = place;
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
		const name = `${Math.abs(lat).toFixed(1)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(1)}°${lon < 0 ? 'W' : 'E'}`;
		return { id: `${lat},${lon}`, name, lat, lon };
	}
	if (place && Number.isFinite(place.lat) && Number.isFinite(place.lon)) {
		return { id: `@${place.name}`, name: String(place.name ?? ''), lat: place.lat, lon: place.lon };
	}
	return null;
}

/**
 * A route as given, in one shape.
 *
 * @param {RouteSpec} spec `[from, to]`, a place (from home), or a route object.
 * @returns {Route | null} The route, or null when it is not one.
 */
export function normalizeRoute(spec) {
	if (isPlace(spec)) return { to: spec };
	if (Array.isArray(spec)) return spec.length >= 2 ? { from: spec[0], to: spec[1] } : null;
	return spec && typeof spec === 'object' && 'to' in spec ? spec : null;
}

/**
 * A colour as CSS, and as channels when it is hex (so it can be blended).
 *
 * @param {string} css Any CSS colour.
 * @returns {{ css: string, rgb: import('./color.js').Rgb | null }} The colour.
 */
function readPaint(css) {
	try {
		return { css, rgb: parseColor(css) };
	} catch {
		return { css, rgb: null };
	}
}

/**
 * The colours along a route, blended in Oklab.
 *
 * @param {string} from Its colour at the start.
 * @param {string} to Its colour at the end.
 * @param {number} toward How far each step is pulled toward white, 0–1 (heads are hotter than tails).
 * @returns {string[]} RAMP + 1 colours. Without hex at both ends, there is no blend: every step is `to`.
 */
export function colorRamp(from, to, toward = 0) {
	const a = readPaint(from);
	const b = readPaint(to);
	if (!a.rgb || !b.rgb) {
		const solid = b.rgb && toward ? toHex(mixOklab(b.rgb, [1, 1, 1], toward)) : to;
		return Array.from({ length: RAMP + 1 }, () => solid);
	}
	const [start, end] = [a.rgb, b.rgb];
	return Array.from({ length: RAMP + 1 }, (_, i) => {
		const c = mixOklab(start, end, i / RAMP);
		return toHex(toward ? mixOklab(c, [1, 1, 1], toward) : c);
	});
}

/**
 * The cities and routes to draw.
 *
 * @param {PlanOptions} options The settings.
 * @returns {{ cities: PlannedCity[], routes: PlannedRoute[] }} Each city once, in the order they appear (home first), and each route that has two known places.
 */
export function planRoutes(options) {
	const palette = pickColors(options, [options.color ?? DEFAULT_COLOR]);
	const home = resolvePlace(options.home);
	/** @type {PlannedCity[]} */
	const cities = [];
	/** @type {Map<string, number>} */
	const index = new Map();
	/** Cities whose colour a route has set, so the first route to set it wins. */
	const set = new Set();

	/**
	 * A place's index among the cities, adding it the first time.
	 *
	 * @param {{ id: string, name: string, lat: number, lon: number }} place The place.
	 * @returns {number} Its index.
	 */
	const add = (place) => {
		const known = index.get(place.id);
		if (known !== undefined) return known;
		const i = cities.length;
		// The home city keeps the first colour to itself; the rest go round the others.
		const shared = !home || palette.length < 2 ? i % palette.length : i && 1 + ((i - 1) % (palette.length - 1));
		cities.push({ ...place, home: place.id === home?.id, color: palette[shared], routes: 0 });
		index.set(place.id, i);
		return i;
	};

	if (home) add(home);
	const given = options.routes ?? (home ? SPOKES.filter((key) => key !== home.id) : ROUTES);
	/** @type {{ from: number, to: number, route: Route, i: number }[]} */
	const pending = [];
	given.forEach((spec, i) => {
		const route = normalizeRoute(spec);
		const to = resolvePlace(route?.to);
		if (!route || !to) return;
		const from = route.from === undefined ? home : resolvePlace(route.from);
		if (route.from !== undefined && !from) return;
		const a = from ? add(from) : -1;
		const b = add(to);
		if (a < 0 || a === b) return;
		pending.push({ from: a, to: b, route, i });
		if (route.color && !set.has(b)) {
			cities[b].color = route.color;
			set.add(b);
		}
	});

	const routes = pending.map(({ from, to, route, i }) => {
		cities[from].routes++;
		cities[to].routes++;
		const end = route.color ?? cities[to].color;
		const startColor = options.gradient ? cities[from].color : end;
		const speed = Number(route.speed);
		const width = Number(route.width ?? options.width);
		return {
			from,
			to,
			ramp: colorRamp(startColor, end),
			cores: colorRamp(startColor, end, 0.55),
			label: route.label ?? `${cities[from].name} → ${cities[to].name}`,
			speed: speed > 0 ? speed : 1,
			width: width > 0 ? width : 2.2,
			dashed: route.dashed ?? options.dashed ?? false,
			offset: (i * 0.37) % 1,
		};
	});
	return { cities, routes };
}
