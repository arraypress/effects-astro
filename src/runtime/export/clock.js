/**
 * @module @arraypress/effects-astro/export/clock
 *
 * The CSS animations under an element, held and stepped by hand (Web
 * Animations): pause them all, set every one to the same moment, read
 * the frame, move on. A recording made this way is exact, frame by frame,
 * however long each frame takes to draw. `release()` lets them run on
 * from where they were.
 */

/** @typedef {import('./snapshot.js').Moved} Moved */

/**
 * @typedef {object} Clock
 * @property {number} count How many animations it holds.
 * @property {(ms: number) => void} seek Sets every animation to `ms` from its start.
 * @property {() => Moved[]} moved What the animations move: each element (or pseudo-element) and its animated properties.
 * @property {() => void} release Lets the animations run on from where they were.
 */

/** A keyframe's keys that are not properties. */
const NOT_PROPS = new Set(['offset', 'computedOffset', 'easing', 'composite']);

/**
 * A keyframe's property in CSS's own spelling (`backgroundColor` is
 * `background-color`; a custom property as it is).
 *
 * @param {string} p The key.
 * @returns {string} The property.
 */
export const cssProperty = (p) => (p.startsWith('--') ? p : p.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));

/**
 * The properties a set of keyframes animates.
 *
 * @param {object[]} keyframes From `getKeyframes()`.
 * @returns {Set<string>} The properties, in CSS's spelling.
 */
export function keyframeProps(keyframes) {
	/** @type {Set<string>} */
	const props = new Set();
	for (const k of keyframes) for (const p of Object.keys(k)) if (!NOT_PROPS.has(p)) props.add(cssProperty(p));
	return props;
}

/**
 * What to read again for an animation, with what was already to be read
 * for its element. A custom property feeds other values, so one that
 * animates one reads the element (and all in it) again; Chrome leaves
 * custom properties out of `getKeyframes()`, so keyframes that name
 * nothing are taken to animate one.
 *
 * @param {string[] | 'all'} before What was to be read.
 * @param {Set<string>} props What this animation animates.
 * @returns {string[] | 'all'} What is to be read now.
 */
export function mergeProps(before, props) {
	if (!props.size || [...props].some((p) => p.startsWith('--'))) return 'all';
	if (before === 'all') return before;
	return [...new Set([...before, ...props])];
}

/**
 * What a set of animations moves: each element (or pseudo-element) and
 * the properties to read again.
 *
 * @param {Animation[]} anims The animations.
 * @returns {Moved[]} One entry an element or pseudo-element.
 */
function movedBy(anims) {
	/** @type {Map<string, Moved>} */
	const moved = new Map();
	/** @type {Map<Element, number>} */
	const keyOf = new Map();
	for (const a of anims) {
		const fx = /** @type {KeyframeEffect | null} */ (a.effect);
		if (!fx?.target) continue;
		if (!keyOf.has(fx.target)) keyOf.set(fx.target, keyOf.size);
		const key = `${keyOf.get(fx.target)}${fx.pseudoElement ?? ''}`;
		const m = moved.get(key) ?? { el: fx.target, pseudo: fx.pseudoElement ?? undefined, props: /** @type {string[]} */ ([]) };
		m.props = mergeProps(m.props, keyframeProps(fx.getKeyframes()));
		moved.set(key, m);
	}
	return [...moved.values()];
}

/**
 * Holds the animations running under `root` (and on it).
 *
 * @param {Element} root The element.
 * @returns {Clock} The clock.
 */
export function clock(root) {
	const anims = root.getAnimations({ subtree: true });
	const was = anims.map((a) => ({ a, t: a.currentTime, running: a.playState === 'running' }));
	for (const a of anims) a.pause();
	const moved = movedBy(anims);
	return {
		count: anims.length,
		/**
		 * Sets every animation to the same moment.
		 *
		 * @param {number} ms From the animations' start.
		 */
		seek(ms) {
			for (const a of anims) a.currentTime = ms;
		},
		/**
		 * What the animations move.
		 *
		 * @returns {Moved[]} Each element (or pseudo-element) and its animated properties.
		 */
		moved: () => [...moved],
		/** Lets the animations run on from where they were. */
		release() {
			for (const { a, t, running } of was) {
				a.currentTime = t;
				if (running) a.play();
			}
		},
	};
}
