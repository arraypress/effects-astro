/**
 * @module @arraypress/effects-astro/world-map
 *
 * The map under <WorldRoutes>: named regions, fitting one into a box
 * (contain or cover), the projection between degrees and CSS px, great-
 * circle paths, and painting the land dots and a graticule into tiles.
 *
 * The projection is equirectangular. A view of the whole world is the
 * plain plate carrée; a region takes its middle latitude as the standard
 * parallel, so Europe is not stretched wide. Positions are CSS px in the
 * box with the map unpanned; one turn of the world is `period` px across,
 * and the band one turn wide centred on the view is the map that shows
 * when it does not drift.
 */

import { LAND, isLand, landAt } from './world-land.js';

/** @typedef {[[number, number], [number, number]]} Bounds Two corners, [[south, west], [north, east]], in degrees. */
/** @typedef {{ south: number, west: number, north: number, east: number }} Box Bounds with `east` past `west` (above 180 when crossing the date line). */

/** Named regions, as [[south, west], [north, east]]. */
export const REGIONS = /** @type {const} */ ({
	world: [[LAND.top - LAND.rows * LAND.step, -180], [LAND.top, 180]],
	europe: [[35, -12], [66, 36]],
	'north-america': [[12, -138], [62, -52]],
	'south-america': [[-56, -84], [13, -32]],
	africa: [[-36, -19], [38, 53]],
	'middle-east': [[11, 24], [43, 64]],
	asia: [[-11, 60], [56, 150]],
	oceania: [[-48, 110], [-5, 180]],
});

/** @typedef {keyof typeof REGIONS} RegionName A region the map can show by name. */

/** Degrees of the world's land latitude the map covers: 84°N to 60°S. */
const NORTH = LAND.top;
const SOUTH = LAND.top - LAND.rows * LAND.step;

/**
 * A longitude brought into [-180, 180).
 *
 * @param {number} lon Degrees east.
 * @returns {number} The same meridian, in [-180, 180).
 */
export const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

/**
 * The bounds a region names, or that fit a set of places.
 *
 * @param {keyof typeof REGIONS | 'routes' | Bounds | undefined} region A name, `routes`, or [[south, west], [north, east]].
 * @param {[number, number][]} [places=[]] [lat, lon] of every city, for `routes`.
 * @returns {Box} The box, `east` past `west`. Unknown names, and `routes` with no places, are the world.
 */
export function regionBounds(region, places = []) {
	if (Array.isArray(region)) {
		const [[south, west], [north, east]] = region;
		return { south: Math.min(south, north), north: Math.max(south, north), west, east: east > west ? east : east + 360 };
	}
	if (region === 'routes' && places.length) return fitPlaces(places);
	const [[south, west], [north, east]] = REGIONS[/** @type {keyof typeof REGIONS} */ (region)] ?? REGIONS.world;
	return { south, west, north, east };
}

/**
 * The smallest box round some places, with a margin: across the date line
 * when that is the short way round (Tokyo and Los Angeles).
 *
 * @param {[number, number][]} places [lat, lon] of each.
 * @returns {Box} The box.
 */
function fitPlaces(places) {
	const lats = places.map((p) => p[0]);
	const lons = places.map((p) => wrapLon(p[1])).sort((a, b) => a - b);
	// The widest gap between neighbouring meridians (round the back too) is the part left out.
	let gap = lons[0] + 360 - lons[lons.length - 1];
	let west = lons[0];
	for (let i = 1; i < lons.length; i++) {
		if (lons[i] - lons[i - 1] > gap) {
			gap = lons[i] - lons[i - 1];
			west = lons[i];
		}
	}
	const span = 360 - gap;
	if (span > 300) return regionBounds('world');
	const south = Math.min(...lats);
	const north = Math.max(...lats);
	const padLon = Math.max(6, span * 0.12, (16 - span) / 2);
	const padLat = Math.max(4, (north - south) * 0.12, (10 - (north - south)) / 2);
	return {
		south: Math.max(SOUTH, south - padLat),
		north: Math.min(NORTH, north + padLat),
		west: west - padLon,
		east: west + span + padLon,
	};
}

