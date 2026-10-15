/** A lane's centre, from the street's centre line. */
export const LANE: number;
/** Half a junction's width: lanes stop at its edge. */
export const BOX: number;
/** The least a pickup can be ahead of a car on its own lane and still be reached without going round. */
export const AHEAD: number;

/** One direction of a street segment, from the edge of one junction to the edge of the next. Headings are radians from +x towards +z. */
export interface Lane {
	id: number;
	edge: number;
	from: number;
	to: number;
	dx: number;
	dz: number;
	heading: number;
	/** Where its centre line starts. */
	x: number;
	z: number;
	length: number;
	/** The lane the other way on the same segment. */
	reverse: number;
}

/** A way across a junction from one lane into another. */
export interface Turn {
	kind: 'straight' | 'right' | 'left' | 'back';
	node: number;
	length: number;
	at(t: number): { x: number; z: number; heading: number };
}

export interface Roads {
	nodes: { x: number; z: number }[];
	lanes: Lane[];
	/** The lanes leaving each junction. */
	out: number[][];
	/** How many streets meet at each junction. */
	degree: number[];
	edges: { id: number; a: number; b: number; axis: 'x' | 'z' }[];
	/** The turn from lane `a` into lane `b` (cached). */
	turn(a: number, b: number): Turn;
}

/** Builds a lane each way (keeping right) on every open segment. */
export function buildRoads(plan: { nodes: { x: number; z: number }[]; edges: { id: number; a: number; b: number; axis: 'x' | 'z' }[] }): Roads;

/** The point `s` along a lane, `side` (default LANE, the lane's middle) right of the street's centre line. */
export function lanePoint(lane: Lane, s: number, side?: number): { x: number; z: number; heading: number };

/** The turn from lane `a` into lane `b` across junction `node`: straight, a tight right, a wide left, or back. */
export function makeTurn(node: { x: number; z: number }, a: Lane, b: Lane): Turn;

/** The shortest way by road (A* over lanes, no doubling back) between two points on lanes; null when there is none. */
export function findRoute(roads: Roads, from: { lane: number; s: number }, to: { lane: number; s: number }): { lanes: number[]; length: number } | null;

/** The lanes a car may take at the end of a lane: all but the way back, unless that is all there is. */
export function exits(roads: Roads, id: number): number[];

/** The street nearest a point, kept clear of junctions, as the lane whose kerb is on the point's side; null beyond `reach` (default 2.2). */
export function nearestStreet(roads: Roads, x: number, z: number, reach?: number): { lane: number; s: number; distance: number } | null;

/** Points along a route (no further apart than `step`, default 0.12), from `s` on its first lane to `end` on its last. */
export function routePoints(roads: Roads, route: number[], s: number, end: number, step?: number): { x: number; z: number }[];
