/**
 * @module @arraypress/effects-astro/iso-city/traffic
 *
 * The cars: each keeps to its lane, eases off for turns (more for a tight
 * right than a wide left), keeps its distance from the car ahead, and
 * stops at the crossing before a junction unless the junction is its to
 * cross. A junction is crossed by one car at a time, and only when there
 * is room on the far side, so traffic never locks up; now and then people
 * cross, and every car waits. Taxis can be called: the nearest by road
 * drives to the pin, pulls in to the kerb, picks up, and goes on its way.
 *
 * Pure: `step` moves it on, and positions are read off the cars.
 */

import { LANE, exits, findRoute, lanePoint, nearestStreet, routePoints } from './roads.js';

/** How much larger than its model (0.44 long) a car is drawn. */
export const CAR_SCALE = 1.3;
/** A car's length. */
export const CAR_LENGTH = 0.44 * CAR_SCALE;
/** The least distance, centre to centre, between two cars in a lane. */
export const GAP = CAR_LENGTH + 0.14;
/** How far before its lane's end a car waiting at the crossing stops (its centre). */
export const STOP = 0.34 + CAR_LENGTH / 2;
/** A car pulled in at the kerb: its centre from the street's centre line. */
export const KERB = 0.35;
/** Where a waiting rider stands: on the pavement, from the street's centre line. */
export const PAVEMENT = 0.62;
/** Pulling away, and braking (world units a second, a second). */
const ACCEL = 0.9;
const BRAKE = 2.2;
/** A share of a car's cruising speed for each kind of turn. */
const TURN_SPEED = { straight: 1, right: 0.48, left: 0.62, back: 0.4 };
/** Cruising speed at `speed` 1, world units a second. */
const CRUISE = 0.85;
/** A taxi's speed on its way to a pickup, a share of its usual. */
const HURRY = 1.35;
/** How long a pickup takes, seconds. */
const PICKUP = 1.4;

/**
 * @typedef {import('./roads.js').Roads} Roads
 * @typedef {import('./roads.js').Turn} Turn
 */

/**
 * @typedef {object} Car
 * @property {number} id Its index.
 * @property {boolean} taxi Whether it is one of the brand's taxis.
 * @property {number} paint Which neutral colour it is (taxis wear the accent).
 * @property {'lane' | 'turn'} phase On a lane, or crossing a junction.
 * @property {number} lane The lane it is on (or turning out of).
 * @property {number} next The lane it turns into next.
 * @property {number} s How far along its lane.
 * @property {number} t How far through its turn.
 * @property {number} v Its speed.
 * @property {number} pref Its own share of the cruising speed.
 * @property {number} holds The junction it has been let across, or −1.
 * @property {number} waiting Seconds it has waited at the crossing.
 * @property {number} side Its centre from the street's centre line (LANE, or KERB pulled in).
 * @property {number[]} plan The lanes after `next`, on the way to a pickup.
 * @property {Job | null} job The pickup it is on its way to.
 * @property {number} pickup Seconds left of a pickup, 0 when not stopped for one.
 * @property {number} hop Seconds since its last pickup began (for the little bounce), or −1.
 * @property {number} odo Distance driven.
 * @property {number} brake How hard it is braking, 0–1 (for the brake lights).
 * @property {number} x Where it is, x.
 * @property {number} z Where it is, z.
 * @property {number} heading Which way it faces, radians.
 */

/**
 * @typedef {object} Job
 * @property {number} id Its number.
 * @property {Car} car The taxi sent.
 * @property {number} lane The lane it picks up on.
 * @property {number} s Where along it.
 * @property {number} x The pin's x, on the pavement.
 * @property {number} z The pin's z.
 * @property {{ x: number, z: number }[]} points The way there, for drawing.
 * @property {number} length The way's length.
 * @property {number} odo The taxi's distance driven when it set off.
 * @property {'going' | 'pickup' | 'done' | 'cancelled'} state How it stands.
 * @property {number} since When it entered that state, seconds.
 */

/**
 * @typedef {object} Traffic
 * @property {Car[]} cars Every car.
 * @property {Job[]} jobs Pickups under way, and ones just ended (for their exit animations).
 * @property {Map<number, { start: number, until: number }>} crossings Junctions where people are crossing, by junction.
 * @property {number} time Seconds simulated.
 * @property {(dt: number) => void} step Moves everything on by `dt` seconds.
 * @property {(x: number, z: number) => Job | null} call Calls the nearest free taxi to the street
 *   nearest a point (on the side of it the point is); null when there is no street there or no taxi.
 */

