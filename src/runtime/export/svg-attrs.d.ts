/** A computed value as an SVG presentation attribute's (px dropped, `url("#a")` as `url(#a)`, a colour as hex, its alpha noted in `alpha` by the opacity attribute it goes into). */
export function attrValue(name: string, v: string, alpha: Map<string, number>): string;

/** A CSS transform's six `matrix()` numbers, applied about `ox`, `oy`, as an SVG `transform` attribute's `matrix(…)`. */
export function aboutOrigin(m: number[], ox: number, oy: number): string;

/** An inline `<svg>` in the page as a nested `<svg>` (serialised) placed where it shows within `origin`, its computed styles written as attributes; what plain SVG cannot say is pushed onto `issues`. */
export function inlineSvg(o: SVGSVGElement, box: DOMRect, origin: DOMRect, issues: string[]): string;
