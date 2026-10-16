export interface LiquidGlassOptions {
	/** How hard the glass bends what is behind it, 0–2; `true` is 1, `false` or 0 is off. Default 1 (CSS `--glass-refract`). */
	refract?: boolean | number;
	/** How much the rim splits what it bends into red, green and blue, 0–1; 0 is one pass, cheaper. Default 0.35 (CSS `--glass-dispersion`). */
	dispersion?: number;
	/** How wide the bending rim is, px. Default 28 (CSS `--glass-bezel`). */
	bezel?: number;
	/** How bright the highlight along the rim is, 0–1. Default 0.7 (CSS `--glass-specular`). */
	specular?: number;
}

/** A lens's settings, all worked out. */
export interface LensSettings {
	refract: number;
	dispersion: number;
	bezel: number;
	specular: number;
}

/** One step of a lens filter: a bend of the backdrop (`feDisplacementMap`'s scale, for one colour channel or all), or the rim's highlight laid over it. */
export type LensStep = { kind: 'bend'; scale: number; channel?: 'R' | 'G' | 'B' } | { kind: 'shine'; amount: number };

/** The settings a lens takes when neither its options nor its CSS give one. */
export const LENS_DEFAULTS: Readonly<LensSettings>;

/** Whether this browser draws SVG filters in `backdrop-filter` (Chromium). Elsewhere the panels keep glass.css's frost. */
export function lensSupported(): boolean;

/** Reads a setting's value: a number, `true` (1), `false` or `none` (0); undefined when there is none. */
export function lensValue(value: unknown): number | undefined;

/** A lens's settings: each from `options`, else the custom property `read` returns (`--glass-refract`…), else the default (`unset` for the strength), clamped to its range. */
export function lensSettings(options: LiquidGlassOptions, read: (property: string) => string, unset?: number): LensSettings;

/** The steps of a lens's filter: one bend, or three (R, G, B) with dispersion, then the highlight. */
export function lensSteps(settings: LensSettings): LensStep[];

/**
 * Bends what is behind one `.glass` panel as a thick lens, through
 * `backdrop-filter: url()` (Chromium; elsewhere it does nothing and the
 * frost stays). Settings left out are read from the panel's custom
 * properties. The filter is remade when the panel's size or radius
 * changes. Returns a function that stops it.
 */
export function liquidGlass(el: HTMLElement, options?: LiquidGlassOptions): () => void;

/** Bends what is behind every `.glass` panel on the page, now and later, whose `--glass-refract` is above 0. Safe to call more than once. */
export function glassLens(): void;
