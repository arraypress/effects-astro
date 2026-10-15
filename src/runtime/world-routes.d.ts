import type { PaletteName } from './palettes.js';
import type { Place, RouteSpec } from './world-plan.js';
import type { Bounds, RegionName } from './world-map.js';

export { CITIES } from './world-plan.js';
export type { CityKey, Place, Route, RouteSpec } from './world-plan.js';
export type { Bounds, RegionName } from './world-map.js';

export interface WorldRoutesConfig {
	/** The routes: `[from, to]`, a place alone (from `home`), or `{ from, to, color, label, speed, width, dashed }`. A place is a key of CITIES, [degrees north, degrees east], or `{ name, lat, lon }`. Default ten routes round the world, or, with a `home`, routes from it to ten cities round the world. */
	routes?: RouteSpec[];
	/** A hub: routes with no `from` start here, and it is marked out with a ring and a halo. Default none. */
	home?: Place;
	/** The routes' colour. Default `#38bdf8`. */
	color?: string;
	/** A palette in place of `color`: each city takes the next colour in the order they appear (a home city takes the first and keeps it), and each route the colour of the city it runs to. Default none. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** Blend each route from its origin's colour to its destination's, in Oklab (with `colors`). Default false. */
	gradient?: boolean;
	/** The land dots' colour, and the names'. Default `#ffffff`. */
	land?: string;
	/** The land dots' opacity. Default 0.18. */
	landOpacity?: number;
	/** Space between land dots, CSS px. Default 7. */
	pitch?: number;
	/** A land dot's radius, CSS px. Default 1.4. */
	dot?: number;
	/** The land dots' shape: `round` or `square`. Default `round`. */
	dotShape?: 'round' | 'square';
	/** Faint lines of latitude and longitude, in dots: true for every 30°, or the degrees between them. Default false. */
	graticule?: boolean | number;
	/** What the map shows: `world`, `europe`, `north-america`, `south-america`, `africa`, `middle-east`, `asia`, `oceania`, `routes` (fitted round the cities and the arcs between them), or [[south, west], [north, east]]. Default `world`. */
	region?: RegionName | 'routes' | Bounds;
	/** `contain` shows all of the region; `cover` fills the box with it. Default `contain`. */
	fit?: 'contain' | 'cover';
	/** Pan the map east this many degrees a second (negative for west), round and round the world. Default 0. */
	drift?: number;
	/** Seconds a comet takes along a route. Default 3.2. */
	lap?: number;
	/** How high the arcs bow, a share of their length. Default 0.3, or 0.08 with a great-circle `curve`. */
	lift?: number;
	/** `bow`: arcs bow up between the cities. `great-circle`: they follow the shortest way over the globe, over the date line where that is shorter. Default `bow`. */
	curve?: 'bow' | 'great-circle';
	/** The faint arcs' opacity. Default 0.14. */
	arcOpacity?: number;
	/** Dash the faint arcs, the dashes running from origin to destination. Default false. */
	dashed?: boolean;
	/** The comets' width, CSS px; the faint arcs are a line half as wide. Default 2.2. */
	width?: number;
	/** A comet's length, a share of its route. Default 0.28. */
	tail?: number;
	/** The glow round a comet's head, CSS px; 0 for none. Default 10. */
	glow?: number;
	/** Comets on each route at once. Default 1. */
	comets?: number;
	/** How wide the ring a landing comet opens grows, CSS px; 0 for none. Default 17. */
	ping?: number;
	/** Mark the cities with a dot. Default true. */
	markers?: boolean;
	/** A city dot's radius, CSS px. Default 2.2. */
	markerSize?: number;
	/** A soft halo breathing round every city (the home city always has one). Default false. */
	halo?: boolean;
	/** Name the cities, leaving out names that would overlap (hovering a city names it either way). Default false. */
	labels?: boolean;
	/** The names' CSS font. Default `500 11px system-ui, sans-serif`. */
	font?: string;
	/** Hovering a city or a route (not through a link or button) brightens it and names it. Default true. */
	interactive?: boolean;
}

/** Starts a dotted world map with comets running between cities in `el`'s canvas. Returns a function that stops it. */
export function worldRoutes(el: HTMLElement, config: WorldRoutesConfig): () => void;
