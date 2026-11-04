/**
 * Starts `start` while `el` is within `margin` (default `200px`) of the viewport and stops it when it moves away,
 * again each time it comes back; `data-effect-live` is on the element while it runs. Returns a function that stops
 * watching (and the effect).
 */
export function whenNear(el: HTMLElement, start: () => (() => void) | void, options?: { margin?: string }): () => void;

/** An element's lazy margin: `data-effect-lazy`, or `lazy` in its config (true for `200px`); null to start at once. */
export function lazyMargin(el: HTMLElement, config: Record<string, unknown>): string | null;
