/**
 * Makes a carousel of an element holding a `[data-carousel-track]`: native
 * scrolling plus dragging with a mouse (with a throw), `data-start` /
 * `data-end` while it can scroll back or on, and `[data-carousel-prev]` /
 * `[data-carousel-next]` buttons. Returns a function that stops it.
 */
export function carousel(el: HTMLElement): () => void;
