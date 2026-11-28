/**
 * @module @arraypress/effects-astro/loop
 *
 * One animation loop for every effect on the page. Each effect registers a
 * frame callback against its element; the loop calls it only while that
 * element is near the screen and the tab is showing, so a page full of
 * effects costs only what is in view.
 *
 * "Near" is within 128px of the viewport: an effect starts a moment before
 * it scrolls in, so it never appears frozen. The loop itself stops when
 * nothing needs it and starts again when something does.
 *
 * An export can hold the effects under an element (`holdFrames`): the loop
 * leaves them alone and the export steps them by hand at exact times, from
 * time 0, so frame N of a recording is the same every time. While a hold is
 * on, `frameNow()` (what effects read the time with instead of
 * `performance.now()`) reports the held time, so an effect that starts under
 * the hold starts at 0.
 */

/** How far outside the viewport an effect still runs, so it is moving when it arrives. */
const MARGIN = '128px';
/** The longest step a frame reports, in seconds: after a stall, effects resume rather than jump. */
const MAX_STEP = 1 / 20;

/**
 * @typedef {object} Hooks
 * @property {(on: boolean, ratio: number) => void} [hold] Called when an export holds the effect (`on`, with the pixel
 *   ratio to draw at: the export's resolution) and when it lets it go; the effect stops adapting its resolution while
 *   held.
 */

/**
 * @typedef {object} Entry
 * @property {Element} el The element whose visibility gates it.
 * @property {(now: number, dt: number) => void} frame The callback.
 * @property {boolean} near Whether the element is near the screen.
 * @property {Hooks} [hooks] What an export may ask of it.
 * @property {Hold} [held] The export holding it.
 */

/**
 * @typedef {object} Hold
 * @property {Element} root Whose effects it holds.
 * @property {number} ratio The pixel ratio they draw at while held.
 * @property {Map<Entry, number>} times Each held effect and the time it was last drawn at, ms (-1: not yet).
 */

/** @type {Set<Entry>} */
const entries = new Set();
/** @type {IntersectionObserver | null} */
let observer = null;
let raf = 0;
let last = 0;
/** @type {Set<Hold>} */
const holds = new Set();
/** The held time, ms, while any hold is on; null otherwise. */
let held = null;
/** The longest step a held effect is moved by at once, ms: a simulation steps as it would live (60 a second). */
const HELD_STEP = 1000 / 60;
/** @type {Set<Promise<unknown>>} The pictures effects are loading (`track`). */
const loads = new Set();

/**
 * Marks something an effect is loading (a picture) that changes what it draws once it arrives: a hold's `ready()` waits
 * for it, so a recording never starts on the frames before it. `loadImage` tracks its pictures.
 *
 * @template T
 * @param {Promise<T>} promise The load.
 * @returns {Promise<T>} The same promise.
 */
export function track(promise) {
	loads.add(promise);
	const done = () => loads.delete(promise);
	promise.then(done, done);
	return promise;
}

/** The page's own `Math.random`, while a hold swaps in a seeded one. */
let ownRandom = /** @type {(() => number) | null} */ (null);

/**
 * A seeded random in [0, 1) (mulberry32): the same numbers in the same order every time.
 *
 * @param {number} seed The seed.
 * @returns {() => number} The random.
 */
