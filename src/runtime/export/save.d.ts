/** Hands a file to the browser to save as `filename` (a Blob, or text saved as `type`, default `image/svg+xml`). */
export function save(data: Blob | string, filename: string, type?: string): void;

/** A file name's part from any text: accents dropped, lower case, letters and digits with hyphens between; `export` when nothing is left. */
export function fileSlug(s: string): string;
