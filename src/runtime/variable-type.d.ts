/** Each axis by its tag (`wght`, `wdth`, `slnt`, `opsz`…): its value at rest, then at the peak of a swell. */
export type Axes = Record<string, [number, number]>;

export interface VariableTypeConfig {
	/** The axes that swell, `{ tag: [rest, peak] }`. Axes the font lacks do nothing. Default `{ wght: [100, 900], wdth: [75, 125] }`. */
	axes?: Axes;
	/** How far a swell reaches from the pointer, in ems (0.3–4). Default 1.1. */
	radius?: number;
	/** How it drops off: 0 a broad hill, 1 a sharp peak (0–1). Default 0.5. */
	falloff?: number;
	/** How far the travelling swell rises with nothing over the text: 0 none, 1 to the peak (0–1). Default 0.35. */
	idle?: number;
	/** Size the line so that at its widest swell it spans its parent's width. Default false. */
	fit?: boolean;
}

/** One axis: its tag, its value at rest and at the peak. */
export interface Axis {
	tag: string;
	rest: number;
	peak: number;
}

/** The axes when none are given: weight 100 to 900, width 75 to 125. */
export const DEFAULT_AXES: Axes;

/** The axes as a list, keeping only four-letter tags with two numbers. */
export function axisList(axes?: Axes): Axis[];

/** A `font-variation-settings` value, `amount` of the way from rest (0) to peak (1); `normal` with no axes. */
export function variation(axes: Axis[], amount: number): string;

/** How much a letter swells `distance` ems from the pointer: 1 under it, easing to 0 at `radius`; `falloff` 0 broad, 1 sharp. */
export function swell(distance: number, radius: number, falloff: number): number;

/** The idle swell, 0 to 1, at `x` ems along the line, `time` seconds in: soft crests travelling left to right. */
export function idleWave(x: number, time: number): number;

/** How much wider a line gets at its widest swell: `xs` each letter's centre in ems, `growth` each letter's peak-minus-rest width, `shape` the swell at an offset from the crest. */
export function widestSwell(xs: ArrayLike<number>, growth: ArrayLike<number>, shape: (offset: number) => number): number;

/** Starts the swell on `el` (styled by VariableType.astro), set in a variable font. Returns a function that stops it and puts the text back. */
export function variableType(el: HTMLElement, config: VariableTypeConfig): () => void;
