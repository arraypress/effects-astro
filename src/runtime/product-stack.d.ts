import type { Layout } from './stack-poses.js';

export interface ProductStackConfig {
	/** How the covers are laid out. Default `fan`. */
	layout?: Layout;
	/** How far apart the covers sit, 0–2. Default 1. */
	spread?: number;
	/** How far the stack leans towards the pointer, degrees. Default 12. */
	tilt?: number;
	/** How much the covers behind dim and soften, 0–1. Default 0.6. */
	depth?: number;
	/** Lean, fan and lift for the pointer and keyboard. Default true. */
	interactive?: boolean;
	/** A cover's width over its height. Default 1. */
	ratio?: number;
}

/**
 * Lays out the covers in `el`'s `.ps-stage` and has them answer the pointer
 * and keyboard: the stack leans towards the pointer, fans apart on hover
 * or focus, and lifts the cover under the pointer. Returns a function that
 * stops it.
 */
export function productStack(el: HTMLElement, config: ProductStackConfig): () => void;
