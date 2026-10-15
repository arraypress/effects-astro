/**
 * @module @arraypress/effects-astro/text-motion
 *
 * Text that arrives:
 *
 *   - `scramble`: the text resolves out of random characters, left to
 *     right, when it scrolls into view (and again on hover, if asked).
 *   - `typewriter`: types a list of phrases one after another, deleting
 *     each before the next, behind a blinking caret.
 *   - `reveal`: the element, or its words, rise and fade into place as
 *     they scroll into view, one after another.
 *
 * The full text is always in the page for assistive technology and
 * search; the motion is drawn over it. With prefers-reduced-motion the
 * text is simply there.
 */

import { prefersReducedMotion } from './device.js';
import { inView } from './in-view.js';

/**
 * @typedef {object} ScrambleConfig
 * @property {string} [characters] What it scrambles through (default letters, digits and a few symbols).
 * @property {number} [duration=0.9] Seconds to resolve.
 * @property {boolean} [hover=false] Scramble again when the pointer comes over it.
 */

/**
 * @typedef {object} TypewriterConfig
 * @property {string[]} phrases What it types, in turn.
 * @property {number} [speed=55] Milliseconds a character when typing.
 * @property {number} [pause=1600] Milliseconds a finished phrase stays.
 * @property {boolean} [loop=true] Start again after the last.
 */

/**
 * @typedef {object} RevealConfig
 * @property {'up' | 'down' | 'left' | 'right' | 'fade' | 'zoom' | 'blur'} [from='up'] How it arrives.
 * @property {boolean} [words=false] Each word arrives on its own, one after another.
 * @property {number} [stagger=0.06] Seconds between words.
 * @property {number} [delay=0] Seconds before it starts.
 * @property {boolean} [once=true] Only the first time it comes into view.
 */

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*+=/<>';

/**
 * Resolves an element's text out of random characters.
 *
 * @param {HTMLElement} el The text (its `data-text`, or its text, is the final text).
 * @param {ScrambleConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function scramble(el, config) {
	const final = el.dataset.text ?? el.textContent ?? '';
	if (prefersReducedMotion()) return () => {};
	const glyphs = config.characters ?? GLYPHS;
	const duration = (config.duration ?? 0.9) * 1000;
	const shown = /** @type {HTMLElement} */ (el.querySelector('[data-scramble-shown]'));
	if (!shown) return () => {};
	let raf = 0;

	/** Runs the scramble once. */
	const play = () => {
		cancelAnimationFrame(raf);
		const start = performance.now();
		/**
		 * One frame: each character still scrambling gets a random glyph.
		 *
		 * @param {number} now The frame's time.
		 */
		const tick = (now) => {
			const done = Math.min(1, (now - start) / duration);
			// Each character settles in its turn, left to right.
			let out = '';
			for (let i = 0; i < final.length; i++) {
				const ch = final[i];
				const settles = i / final.length;
				out += ch === ' ' || done >= settles + 0.15 ? ch : glyphs[(Math.random() * glyphs.length) | 0];
			}
			shown.textContent = out;
			if (done < 1) raf = requestAnimationFrame(tick);
			else shown.textContent = final;
		};
		raf = requestAnimationFrame(tick);
	};

	const unwatch = inView(el, play);
	if (config.hover) el.addEventListener('pointerenter', play);
	return () => {
		unwatch();
		cancelAnimationFrame(raf);
		el.removeEventListener('pointerenter', play);
		shown.textContent = final;
	};
}

/**
 * Types phrases one after another.
 *
 * @param {HTMLElement} el The element (its `[data-typed]` child gets the text).
 * @param {TypewriterConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function typewriter(el, config) {
	const typed = el.querySelector('[data-typed]');
	const phrases = config.phrases ?? [];
	if (!(typed instanceof HTMLElement) || !phrases.length) return () => {};
	if (prefersReducedMotion()) {
		typed.textContent = phrases[0];
		return () => {};
	}
	const speed = config.speed ?? 55;
	const pause = config.pause ?? 1600;
	let phrase = 0;
	let length = 0;
	let deleting = false;
	let timer = 0;

	/** One keystroke, and the next booked. */
	const step = () => {
		const text = phrases[phrase];
		length += deleting ? -1 : 1;
		typed.textContent = text.slice(0, length);
		let wait = deleting ? speed / 2 : speed;
		if (!deleting && length >= text.length) {
			if (phrase === phrases.length - 1 && config.loop === false) return;
			deleting = true;
			wait = pause;
		} else if (deleting && length <= 0) {
			deleting = false;
			phrase = (phrase + 1) % phrases.length;
			wait = speed * 6;
		}
		timer = window.setTimeout(step, wait);
	};
	const unwatch = inView(el, () => {
		timer = window.setTimeout(step, speed);
	});
	return () => {
		unwatch();
		clearTimeout(timer);
	};
}

/**
 * Brings an element (or its words) into place as it scrolls into view.
 *
 * @param {HTMLElement} el The element.
 * @param {RevealConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function reveal(el, config) {
	if (prefersReducedMotion()) {
		el.classList.add('is-revealed');
		return () => {};
	}
	el.classList.add('is-waiting');
	return inView(
		el,
		() => el.classList.add('is-revealed'),
		config.once !== false,
		() => el.classList.remove('is-revealed'),
	);
}