/**
 * Puts cars on the roads.
 *
 * @param {Roads} roads The roads.
 * @param {object} [options]
 * @param {number} [options.cars=14] How many cars.
 * @param {number} [options.taxis=4] How many of them are taxis.
 * @param {number} [options.speed=1] Cruising speed, a share of the usual.
 * @param {number} [options.paints=5] How many neutral colours there are to pick from.
 * @param {boolean} [options.parked=false] Park them at the kerb and never move (a still frame).
 * @param {() => number} [options.random=Math.random] The generator.
 * @returns {Traffic} The traffic.
 */
export function createTraffic(roads, { cars: count = 14, taxis = 4, speed = 1, paints = 5, parked = false, random = Math.random } = {}) {
	const { lanes } = roads;
	// Places to start: slots along every lane, far enough apart, dealt out at random.
	/** @type {{ lane: number, s: number }[]} */
	const slots = [];
	for (const lane of lanes) {
		for (let s = 0.4; s <= lane.length - STOP - 0.05; s += GAP + 0.3) slots.push({ lane: lane.id, s });
	}
	for (let i = slots.length - 1; i > 0; i--) {
		const k = Math.floor(random() * (i + 1));
		[slots[i], slots[k]] = [slots[k], slots[i]];
	}
	const total = Math.min(Math.max(0, Math.round(count)), slots.length);
	const taxiCount = Math.min(total, Math.max(0, Math.round(taxis)));
	/** @type {Car[]} */
	const cars = slots.slice(0, total).map((slot, id) => ({
		id,
		taxi: id < taxiCount,
		paint: Math.floor(random() * paints),
		phase: 'lane',
		lane: slot.lane,
		next: -1,
		s: slot.s,
		t: 0,
		v: 0,
		pref: 0.88 + random() * 0.24,
		holds: -1,
		waiting: 0,
		side: parked ? KERB : LANE,
		plan: [],
		job: null,
		pickup: 0,
		hop: -1,
		odo: 0,
		brake: parked ? 0 : 1,
		x: 0,
		z: 0,
		heading: 0,
	}));
	for (const car of cars) {
		car.next = wander(car.lane);
		place(car);
	}
	/** Who has been let across each junction, by junction. */
	/** @type {Map<number, Car>} */
	const holders = new Map();
	/** @type {Map<number, { start: number, until: number }>} */
	const crossings = new Map();
	/** @type {Job[]} */
	const jobs = [];
	let jobId = 0;

	/**
	 * Picks the lane to take after a lane: straight on more often than not.
	 *
	 * @param {number} id The lane.
	 * @returns {number} The lane after it.
	 */
	function wander(id) {
		const options = exits(roads, id);
		const weights = options.map((m) => (roads.turn(id, m).kind === 'straight' ? 2 : 1));
		let pick = random() * weights.reduce((a, b) => a + b, 0);
		for (let i = 0; i < options.length; i++) {
			pick -= weights[i];
			if (pick <= 0) return options[i];
		}
		return options[options.length - 1];
	}

	/**
	 * Works out where a car is from where it is along its lane or turn.
	 *
	 * @param {Car} car The car.
	 */
	function place(car) {
		const p = car.phase === 'lane' ? lanePoint(lanes[car.lane], car.s, car.side) : roads.turn(car.lane, car.next).at(car.t);
		car.x = p.x;
		car.z = p.z;
		car.heading = p.heading;
	}

	/**
	 * The speed a car may be doing now to stop within a distance (from `floor`, the speed it may arrive at).
	 *
	 * @param {number} distance The distance.
	 * @param {number} [floor=0] The speed it may arrive at.
	 * @param {number} [ease=1] A share of full braking.
	 * @returns {number} The speed.
	 */
	const within = (distance, floor = 0, ease = 1) => Math.sqrt(floor * floor + 2 * BRAKE * ease * Math.max(0, distance));

	/** @type {Traffic} */
	const traffic = {
		cars,
		jobs,
		crossings,
		time: 0,
		step(dt) {
			if (parked || dt <= 0) return;
			traffic.time += dt;
			const now = traffic.time;

			// People cross now and then where three or four streets meet.
			for (const [node, hold] of crossings) if (now > hold.until) crossings.delete(node);
			for (let node = 0; node < roads.nodes.length; node++) {
				if (roads.degree[node] < 3 || crossings.has(node) || holders.has(node)) continue;
				if (random() < dt / 40) crossings.set(node, { start: now, until: now + 2.2 + random() * 1.2 });
			}

			// Each lane's cars, nearest its start first.
			/** @type {Car[][]} */
			const onLane = lanes.map(() => []);
			for (const car of cars) if (car.phase === 'lane') onLane[car.lane].push(car);
			for (const list of onLane) if (list.length > 1) list.sort((a, b) => a.s - b.s);
			/**
			 * The car furthest back on a lane, or the one turning into it.
			 *
			 * @param {number} id The lane.
			 * @param {Car} me The car asking (skipped).
			 * @returns {number | null} How far along that car is (negative while it is still turning in), or null for an empty lane.
			 */
			const tailOf = (id, me) => {
				const from = lanes[id].from;
				const turning = holders.get(from);
				if (turning && turning !== me && turning.phase === 'turn' && turning.next === id) {
					return turning.t - roads.turn(turning.lane, turning.next).length;
				}
				const list = onLane[id];
				for (const car of list) if (car !== me) return car.s;
				return null;
			};

			/** @type {Map<number, Car[]>} */
			const asks = new Map();
			for (const car of cars) {
				const before = car.v;
				// A taxi on its way to a pickup hurries a little.
				const cruise = CRUISE * speed * car.pref * (car.job?.state === 'going' ? HURRY : 1);
				if (car.hop >= 0) car.hop += dt;
				if (car.pickup > 0) {
					car.v = 0;
					car.pickup -= dt;
					if (car.pickup <= 0) finish(car, now);
					car.brake = 1;
					continue;
				}
				let limit = cruise;
				const lane = lanes[car.lane];
				const turn = roads.turn(car.lane, car.next);
				const turnSpeed = cruise * TURN_SPEED[turn.kind];
				if (car.phase === 'lane') {
					const left = lane.length - car.s;
					limit = Math.min(limit, within(left, turnSpeed, 0.35));
					const list = onLane[car.lane];
					const ahead = list[list.indexOf(car) + 1];
					if (ahead) {
						limit = Math.min(limit, within(ahead.s - car.s - GAP, ahead.v * 0.9));
					} else if (car.holds === lane.to) {
						const tail = tailOf(car.next, car);
						if (tail !== null) limit = Math.min(limit, within(left + turn.length + tail - GAP));
					}
					if (car.holds !== lane.to) {
						const stopAt = lane.length - STOP;
						const toStop = stopAt - car.s;
						// Only the car at the front asks: one queued behind it never holds a junction it cannot reach.
						if (!ahead && toStop < (car.v * car.v) / (2 * BRAKE) + 0.5) {
							const list2 = asks.get(lane.to) ?? [];
							list2.push(car);
							asks.set(lane.to, list2);
						}
						limit = Math.min(limit, within(toStop));
						if (toStop < 0.05 && car.v < 0.05) car.waiting += dt;
					}
					const job = car.job;
					if (job && job.state === 'going' && job.lane === car.lane && car.next !== -1 && car.plan.length === 0 && pickupHere(car)) {
						const toPin = job.s - car.s;
						limit = Math.min(limit, within(toPin, 0, 0.55));
						car.side = LANE + (KERB - LANE) * Math.min(1, Math.max(0, 1 - toPin / 1.4));
						if (toPin < 0.03 && car.v < 0.1) {
							car.v = 0;
							car.pickup = PICKUP;
							car.hop = 0;
							job.state = 'pickup';
							job.since = now;
							car.brake = 1;
							continue;
						}
					} else if (car.side !== LANE) {
						car.side += (LANE - car.side) * Math.min(1, dt * 2.5);
						if (Math.abs(car.side - LANE) < 0.002) car.side = LANE;
					}
				} else {
					limit = Math.min(limit, Math.max(turnSpeed, cruise * (car.t / turn.length)));
					const tail = tailOf(car.next, car);
					if (tail !== null) limit = Math.min(limit, within(turn.length - car.t + tail - GAP));
				}
				car.v = limit < car.v ? Math.max(limit, car.v - BRAKE * 2 * dt) : Math.min(limit, car.v + ACCEL * dt);
				advance(car, car.v * dt, onLane);
				const slowing = (before - car.v) / dt;
				const target = car.v < 0.03 ? 1 : Math.min(1, Math.max(0, slowing / 0.8));
				car.brake += (target - car.brake) * Math.min(1, dt * 8);
				place(car);
			}

			// Let one car across each free junction: the one that has waited
			// longest, when there is room on the far side.
			for (const [node, list] of asks) {
				if (holders.has(node) || crossings.has(node)) continue;
				list.sort((a, b) => b.waiting - a.waiting);
				for (const car of list) {
					const tail = tailOf(car.next, car);
					if (tail !== null && tail < GAP + 0.05) continue;
					holders.set(node, car);
					car.holds = node;
					car.waiting = 0;
					break;
				}
			}
		},
		call(x, z) {
			const street = nearestStreet(roads, x, z);
			if (!street) return null;
			const free = cars.filter((c) => c.taxi && (!c.job || c.job.state === 'going') && c.pickup <= 0);
			if (!free.length) return null;
			/** @type {{ car: Car, route: { lanes: number[], length: number }, from: { lane: number, s: number }, lead: number } | null} */
			let best = null;
			for (const car of free) {
				const from = startOf(car);
				const route = findRoute(roads, from.at, street);
				if (!route) continue;
				const cost = route.length + from.lead + (car.job ? 6 : 0);
				if (!best || cost < best.route.length + best.lead + (best.car.job ? 6 : 0)) best = { car, route, from: from.at, lead: from.lead };
			}
			if (!best) return null;
			const { car, route, from } = best;
			if (car.job) {
				car.job.state = 'cancelled';
				car.job.since = traffic.time;
			}
			// The way there: the rest of a turn under way, then the route.
			/** @type {{ x: number, z: number }[]} */
			const points = [{ x: car.x, z: car.z }];
			if (car.phase === 'turn') {
				const turn = roads.turn(car.lane, car.next);
				for (let t = car.t + 0.12; t < turn.length; t += 0.12) points.push(turn.at(t));
			}
			points.push(...routePoints(roads, route.lanes, from.s, street.s));
			let length = 0;
			for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
			const pin = lanePoint(lanes[street.lane], street.s, PAVEMENT);
			/** @type {Job} */
			const job = { id: ++jobId, car, lane: street.lane, s: street.s, x: pin.x, z: pin.z, points, length, odo: car.odo, state: 'going', since: traffic.time };
			car.job = job;
			if (car.phase === 'lane') {
				if (route.lanes.length > 1) car.next = route.lanes[1];
				car.plan = route.lanes.slice(2);
			} else {
				car.plan = route.lanes.slice(1);
			}
			jobs.push(job);
			return job;
		},
	};

	/**
	 * Whether a car's pickup is ahead of it on the lane it is on.
	 *
	 * @param {Car} car The car.
	 * @returns {boolean} True when it should be pulling in.
	 */
	function pickupHere(car) {
		return Boolean(car.job && car.job.s >= car.s - 0.05);
	}

	/**
	 * Where a car's way to a pickup starts: on its lane a stopping distance
	 * ahead, or (mid-turn) at the start of the lane it is turning into.
	 *
	 * @param {Car} car The car.
	 * @returns {{ at: { lane: number, s: number }, lead: number }} The start, and the distance to it.
	 */
	function startOf(car) {
		if (car.phase === 'turn') return { at: { lane: car.next, s: 0 }, lead: roads.turn(car.lane, car.next).length - car.t };
		return { at: { lane: car.lane, s: car.s }, lead: 0 };
	}

	/**
	 * Ends a pickup: the taxi pulls away and goes back to wandering.
	 *
	 * @param {Car} car The taxi.
	 * @param {number} now The time, seconds.
	 */
	function finish(car, now) {
		car.pickup = 0;
		if (car.job) {
			car.job.state = 'done';
			car.job.since = now;
		}
		car.job = null;
		car.plan = [];
	}

	/**
	 * Moves a car on along its lane and through its turns, never into the
	 * car ahead or past a crossing it has not been let over.
	 *
	 * @param {Car} car The car.
	 * @param {number} ds How far.
	 * @param {Car[][]} onLane Each lane's cars, nearest its start first.
	 */
	function advance(car, ds, onLane) {
		car.odo += ds;
		if (car.phase === 'lane') {
			const lane = lanes[car.lane];
			const list = onLane[car.lane];
			const ahead = list[list.indexOf(car) + 1];
			let s = car.s + ds;
			if (ahead && s > ahead.s - GAP) {
				s = Math.max(car.s, ahead.s - GAP);
				car.v = Math.min(car.v, ahead.v);
			}
			if (car.holds !== lane.to && s > lane.length - STOP) {
				s = Math.max(car.s, lane.length - STOP);
				car.v = 0;
			}
			if (car.job && car.job.state === 'going' && car.job.lane === car.lane && car.plan.length === 0 && car.s <= car.job.s && s > car.job.s) s = car.job.s;
			car.s = s;
			if (car.s >= lane.length) {
				car.phase = 'turn';
				car.t = car.s - lane.length;
			}
			return;
		}
		const turn = roads.turn(car.lane, car.next);
		car.t += ds;
		if (car.t < turn.length) return;
		holders.delete(turn.node);
		car.holds = -1;
		car.phase = 'lane';
		car.s = car.t - turn.length;
		car.t = 0;
		car.lane = car.next;
		car.next = car.plan.length ? /** @type {number} */ (car.plan.shift()) : wander(car.lane);
	}

	return traffic;
}
