import type { Roads } from './roads.js';

/** How much larger than its model (0.44 long) a car is drawn. */
export const CAR_SCALE: number;
/** A car's length. */
export const CAR_LENGTH: number;
/** The least distance, centre to centre, between two cars in a lane. */
export const GAP: number;
/** How far before its lane's end a car waiting at the crossing stops (its centre). */
export const STOP: number;
/** A car pulled in at the kerb: its centre from the street's centre line. */
export const KERB: number;
/** Where a waiting rider stands, from the street's centre line. */
export const PAVEMENT: number;

export interface Car {
	id: number;
	taxi: boolean;
	/** Which neutral colour (taxis wear the accent). */
	paint: number;
	phase: 'lane' | 'turn';
	lane: number;
	next: number;
	s: number;
	t: number;
	v: number;
	pref: number;
	/** The junction it has been let across, or −1. */
	holds: number;
	waiting: number;
	side: number;
	plan: number[];
	job: Job | null;
	/** Seconds left of a pickup. */
	pickup: number;
	/** Seconds since its last pickup began, or −1. */
	hop: number;
	odo: number;
	/** How hard it is braking, 0–1. */
	brake: number;
	x: number;
	z: number;
	heading: number;
}

export interface Job {
	id: number;
	car: Car;
	lane: number;
	s: number;
	/** The pin, on the pavement. */
	x: number;
	z: number;
	/** The way there, for drawing. */
	points: { x: number; z: number }[];
	length: number;
	/** The taxi's distance driven when it set off. */
	odo: number;
	state: 'going' | 'pickup' | 'done' | 'cancelled';
	/** When it entered that state, seconds. */
	since: number;
}

export interface Traffic {
	cars: Car[];
	jobs: Job[];
	/** Junctions where people are crossing. */
	crossings: Map<number, { start: number; until: number }>;
	time: number;
	/** Moves everything on by `dt` seconds. */
	step(dt: number): void;
	/** Calls the nearest free taxi by road to the street nearest a point; null when there is no street or taxi. */
	call(x: number, z: number): Job | null;
}

/** Puts cars on the roads (defaults: 14 cars, 4 taxis, speed 1, 5 paints, moving, Math.random). */
export function createTraffic(
	roads: Roads,
	options?: { cars?: number; taxis?: number; speed?: number; paints?: number; parked?: boolean; random?: () => number },
): Traffic;
