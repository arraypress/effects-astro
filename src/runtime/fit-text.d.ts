/** Fits one element's single line of text to its parent's content width, once. */
export function fit(el: HTMLElement): void;

/** Keeps an element's text fitted to its parent's width (on resize and font load). Returns a function that stops it. */
export function fitText(el: HTMLElement): () => void;
