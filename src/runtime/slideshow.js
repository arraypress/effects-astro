/**
 * @module @arraypress/effects-astro/slideshow
 *
 * What a slideshow does besides drawing its pictures: moving on by itself
 * every so often (paused while hovered, focused, pressed, off screen or in
 * a hidden tab), the arrow keys and a swipe for the previous and next, dots
 * that pick one, and the current picture's alt read out politely when a
 * person changed it. The effect draws each change; this decides when.
 */

import { animate } from './loop.js';
import { CLICK_IGNORE } from './pointer.js';

/** How far a swipe must travel across, CSS px, and the most it may take, ms. */
const SWIPE = { distance: 40, time: 800 };

/**
 * A slide number brought into range, wrapping round at either end.
 *
 * @param {number} i The number, any integer.
 * @param {number} count How many slides there are.
 * @returns {number} It, 0 to count - 1.
 */
export function wrap(i, count) {
	return ((i % count) + count) % count;
}

/**
 * Which way a finished drag goes: a quick, mostly sideways stroke far
 * enough across is a swipe.
 *
 * @param {number} dx How far it went right, px.
 * @param {number} dy How far it went down, px.
 * @param {number} ms How long it took.
 * @returns {-1 | 0 | 1} 1 for the next slide (a swipe left), -1 for the previous, 0 for no swipe.
 */
export function swipeStep(dx, dy, ms) {
	if (ms > SWIPE.time || Math.abs(dx) < SWIPE.distance || Math.abs(dx) < 1.5 * Math.abs(dy)) return 0;
	return dx < 0 ? 1 : -1;
}

/**
 * @typedef {object} SlideshowOptions
 * @property {number} count How many slides there are.
 * @property {number} [interval=5] Seconds each slide stays before the next, when playing.
 * @property {boolean} [autoplay=true] Move on by itself.
 * @property {(index: number) => string} [describe] What to read out for a slide (its alt).
 * @property {(to: number, from: number, dir: 1 | -1) => Promise<void> | void} show Draws the change;
 *   the slideshow waits for it before the next one, keeping the latest asked for meanwhile.
 */

/**
 * Runs a slideshow on an element: its `[data-slide-dot]` buttons pick a slide
 * (and carry `aria-current` and a `--slide-progress` 0–1 while playing),
 * and its `[data-slide-live]` element announces the slide a person moved to.
 *
 * @param {HTMLElement} el The slideshow (focusable, so it takes the arrow keys).
 * @param {SlideshowOptions} options The slides and how to show a change.
 * @returns {{ go: (to: number, dir?: 1 | -1, user?: boolean) => void, stop: () => void }} Moves to a slide; stops it all.
 */
