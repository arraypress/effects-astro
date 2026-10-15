/** Whether a file matches an input's `accept` list (extensions, MIME types, `image/*`); an empty list takes anything. */
export function accepts(file: File, accept: string): boolean;

/**
 * Makes an element a drop target for the `<input type="file">` inside it:
 * accepted files land in the input and fire its `change`. Sets
 * `data-state` to `idle`, `over` or (briefly) `rejected`. Returns a function that stops it.
 */
export function dropzone(el: HTMLElement): () => void;
