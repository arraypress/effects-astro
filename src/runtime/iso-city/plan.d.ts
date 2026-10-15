/** World units from one street's centre line to the next. */
export const PITCH: number;
/** A street's width: two lanes. */
export const ROAD: number;
/** The pavement's width round each block. */
export const CURB: number;
/** The height of pavements and plazas above the road. */
export const SLAB: number;
/** The height of a storey. */
export const STOREY: number;

export interface Rect { x0: number; z0: number; x1: number; z1: number }
/** A junction: its column and row, and where it is. */
export interface Node { id: number; i: number; j: number; x: number; z: number }
/** A street segment between two neighbouring junctions. */
export interface Edge { id: number; a: number; b: number; axis: 'x' | 'z' }
/** A box of a building. */
export interface Part extends Rect { y0: number; y1: number }
/** Something standing on a roof. */
export type Roof =
	| { kind: 'box' | 'hut'; x0: number; z0: number; x1: number; z1: number; y0: number; y1: number }
	| { kind: 'tank'; x: number; z: number; r: number; y0: number; y1: number }
	| { kind: 'garden'; x0: number; z0: number; x1: number; z1: number; y0: number }
	| { kind: 'solar'; x0: number; z0: number; x1: number; z1: number; y0: number; rows: number };
/** A building: its body (and set-back tier), roof clutter, a shade (−1 to 1), a seed and a pick (0–1). */
export interface Building { parts: Part[]; roof: Roof[]; tone: number; seed: number; glass: number }
export interface Tree { x: number; z: number; r: number; h: number; tone: number }
/** A block, or two merged across a plaza. */
export interface Block extends Rect { kind: 'build' | 'park'; plaza: Rect | null }
export interface Pond { x: number; z: number; r: number }
export interface Path extends Rect { axis: 'x' | 'z' }

export interface CityPlan {
	/** Blocks across. */
	size: number;
	/** The street grid's span, world units. */
	extent: number;
	/** The junctions, row by row: id = j × (size + 1) + i. */
	nodes: Node[];
	/** The open street segments. */
	edges: Edge[];
	/** The segments closed into plazas. */
	closed: Edge[];
	blocks: Block[];
	buildings: Building[];
	trees: Tree[];
	ponds: Pond[];
	paths: Path[];
	lamps: { x: number; z: number }[];
}

/** Plans a city from a seed (default 7) and blocks across (default 6, 2–12). The same seed and size always give the same city. */
export function planCity(options?: { seed?: number; size?: number }): CityPlan;

/** Whether every junction can reach every other along some segments. */
export function connected(count: number, edges: { a: number; b: number }[]): boolean;

/** Where a line of sight from `from` to `to` first enters a building, or null when it meets none. */
export function firstHit(plan: CityPlan, from: [number, number, number], to: [number, number, number]): [number, number, number] | null;
