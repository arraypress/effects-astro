/** A line of text as the browser set it. */
export interface TextLine {
	/** Its top, viewport px. */
	top: number;
	/** Its height, px. */
	h: number;
	/** Its left and right edges, viewport px. */
	left: number;
	right: number;
	/** Its characters. */
	s: string;
}

/** Text as `text-transform` (`uppercase`, `lowercase`, `capitalize`) shows it. */
export function transformText(s: string, t: string): string;

/** Characters (each with its box, in order) grouped into the lines they were set on. */
export function groupLines(glyphs: { rect: { top: number; left: number; right: number; height: number }; ch: string }[]): TextLine[];

/** A text node's lines as SVG `<text>` elements, each where the browser set it within `origin`, in its font and fill. */
export function textLines(node: Text, cs: CSSStyleDeclaration, origin: DOMRect, opacity: number): string;
