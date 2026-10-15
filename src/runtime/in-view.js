/**
 * @module @arraypress/effects-astro/in-view
 *
 * Calling back as an element scrolls into view, for effects that play on
 * arrival rather than run all the time.
 */

/**
 * Calls back when an element first comes into view (or at once, where
 * IntersectionObserver is missing).
 *
 * @param {Element} el The element.
 * @param {() => void} show Called when it is in view.
 * @param {boolean} [once=true] Stop watching after the first time.
 * @param {() => void} [hide] Called when it leaves view (when not `once`).
 * @returns {() => void} Stops watching.
 */
export function inView(el, show, once = true, hide) {
	if (typeof IntersectionObserver === 'undefined') {
		show();
		return () => {};
	}
	const observer = new IntersectionObserver(
		([entry]) => {
			if (entry.isIntersecting) {
				show();
				if (once) observer.disconnect();
			} else {
				hide?.();
			}
		},
		{ rootMargin: '0px 0px -10% 0px' },
	);
	observer.observe(el);
	return () => observer.disconnect();
}
