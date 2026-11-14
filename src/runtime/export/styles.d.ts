/** The pseudo-elements an export reads. */
export const PSEUDOS: readonly ['::before', '::after'];

/** Whether a computed property is read at all (not a custom property, motion, interaction or a path's `d`). */
export function kept(name: string): boolean;

/** Whether a pseudo-element is drawn at all: it has content and is not `display: none`. */
export function pseudoShows(cs: { content: string; display: string }): boolean;

/**
 * The declarations (`name:value;` each) that rebuild `el`'s look, or its pseudo-element's, on a copy with no
 * stylesheet: those that differ from the browser's default for it, and of the inherited ones those that differ from
 * `inheritsFrom` (the parent's computed style; the element's own for a pseudo-element; none for the copy's root).
 */
export function declarations(el: Element, pseudo?: string, inheritsFrom?: CSSStyleDeclaration | null): string;

/** Removes the blank frame the browser's defaults are read in, when the page is done exporting for a while. */
export function releaseDefaults(): void;
