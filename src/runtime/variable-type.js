/**
 * @module @arraypress/effects-astro/variable-type
 *
 * A variable-font headline whose letters swell under the pointer: each
 * letter's axes (weight and width by default, any others the font has)
 * run from rest to peak by its distance from the pointer, on a spring, so
 * a pass over the word rolls through it like a wave and settles back when
 * the pointer leaves. With nothing over it, a gentle swell travels along
 * the line on its own.
 *
 * A swell widens the line. A fitted line (`fit`) is sized so that at its
 * widest swell it spans its parent, with room either side at rest.
 *
 * The text stays real DOM text, split into one span a letter
 * (`splitLetters`): selectable, found by search, read as words. Letter
 * positions (and a fitted line's size) are read once, at rest, when the
 * text changes size or its fonts load; each frame only writes, a
 * `font-variation-settings` and a `--swell` (0 rest, 1 peak, for CSS) to
 * each letter that moved, in steps, so the browser reuses the font
 * instances it builds. Touch follows the finger; with
 * prefers-reduced-motion the text stays at rest, a fitted line at the size
 * it has in motion.
 */

import { prefersReducedMotion } from './device.js';
import { fit, fitText } from './fit-text.js';
import { animate } from './loop.js';
import { pointerIn } from './pointer.js';
import { joinLetters, splitLetters } from './text.js';

/**
 * @typedef {Record<string, [number, number]>} Axes Each axis by its tag
 *   (`wght`, `wdth`, `slnt`, `opsz`…): its value at rest, then at the peak of a swell.
 */

/**
 * @typedef {object} VariableTypeConfig
 * @property {Axes} [axes] The axes that swell, `{ tag: [rest, peak] }` (default `{ wght: [100, 900], wdth: [75, 125] }`). Axes the font lacks do nothing.
 * @property {number} [radius=1.1] How far a swell reaches from the pointer, in ems.
 * @property {number} [falloff=0.5] How it drops off: 0 a broad hill, 1 a sharp peak.
 * @property {number} [idle=0.35] How far the travelling swell rises with nothing over the text: 0 none, 1 to the peak.
 * @property {boolean} [fit=false] Size the line so that at its widest swell it spans its parent's width.
 */

/** @typedef {{ tag: string, rest: number, peak: number }} Axis */

/** The axes when none are given. */
export const DEFAULT_AXES = /** @type {Axes} */ ({ wght: [100, 900], wdth: [75, 125] });

/** The spring's stiffness, per second squared. */
const STIFFNESS = 150;
/** The spring's damping: a touch under critical, so a swell overshoots a hair and settles. */
const DAMPING = 2 * 0.72 * Math.sqrt(STIFFNESS);
/** How long the pointer must be gone before the idle swell starts, ms. */
const IDLE_AFTER = 1400;
/** The idle swell's wavelength, in ems. */
const WAVELENGTH = 5.5;
/** How fast the idle swell travels, ems a second. */
const TRAVEL = 1.6;
/** Vertical distance counts for this much of horizontal: a tall letter swells along its whole height. */
const SQUASH = 0.5;
/** Room left for a spring overshooting its swell, a share of the widest. */
const OVERSHOOT = 1.08;
/** Crest positions tried per letter when finding the widest swell. */
const SAMPLES = 8;
/**
 * Swells are written in steps this fine: every distinct setting is a font
 * instance the browser builds and caches, so a few dozen steps stay cheap
 * where a continuous value would build a new one every frame.
 */
const STEPS = 64;

/**
 * The axes as a list, keeping only four-letter tags with two numbers.
 *
 * @param {Axes | undefined} axes The axes, `{ tag: [rest, peak] }`.
 * @returns {Axis[]} Each axis, in order.
 */
export function axisList(axes = DEFAULT_AXES) {
	return Object.entries(axes ?? DEFAULT_AXES)
		.filter(([tag, ends]) => /^[a-zA-Z0-9]{4}$/.test(tag) && Array.isArray(ends) && ends.length === 2 && ends.every(Number.isFinite))
		.map(([tag, [rest, peak]]) => ({ tag, rest, peak }));
}

/**
 * A `font-variation-settings` value, part of the way from rest to peak.
 *
 * @param {Axis[]} axes The axes.
 * @param {number} amount 0 at rest, 1 at the peak (a spring may overshoot either).
 * @returns {string} The settings, e.g. `"wght" 500, "wdth" 100`; `normal` with no axes.
 */
export function variation(axes, amount) {
	if (!axes.length) return 'normal';
	return axes.map(({ tag, rest, peak }) => `"${tag}" ${Math.round((rest + (peak - rest) * amount) * 10) / 10}`).join(', ');
}

/**
 * How much a letter swells at a distance from the pointer.
 *
 * @param {number} distance The distance, in ems.
 * @param {number} radius The swell's reach, in ems.
 * @param {number} falloff 0 a broad hill, 1 a sharp peak.
 * @returns {number} 1 under the pointer, easing to 0 at `radius` and beyond.
 */
