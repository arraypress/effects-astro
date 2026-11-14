/** Every `url(…)` in a CSS value that would load from outside (not `data:`, not a `#fragment`), in order. */
export function outerUrls(value: string): string[];

/** Whether a CSS value has a `url(…)` that would load from outside (not `data:`, not a `#fragment`). */
export function hasOuterUrl(value: string): boolean;

/** A blob as a `data:` URL. */
export function blobToDataUrl(blob: Blob): Promise<string>;

/** A file (absolute, or relative to the page) as a `data:` URL, fetched once per page; a `data:` URL is returned as it is. Rejects when it cannot be fetched. */
export function toDataUrl(url: string): Promise<string>;

/** A CSS value with every `url(…)` that loads from outside swapped for its `data:` URL (`none` for one that cannot be fetched). */
export function inlineCssUrls(value: string): Promise<string>;
