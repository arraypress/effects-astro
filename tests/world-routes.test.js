import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CITIES, RAMP, DEFAULT_COLOR, cityName, colorRamp, normalizeRoute, planRoutes, resolvePlace } from '../src/runtime/world-plan.js';
import { REGIONS, fitView, greatCircle, project, regionBounds, unproject, wrapLon } from '../src/runtime/world-map.js';
import { placeLabels } from '../src/runtime/world-labels.js';
import { LAND, isLand, landAt } from '../src/runtime/world-land.js';
import { mixOklab, parseColor, toHex } from '../src/runtime/color.js';
import * as routes from '../src/runtime/world-routes.js';

/**
 * Asserts two numbers match to within a tolerance.
 *
 * @param {number} actual The number got.
 * @param {number} expected The number wanted.
 * @param {number} [within=1e-6] How close is close enough.
 */
const near = (actual, expected, within = 1e-6) => assert.ok(Math.abs(actual - expected) <= within, `${actual} ≉ ${expected}`);

test('the cities are still exported from world-routes, and their keys match the types', () => {
	assert.equal(routes.CITIES, CITIES);
	const types = readFileSync(new URL('../src/runtime/world-plan.d.ts', import.meta.url), 'utf8');
	const union = types.slice(types.indexOf('export type CityKey'), types.indexOf(';', types.indexOf('export type CityKey')));
	assert.deepEqual([...union.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort(), Object.keys(CITIES).sort());
	for (const [lat, lon] of Object.values(CITIES)) assert.ok(Math.abs(lat) <= 90 && Math.abs(lon) <= 180);
});

test('city names are the key in title case, with the accents some need', () => {
	assert.equal(cityName('new-york'), 'New York');
	assert.equal(cityName('london'), 'London');
	assert.equal(cityName('sao-paulo'), 'São Paulo');
	assert.equal(cityName('zurich'), 'Zürich');
});

test('a place is a key, coordinates or a named point; anything else is unknown', () => {
	assert.deepEqual(resolvePlace('tokyo'), { id: 'tokyo', name: 'Tokyo', lat: 35.68, lon: 139.69 });
	assert.deepEqual(resolvePlace([-33.9, 18.4]), { id: '-33.9,18.4', name: '33.9°S 18.4°E', lat: -33.9, lon: 18.4 });
	assert.deepEqual(resolvePlace({ name: 'Reykjavík', lat: 64.15, lon: -21.94 }), { id: '@Reykjavík', name: 'Reykjavík', lat: 64.15, lon: -21.94 });
	assert.equal(resolvePlace(/** @type {any} */ ('atlantis')), null);
	assert.equal(resolvePlace(/** @type {any} */ ([Number.NaN, 0])), null);
	assert.equal(resolvePlace(undefined), null);
});

test('routes come as pairs, objects or a lone place, all in one shape', () => {
	assert.deepEqual(normalizeRoute(['london', 'tokyo']), { from: 'london', to: 'tokyo' });
	assert.deepEqual(normalizeRoute([[51.5, 0], 'tokyo']), { from: [51.5, 0], to: 'tokyo' });
	assert.deepEqual(normalizeRoute('tokyo'), { to: 'tokyo' });
	assert.deepEqual(normalizeRoute([35.7, 139.7]), { to: [35.7, 139.7] });
	assert.deepEqual(normalizeRoute({ name: 'Here', lat: 1, lon: 2 }), { to: { name: 'Here', lat: 1, lon: 2 } });
	const route = { from: 'paris', to: 'rome', color: '#f00', speed: 2 };
	assert.equal(normalizeRoute(/** @type {any} */ (route)), route);
	assert.equal(normalizeRoute(/** @type {any} */ (['london'])), null);
	assert.equal(normalizeRoute(/** @type {any} */ (null)), null);
	assert.equal(normalizeRoute(/** @type {any} */ ({ from: 'paris' })), null);
});

test('the default map is the ten routes it always was, in one colour', () => {
	const { cities, routes: planned } = planRoutes({});
	assert.equal(planned.length, 10);
	assert.equal(cities[planned[0].from].id, 'new-york');
	assert.equal(cities[planned[0].to].id, 'london');
	assert.ok(planned.every((r) => r.ramp.every((c) => c === DEFAULT_COLOR)));
	assert.deepEqual(planned.slice(0, 3).map((r) => r.offset), [0, 0.37, 0.74]);
	assert.ok(planned.every((r) => r.speed === 1 && r.width === 2.2 && r.dashed === false));
	assert.equal(planned[0].label, 'New York → London');
});

test('a home city is first, every place alone runs from it, and with no routes it gets spokes', () => {
	const { cities, routes: planned } = planRoutes({ home: 'edinburgh', routes: ['tokyo', ['paris', 'rome'], { to: 'lagos', label: 'Lagos, by Friday' }] });
	assert.equal(cities[0].id, 'edinburgh');
	assert.ok(cities[0].home && !cities[1].home);
	assert.deepEqual(planned.map((r) => [cities[r.from].id, cities[r.to].id]), [['edinburgh', 'tokyo'], ['paris', 'rome'], ['edinburgh', 'lagos']]);
	assert.equal(planned[2].label, 'Lagos, by Friday');
	assert.equal(cities[0].routes, 2);

	const spokes = planRoutes({ home: 'tokyo' });
	assert.equal(spokes.routes.length, 9);
	assert.ok(spokes.routes.every((r) => r.from === 0 && spokes.cities[r.to].id !== 'tokyo'));
});

test('without a home, a place alone is a city with no route; routes to unknown places, or to themselves, are dropped', () => {
	const { cities, routes: planned } = planRoutes({ routes: ['oslo', ['london', 'atlantis'], ['paris', 'paris'], ['paris', 'rome']] });
	assert.deepEqual(cities.map((c) => c.id), ['oslo', 'paris', 'rome']);
	assert.equal(planned.length, 1);
	assert.equal(cities[0].routes, 0);
});

test('a palette colours the cities in order (home keeps the first), and each route the city it runs to', () => {
	const colors = ['#ffffff', '#ff0000', '#00ff00'];
	const { cities, routes: planned } = planRoutes({ home: 'london', routes: ['tokyo', 'sydney', 'lima'], colors });
	// The home city keeps the first colour; the others go round the rest.
	assert.deepEqual(cities.map((c) => c.color), ['#ffffff', '#ff0000', '#00ff00', '#ff0000']);
	assert.deepEqual(planned.map((r) => r.ramp[0]), ['#ff0000', '#00ff00', '#ff0000']);
	// Without a home, every city takes the next colour in turn.
	const open = planRoutes({ routes: [['london', 'tokyo'], ['paris', 'rome']], colors });
	assert.deepEqual(open.cities.map((c) => c.color), ['#ffffff', '#ff0000', '#00ff00', '#ffffff']);
	assert.ok(planned.every((r) => r.ramp.every((c) => c === r.ramp[0])));
});

test('a route\'s own colour is its colour, and its destination\'s if nothing set that first', () => {
	const { cities, routes: planned } = planRoutes({
		home: 'london',
		routes: [{ to: 'tokyo', color: '#f97316' }, { from: 'paris', to: 'tokyo', color: '#0ea5e9' }, 'sydney'],
		colors: ['#ffffff', '#ff0000'],
	});
	assert.equal(cities[1].color, '#f97316');
	assert.deepEqual(planned.map((r) => r.ramp[RAMP]), ['#f97316', '#0ea5e9', cities[3].color]);
});

test('a gradient runs from the origin\'s colour to the destination\'s, blended in Oklab', () => {
	const { routes: planned } = planRoutes({ home: 'london', routes: ['tokyo'], colors: ['#ffffff', '#0000ff'], gradient: true });
	const [route] = planned;
	assert.equal(route.ramp.length, RAMP + 1);
	assert.equal(route.ramp[0], '#ffffff');
	assert.equal(route.ramp[RAMP], '#0000ff');
	assert.equal(route.ramp[RAMP / 2], toHex(mixOklab(parseColor('#ffffff'), parseColor('#0000ff'), 0.5)));
	// The heads run hotter: the same blend pulled toward white.
	assert.equal(route.cores[RAMP], toHex(mixOklab(parseColor('#0000ff'), [1, 1, 1], 0.55)));
});

test('colours that are not hex are kept as they are, with no blend', () => {
	assert.deepEqual(new Set(colorRamp('tomato', 'rgb(0 0 255)')), new Set(['rgb(0 0 255)']));
	assert.deepEqual(new Set(colorRamp('tomato', '#0000ff')), new Set(['#0000ff']));
	const { routes: planned } = planRoutes({ routes: [['london', 'paris']], color: 'hsl(20 90% 60%)' });
	assert.equal(planned[0].ramp[0], 'hsl(20 90% 60%)');
});

test('regions: names, boxes (over the date line too), and unknown names as the world', () => {
	assert.deepEqual(regionBounds('world'), { south: -60, west: -180, north: 84, east: 180 });
	assert.deepEqual(regionBounds(undefined), regionBounds('world'));
	assert.deepEqual(regionBounds(/** @type {any} */ ('narnia')), regionBounds('world'));
	assert.deepEqual(regionBounds('europe'), { south: 35, west: -12, north: 66, east: 36 });
	assert.deepEqual(regionBounds([[60, -10], [35, 30]]), { south: 35, west: -10, north: 60, east: 30 });
	assert.deepEqual(regionBounds([[-50, 110], [60, -100]]), { south: -50, west: 110, north: 60, east: 260 });
	for (const [[s, w], [n, e]] of Object.values(REGIONS)) assert.ok(s < n && w < e);
});

test('a region fitted round the routes takes the short way round, with a margin', () => {
	const europe = regionBounds('routes', [CITIES.london, CITIES.rome, CITIES.warsaw].map(([a, b]) => [a, b]));
	assert.ok(europe.west < CITIES.london[1] && europe.east > CITIES.warsaw[1]);
	assert.ok(europe.south < CITIES.rome[0] && europe.north > CITIES.warsaw[0]);
	// Tokyo to Los Angeles is shorter over the Pacific: the box crosses the date line.
	const pacific = regionBounds('routes', [CITIES.tokyo, CITIES['los-angeles']].map(([a, b]) => [a, b]));
	assert.ok(pacific.west < 139.69 && pacific.east > 360 - 118.24 && pacific.east - pacific.west < 180);
	// Places all round the world are the world; none at all is the world too.
	assert.deepEqual(regionBounds('routes', [-180, -135, -90, -45, 0, 45, 90, 135].map((lon) => [0, lon])), regionBounds('world'));
	assert.deepEqual(regionBounds('routes', []), regionBounds('world'));
	// One city still gets a box round it.
	const one = regionBounds('routes', [[50, 10]]);
	assert.ok(one.east - one.west >= 16 && one.north - one.south >= 10);
});

test('the world fits as it always did: plate carrée, contained and centred', () => {
	const view = fitView(regionBounds('world'), 1000, 500);
	assert.equal(view.squash, 1);
	near(view.scale, Math.min(1000 / 360, 500 / 144));
	near(view.period, 1000);
	const frameHeight = 144 * view.scale;
	near(view.top, (500 - frameHeight) / 2);
	// The old projection: x from 180°W across the frame, y from 84°N down it.
	const [x, y] = project(view, 51.51, -0.13);
	near(x, ((-0.13 + 180) / 360) * 1000);
	near(y, (500 - frameHeight) / 2 + ((84 - 51.51) / 144) * frameHeight);
});

test('a region is fitted round its middle latitude, contained or covering', () => {
	const box = regionBounds('europe');
	const contain = fitView(box, 1200, 600);
	const cover = fitView(box, 1200, 600, 'cover');
	near(contain.squash, Math.cos((50.5 * Math.PI) / 180));
	assert.ok(cover.scale > contain.scale);
	const spanX = (box.east - box.west) * contain.scale * contain.squash;
	const spanY = (box.north - box.south) * contain.scale;
	assert.ok(spanX <= 1200 + 1e-9 && spanY <= 600 + 1e-9);
	assert.ok(Math.abs(spanX - 1200) < 1e-9 || Math.abs(spanY - 600) < 1e-9);
	const [cx, cy] = project(contain, (box.north + box.south) / 2, (box.west + box.east) / 2);
	near(cx, 600);
	near(cy, 300);
});

test('project and unproject undo each other, and longitudes wrap onto the turn of the world in view', () => {
	const view = fitView(regionBounds('europe'), 900, 700, 'cover');
	const [x, y] = project(view, 48.86, 2.35);
	const [lat, lon] = unproject(view, x, y);
	near(lat, 48.86, 1e-9);
	near(lon, 2.35, 1e-9);
	// 361° east is 1° east.
	assert.deepEqual(project(view, 10, 361).map((v) => v.toFixed(6)), project(view, 10, 1).map((v) => v.toFixed(6)));
	assert.equal(wrapLon(180), -180);
	assert.equal(wrapLon(-190), 170);
});

test('a great circle runs between its ends, bows toward the pole, and crosses the date line unbroken', () => {
	const path = greatCircle([CITIES.london[0], CITIES.london[1]], [CITIES['new-york'][0], CITIES['new-york'][1]], 32);
	assert.equal(path.length, 33);
	near(path[0][0], 51.51, 1e-9);
	near(path[32][1], -74.01, 1e-9);
	assert.ok(path[16][0] > 51.51, 'London to New York goes north of both');
	const pacific = greatCircle([35.68, 139.69], [34.05, -118.24], 32);
	near(pacific[32][1], 360 - 118.24, 1e-6);
	for (let i = 1; i < pacific.length; i++) assert.ok(Math.abs(pacific[i][1] - pacific[i - 1][1]) < 20);
	// The same place twice is a point, not NaN.
	assert.ok(greatCircle([10, 10], [10, 10], 4).every(([a, b]) => a === 10 && b === 10));
});

test('names go beside their city, move aside for others, and are left out with nowhere to go', () => {
	const item = { x: 100, y: 100, w: 40, h: 10, gap: 6 };
	assert.deepEqual(placeLabels([item], [], null), [{ x: 106, y: 95, w: 40, h: 10 }]);
	// Two cities side by side: the first name covers both of the second's sides, so it goes above.
	const [a, b] = placeLabels([item, { ...item, x: 120 }], [], null);
	assert.deepEqual(a, { x: 106, y: 95, w: 40, h: 10 });
	assert.deepEqual(b, { x: 100, y: 84, w: 40, h: 10 });
	// Another city's dot to the right: the name takes the left.
	assert.deepEqual(placeLabels([{ ...item, x: 200 }], [{ x: 220, y: 98, w: 4, h: 4 }], null)[0], { x: 154, y: 95, w: 40, h: 10 });
	// At the box's right edge it goes left; with every side blocked it is left out, unless forced.
	assert.equal(placeLabels([{ ...item, x: 190 }], [], { width: 200, height: 200 })[0]?.x, 190 - 6 - 40);
	const wall = [{ x: 0, y: 0, w: 300, h: 300 }];
	assert.deepEqual(placeLabels([item], wall, null), [null]);
	assert.deepEqual(placeLabels([{ ...item, force: true }], wall, null), [{ x: 106, y: 95, w: 40, h: 10 }]);
});

test('the land sampler agrees with the cells at their centres and blends between them', () => {
	assert.equal(isLand(51.5, -0.13), true);
	assert.equal(isLand(40, -30), false);
	assert.equal(isLand(35, 180), isLand(35, -180));
	for (const [lat, lon] of [[48.75, 9.75], [40.25, -30.25], [-20.25, 134.25]]) assert.equal(landAt(lat, lon), isLand(lat, lon) ? 1 : 0);
	const coast = landAt(51.5, -0.13);
	assert.ok(coast > 0 && coast <= 1);
	assert.equal(landAt(LAND.top + 5, 0), 0);
	assert.equal(landAt(-80, 0), 0);
});