export function slideshow(el, options) {
	const { count, interval = 5, autoplay = true, describe, show } = options;
	const dots = /** @type {HTMLElement[]} */ ([...el.querySelectorAll('[data-slide-dot]')]);
	const live = el.querySelector('[data-slide-live]');
	const held = { hover: false, focus: false, press: false };
	const playing = autoplay && count > 1;
	let index = 0;
	let busy = false;
	let stopped = false;
	let elapsed = 0;
	/** @type {{ to: number, dir: 1 | -1, user: boolean } | null} */
	let queued = null;
	/** @type {{ x: number, y: number, t: number } | null} */
	let down = null;

	/**
	 * Marks a slide current on the dots, and reads its alt out when a person chose it.
	 *
	 * @param {number} i The slide.
	 * @param {boolean} user Whether a person moved to it.
	 */
	const mark = (i, user) => {
		dots.forEach((dot, k) => {
			if (k === i) dot.setAttribute('aria-current', 'true');
			else dot.removeAttribute('aria-current');
			if (playing) dot.style.setProperty('--slide-progress', '0');
		});
		if (user && live && describe) live.textContent = `${i + 1} of ${count}: ${describe(i)}`;
	};

	/**
	 * Moves to a slide: now, or once the change on screen has finished.
	 *
	 * @param {number} to The slide (wrapped into range).
	 * @param {1 | -1} [dir] Which way it goes; by default the shorter way forward or back.
	 * @param {boolean} [user=false] Whether a person asked for it (it is then read out).
	 */
	const go = (to, dir, user = false) => {
		const target = wrap(to, count);
		const way = dir ?? (target >= index ? 1 : -1);
		if (stopped) return;
		if (busy) {
			queued = { to: target, dir: way, user };
			return;
		}
		if (target === index) return;
		const from = index;
		index = target;
		elapsed = 0;
		busy = true;
		mark(target, user);
		Promise.resolve(show(target, from, way))
			.catch(() => {})
			.then(() => {
				busy = false;
				const next = queued;
				queued = null;
				if (next) go(next.to, next.dir, next.user);
			});
	};

	/**
	 * Steps the timer while it may run, and moves on when it is up.
	 *
	 * @param {number} _now The time, ms.
	 * @param {number} dt Seconds since the last frame.
	 */
	const tick = (_now, dt) => {
		if (busy || held.hover || held.focus || held.press) return;
		elapsed += dt;
		dots[index]?.style.setProperty('--slide-progress', String(Math.min(1, elapsed / interval)));
		if (elapsed >= interval) go(index + 1, 1);
	};

	/**
	 * The arrow keys, while it has focus.
	 *
	 * @param {KeyboardEvent} e The key.
	 */
	const onKey = (e) => {
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		const by = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
		if (!by) return;
		e.preventDefault();
		go(index + by, /** @type {1 | -1} */ (by), true);
	};

	/**
	 * A dot pressed: its slide.
	 *
	 * @param {MouseEvent} e The click.
	 */
	const onClick = (e) => {
		const dot = /** @type {HTMLElement} */ (e.target).closest('[data-slide-dot]');
		const i = dot ? dots.indexOf(/** @type {HTMLElement} */ (dot)) : -1;
		if (i >= 0) go(i, i > index ? 1 : -1, true);
	};

	/**
	 * A press starts: a swipe, perhaps, unless it is on a control.
	 *
	 * @param {PointerEvent} e The press.
	 */
	const onDown = (e) => {
		if (!e.isPrimary || /** @type {HTMLElement} */ (e.target).closest(CLICK_IGNORE)) return;
		down = { x: e.clientX, y: e.clientY, t: e.timeStamp };
		held.press = true;
	};

	/**
	 * A press ends: a swipe moves on.
	 *
	 * @param {PointerEvent} e The release.
	 */
	const onUp = (e) => {
		held.press = false;
		if (!down || !e.isPrimary) return;
		const by = swipeStep(e.clientX - down.x, e.clientY - down.y, e.timeStamp - down.t);
		down = null;
		if (by) go(index + by, by, true);
	};

	/**
	 * A mouse over it holds the timer; a touch does not, as it never leaves.
	 *
	 * @param {PointerEvent} e The pointer.
	 */
	const onEnter = (e) => {
		if (e.pointerType === 'mouse') held.hover = true;
	};

	/** The mouse has left: the timer runs again. */
	const onLeave = () => {
		held.hover = false;
	};

	/** Focus inside it holds the timer, so a keyboard or screen reader user is not overtaken. */
	const onFocus = () => {
		held.focus = true;
	};

	/**
	 * Focus has left it altogether: the timer runs again.
	 *
	 * @param {FocusEvent} e The focus change.
	 */
	const onBlur = (e) => {
		if (!el.contains(/** @type {Node | null} */ (e.relatedTarget))) held.focus = false;
	};

	const listeners = /** @type {[string, (e: any) => void][]} */ ([
		['keydown', onKey],
		['click', onClick],
		['pointerdown', onDown],
		['pointerup', onUp],
		['pointercancel', onUp],
		['pointerenter', onEnter],
		['pointerleave', onLeave],
		['focusin', onFocus],
		['focusout', onBlur],
	]);
	for (const [type, fn] of listeners) el.addEventListener(type, fn);
	const stopTimer = playing ? animate(el, tick) : () => {};
	mark(0, false);

	return {
		go,
		stop: () => {
			stopped = true;
			stopTimer();
			for (const [type, fn] of listeners) el.removeEventListener(type, fn);
		},
	};
}
