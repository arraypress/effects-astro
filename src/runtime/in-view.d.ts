/**
 * Calls `show` when `el` comes into view (at once without
 * IntersectionObserver); unless `once`, `hide` when it leaves. Returns a
 * function that stops watching.
 */
export function inView(el: Element, show: () => void, once?: boolean, hide?: () => void): () => void;
