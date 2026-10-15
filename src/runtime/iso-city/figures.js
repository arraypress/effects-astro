/**
 * @module @arraypress/effects-astro/iso-city/figures
 *
 * What moves in the city, as the shader's instances: each car's place,
 * paint and state (with the little hop and squash of a pickup), the people
 * (a rider waiting by each pin who steps into the taxi, and people walking
 * over a zebra while the cars wait), and each pin's drop, bob and pop.
 *
 * Pure: read off the traffic at a moment.
 */

import { lanePoint } from './roads.js';
import { CAR_SCALE, KERB, PAVEMENT } from './traffic.js';

/** Floats an instance: place (x, z, heading, lift), paint (r, g, b, taxi: 1, car: 0, neither: −1), state (brake, squash, scale, fade). */
export const INSTANCE = 12;
/** How much larger than its model a pin is drawn. */
export const PIN_SCALE = 1.9;
/** How much larger than its model a person is drawn. */
export const PERSON_SCALE = 1.8;
/** How long a taxi's pickup hop lasts, seconds. */
const HOP = 1.6;

/**
 * @typedef {import('./traffic.js').Traffic} Traffic
 * @typedef {import('./traffic.js').Job} Job
 * @typedef {import('./roads.js').Roads} Roads
 */

/**
 * An eased drop with one small bounce: 0 at the start, 1 landed.
 *
 * @param {number} t Progress, 0–1 (clamped).
 * @returns {number} The eased value.
 */
export function bounce(t) {
	const x = Math.min(1, Math.max(0, t));
	if (x < 0.55) return (x / 0.55) ** 2;
	const k = (x - 0.775) / 0.225;
	return 1 - 0.12 * Math.max(0, 1 - k * k);
}

/**
 * Writes the cars' instances.
 *
 * @param {import('./traffic.js').Car[]} cars The cars.
 * @param {{ accent: number[], neutrals: number[][] }} look Their colours: taxis wear the accent.
 * @param {Float32Array} out Where to write them, INSTANCE floats a car.
 */
export function carInstances(cars, look, out) {
	cars.forEach((car, i) => {
		const paint = car.taxi ? look.accent : look.neutrals[car.paint % look.neutrals.length];
		const hop = car.hop >= 0 && car.hop < HOP ? car.hop : -1;
		const lift = hop >= 0 ? 0.07 * Math.abs(Math.sin(hop * Math.PI * 2.4)) * Math.exp(-hop * 2.6) : 0;
		const squash = hop >= 0 ? 1 + 0.12 * Math.sin(hop * Math.PI * 4.8) * Math.exp(-hop * 3) : 1;
		out.set([car.x, car.z, car.heading, lift, paint[0], paint[1], paint[2], car.taxi ? 1 : 0, car.brake, squash, CAR_SCALE, 0], i * INSTANCE);
	});
}

/**
 * The people's instances: a rider by each pin (stepping to the taxi and in
 * as it picks up), and one or two people walking over a zebra wherever
 * people are crossing.
 *
 * @param {Traffic} traffic The traffic.
 * @param {Roads} roads The roads.
 * @returns {number[]} INSTANCE floats a person.
 */
export function peopleInstances(traffic, roads) {
	const clock = traffic.time;
	/** @type {number[]} */
	const out = [];
	for (const job of traffic.jobs) {
		const lane = roads.lanes[job.lane];
		// Beside the pin, on the side nearer the camera (which looks from +x, +z), so the pin never hides them.
		const at = lanePoint(lane, job.s + 0.18 * Math.sign(lane.dx + lane.dz), PAVEMENT - 0.06);
		const since = clock - job.since;
		if (job.state === 'going') {
			const wave = Math.abs(Math.sin(clock * 5)) * 0.012 * bounce(since * 2);
			out.push(at.x, at.z, lane.heading + Math.PI / 2, wave, 0, 0, 0, -1, 0, 1, bounce(since * 2.5) * PERSON_SCALE, 0);
		} else if (job.state === 'pickup' && since < 0.6) {
			// Steps to the car and climbs in.
			const k = since / 0.6;
			const to = lanePoint(lane, job.s, KERB + 0.05);
			out.push(at.x + (to.x - at.x) * k, at.z + (to.z - at.z) * k, lane.heading - Math.PI / 2, 0, 0, 0, 0, -1, 0, 1, (1 - k * k) * PERSON_SCALE, 0);
		}
	}
	for (const [node, hold] of traffic.crossings) {
		// One of the junction's zebras, the same one for the whole crossing.
		const leaving = roads.out[node];
		const lane = roads.lanes[leaving[(node * 7 + Math.floor(hold.start * 3)) % leaving.length]];
		const k = (clock - hold.start) / (hold.until - hold.start);
		const count = 1 + ((node + Math.floor(hold.start)) % 2);
		for (let n = 0; n < count; n++) {
			// From kerb to kerb (across from the street's centre), the second person the other way.
			const across = -0.62 + 1.24 * Math.min(1, Math.max(0, k * 1.15 - n * 0.1));
			const way = n % 2 ? -1 : 1;
			const p = lanePoint(lane, 0.12 + n * 0.1, way * across);
			const step = Math.abs(Math.sin(k * 40 + n)) * 0.01;
			out.push(p.x, p.z, lane.heading + way * (Math.PI / 2), step, 0, 0, 0, -1, 0, 1, Math.min(1, Math.min(k, 1 - k) * 12) * PERSON_SCALE, 0);
		}
	}
	return out;
}

/**
 * @typedef {object} PinState
 * @property {Job} job Its pickup.
 * @property {number} scale Its size (PIN_SCALE not included).
 * @property {number} lift How high it hangs over the pavement.
 * @property {number} fade Its ring's and route's opacity, 0–1.
 * @property {number} pulse The ring's pulse, 0–1.
 */

/**
 * The pins to draw: dropping in with a bounce and bobbing while the taxi
 * comes, popping away as it picks up (or is sent elsewhere).
 *
 * @param {Job[]} jobs The pickups.
 * @param {number} clock The traffic's time, seconds.
 * @returns {PinState[]} The pins on show.
 */
export function pinStates(jobs, clock) {
	/** @type {PinState[]} */
	const pins = [];
	for (const job of jobs) {
		const since = clock - job.since;
		if (job.state === 'going') {
			pins.push({ job, scale: 0.6 + 0.4 * bounce(since * 2.2), lift: (1 - bounce(since * 2.2)) * 0.9 + Math.sin(clock * 2.2) * 0.015, fade: 1, pulse: (since * 0.7) % 1 });
		} else if (job.state !== 'done' && since < 0.45) {
			const k = since / 0.45;
			pins.push({ job, scale: 1 + 0.25 * Math.sin(k * Math.PI) - k, lift: k * 0.25, fade: 1 - k, pulse: Math.min(1, k * 1.2) });
		}
	}
	return pins;
}
