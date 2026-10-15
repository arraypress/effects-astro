/** Two corners, [[south, west], [north, east]], in degrees. */
export type Bounds = [[number, number], [number, number]];

/** Bounds with `east` past `west` (above 180 when crossing the date line). */
export interface Box {
	south: number;
	west: number;
	north: number;
	east: number;
}

/** A region the map can show by name. */
export type RegionName = 'world' | 'europe' | 'north-america' | 'south-america' | 'africa' | 'middle-east' | 'asia' | 'oceania';

/** Named regions, as [[south, west], [north, east]]. */
export const REGIONS: Record<RegionName, Bounds>;

/** A longitude brought into [-180, 180). */
export function wrapLon(lon: number): number;

/** The box a region names (unknown names are the world), or with `routes` the smallest round `places`, the short way round. */
export function regionBounds(region: RegionName | 'routes' | Bounds | undefined, places?: [number, number][]): Box;

/** A box fitted into a width and height. */
export interface MapView {
	width: number;
	height: number;
	/** CSS px a degree of latitude. */
	scale: number;
	/** cos(standard parallel): a degree of longitude is `scale * squash` px. */
	squash: number;
	/** The place at the box's middle. */
	lat: number;
	lon: number;
	/** CSS px once round the world. */
	period: number;
	/** Where the region's north edge falls, CSS px down. */
	top: number;
}

/** Fits a box into a width and height: all of it (`contain`, the default) or filling it (`cover`). */
export function fitView(box: Box, width: number, height: number, fit?: 'contain' | 'cover'): MapView;

/** Where a place falls on the unpanned map, CSS px: on the turn of the world centred on the view. */
export function project(view: MapView, lat: number, lon: number): [number, number];

/** The place at a point on the unpanned map, [lat, lon] (longitude not wrapped). */
export function unproject(view: MapView, x: number, y: number): [number, number];

/** `steps + 1` points [lat, lon] along the great circle between two places, longitudes unbroken from the first. */
export function greatCircle(from: [number, number], to: [number, number], steps: number): [number, number][];

/** How the land is painted. */
export interface LandStyle {
	color: string;
	opacity: number;
	/** Space between dots, CSS px. */
	pitch: number;
	/** A dot's radius (half its side, square), CSS px. */
	dot: number;
	shape: 'round' | 'square';
	/** Degrees between graticule lines, 0 for none. */
	graticule: number;
	/** Repeat the world round, rather than one turn of it. */
	wrap: boolean;
}

/** Paints the land dots (and graticule) for the strip of the unpanned map from `left`, `width` CSS px wide, into `ctx` at 0. */
export function paintLand(ctx: CanvasRenderingContext2D, view: MapView, style: LandStyle, left: number, width: number): void;
