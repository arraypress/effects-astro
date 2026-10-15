/**
 * @module @arraypress/effects-astro/stack-poses
 *
 * Where each cover of a `<ProductStack>` sits: pure layout, shared by the
 * component (which writes the resting poses into the page, so the stack
 * stands before any script runs) and the runtime (which moves between
 * them as the pointer comes and goes).
 *
 * Lengths are in cover widths, so a pose holds at any size: the transform
 * multiplies them by `--ps-w`, the cover's width in CSS. Three layouts:
 *
 *   - `fan`: a hand of cards, the middle cover in front.
 *   - `stack`: a deck seen at an angle, the first cover in front and the
 *     rest stepping back up and to the right.
 *   - `arc`: a carousel arc, the middle cover facing the viewer and the
 *     rest turned in towards it either side, closer together further out.
 *
 * Open, the covers move further apart; a lifted cover comes forward,
 * squares up to the viewer and pushes its neighbours aside.
 */

/** The layouts, the first the default. */
export const LAYOUTS = /** @type {const} */ (['fan', 'stack', 'arc']);

/** How much further apart the covers sit when the stack is open, per layout. */
const OPEN = { fan: 1.35, stack: 1.6, arc: 1.3 };

/** How far a lifted cover pushes its neighbours aside, in cover steps. */
const MAKE_ROOM = 0.4;

/**
 * @typedef {'fan' | 'stack' | 'arc'} Layout
 */

/**
 * @typedef {object} Pose
 * @property {number} x Across, in cover widths; right is positive.
 * @property {number} y Down, in cover widths.
 * @property {number} z Towards the viewer, in cover widths.
 * @property {number} rx Turn about the horizontal axis, degrees.
 * @property {number} ry Turn about the vertical axis, degrees.
 * @property {number} rz Turn in the plane, degrees.
 * @property {number} s Scale.
 * @property {number} blur How far out of focus, 0 sharp to 1 the furthest.
 */

/**
 * @typedef {object} PoseState
 * @property {number} [spread=1] How far apart the covers sit, 0–2.
 * @property {boolean} [open=false] Whether the stack is fanned apart (pointer over it, or a cover focused).
 * @property {number} [lifted=-1] The cover that is lifted forward; -1 for none.
 */

/**
 * A known layout, or the default.
 *
 * @param {unknown} layout A layout's name.
 * @returns {Layout} It, if known; else `fan`.
 */
export function layoutOf(layout) {
	return LAYOUTS.includes(/** @type {Layout} */ (layout)) ? /** @type {Layout} */ (layout) : 'fan';
}

/**
 * The cover in front when none is lifted: the middle one in a fan (between
 * two when the count is even) or an arc (the left of the two), the first
 * in a stack.
 *
 * @param {Layout} layout The layout.
 * @param {number} n How many covers.
 * @returns {number} Its index; in an even fan, half way between two.
 */
export function frontOf(layout, n) {
	if (layout === 'stack') return 0;
	return layout === 'arc' ? Math.floor((n - 1) / 2) : (n - 1) / 2;
}

/**
 * How much further back a cover right of the front sits than its twin on
 * the left, so no two covers share a depth (their planes would cut through
 * each other) and an even fan has one cover in front.
 *
 * @param {number} t Its place: steps from the front, signed.
 * @returns {number} The extra depth, in cover widths.
 */
function behind(t) {
	return t > 0 ? 0.06 : 0;
}

/**
 * One cover's pose, before centring.
 *
 * @param {Layout} layout The layout.
 * @param {number} t Its place: steps from the front, signed; already pushed aside for a lifted neighbour.
 * @param {number} k The spread, open or not.
 * @param {boolean} lifted Whether it is the lifted cover.
 * @returns {Omit<Pose, 'blur'>} Its pose.
 */
