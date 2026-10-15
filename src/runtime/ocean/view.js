/**
 * @module @arraypress/effects-astro/ocean/view
 *
 * The camera over the sea: a pinhole a few metres above the water,
 * pitched slightly down, its lens shifted (as an architect's camera
 * shifts) so the horizon lands where the copy needs it while the horizon
 * stays level and straight. Also where a point on the frame looks, and
 * where the sun sits for a time of day or a `sun` override.
 *
 * World space: x right, y up, z ahead; metres. Frame space: x 0–1 from
 * the left, y 0–1 from the bottom, as `pointerIn` gives them.
 */

/** How far the camera looks down, radians. */
const PITCH = (3 * Math.PI) / 180;
/** The lens: focal length in units of the frame's height (about a 42° view top to bottom). */
const FOCAL = 1.3;
/** The narrowest frame (width over height) the lens keeps its focal length for; narrower frames widen it so a phone still sees the sea. */
const NARROW = 1.15;
/** The lowest the sun may sit, radians: just clear of the horizon. */
const LOWEST = (0.4 * Math.PI) / 180;

/**
 * @typedef {[number, number, number]} Vec3
 */

/**
 * @typedef {object} OceanView
 * @property {Vec3} eye Where the camera is, metres.
 * @property {Vec3} right The camera's right, a unit vector.
 * @property {Vec3} up Its up.
 * @property {Vec3} forward Where it looks.
 * @property {number} focal Focal length, in units of the frame's height.
 * @property {number} shift How far the lens is shifted down, in units of the frame's height.
 * @property {number} aspect The frame's width over its height.
 */

/**
 * The camera for a frame.
 *
 * @param {object} options The camera.
 * @param {number} options.height How high above the sea, metres.
 * @param {number} options.horizon Where the horizon sits, 0–1 up the frame.
 * @param {number} options.aspect The frame's width over its height.
 * @param {number} [options.x=0] How far to the side it has moved, metres (parallax).
 * @param {number} [options.lift=0] How far it has risen, metres.
 * @returns {OceanView} The camera.
 */
export function oceanView({ height, horizon, aspect, x = 0, lift = 0 }) {
	const focal = FOCAL * Math.min(1, aspect / NARROW);
	const c = Math.cos(PITCH);
	const s = Math.sin(PITCH);
	return {
		eye: [x, height + lift, 0],
		right: [1, 0, 0],
		up: [0, c, s],
		forward: [0, -s, c],
		focal,
		// A level ray has y 0: -focal·sin + (v - shift)·cos = 0 at v = horizon - 0.5.
		shift: horizon - 0.5 - focal * Math.tan(PITCH),
		aspect,
	};
}

/**
 * Where a point on the frame looks.
 *
 * @param {OceanView} view The camera.
 * @param {number} x Across the frame, 0 (left) to 1.
 * @param {number} y Up it, 0 (bottom) to 1.
 * @returns {Vec3} The direction, a unit vector.
 */
export function viewRay(view, x, y) {
	const u = (x - 0.5) * view.aspect;
	const v = y - 0.5 - view.shift;
	const d = /** @type {Vec3} */ ([0, 1, 2].map((i) => view.right[i] * u + view.up[i] * v + view.forward[i] * view.focal));
	const length = Math.hypot(...d);
	return /** @type {Vec3} */ (d.map((c) => c / length));
}

/**
 * Where the sun is: above the point `x` across the horizon at `elevation`
 * degrees, or, with an override, behind the point on the frame it names.
 * It is kept just clear of the horizon.
 *
 * @param {OceanView} view The camera (its parallax ignored: the sun is far away).
 * @param {number} horizon Where the horizon sits, 0–1 up the frame.
 * @param {{ x: number, elevation: number }} look The time of day's sun.
 * @param {{ x?: number, y?: number } | null} [override] Where to put it instead: x 0–1 across, y 0–1 up the frame.
 * @returns {Vec3} The direction towards it, a unit vector.
 */
export function sunDirection(view, horizon, look, override) {
	const x = override?.x ?? look.x;
	const ray = viewRay(view, x, override?.y ?? horizon);
	const across = Math.hypot(ray[0], ray[2]);
	const elevation = Math.max(LOWEST, override?.y === undefined ? (look.elevation * Math.PI) / 180 : Math.asin(ray[1]));
	return [(ray[0] / across) * Math.cos(elevation), Math.sin(elevation), (ray[2] / across) * Math.cos(elevation)];
}
