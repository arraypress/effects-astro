/**
 * @module @arraypress/effects-astro/budget
 *
 * A cap on how many things run at once. Live effects share two scarce
 * things: WebGL contexts (a browser keeps about sixteen and drops the
 * oldest past that, which leaves an effect's canvas blank) and the main
 * thread (the costly ones). A budget lets only so many run together; the
 * rest wait their turn, in the order they asked, and start as one stops.
 * It pairs with `whenNear`: an effect takes a turn as it nears the screen
 * and gives it back as it leaves.
 */

/**
 * A budget of `cap` things running at once.
 *
 * @param {number} cap How many may run together.
 * @returns {(key: object, run: () => () => void) => () => void} `take(key, run)`: runs `run` now if there is room, or when a turn comes up, and returns how to give the turn back (stopping what ran, or leaving the queue), which lets the longest-waiting one start.
 */
export function budget(cap) {
	/** @type {Map<object, () => void>} */
	const live = new Map();
	/** @type {Map<object, () => () => void>} */
	const waiting = new Map();

	/**
	 * Runs one now.
	 *
	 * @param {object} key What it is.
	 * @param {() => () => void} run Starts it; returns how to stop it.
	 */
	const start = (key, run) => {
		waiting.delete(key);
		live.set(key, run());
	};

	return (key, run) => {
		if (live.size < cap) start(key, run);
		else waiting.set(key, run);
		return () => {
			waiting.delete(key);
			const stop = live.get(key);
			if (!stop) return;
			live.delete(key);
			stop();
			const next = waiting.entries().next().value;
			if (next) start(next[0], next[1]);
		};
	};
}
