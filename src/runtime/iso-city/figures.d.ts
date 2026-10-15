import type { Car, Job, Traffic } from './traffic.js';
import type { Roads } from './roads.js';

/** Floats an instance: place (x, z, heading, lift), paint (r, g, b, taxi: 1, car: 0, neither: −1), state (brake, squash, scale, fade). */
export const INSTANCE: number;
/** How much larger than its model a pin is drawn. */
export const PIN_SCALE: number;
/** How much larger than its model a person is drawn. */
export const PERSON_SCALE: number;

/** An eased drop with one small bounce: 0 at the start, 1 landed. */
export function bounce(t: number): number;

/** Writes the cars' instances into `out`, INSTANCE floats a car; taxis wear the accent. */
export function carInstances(cars: Car[], look: { accent: number[]; neutrals: number[][] }, out: Float32Array): void;

/** The people's instances: a rider by each pin, and people on the zebras where they are crossing. */
export function peopleInstances(traffic: Traffic, roads: Roads): number[];

/** A pin on show. */
export interface PinState {
	job: Job;
	scale: number;
	lift: number;
	fade: number;
	pulse: number;
}

/** The pins to draw: dropping and bobbing while their taxi comes, popping away as it picks up or is sent elsewhere. */
export function pinStates(jobs: Job[], clock: number): PinState[];
