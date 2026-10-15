/**
 * Fills a timeline as it scrolls: `--progress` (0–1) on the element, and
 * `is-reached` on each `[data-timeline-item]` the fill has passed. Returns a function that stops it.
 */
export function timeline(el: HTMLElement): () => void;
