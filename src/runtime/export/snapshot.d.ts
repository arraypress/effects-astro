/** What moved between frames: an element (or its pseudo-element) and the properties to read again. */
export interface Moved {
	el: Element;
	/** `'::before'` or `'::after'`, for its pseudo-element. */
	pseudo?: string;
	/** The properties; `'all'` reads the element and everything in it again (for a custom property others are computed from). */
	props: string[] | 'all';
}

/** An element as a live, self-contained SVG. */
export interface Snapshot {
	/** The element's width, CSS px. */
	readonly width: number;
	/** The element's height, CSS px. */
	readonly height: number;
	/** The SVG document, `scale` (default 1) times the element's size, every vector and word sharp. */
	svg(scale?: number): string;
	/** Reads the moved properties again from the page into the copy. */
	update(moved: Moved[]): Promise<void>;
	/**
	 * Reads every kept canvas again into the copy, now (call it in the task that drew them); a `live` snapshot of
	 * effects stepped by hand. Returns how many it read.
	 */
	canvases(type?: string): number;
}

export interface SnapshotOptions {
	/** Square corners, whatever the element's border-radius (an export of a card, not of its frame). Default true. */
	square?: boolean;
	/** Elements to leave out. */
	skip?: (el: Element) => boolean;
	/** Keep every canvas, blank ones too, for `canvases()` to read again each frame. Default false. */
	live?: boolean;
}

/** The inline style that sets a snapshot's root in place, at its size, untransformed and with no shadow (`square` corners too). */
export function rootStyle(width: number, height: number, square: boolean): string;

/** The pseudo-elements' rules (`${n}::before` → declarations), each on the `xs${n}` class its element's copy carries. */
export function pseudoCss(rules: Map<string, string>): string;

/** The SVG document round a serialised copy: `scale` times the element's size, a `<foreignObject>` holding it. */
export function snapshotSvg(body: string, width: number, height: number, scale: number): string;

/**
 * An element (shown, laid out) as a self-contained SVG: a copy with every computed style inline, its pseudo-elements as
 * rules, its pictures, canvases and fonts inlined, in a `<foreignObject>`. Drawn to a canvas it is a pixel-faithful
 * picture of the element; `update()` rewrites only what a stepped `clock` moved.
 */
export function snapshot(el: HTMLElement, options?: SnapshotOptions): Promise<Snapshot>;
