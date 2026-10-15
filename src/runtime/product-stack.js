/**
 * @module @arraypress/effects-astro/product-stack
 *
 * Product covers floating in 3D, in a fan, a stack or an arc
 * (src/runtime/stack-poses.js places them). The covers are the page's own
 * links and images, moved by CSS transforms, so they stay crisp, take
 * focus and click through like any link. This module only decides which
 * pose each cover is in and writes it; CSS eases between poses, floats the
 * covers and sweeps the sheen, all on the compositor, so nothing runs on
 * the main thread while the stack sits still.
 *
 *   - Pointer: the stack leans towards it, wherever it is on the page.
 *   - Hover (or focus): the covers fan apart, and the one under the
 *     pointer (or focused) lifts forward, comes into focus and pushes its
 *     neighbours aside.
 *   - Depth of field: covers further from the one in front dim and lose a
 *     little colour; only the furthest blur, a little.
 *
 * With reduced motion it holds still and does not lean; hover and focus
 * still lift a cover, without easing. On a touch screen it does not lean
 * or fan: a tap is a tap on the link.
 */

import { canHover, prefersReducedMotion } from './device.js';
import { inView } from './in-view.js';
import { frontOf, layoutOf, poseFilter, poseTransform, stackBounds, stackPoses } from './stack-poses.js';

/**
 * @typedef {object} ProductStackConfig
 * @property {'fan' | 'stack' | 'arc'} [layout='fan'] How the covers are laid out.
 * @property {number} [spread=1] How far apart the covers sit, 0–2.
 * @property {number} [tilt=12] How far the stack leans towards the pointer, degrees.
 * @property {number} [depth=0.6] How much the covers behind dim and soften, 0–1.
 * @property {boolean} [interactive=true] Lean, fan and lift for the pointer and keyboard.
 * @property {number} [ratio=1] A cover's width over its height.
 */

/**
 * Lays out an element's covers and, unless it is not interactive, has
 * them answer the pointer and keyboard. The element holds a `.ps-scene`
 * with a `.ps-stage` in it, whose children are the covers.
 *
 * @param {HTMLElement} el The component's element.
 * @param {ProductStackConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function productStack(el, config) {
	const scene = /** @type {HTMLElement | null} */ (el.querySelector('.ps-scene'));
	const stage = /** @type {HTMLElement | null} */ (el.querySelector('.ps-stage'));
	if (!scene || !stage) return () => {};
	const covers = /** @type {HTMLElement[]} */ ([...stage.children]);
	const n = covers.length;
	const layout = layoutOf(config.layout);
	const spread = config.spread ?? 1;
	const depth = config.depth ?? 0.6;
	const ratio = config.ratio && config.ratio > 0 ? config.ratio : 1;
	const tilt = config.tilt ?? 12;
	const still = prefersReducedMotion();
	let open = false;
	let lifted = -1;

	const bounds = stackBounds(layout, n, spread, ratio);
	el.style.setProperty('--ps-wide', String(bounds.wide));
	el.style.setProperty('--ps-tall', String(bounds.tall));
	el.style.setProperty('--ps-ratio', String(ratio));
	covers.forEach((cover, i) => {
		cover.style.setProperty('--ps-i', String(i));
		cover.querySelectorAll('img').forEach((img) => (img.draggable = false));
	});

	/** Writes every cover's pose for the state the stack is in, and marks the one in front. */
	const pose = () => {
		const front = lifted >= 0 ? lifted : Math.floor(frontOf(layout, n));
		stackPoses(layout, n, { spread, open, lifted }).forEach((p, i) => {
			covers[i].style.transform = poseTransform(p);
			covers[i].style.filter = poseFilter(p, depth);
			covers[i].classList.toggle('is-front', i === front);
			covers[i].classList.toggle('is-lifted', i === lifted);
		});
	};

	/**
	 * Moves to a new state, if it is one.
	 *
	 * @param {boolean} nextOpen Whether the covers fan apart.
	 * @param {number} nextLifted The cover lifted forward; -1 for none.
	 */
	const set = (nextOpen, nextLifted) => {
		if (nextOpen === open && nextLifted === lifted) return;
		open = nextOpen;
		lifted = nextLifted;
		pose();
	};

	pose();
	// Ease only from the first change on: the stack is in place when it appears.
	const ready = requestAnimationFrame(() => el.classList.add('is-ready'));
	/** @type {Array<() => void>} */
	const stops = [() => cancelAnimationFrame(ready)];

	/**
	 * Listens to an event, and remembers to stop.
	 *
	 * @param {EventTarget} target What to listen to.
	 * @param {string} type The event.
	 * @param {(e: any) => void} handler The listener.
	 */
	const on = (target, type, handler) => {
		target.addEventListener(type, handler, { passive: true });
		stops.push(() => target.removeEventListener(type, handler));
	};

	/**
	 * The cover an event happened in.
	 *
	 * @param {Event} e The event.
	 * @returns {number} Its index; -1 when it was in none.
	 */
	const coverOf = (e) => covers.findIndex((cover) => cover.contains(/** @type {Node | null} */ (e.target)));

	if (config.interactive !== false) {
		/** @param {PointerEvent} e The pointer coming over the stack, or moving over it. */
		const hover = (e) => {
			if (e.pointerType !== 'touch') set(true, coverOf(e));
		};
		on(scene, 'pointerover', hover);
		on(scene, 'pointerleave', () => set(Boolean(scene.querySelector(':focus-visible')), -1));
		on(scene, 'focusin', (e) => set(true, coverOf(e)));
		on(scene, 'focusout', (/** @type {FocusEvent} */ e) => {
			if (!scene.contains(/** @type {Node | null} */ (e.relatedTarget))) set(scene.matches(':hover'), -1);
		});
		if (!still && canHover() && tilt > 0) stops.push(lean(el, scene, tilt));
	}

	// Asleep while out of view: the float and sheen stop with it.
	stops.push(inView(el, () => el.classList.remove('is-asleep'), false, () => el.classList.add('is-asleep')));
	return () => stops.forEach((stop) => stop());
}

