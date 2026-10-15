import type { CityPlan } from './plan.js';

/** World units of ground round the street grid the map covers. */
export const MARGIN: number;

/** Where the shadow of a point at a height falls (x, z shift), with `sun` the direction towards the sun. */
export function shadowShift(sun: [number, number, number], height: number): [number, number];

/** The convex hull of some points, anticlockwise. */
export function hull(points: [number, number][]): [number, number][];

/** Bakes the ground's shadows (red: 0 lit, 1 shaded) into a canvas `resolution` (default 1024) square; `rect` is its least x, z and 1 / span. */
export function bakeShadows(plan: CityPlan, sun: [number, number, number], resolution?: number): { canvas: HTMLCanvasElement; rect: [number, number, number] };
