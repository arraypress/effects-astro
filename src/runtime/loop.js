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
 */

/** How far outside the viewport an effect still runs, so it is moving when it arrives. */
const MARGIN = '128px';
/** The longest step a frame reports, in seconds: after a stall, effects resume rather than jump. */
const MAX_STEP = 1 / 20;

/**
 * @typedef {object} Entry
 * @property {Element} el The element whose visibility gates it.
 * @property {(now: number, dt: number) => void} frame The callback.
 * @property {boolean} near Whether the element is near the screen.
 */

/** @type {Set<Entry>} */
const entries = new Set();
/** @type {IntersectionObserver | null} */
let observer = null;
let raf = 0;
let last = 0;

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
	for (const entry of entries) if (entry.near) return true;
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
	for (const entry of entries) if (entry.near) entry.frame(now, dt);
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
 * @returns {() => void} Unregisters it.
 */
export function animate(el, frame) {
	/** @type {Entry} */
	const entry = { el, frame, near: false };
	entries.add(entry);
	watcher().observe(el);
	return () => {
		entries.delete(entry);
		if (![...entries].some((e) => e.el === el)) watcher().unobserve(el);
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
