import type { PaletteName } from './palettes.js';

export interface KineticGridConfig {
	/** Two CSS hex colours: the wires' and the pulses'. Default the sketch's blue and white. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`: its first colour for the wires, its glint for the pulses. */
	palette?: PaletteName | (string & {});
	/** The ground, a CSS hex colour (opaque, so the canvas covers what is under it); `transparent` leaves it clear. Default '#0a0a0a'. */
	background?: string;
	/** Grid cells across, whatever the width (cells are square). Default 48. */
	cols?: number;
	/** A wire's width, CSS px. Default 1. */
	width?: number;
	/** How bright a wire at rest is, 0–1; stretched wires brighten to full. Default 0.35. */
	rest?: number;
	/** Drops alive at once, 0–6 (each slot lands a new one about every five seconds). Default 4. */
	drops?: number;
	/** How far the ripples push the wires, 0–1.6 (past that they fold). Default 1. */
	strength?: number;
	/** The ripples' scale: wavelength, reach and speed together, 0.5–2. Default 1. */
	size?: number;
	/** Ring pulses alive at once, 0–4 (each slot about every two and a half seconds). Default 3. */
	pulses?: number;
	/** Plays the clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** Seeds where and when drops land, so two cards differ. Default 0. */
	offset?: number;
	/** An area kept calm and dim: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The settings' defaults. */
export declare const KINETIC_DEFAULTS: {
	background: string;
	cols: number;
	width: number;
	rest: number;
	drops: number;
	strength: number;
	size: number;
	pulses: number;
	speed: number;
	offset: number;
};

/** Most drop slots (the shader's array). */
export declare const MAX_DROPS: number;
/** Most pulse slots (the shader's array). */
export declare const MAX_PULSES: number;

/** A drop's timing, seconds: a slot lands one every `period`, up to `jitter` late; it lasts `life`, its height falling by e every `decay`, rising over `rise`. */
export declare const DROP_TIMING: { period: number; jitter: number; life: number; decay: number; rise: number };

/** A pulse's timing, seconds: a slot fires every `period`, up to `jitter` late, and a ring lasts `life`. */
export declare const PULSE_TIMING: { period: number; jitter: number; life: number };

/** The ripple's shape at `size` 1, in widths (speeds a second). */
export declare const WAVE: { speed: number; wavelength: number; sigma: number; spread: number; core: number; amp: number; reach: number };

/** Dave Hoskins' Hash without Sine, three in, three out, each 0–1. */
export declare function hash33(x: number, y: number, z: number): [number, number, number];

/** Where (0–1 of the width and height, from the top left) and when (seconds) a slot's drop for a cycle lands. */
export declare function dropAt(slot: number, cycle: number, offset?: number): { x: number; y: number; start: number };

/** A drop's height over its life, 0–1: a quick rise, an exponential fall, eased to nothing by the end. */
export declare function dropEnvelope(age: number): number;

/** The drops alive at a moment (the clock already at its speed): place, age in seconds, and envelope. */
export declare function dropsAt(time: number, config?: { drops?: number; offset?: number }): { x: number; y: number; age: number; amp: number }[];

/** The pulse rings alive at a moment: centre (0–1 of the width and height), radius in widths, brightness 0–1. */
export declare function pulsesAt(time: number, config?: { pulses?: number; offset?: number; size?: number }): { x: number; y: number; radius: number; glow: number }[];

/** One drop's ripple at a distance (widths) and age (seconds): the radial displacement and its slope. */
export declare function ripple(r: number, age: number, size?: number): [number, number];

/** How far the grid is moved at a point (widths from the top left), summed over the live drops: x and y, widths. */
export declare function displacement(x: number, y: number, time: number, config?: KineticGridConfig, aspect?: number): [number, number];

/** The two colours as the shader takes them: the wires' and the pulses'. */
export declare function gridColors(config: KineticGridConfig): [string, string];

/** A CSS `background` of the grid at rest (for before the shader starts and without WebGL); `aspect` is height over width, default 1.25. */
export declare function gridStill(config?: KineticGridConfig, aspect?: number): string;

/** Starts the grid on an element (its first canvas is drawn into). Returns a function that stops it. */
export declare function kineticGrid(el: HTMLElement, config: KineticGridConfig): () => void;
