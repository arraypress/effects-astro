/** The element's non-empty text nodes, in order. */
export function textNodes(el: HTMLElement): Text[];

/** A Range over all of an element's own text (or its split letters), or null when it has none. */
export function textRange(el: HTMLElement): Range | null;

/** Splits an element's text into one `[data-letter]` span a letter, spaces left as text; reuses letters already split. Returns them in order. */
export function splitLetters(el: HTMLElement): HTMLElement[];

/** Puts letters split by `splitLetters` back as plain text. */
export function joinLetters(el: HTMLElement): void;

/** Every non-empty text node inside `root`, at any depth, except those inside `skip`. */
export function textNodesWithin(root: Element, skip?: Element | null): Text[];

/** Draws text nodes into a 2D context (CSS px) glyph by glyph, each where the browser laid it out and in its own element's font, `origin` being the viewport point the context's 0, 0 stands for. */
export function paintGlyphs(ctx: CanvasRenderingContext2D, texts: Text[], origin: { x: number; y: number }): void;
