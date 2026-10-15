/** A flock of particles, each held to a home by a spring. */
export interface Swarm {
	count: number;
	/** Positions, x, y pairs. */
	pos: Float32Array;
	/** Velocities, x, y pairs, units a second. */
	vel: Float32Array;
	/** Homes, x, y pairs. */
	home: Float32Array;
	/** How tightly each is held to its home, 0–1; a few are loose. */
	grip: Float32Array;
	/** Seconds stepped since it was last dispersed. */
	time: number;
}

/** What moves a swarm on a step. */
export interface SwarmForces {
	/** The springs' stiffness at full grip, a second squared. Default 40. */
	pull?: number;
	/** How hard the curl-noise flow pushes, units a second squared. Default 0.5. */
	flow?: number;
	/** The flow's swirls a unit. Default 6. */
	scale?: number;
	/** How fast a particle loses speed, a share a second. Default 4. */
	damping?: number;
	/** Each particle's chance a second of trading homes with a neighbour. Default 0.05. */
	wander?: number;
	/** Seconds the springs take to come on after `disperse`. Default 2.2. */
	arrive?: number;
	/** A pointer to flee: where, how far it reaches, how hard it pushes. */
	pointer?: { x: number; y: number; radius: number; force: number } | null;
	/** The random source. Default Math.random. */
	random?: () => number;
}

/** Makes a swarm of `count` particles at the origin. */
export function createSwarm(count: number, random?: () => number): Swarm;

/** Throws the swarm into a loose cloud round (x, y), moving every which way, and restarts its clock. */
export function disperse(swarm: Swarm, x: number, y: number, spread: number, random?: () => number): void;

/** Gives the particles their homes (x, y pairs), ordered so particles close in the order have homes close on the shape. */
export function setHomes(swarm: Swarm, homes: Float32Array): void;

/** Puts every particle at its home, at rest, for a still frame. */
export function settle(swarm: Swarm): void;

/** Moves the swarm on by `dt` seconds: springs, flow, the pointer, damping. */
export function stepSwarm(swarm: Swarm, dt: number, forces?: SwarmForces): void;
