/** A CSS length or number as a number (`'12.5px'` is 12.5); 0 when it is not one. */
export function cssNumber(v: string): number;

/** A number to at most two decimal places, as an attribute's text. */
export function round2(n: number): string;

/** Text made safe inside an XML element or a double-quoted attribute (`&`, `<`, `>` and `"` escaped). */
export function escapeXml(s: string): string;

/** A computed 2D transform's six numbers, `[a, b, c, d, e, f]`; null for anything but a `matrix()`. */
export function matrixOf(t: string): number[] | null;
