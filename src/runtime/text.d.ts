/** The element's non-empty text nodes, in order. */
export function textNodes(el: HTMLElement): Text[];

/** A Range over all of an element's own text (or its split letters), or null when it has none. */
export function textRange(el: HTMLElement): Range | null;

/** Splits an element's text into one `[data-letter]` span a letter, spaces left as text; reuses letters already split. Returns them in order. */
export function splitLetters(el: HTMLElement): HTMLElement[];

/** Puts letters split by `splitLetters` back as plain text. */
export function joinLetters(el: HTMLElement): void;
