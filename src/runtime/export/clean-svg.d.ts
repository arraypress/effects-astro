/** Whether a computed transform is a translate and scale only (no rotation or skew). */
export function plainTransform(t: string): boolean;

/** An element as an issue's message names it: its tag and first two classes (`div.card.wide`). */
export function describe(el: Element): string;

/** Markup in a `<g opacity>` when `opacity` is under 1 and there is markup; as it is otherwise. */
export function faded(markup: string, opacity: number): string;

/** Swaps each picture's `data-src` in SVG markup for an `href` to its file as a `data:` URL (empty for one that cannot be fetched). */
export function inlinePictures(body: string): Promise<string>;

/** What stops an element (shown, laid out) being rebuilt faithfully as plain SVG, each once; empty when it can be. */
export function cleanIssues(el: HTMLElement): string[];

/**
 * An element (shown, laid out) as a plain SVG document: rects, pictures, its inline SVGs and its words as `<text>`, its
 * fonts inlined; `long` (default 1080) px on its longer side, its viewBox the element's CSS size. Throws, listing why,
 * when it cannot be rebuilt faithfully (see `cleanIssues`).
 */
export function cleanSvg(el: HTMLElement, long?: number): Promise<string>;
