import type { NumberStyle } from './number-format.js';

/**
 * Follows a range input: keeps `--fill` (0–100%) on it and writes its
 * value, formatted, into the `<output for>` naming it. Returns a function that stops it.
 */
export function range(el: HTMLElement, config: NumberStyle): () => void;
