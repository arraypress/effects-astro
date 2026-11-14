/** A face the text asks for: its style, the weights, and the characters (code points) set in it. */
export interface FontUse {
	style: 'normal' | 'italic' | string;
	weights: Set<number>;
	chars: Set<number>;
}

/** A family name as it is matched: unquoted, lower case. */
export function familyKey(s: string): string;

/** Notes a piece of text's font (style, weight, characters in both cases) against each family in its stack, in `uses`. */
export function noteUse(uses: Map<string, FontUse[]>, cs: { fontStyle: string; fontWeight: string; fontFamily: string }, text: string): void;

/** A `unicode-range` descriptor as `[first, last]` code points; all of Unicode when it is empty. */
export function unicodeRanges(desc: string): [number, number][];

/** Whether any of the code points falls in the ranges. */
export function coversAny(chars: Iterable<number>, ranges: [number, number][]): boolean;

/** Whether a face's `font-weight` descriptor serves any of the weights (a static face within 100 of one; always for a non-number). */
export function servesWeight(desc: string, weights: number[]): boolean;

/** A face's file URL (as written) and format (`woff2` when unsaid), from its `src` descriptor; null for none. */
export function fontSource(src: string): { url: string; format: string } | null;

/** A face's `@font-face` rule again (family, style, weight, stretch, unicode-range), its file the `data:` URL given. */
export function faceRule(style: { getPropertyValue(name: string): string }, data: string, format: string): string;

/** The page's `@font-face` rules for the text under `root` (only the families, styles, weights and unicode ranges it uses), each file inlined. */
export function fontFaceCss(root: Element): Promise<string>;