export function swell(distance, radius, falloff) {
	if (!(radius > 0) || distance >= radius) return 0;
	const t = 1 - Math.max(0, distance) / radius;
	const smooth = t * t * (3 - 2 * t);
	return smooth ** (0.6 + Math.min(1, Math.max(0, falloff)) * 2.4);
}

/**
 * The idle swell at a point along the line: soft crests, a wavelength
 * apart, travelling left to right.
 *
 * @param {number} x The point, in ems from the text's left.
 * @param {number} time Seconds.
 * @returns {number} 0 to 1.
 */
export function idleWave(x, time) {
	const phase = ((x - time * TRAVEL) / WAVELENGTH) * Math.PI * 2;
	return (0.5 + 0.5 * Math.cos(phase)) ** 4;
}

/**
 * How much wider a line gets at its widest swell: the crest is tried all
 * along it, and each letter grows by its share of the swell there.
 *
 * @param {ArrayLike<number>} xs Each letter's centre, in ems along the line.
 * @param {ArrayLike<number>} growth How much wider each letter is at its peak than at rest.
 * @param {(offset: number) => number} shape The swell, 0 to 1, a letter `offset` ems from the crest.
 * @returns {number} The most the line grows, in `growth`'s units.
 */
export function widestSwell(xs, growth, shape) {
	const n = xs.length;
	if (!n) return 0;
	const from = xs[0];
	const span = xs[n - 1] - from;
	const tries = Math.max(1, (n - 1) * SAMPLES);
	let widest = 0;
	for (let t = 0; t <= tries; t++) {
		const crest = from + (span * t) / tries;
		let total = 0;
		for (let i = 0; i < n; i++) total += growth[i] * shape(xs[i] - crest);
		widest = Math.max(widest, total);
	}
	return widest;
}

/**
 * Starts the swell on an element.
 *
 * @param {HTMLElement} el The text, set in a variable font.
 * @param {VariableTypeConfig} config The settings.
 * @returns {() => void} Stops it and puts the text back as it was.
 */