function place(layout, t, k, lifted) {
	if (layout === 'stack') {
		const pose = { x: t * 0.15 * k, y: -t * 0.06 * k, z: -t * 0.3 * k, rx: 5, ry: -28, rz: 0, s: 1 };
		// Drawn up out of the deck to one height, and forward, in front of the covers that were in front of it.
		return lifted ? { ...pose, x: pose.x * 0.6, y: -0.32, z: 0.5, rx: 2, ry: -12, s: 1.04 } : pose;
	}
	if (layout === 'arc') {
		// The front cover faces the viewer; the rest turn in towards it and stand closer together the further out they go.
		const near = Math.min(Math.abs(t), 1);
		const far = Math.max(0, Math.abs(t) - 1);
		const side = Math.sign(t);
		const pose = { x: side * (near * 0.62 + far * 0.26) * k, y: 0, z: -(near * 0.5 + far * 0.16 * k) - behind(t), rx: 0, ry: -side * near * 48, rz: 0, s: 1 };
		return lifted ? { ...pose, y: -0.04, z: pose.z + 0.6, ry: pose.ry * 0.25, s: 1.05 } : pose;
	}
	const pose = { x: t * 0.22 * k, y: t * t * 0.026 * k, z: -Math.abs(t) * 0.12 - behind(t), rx: 0, ry: 0, rz: t * 6.5 * k, s: 1 };
	return lifted ? { ...pose, y: pose.y - 0.12, z: pose.z + 0.5, rz: pose.rz * 0.3, s: 1.06 } : pose;
}

/**
 * Every cover's pose, before centring and focus.
 *
 * @param {Layout} layout The layout.
 * @param {number} n How many covers.
 * @param {PoseState} state The spread, and whether it is open and which cover is lifted.
 * @returns {Array<Omit<Pose, 'blur'>>} The poses, in the covers' order.
 */
function placeAll(layout, n, { spread = 1, open = false, lifted = -1 }) {
	const front = frontOf(layout, n);
	const k = Math.max(0, spread) * (open ? OPEN[layout] : 1);
	return Array.from({ length: n }, (_, i) => {
		const aside = lifted < 0 || i === lifted ? 0 : Math.sign(i - lifted) * MAKE_ROOM;
		return place(layout, i - front + aside, k, i === lifted);
	});
}

/**
 * The box round a set of covers' centres, in cover widths.
 *
 * @param {Array<{ x: number, y: number }>} poses The poses.
 * @returns {{ left: number, right: number, top: number, bottom: number }} The box.
 */
