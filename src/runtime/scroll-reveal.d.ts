/** The classes reveal.css styles, as a selector list. */
export const REVEAL_CLASSES: string;

export interface ScrollRevealConfig {
	/** What to reveal. Default the reveal.css classes. */
	selector?: string;
	/** The class added on arrival. Default `is-visible`. */
	visibleClass?: string;
	/** How much must be in view, 0–1. Default 0.08. */
	threshold?: number;
	/** The observer's margin. Default `0px 0px -10% 0px`. */
	rootMargin?: string;
	/** Reveal once; false hides it again when it leaves, to replay. Default true. */
	once?: boolean;
}

/**
 * Adds `visibleClass` to each matching element as it scrolls into view
 * (at once if already on screen), and marks the page `.fx-reveal`. Calling
 * it again replaces the previous run. Returns a function that stops it.
 */
export function scrollReveal(config?: ScrollRevealConfig): () => void;
