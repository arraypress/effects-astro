/** The element's non-empty text nodes, in order. */
export function textNodes(el: HTMLElement): Text[];

/** A Range over all of an element's own text, or null when it has none. */
export function textRange(el: HTMLElement): Range | null;
