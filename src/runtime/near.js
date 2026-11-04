/**
 * @module @arraypress/effects-astro/near
 *
 * Runs an effect only while its element is near the screen: started as it
 * comes within `margin` of the viewport, stopped (its WebGL context given
 * back) as it leaves. A browser keeps about sixteen WebGL contexts at once
 * and drops the oldest past that, so a page with many effects (a wall of
 * cards, a long list) needs this; `mount` uses it for any element marked
 * `lazy`. While running, the element carries `data-effect-live`, which the
 * stylesheet can fade the canvas in on.
 */

/** One observer per margin, shared by every element that uses it. */
/** @type {Map<string, { observer: IntersectionObserver, handlers: Map<Element, (near: boolean) => void> }>} */
const observers = new Map();

/**
 * The shared observer for a margin, made on first use.
 *
 * @param {string} margin A CSS length for `rootMargin`'s top and bottom (and left and right).
 * @returns {{ observer: IntersectionObserver, handlers: Map<Element, (near: boolean) => void> }} It and its handlers.
 */
function observerFor(margin) {
	let entry = observers.get(margin);
	if (!entry) {
		/** @type {Map<Element, (near: boolean) => void>} */
		const handlers = new Map();
		const observer = new IntersectionObserver(
			(changes) => {
				for (const change of changes) handlers.get(change.target)?.(change.isIntersecting);
			},
			{ rootMargin: `${margin} ${margin}` },
		);
		entry = { observer, handlers };
		observers.set(margin, entry);
	}
	return entry;
}

/**
 * Starts `start` while `el` is within `margin` of the viewport, and stops it
 * when it moves further away; again each time it comes back.
 *
 * @param {HTMLElement} el The element to watch.
 * @param {() => (() => void) | void} start Starts the effect; returns how to stop it.
 * @param {{ margin?: string }} [options] How near counts as near (CSS length). Default `200px`.
 * @returns {() => void} Stops watching, and stops the effect if it is running.
 */
export function whenNear(el, start, { margin = '200px' } = {}) {
	/** @type {(() => void) | null} */
	let stop = null;
	/** Starts the effect, if it isn't running. */
	const on = () => {
		if (stop) return;
		stop = start() ?? (() => {});
		el.setAttribute('data-effect-live', '');
	};
	/** Stops the effect, if it's running. */
	const off = () => {
		if (!stop) return;
		const s = stop;
		stop = null;
		el.removeAttribute('data-effect-live');
		s();
	};
	if (typeof IntersectionObserver === 'undefined') {
		on();
		return off;
	}
	const { observer, handlers } = observerFor(margin);
	handlers.set(el, (near) => (near ? on() : off()));
	observer.observe(el);
	return () => {
		observer.unobserve(el);
		handlers.delete(el);
		off();
	};
}

/**
 * Reads how lazy an element is: its `data-effect-lazy` attribute, or a
 * `lazy` setting in its config (true for the default margin, or a length).
 *
 * @param {HTMLElement} el The element.
 * @param {Record<string, unknown>} config Its settings.
 * @returns {string | null} The margin to start within, or null to start at once.
 */
export function lazyMargin(el, config) {
	const attr = el.dataset.effectLazy;
	if (attr !== undefined) return attr || '200px';
	if (config.lazy === true) return '200px';
	if (typeof config.lazy === 'string' && config.lazy) return config.lazy;
	return null;
}