export function variableType(el, config) {
	const axes = axisList(config.axes);
	el.style.fontVariationSettings = variation(axes, 0);
	const fitting = config.fit === true;
	if (!axes.length) return fitting ? fitText(el) : () => {};
	// Still, a fitted line keeps the size it has in motion; anything else needs nothing.
	const still = prefersReducedMotion();
	if (still && !fitting) return () => {};
	const radius = config.radius ?? 1.1;
	const falloff = config.falloff ?? 0.5;
	const idle = Math.min(1, Math.max(0, config.idle ?? 0.35));
	const letters = splitLetters(el);
	const count = letters.length;
	const value = new Float32Array(count);
	const velocity = new Float32Array(count);
	const written = new Float32Array(count).fill(-1);
	/** Each letter's centre at rest, in ems from the element's top left. */
	let centres = new Float32Array(count * 2);
	let em = 16;
	let width = 1;
	let height = 1;
	let dirty = true;
	let raf = 0;
	let resting = false;
	let gain = 0;
	let lastSeen = -Infinity;
	/** @type {{ x: number, y: number } | null} The finger, in ems from the element's top left. */
	let touch = null;

	/**
	 * Sizes a fitted line: fitted to its parent at rest, then made smaller
	 * by as much as its widest swell (the pointer's or the idle one's) would
	 * add, so that at its widest it spans the parent. Read with every letter
	 * at rest and then at its peak.
	 */
	const fitWithRoom = () => {
		fit(el);
		const size = parseFloat(getComputedStyle(el).fontSize) || 16;
		const rest = letters.map((letter) => letter.getBoundingClientRect());
		const peak = variation(axes, 1);
		for (const letter of letters) letter.style.fontVariationSettings = peak;
		const growth = letters.map((letter, i) => letter.getBoundingClientRect().width - rest[i].width);
		for (const letter of letters) letter.style.removeProperty('font-variation-settings');
		const xs = rest.map((r) => (r.left + r.width / 2) / size);
		const line = rest[count - 1].right - rest[0].left;
		const pointer = widestSwell(xs, growth, (offset) => swell(Math.abs(offset), radius, falloff));
		const drift = widestSwell(xs, growth, (offset) => idle * idleWave(offset, 0));
		const widest = Math.max(pointer, drift) * OVERSHOOT;
		if (line > 0 && widest > 0) el.style.fontSize = `${Math.floor(((size * line) / (line + widest)) * 100) / 100}px`;
	};

	/** Reads every letter's centre with the text at rest, sizing a fitted line first. */
	const measure = () => {
		for (const letter of letters) letter.style.removeProperty('font-variation-settings');
		if (fitting && count) fitWithRoom();
		const box = el.getBoundingClientRect();
		em = parseFloat(getComputedStyle(el).fontSize) || 16;
		width = box.width || 1;
		height = box.height || 1;
		centres = new Float32Array(count * 2);
		letters.forEach((letter, i) => {
			const r = letter.getBoundingClientRect();
			centres[i * 2] = (r.left + r.width / 2 - box.left) / em;
			centres[i * 2 + 1] = (r.top + r.height / 2 - box.top) / em;
		});
		written.fill(-1);
		resting = false;
	};

	/**
	 * One frame: each letter's spring heads for its swell, and the letters
	 * that moved are written.
	 *
	 * @param {number} now The frame's time, ms.
	 * @param {number} dt Seconds since the last frame.
	 */
	const frame = (now, dt) => {
		if (dirty) {
			dirty = false;
			measure();
		}
		let px = 0;
		let py = 0;
		let present = false;
		if (touch) {
			({ x: px, y: py } = touch);
			present = true;
		} else {
			const p = pointerIn(el);
			if (p.inside) {
				px = (p.x * width) / em;
				py = ((1 - p.y) * height) / em;
				present = true;
			}
		}
		if (present) lastSeen = now;
		const wanted = idle > 0 && now - lastSeen > IDLE_AFTER ? 1 : 0;
		gain += (wanted - gain) * Math.min(1, dt * 0.9);
		if (Math.abs(wanted - gain) < 0.001) gain = wanted;
		if (resting && !present && gain === 0) return;
		const time = now / 1000;
		let moving = gain !== wanted;
		for (let i = 0; i < count; i++) {
			const cx = centres[i * 2];
			const cy = centres[i * 2 + 1];
			let goal = present ? swell(Math.hypot(px - cx, (py - cy) * SQUASH), radius, falloff) : 0;
			if (gain > 0) goal = Math.max(goal, gain * idle * idleWave(cx, time));
			velocity[i] += (STIFFNESS * (goal - value[i]) - DAMPING * velocity[i]) * dt;
			value[i] += velocity[i] * dt;
			if (Math.abs(velocity[i]) < 0.002 && Math.abs(goal - value[i]) < 0.002) {
				value[i] = goal;
				velocity[i] = 0;
			} else {
				moving = true;
			}
			const step = Math.round(value[i] * STEPS) / STEPS;
			if (step === written[i]) continue;
			written[i] = step;
			const letter = letters[i];
			letter.style.fontVariationSettings = variation(axes, step);
			letter.style.setProperty('--swell', step.toFixed(3));
		}
		resting = !moving && gain === 0 && !present;
	};

	/**
	 * Follows a finger on the text (a mouse is read from the page's pointer).
	 *
	 * @param {PointerEvent} e The press or move.
	 */
	const finger = (e) => {
		if (e.pointerType !== 'touch') return;
		const box = el.getBoundingClientRect();
		touch = { x: (e.clientX - box.left) / em, y: (e.clientY - box.top) / em };
		resting = false;
	};
	/** The finger has lifted, or the page took it to scroll. */
	const lift = () => {
		touch = null;
	};

	/**
	 * Marks the letters for reading again: on the next frame in motion, or
	 * on its own frame when still.
	 */
	const invalidate = () => {
		dirty = true;
		if (!still || raf) return;
		raf = requestAnimationFrame(() => {
			raf = 0;
			dirty = false;
			measure();
		});
	};

	// Re-read the letters when the line's width changes or the text's
	// height does (a refit, a font arriving), never on a swell itself.
	let lineWidth = -1;
	let textHeight = -1;
	const observer = new ResizeObserver((entries) => {
		for (const entry of entries) {
			const own = entry.target === el;
			const size = Math.round(own ? entry.contentRect.height : entry.contentRect.width);
			if (size === (own ? textHeight : lineWidth)) continue;
			if (own) textHeight = size;
			else lineWidth = size;
			invalidate();
		}
	});
	observer.observe(el);
	if (el.parentElement) observer.observe(el.parentElement);
	// A font is only fetched once text needs it, so `ready` can resolve before
	// a hidden headline's has even started; `loadingdone` catches it arriving.
	document.fonts?.ready.then(invalidate).catch(() => {});
	document.fonts?.addEventListener('loadingdone', invalidate);
	invalidate();
	if (still) {
		return () => {
			cancelAnimationFrame(raf);
			observer.disconnect();
			document.fonts?.removeEventListener('loadingdone', invalidate);
			joinLetters(el);
		};
	}

	el.addEventListener('pointerdown', finger);
	el.addEventListener('pointermove', finger, { passive: true });
	el.addEventListener('pointerup', lift);
	el.addEventListener('pointercancel', lift);
	const stop = animate(el, frame);

	return () => {
		stop();
		observer.disconnect();
		document.fonts?.removeEventListener('loadingdone', invalidate);
		el.removeEventListener('pointerdown', finger);
		el.removeEventListener('pointermove', finger);
		el.removeEventListener('pointerup', lift);
		el.removeEventListener('pointercancel', lift);
		joinLetters(el);
	};
}