/**
 * Leans a stack towards the pointer, anywhere on the page, while it is in
 * view: `--ps-lean-x` / `--ps-lean-y` (degrees) on the element turn its
 * stage, and `--ps-glint-x` / `--ps-glint-y` (-1 to 1) move the covers'
 * gloss the other way, as a light would. One read and one write a frame at
 * most, and only while the pointer moves.
 *
 * @param {HTMLElement} el The component's element.
 * @param {HTMLElement} scene The box the stack sits in; it leans about its centre.
 * @param {number} tilt The most it leans, degrees.
 * @returns {() => void} Stops it.
 */
function lean(el, scene, tilt) {
	let x = 0;
	let y = 0;
	let inside = false;
	let frame = 0;

	/** Writes the lean for where the pointer last was. */
	const write = () => {
		frame = 0;
		const box = scene.getBoundingClientRect();
		const reach = { x: Math.max(window.innerWidth * 0.5, 1), y: Math.max(window.innerHeight * 0.5, 1) };
		const nx = inside ? Math.max(-1, Math.min(1, (x - (box.left + box.width / 2)) / reach.x)) : 0;
		const ny = inside ? Math.max(-1, Math.min(1, (y - (box.top + box.height / 2)) / reach.y)) : 0;
		el.style.setProperty('--ps-lean-x', `${(-ny * tilt * 0.6).toFixed(2)}deg`);
		el.style.setProperty('--ps-lean-y', `${(nx * tilt).toFixed(2)}deg`);
		el.style.setProperty('--ps-glint-x', (-nx).toFixed(3));
		el.style.setProperty('--ps-glint-y', (-ny).toFixed(3));
	};

	/** Books a write for the next frame, if none is booked. */
	const book = () => {
		frame ||= requestAnimationFrame(write);
	};

	/** @param {PointerEvent} e The move. */
	const move = (e) => {
		if (e.pointerType === 'touch') return;
		x = e.clientX;
		y = e.clientY;
		inside = true;
		book();
	};

	/** The pointer left the window: settle back. */
	const leave = () => {
		inside = false;
		book();
	};

	/** Starts following the pointer. */
	const listen = () => {
		document.addEventListener('pointermove', move, { passive: true });
		document.documentElement.addEventListener('pointerleave', leave);
	};

	/** Stops following the pointer. */
	const quiet = () => {
		document.removeEventListener('pointermove', move);
		document.documentElement.removeEventListener('pointerleave', leave);
		cancelAnimationFrame(frame);
		frame = 0;
	};

	const watching = inView(el, listen, false, quiet);
	return () => {
		watching();
		quiet();
	};
}
