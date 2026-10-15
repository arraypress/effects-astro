/** An element's `data-effect-config`, parsed; empty when missing or invalid. */
export function readConfig(el: HTMLElement): Record<string, unknown>;

/**
 * Registers an effect: `setup` runs once for every element matching
 * `selector`, now, after each Astro view transition and whenever one is
 * added to the page, with its parsed `data-effect-config`. The function it
 * returns runs when the element leaves the page.
 */
export function mount<T>(selector: string, setup: (el: HTMLElement, config: T) => (() => void) | void): void;

/** Calls `apply` with an effect's `data-colors` now (if set) and whenever it changes. Returns a function that stops following. */
export function watchColors(el: HTMLElement, apply: (next: { colors: string[]; glint?: string }) => void): () => void;
