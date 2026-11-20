import type { PaletteName } from './palettes.js';

export interface CascadeGridConfig {
	/** The cells: staggered pointy-top hexagons, or dots on a square grid. Default `hex`. */
	cell?: 'hex' | 'dot';
	/** A cell's width in CSS px. Default 16. */
	pitch?: number;
	/** Cells across instead, whatever the width (overrides `pitch`). */
	cols?: number;
	/** Two CSS hex colours: an idle cell's and a reactive one's. Default the sketch's grey and green. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`: its last and first colours. */
	palette?: PaletteName | (string & {});
	/** A CSS hex colour to fill behind the cells; none leaves the canvas clear there. */
	background?: string;
	/** An idle cell's size, a share of the cell (0–1). Default 0.12 for hexagons, 0.14 for dots. */
	idle?: number;
	/** A reactive cell's size, a share of the cell (0–1; 1 is flush). Default 0.92 for hexagons, 0.9 for dots. */
	reactive?: number;
	/** How a cell is drawn: filled, outlined, or outlined around a solid core that grows with its level. Default `core` for hexagons, `solid` for dots. */
	fill?: 'solid' | 'outline' | 'core';
	/** The outline's width, idle and reactive, a share of the cell (0–0.5). Default [0.06, 0.12]. */
	stroke?: [number, number];
	/** A cell's opacity, idle and reactive (0–1). Default [0.5, 1]. */
	opacity?: [number, number];
	/** Seconds between one column and the next: the wave crosses `1 / lag` columns a second. Default 0.06. */
	lag?: number;
	/** How fast the spectrum changes, noise units a second. Default 0.6. */
	evolve?: number;
	/** Noise units a row: higher makes the bands narrower. Default 0.12. */
	scale?: number;
	/** The noise window stretched to 0–1: a lower top makes more cells reactive. Default [0.3, 0.75]. */
	range?: [number, number];
	/** How much busier the low rows are (0–1): the bottom row gets it all, the middle none. Default 0.35. */
	tilt?: number;
	/** Which way the wave travels. Up and down make the columns the spectrum, busier at the left. Default `right`. */
	direction?: 'right' | 'left' | 'up' | 'down';
	/** Where the noise starts (a number, or a band and a time shift), so two grids differ. Default 0. */
	offset?: number | [number, number];
	/** Plays the clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** An area kept calm: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The settings with every default filled in, as the shader takes them. */
export interface CascadeOptions {
	cell: 'hex' | 'dot';
	pitch: number;
	idle: number;
	reactive: number;
	fill: 'solid' | 'outline' | 'core';
	stroke: [number, number];
	opacity: [number, number];
	lag: number;
	evolve: number;
	scale: number;
	range: [number, number];
	tilt: number;
	direction: 'right' | 'left' | 'up' | 'down';
	offset: [number, number];
	speed?: number;
}

/** The settings' defaults, shared by the shader and the JavaScript twins (`idle`, `reactive` and `fill` depend on the cell). */
export declare const CASCADE_DEFAULTS: {
	cell: 'hex' | 'dot';
	pitch: number;
	stroke: [number, number];
	opacity: [number, number];
	lag: number;
	evolve: number;
	scale: number;
	range: [number, number];
	tilt: number;
	direction: 'right' | 'left' | 'up' | 'down';
};

/** Each cell's own defaults: an idle and a reactive size, and how it is drawn. */
export declare const CELL_DEFAULTS: {
	hex: { idle: number; reactive: number; fill: 'solid' | 'outline' | 'core' };
	dot: { idle: number; reactive: number; fill: 'solid' | 'outline' | 'core' };
};

/** The settings with every default filled in, the cell's own included. */
export declare function cascadeOptions(config?: CascadeGridConfig): CascadeOptions;

/** A band's level at a moment, 0–1, before the quiet area: `cascadeLevel(a, b + 1, h, t + lag)` equals `cascadeLevel(a, b, h, t)`. */
export declare function cascadeLevel(a: number, b: number, h: number, t: number, config?: CascadeGridConfig): number;

/** The lattice's spacing on a target: a cell's width and a row's height. */
export declare function latticeOf(config: CascadeGridConfig, width: number, ratio?: number): { pitch: number; rowHeight: number };

/** The cell a point is in (x from the left edge, y down from the middle row), and its centre. */
export declare function latticeCell(cell: 'hex' | 'dot', x: number, y: number, pitch: number): { col: number; row: number; x: number; y: number };

/** One frame, cell by cell: each cell's centre (from the top left) and its level, the quiet area included. */
export declare function cascadeCells(
	config: CascadeGridConfig,
	width: number,
	height: number,
	time?: number,
): { col: number; row: number; x: number; y: number; level: number }[];

/** The two colours as the shader takes them: an idle cell's and a reactive one's. */
export declare function cascadeColors(config: CascadeGridConfig): [string, string];

/** A CSS `background` showing the grid at rest (idle cells over the `background` colour), for before the shader starts and without WebGL. */
export declare function cascadeStill(config: CascadeGridConfig, width?: number): string;

/** Starts the grid on an element (its first canvas is drawn into). Returns a function that stops it. */
export declare function cascadeGrid(el: HTMLElement, config: CascadeGridConfig): () => void;
