/** A city a route can name. */
export type CityKey =
	| 'amsterdam' | 'athens' | 'auckland' | 'bangalore' | 'bangkok' | 'barcelona' | 'berlin' | 'bogota'
	| 'boston' | 'brussels' | 'buenos-aires' | 'cairo' | 'cape-town' | 'chicago' | 'copenhagen' | 'delhi'
	| 'denver' | 'dubai' | 'dublin' | 'edinburgh' | 'helsinki' | 'hong-kong' | 'istanbul'
	| 'jakarta' | 'johannesburg' | 'kuala-lumpur' | 'lagos' | 'lima' | 'lisbon' | 'london' | 'los-angeles'
	| 'madrid' | 'manchester' | 'manila' | 'melbourne' | 'mexico-city' | 'miami' | 'milan' | 'montreal'
	| 'mumbai' | 'munich' | 'nairobi' | 'new-york' | 'osaka' | 'oslo' | 'paris' | 'prague' | 'reykjavik'
	| 'riyadh' | 'rome' | 'san-francisco' | 'santiago' | 'sao-paulo' | 'seattle' | 'seoul' | 'shanghai'
	| 'singapore' | 'stockholm' | 'sydney' | 'taipei' | 'tokyo' | 'toronto' | 'vancouver' | 'vienna' | 'warsaw'
	| 'zurich';

/** Cities a route can name, as [degrees north, degrees east]. */
export const CITIES: Record<CityKey, [number, number]>;

/** A city's key, [degrees north, degrees east], or a named point. */
export type Place = CityKey | [number, number] | { name: string; lat: number; lon: number };

/** A route with settings of its own. */
export interface Route {
	/** Where it starts. Default the home city. */
	from?: Place;
	/** Where it ends. */
	to: Place;
	/** Its colour (and its destination's, if nothing coloured that first). */
	color?: string;
	/** What hovering it shows. Default "From → To". */
	label?: string;
	/** How fast its comets run, times the usual. Default 1. */
	speed?: number;
	/** Its comets' width, CSS px. Default the map's `width`. */
	width?: number;
	/** Dash its faint arc. Default the map's `dashed`. */
	dashed?: boolean;
}

/** A route as given: `[from, to]`, a route object, or a place alone (from the home city). */
export type RouteSpec = [Place, Place] | Route | Place;

/** What `planRoutes` reads. */
export interface PlanOptions {
	routes?: RouteSpec[];
	home?: Place;
	color?: string;
	colors?: string[];
	gradient?: boolean;
	width?: number;
	dashed?: boolean;
}

/** A city to draw. */
export interface PlannedCity {
	/** Its key, its name, or its coordinates. */
	id: string;
	/** What its label says. */
	name: string;
	lat: number;
	lon: number;
	home: boolean;
	color: string;
	/** How many routes start or end there. */
	routes: number;
}

/** A route to draw. */
export interface PlannedRoute {
	/** Its cities, as indices into `cities`. */
	from: number;
	to: number;
	/** Its colour from start to end, RAMP + 1 steps. */
	ramp: string[];
	/** The same, nearer white, for the comets' heads. */
	cores: string[];
	label: string;
	speed: number;
	width: number;
	dashed: boolean;
	/** Where in its lap it starts, 0–1. */
	offset: number;
}

/** The routes' colour when none is given: `#38bdf8`. */
export const DEFAULT_COLOR: string;

/** Steps in a route's colour ramp. */
export const RAMP: number;

/** A city's key as a name: `new-york` is New York, `sao-paulo` São Paulo. */
export function cityName(key: string): string;

/** Where a place is and what it is called; null for an unknown city or bad coordinates. */
export function resolvePlace(place: Place | undefined): { id: string; name: string; lat: number; lon: number } | null;

/** A route as given, as a route object; null when it is not one. */
export function normalizeRoute(spec: RouteSpec): Route | null;

/** RAMP + 1 colours from `from` to `to`, blended in Oklab and pulled `toward` white (0–1); solid `to` unless both are hex. */
export function colorRamp(from: string, to: string, toward?: number): string[];

/** The cities (each once, home first) and the routes between known places, with their colours. */
export function planRoutes(options: PlanOptions): { cities: PlannedCity[]; routes: PlannedRoute[] };