/**
 * @typedef {object} MapView
 * @property {number} width The box's width, CSS px.
 * @property {number} height The box's height, CSS px.
 * @property {number} scale CSS px a degree of latitude.
 * @property {number} squash cos(standard parallel): a degree of longitude is `scale * squash` px.
 * @property {number} lat The latitude at the box's middle.
 * @property {number} lon The longitude at the box's middle.
 * @property {number} period CSS px once round the world.
 * @property {number} top Where the region's north edge falls, CSS px down.
 */

/**
 * Fits bounds into a box.
 *
 * @param {Box} box The region.
 * @param {number} width The box's width, CSS px.
 * @param {number} height The box's height, CSS px.
 * @param {'contain' | 'cover'} [fit='contain'] Show all of the region (`contain`), or fill the box with it (`cover`).
 * @returns {MapView} The view.
 */
export function fitView(box, width, height, fit = 'contain') {
	const spanLon = box.east - box.west;
	const spanLat = box.north - box.south;
	const squash = spanLon >= 300 ? 1 : Math.cos((((box.north + box.south) / 2) * Math.PI) / 180);
	const across = width / (spanLon * squash);
	const down = height / spanLat;
	const scale = fit === 'cover' ? Math.max(across, down) : Math.min(across, down);
	const lat = (box.north + box.south) / 2;
	return {
		width,
		height,
		scale,
		squash,
		lat,
		lon: wrapLon((box.west + box.east) / 2),
		period: 360 * scale * squash,
		top: height / 2 - (box.north - lat) * scale,
	};
}

/**
 * Where a place falls, with the map unpanned: on the turn of the world
 * centred on the view.
 *
 * @param {MapView} view The view.
 * @param {number} lat Degrees north.
 * @param {number} lon Degrees east.
 * @returns {[number, number]} CSS px across and down.
 */
export function project(view, lat, lon) {
	return [view.width / 2 + wrapLon(lon - view.lon) * view.scale * view.squash, view.height / 2 - (lat - view.lat) * view.scale];
}

/**
 * The place at a point, the inverse of `project` (longitude not wrapped).
 *
 * @param {MapView} view The view.
 * @param {number} x CSS px across, unpanned.
 * @param {number} y CSS px down.
 * @returns {[number, number]} [lat, lon] in degrees.
 */
export function unproject(view, x, y) {
	return [view.lat - (y - view.height / 2) / view.scale, view.lon + (x - view.width / 2) / (view.scale * view.squash)];
}

/**
 * Points along the great circle (the shortest way over the globe) between
 * two places, longitudes running on unbroken from the first, so a route
 * over the date line goes past 180° rather than jumping back.
 *
 * @param {[number, number]} from [lat, lon] in degrees.
 * @param {[number, number]} to [lat, lon] in degrees.
 * @param {number} steps How many pieces.
 * @returns {[number, number][]} `steps + 1` points, [lat, lon].
 */
export function greatCircle(from, to, steps) {
	const rad = Math.PI / 180;
	/**
	 * A place as a point on the unit sphere.
	 *
	 * @param {[number, number]} p [lat, lon] in degrees.
	 * @returns {[number, number, number]} x, y, z.
	 */
	const toVector = ([lat, lon]) => [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)];
	const a = toVector(from);
	const b = toVector(to);
	const angle = Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
	/** @type {[number, number][]} */
	const points = [];
	let last = from[1];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		// Antipodes and the same place have no one great circle: run straight in degrees instead.
		const near = Math.sin(angle) < 1e-6;
		const wa = near ? 1 - t : Math.sin((1 - t) * angle) / Math.sin(angle);
		const wb = near ? t : Math.sin(t * angle) / Math.sin(angle);
		const [x, y, z] = [0, 1, 2].map((k) => wa * a[k] + wb * b[k]);
		let lon = near ? from[1] + (to[1] - from[1]) * t : Math.atan2(y, x) / rad;
		lon += Math.round((last - lon) / 360) * 360;
		last = lon;
		points.push([near ? from[0] + (to[0] - from[0]) * t : Math.atan2(z, Math.hypot(x, y)) / rad, lon]);
	}
	return points;
}

/**
 * @typedef {object} LandStyle
 * @property {string} color The dots' colour.
 * @property {number} opacity Their opacity.
 * @property {number} pitch Space between dots, CSS px.
 * @property {number} dot A dot's radius (half its side, square), CSS px.
 * @property {'round' | 'square'} shape The dots' shape.
 * @property {number} graticule Degrees between graticule lines, 0 for none.
 * @property {boolean} wrap Repeat the world round (a drifting map), rather than one turn of it.
 */

