import type { NumberStyle } from './number-format.js';

export interface CountUpConfig extends NumberStyle {
	/** Where the first count starts. Default 0. */
	from?: number;
	/** Seconds a count takes. Default 1.6. */
	duration?: number;
}

/**
 * Counts an element up to its `data-value` as it comes into view, and to
 * each new `data-value` after. Returns a function that stops it.
 */
export function countUp(el: HTMLElement, config: CountUpConfig): () => void;
