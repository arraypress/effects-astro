/** An SVG document's text as a `data:` URL (which a CSP with `img-src data:` allows, where it may not allow `blob:`). */
export function svgDataUrl(svg: string): string;

/** Loads a picture (a `data:` URL, or same-origin) and waits until it can be drawn, then `settle` ms more (default 0) for an SVG's own web fonts. */
export function decodeImage(src: string, settle?: number): Promise<HTMLImageElement>;

/** Draws an SVG (its text, or a URL to it) onto a canvas, filling it at `width` × `height` px: a new canvas unless one is given (cleared and sized first); waits `settle` ms (default 250) after it decodes, for its fonts. */
export function drawSvg<C extends HTMLCanvasElement | OffscreenCanvas = HTMLCanvasElement>(svg: string, width: number, height: number, canvas?: C, settle?: number): Promise<C>;

/** A canvas as an image file: `type` (default `image/png`; `image/jpeg` or `image/webp` at `quality`, 0–1). */
export function imageOf(canvas: HTMLCanvasElement | OffscreenCanvas, type?: string, quality?: number): Promise<Blob>;

/** A canvas as a PNG. */
export function pngOf(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<Blob>;

/** An SVG (its text, or a URL to it) drawn to an image file's bytes at `width` × `height` px: a PNG by default, or `type` (`image/jpeg`, `image/webp`) at `quality`, 0–1; `settle` ms (default 0) to wait for its fonts. */
export function rasterize(svg: string, size: { width: number; height: number; settle?: number }, type?: string, quality?: number): Promise<Uint8Array>;