function extent(poses) {
	const xs = poses.map((p) => p.x);
	const ys = poses.map((p) => p.y);
	return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

/**
 * Where the resting stack's centre is, so every pose can be moved to put it
 * in the middle (a stack steps off to one side; a fan dips at its ends).
 *
 * @param {Layout} layout The layout.
 * @param {number} n How many covers.
 * @param {number} spread The spread.
 * @returns {{ x: number, y: number }} The centre, in cover widths.
 */
function centreOf(layout, n, spread) {
	const box = extent(placeAll(layout, n, { spread }));
	return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
}

/**
 * Every cover's pose: placed, centred, and given how far it is out of
 * focus (by its distance from the lifted cover, or from the front).
 *
 * @param {Layout} layout The layout.
 * @param {number} n How many covers.
 * @param {PoseState} [state] The spread, and whether it is open and which cover is lifted.
 * @returns {Pose[]} The poses, in the covers' order.
 */
export function stackPoses(layout, n, state = {}) {
	if (n <= 0) return [];
	const spread = state.spread ?? 1;
	const lifted = Number.isInteger(state.lifted) && /** @type {number} */ (state.lifted) < n ? /** @type {number} */ (state.lifted) : -1;
	const centre = centreOf(layout, n, spread);
	const focus = lifted >= 0 ? lifted : frontOf(layout, n);
	const furthest = Math.max(focus, n - 1 - focus, 1);
	return placeAll(layout, n, { spread, open: state.open, lifted }).map((pose, i) => ({
		...pose,
		x: pose.x - centre.x,
		y: pose.y - centre.y,
		blur: Math.min(1, Math.max(0, Math.abs(i - focus) - 0.5) / Math.max(furthest - 0.5, 0.5)),
	}));
}

/**
 * How far a set of covers reach from the centre each way, each cover's
 * turned box included.
 *
 * @param {Pose[]} poses The poses.
 * @param {number} ratio A cover's width over its height.
 * @returns {{ x: number, y: number }} The furthest reach across and down, in cover widths.
 */
function reach(poses, ratio) {
	let x = 0;
	let y = 0;
	for (const { x: px, y: py, rz, s } of poses) {
		const turn = (rz * Math.PI) / 180;
		const [cos, sin] = [Math.abs(Math.cos(turn)), Math.abs(Math.sin(turn))];
		x = Math.max(x, Math.abs(px) + 0.5 * s * (cos + sin / ratio));
		y = Math.max(y, Math.abs(py) + 0.5 * s * (sin + cos / ratio));
	}
	return { x, y };
}

/**
 * The room the stack needs, in cover widths: across, at rest, open, and
 * open with the front cover lifted (a cover lifted at either end pushes its
 * neighbours a little past it); down, with any cover lifted. The component
 * sizes its box to it.
 *
 * @param {Layout} layout The layout.
 * @param {number} n How many covers.
 * @param {number} [spread=1] The spread.
 * @param {number} [ratio=1] A cover's width over its height.
 * @returns {{ wide: number, tall: number }} The box's width and height, in cover widths.
 */
export function stackBounds(layout, n, spread = 1, ratio = 1) {
	if (n <= 0) return { wide: 1, tall: 1 / ratio };
	/**
	 * Every pose of the stack in some states.
	 *
	 * @param {PoseState[]} states The states.
	 * @returns {Pose[]} Their poses, all together.
	 */
	const posesIn = (states) => states.flatMap((state) => stackPoses(layout, n, state));
	const settled = [{ spread }, { spread, open: true }, { spread, open: true, lifted: Math.floor(frontOf(layout, n)) }];
	const lifts = Array.from({ length: n }, (_, lifted) => ({ spread, open: true, lifted }));
	const x = reach(posesIn(settled), ratio).x;
	const y = reach(posesIn([...settled, ...lifts]), ratio).y;
	// A margin for what the box above leaves out: perspective, the lean and the float.
	const margin = 1.05;
	return { wide: +(x * 2 * margin).toFixed(3), tall: +(y * 2 * margin).toFixed(3) };
}

/**
 * A pose as a CSS transform, in `--ps-w` (the cover's width). The list of
 * functions is the same for every pose, so the browser eases between any
 * two.
 *
 * @param {Pose} pose The pose.
 * @returns {string} The transform.
 */
export function poseTransform({ x, y, z, rx, ry, rz, s }) {
	/**
	 * A length in cover widths.
	 *
	 * @param {number} v The length, in cover widths.
	 * @returns {string} It in CSS.
	 */
	const w = (v) => `calc(var(--ps-w) * ${+v.toFixed(4)})`;
	/**
	 * An angle in degrees.
	 *
	 * @param {number} v The angle.
	 * @returns {string} It in CSS.
	 */
	const deg = (v) => `${+v.toFixed(2)}deg`;
	return `translate3d(${w(x)}, ${w(y)}, ${w(z)}) rotateY(${deg(ry)}) rotateX(${deg(rx)}) rotateZ(${deg(rz)}) scale(${+s.toFixed(4)})`;
}

/**
 * A pose's depth of field as a CSS filter: covers out of focus dim and
 * lose a little colour, and only the furthest blur, a little, so the cost
 * stays small.
 *
 * @param {Pose} pose The pose.
 * @param {number} depth How strong the depth of field is, 0–1.
 * @returns {string} The filter; the same functions every time, so it eases.
 */
export function poseFilter({ blur }, depth) {
	const d = Math.min(1, Math.max(0, depth)) * blur;
	const soft = Math.max(0, d - 0.35) * 3;
	return `brightness(${+(1 - d * 0.55).toFixed(3)}) saturate(${+(1 - d * 0.35).toFixed(3)}) blur(${+soft.toFixed(2)}px)`;
}
