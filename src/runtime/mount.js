/**
 * @module @arraypress/effects-astro/mount
 *
 * Starts every instance of an effect on the page, and starts them again
 * after an Astro view transition swaps the page in. Elements added to the
 * page later (by a script, a template, a client-side list) start too, and
 * elements taken out stop, so a page can bring effects in and out as it
 * scrolls and never hold more WebGL contexts than it shows. Each component renders
 * an element with its settings as JSON in `data-effect-config`; the setup
 * function is called once per element with those settings, and the
 * function it returns is called when the element leaves the page.
 */

/** @type {Map<string, (el: HTMLElement, config: any) => (() => void) | void>} */
const effects = new Map();
/** For each registered selector, its running elements and how to stop each: one element can carry several effects. */
/** @type {Map<string, Map<HTMLElement, () => void>>} */
const running = new Map();
let listening = false;
let queued = false;

/**
 * Reads an element's settings.
 *
 * @param {HTMLElement} el The element.
 * @returns {Record<string, unknown>} Its `data-effect-config`, parsed; empty
 *   when missing or not valid JSON.
 */
export function readConfig(el) {
	try {
		return JSON.parse(el.dataset.effectConfig ?? '{}') ?? {};
	} catch {
		return {};
	}
}

/** Sets up every registered effect's elements that are not running yet, and stops those that left the page. */
function scan() {
	for (const [selector, setup] of effects) {
		const live = running.get(selector) ?? new Map();
		running.set(selector, live);
		for (const [el, stop] of live) {
			if (!el.isConnected) {
				stop();
				live.delete(el);
			}
		}
		document.querySelectorAll(selector).forEach((node) => {
			const el = /** @type {HTMLElement} */ (node);
			if (live.has(el)) return;
			live.set(el, setup(el, readConfig(el)) ?? (() => {}));
		});
	}
}

/**
 * Scans again, once a frame at most, when elements are added to or taken
 * out of the page. Text changing (a counter, a typewriter) is ignored.
 */
function watchPage() {
	if (typeof MutationObserver === 'undefined') return;
	new MutationObserver((records) => {
		if (queued) return;
		const elements = records.some((record) =>
			[...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE),
		);
		if (!elements) return;
		queued = true;
		requestAnimationFrame(() => {
			queued = false;
			scan();
		});
	}).observe(document.documentElement, { childList: true, subtree: true });
}

/**
 * Registers an effect: `setup` runs for every element matching `selector`,
 * now, after each view transition, and whenever one is added to the page.
 *
 * @template T
 * @param {string} selector Matches the effect's elements.
 * @param {(el: HTMLElement, config: T) => (() => void) | void} setup Starts
 *   the effect on one element; returns a function that stops it.
 */
export function mount(selector, setup) {
	if (typeof document === 'undefined') return;
	effects.set(selector, setup);
	if (!listening) {
		listening = true;
		document.addEventListener('astro:page-load', scan);
		watchPage();
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
	else scan();
}

/**
 * Follows an effect's `data-colors` attribute (JSON `{ colors, glint? }`,
 * written by `setColors`): calls `apply` with it now, if set, and whenever
 * it changes.
 *
 * @param {HTMLElement} el The effect's element.
 * @param {(next: { colors: string[], glint?: string }) => void} apply Takes the new colours.
 * @returns {() => void} Stops following.
 */
export function watchColors(el, apply) {
	/** Reads the attribute and passes it on, if it holds colours. */
	const read = () => {
		try {
			const next = JSON.parse(el.dataset.colors ?? 'null');
			if (next?.colors?.length) apply(next);
		} catch {
			// Not JSON: keep the colours there are.
		}
	};
	const observer = new MutationObserver(read);
	observer.observe(el, { attributes: true, attributeFilter: ['data-colors'] });
	read();
	return () => observer.disconnect();
}
