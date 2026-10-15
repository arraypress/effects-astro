/**
 * Registers a frame callback on the page's one animation loop, called while
 * `el` is within 128px of the viewport and the tab is showing. `dt` is the
 * seconds since the last frame (0 after a pause, at most 1/20). Returns a
 * function that unregisters it.
 */
export function animate(el: Element, frame: (now: number, dt: number) => void): () => void;