/**
 * Paints the land, a dot wherever the grid falls on it, and the graticule
 * as finer dots along the lines, for one strip of the map. The grid is
 * the same in every strip, so strips meet without a seam.
 *
 * @param {CanvasRenderingContext2D} ctx Scaled so units are CSS px, the strip starting at 0.
 * @param {MapView} view The view.
 * @param {LandStyle} style How it looks.
 * @param {number} left The strip's left edge, CSS px across the unpanned map.
 * @param {number} width The strip's width, CSS px.
 */
export function paintLand(ctx, view, style, left, width) {
	const { pitch, dot } = style;
	const band = view.width / 2 - view.period / 2;
	const gx = band + pitch / 2;
	const gy = view.top + pitch / 2;
	// Zoomed in so far that a cell spans several dots, blend the cells for round coasts.
	const smooth = view.scale * view.squash * LAND.step > pitch * 1.5;
	const ys = gridLine(gy, pitch, view.height, dot);
	const xs = gridLine(gx - left, pitch, width, dot);

	/**
	 * Whether a grid point (unpanned CSS px) is on this turn of the map.
	 *
	 * @param {number} x CSS px across.
	 * @returns {boolean} True when it shows.
	 */
	const shows = (x) => style.wrap || (x >= band && x < band + view.period);

	/**
	 * Adds a dot to the path.
	 *
	 * @param {number} x CSS px across the strip.
	 * @param {number} y CSS px down.
	 * @param {number} r Its radius.
	 */
	const mark = (x, y, r) => {
		if (style.shape === 'square') ctx.rect(x - r, y - r, r * 2, r * 2);
		else {
			ctx.moveTo(x + r, y);
			ctx.arc(x, y, r, 0, Math.PI * 2);
		}
	};

	ctx.fillStyle = style.color;
	ctx.globalAlpha = style.opacity;
	ctx.beginPath();
	for (const y of ys) {
		for (const sx of xs) {
			if (!shows(sx + left)) continue;
			const [lat, lon] = unproject(view, sx + left, y);
			if (smooth ? landAt(lat, lon) > 0.5 : isLand(lat, lon)) mark(sx, y, dot);
		}
	}
	ctx.fill();

	if (style.graticule > 0) {
		const g = style.graticule;
		const fine = Math.max(0.5, dot * 0.45);
		ctx.globalAlpha = style.opacity * 0.6;
		ctx.beginPath();
		for (let lat = Math.ceil(SOUTH / g) * g; lat <= NORTH; lat += g) {
			const y = project(view, lat, view.lon)[1];
			if (y < -dot || y > view.height + dot) continue;
			for (let sx = xs[0] ?? 0; sx < width + dot; sx += pitch / 2) if (shows(sx + left)) mark(sx, y, fine);
		}
		const [, west] = unproject(view, left, 0);
		const [, east] = unproject(view, left + width, 0);
		const top = Math.max(0, project(view, NORTH, 0)[1]);
		const bottom = Math.min(view.height, project(view, SOUTH, 0)[1]);
		for (let lon = Math.ceil(west / g) * g; lon <= east; lon += g) {
			const x = view.width / 2 + (lon - view.lon) * view.scale * view.squash;
			if (!shows(x)) continue;
			for (let y = gy + Math.ceil((top - gy) / (pitch / 2)) * (pitch / 2); y <= bottom; y += pitch / 2) mark(x - left, y, fine);
		}
		ctx.fill();
	}
	ctx.globalAlpha = 1;
}

/**
 * The grid's positions along one axis that fall in a span (dots reaching
 * in from either side included).
 *
 * @param {number} origin Where a grid line falls, CSS px from the span's start.
 * @param {number} pitch The spacing.
 * @param {number} length The span.
 * @param {number} reach How far a dot reaches from its centre.
 * @returns {number[]} The positions, from the span's start.
 */
function gridLine(origin, pitch, length, reach) {
	const out = [];
	for (let p = origin + Math.ceil((-reach - origin) / pitch) * pitch; p < length + reach; p += pitch) out.push(p);
	return out;
}