function seeded(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * The time effects draw at, ms: `performance.now()`, or the held time while an export holds effects
 * (`holdFrames`), so one that starts or draws a still under the hold reads the export's clock.
 *
 * @returns {number} The time, ms.
 */
export const frameNow = () => held ?? performance.now();

/**
 * The shared IntersectionObserver, made on first use (there is none on the
 * server).
 *
 * @returns {IntersectionObserver} The observer.
 */
function watcher() {
	observer ??= new IntersectionObserver(
		(changes) => {
			for (const change of changes) {
				for (const entry of entries) if (entry.el === change.target) entry.near = change.isIntersecting;
			}
			wake();
		},
		{ rootMargin: MARGIN },
	);
	return observer;
}

/**
 * Is any effect due a frame?
 *
 * @returns {boolean} True when some registered element is near the screen
 *   and the tab is showing.
 */
function due() {
	if (document.hidden) return false;
	for (const entry of entries) if (entry.near && !entry.held) return true;
	return false;
}

/**
 * One turn of the loop: every effect near the screen draws, then the loop
 * books the next turn if anything still needs it.
 *
 * @param {number} now The frame's timestamp.
 */
function tick(now) {
	const dt = last ? Math.min((now - last) / 1000, MAX_STEP) : 0;
	last = now;
	for (const entry of entries) if (entry.near && !entry.held) entry.frame(now, dt);
	raf = due() ? requestAnimationFrame(tick) : 0;
	if (!raf) last = 0;
}

/** Starts the loop if it is stopped and something needs it. */
function wake() {
	if (!raf && due()) raf = requestAnimationFrame(tick);
}

/**
 * Registers a frame callback, called while `el` is near the screen.
 *
 * @param {Element} el The element whose visibility gates it.
 * @param {(now: number, dt: number) => void} frame Draws one frame; `dt` is
 *   the seconds since the last, 0 on the first after a pause.
 * @param {Hooks} [hooks] What an export may ask of it (to draw at its resolution while held).
 * @returns {() => void} Unregisters it.
 */
export function animate(el, frame, hooks) {
	/** @type {Entry} */
	const entry = { el, frame, near: false, hooks };
	entries.add(entry);
	for (const h of holds) claim(h, entry);
	watcher().observe(el);
	return () => {
		entries.delete(entry);
		entry.held?.times.delete(entry);
		if (![...entries].some((e) => e.el === el)) watcher().unobserve(el);
	};
}

/**
 * Puts an effect under a hold, when it is the hold's element or inside it.
 *
 * @param {Hold} hold The hold.
 * @param {Entry} entry The effect.
 */
function claim(hold, entry) {
	if (entry.held || !(entry.el === hold.root || hold.root.contains(entry.el))) return;
	entry.held = hold;
	hold.times.set(entry, -1);
	entry.hooks?.hold?.(true, hold.ratio);
}

/**
 * @typedef {object} HeldFrames
 * @property {() => number} count How many effects it holds now.
 * @property {(timeout?: number) => Promise<number>} ready Resolves (with the count) once it holds at least one effect,
 *   for an effect started again under the hold; rejects after `timeout` ms (default 5000) with none.
 * @property {(ms: number) => void} seek Draws every held effect at `ms` from the hold's start: one that has not drawn
 *   yet starts at 0; one behind is stepped forward 1/60 s at a time (a simulation runs as it would live); one ahead
 *   is not stepped back (start it again, under a new hold, to go back). Synchronous: read the canvases right after.
 * @property {() => void} release Gives the effects back to the loop (and the time back to `performance.now()`).
 */

/**
 * Holds the effects under `root` for an export: the loop stops drawing them, and `seek` draws them by hand at exact
 * times from 0, frame by frame, however long each frame takes. Effects registered under `root` while it holds (one
 * started again for a clean run) are held from their first frame. Effects read `frameNow()`, the held time, and while
 * a hold is on `Math.random` is a seeded one (an effect's grain, its scatter), so a recording made this way is the same
 * every time; the page's own comes back when the last hold is released.
 *
 * @param {Element} root Whose effects to hold.
 * @param {{ ratio?: number, seed?: number }} [options] The pixel ratio they draw at while held (the export's resolution
 *   over the element's CSS size; default the device's), and the seed for `Math.random` while held (default 1).
 * @returns {HeldFrames} The hold.
 */
export function holdFrames(root, { ratio = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, seed = 1 } = {}) {
	/** @type {Hold} */
	const hold = { root, ratio, times: new Map() };
	if (!holds.size) {
		ownRandom = Math.random;
		Math.random = seeded(seed);
	}
	holds.add(hold);
	held = 0;
	for (const entry of entries) claim(hold, entry);
	return {
		count: () => hold.times.size,
		async ready(timeout = 5000) {
			const until = performance.now() + timeout;
			await new Promise((resolve, reject) => {
				(function wait() {
					if (hold.times.size) resolve(hold.times.size);
					else if (performance.now() > until) reject(new Error('holdFrames: no effect started under the element'));
					else setTimeout(wait, 30);
				})();
			});
			// and the pictures they're loading (a photo, a paint texture): a frame drawn before one arrives differs from
			// one drawn after, so every run waits for them (the effects' own handlers run first)
			while (loads.size && performance.now() < until + timeout) await Promise.race([Promise.allSettled([...loads]), new Promise((r) => setTimeout(r, 250))]);
			await new Promise((r) => setTimeout(r, 0));
			return hold.times.size;
		},
		seek(ms) {
			for (const [entry, at] of hold.times) {
				let t = at;
				if (t < 0) {
					held = 0;
					entry.frame(0, 0);
					t = 0;
				}
				while (t < ms - 1e-6) {
					const next = Math.min(ms, t + HELD_STEP);
					held = next;
					entry.frame(next, (next - t) / 1000);
					t = next;
				}
				hold.times.set(entry, t);
			}
			held = ms;
		},
		release() {
			if (!holds.delete(hold)) return;
			for (const entry of hold.times.keys()) {
				entry.held = undefined;
				entry.hooks?.hold?.(false, 1);
			}
			hold.times.clear();
			if (!holds.size) {
				held = null;
				if (ownRandom) Math.random = ownRandom;
				ownRandom = null;
			}
			last = 0;
			wake();
		},
	};
}

if (typeof document !== 'undefined') {
	document.addEventListener('visibilitychange', () => {
		if (document.hidden) {
			cancelAnimationFrame(raf);
			raf = 0;
			last = 0;
		} else {
			wake();
		}
	});
}
