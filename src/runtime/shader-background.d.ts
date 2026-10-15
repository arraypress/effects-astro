import type { PaletteName } from './palettes.js';
import type { Rgb } from './color.js';

/** The six shader backgrounds. */
export type ShaderBackgroundName = 'mesh-gradient' | 'grain-gradient' | 'silk' | 'band-lens' | 'grid' | 'waves';

export interface ShaderBackgroundConfig {
	/** Which shader background. */
	effect: ShaderBackgroundName;
	/** Up to four colours (hex or `rgb()`); those missing come from `--color-accent` where it sits: the accent, the accent towards `--color-bg`, its hue +36°, its hue −32° lifted. Only mesh-gradient, grain-gradient and silk use the fourth. Default all four from the accent. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** How fast it moves, 0–4. Default 1. */
	speed?: number;
	/** How strong it is (brightness and contrast, not opacity), 0–2. Default 1. */
	intensity?: number;
	/** One frame, never the loop: for a shader background that is wallpaper. Default false. */
	static?: boolean;
	/** With `static`, the moment drawn, in seconds. Default 12. */
	frame?: number;
	/** Lean towards the pointer, on devices that hover. Default false. */
	interactive?: boolean;
}

/** Every shader background's fragment shader, by name. */
export const SHADER_BACKGROUNDS: Record<ShaderBackgroundName, string>;

/** Reads `#rgb`, `#rrggbb` or `rgb()`/`rgba()`; null for anything else. */
export function readColor(value: string): Rgb | null;

/** Turns a colour's hue by `deg` degrees in HSL; a grey comes back unchanged. */
export function hueRotate(rgb: Rgb, deg: number): Rgb;

/** The four colours: those given (unreadable ones skipped), the rest derived from the accent and background tokens. */
export function shaderBackgroundPalette(from: { accent?: string; background?: string; colors?: string[] }): [Rgb, Rgb, Rgb, Rgb];

/** Speed (0–4, default 1), intensity (0–2, default 1) and the still frame (default 12), read and clamped. */
export function shaderBackgroundSettings(config: Partial<ShaderBackgroundConfig>): { speed: number; intensity: number; frame: number };

/** The CSS `background` that stands in without WebGL: soft pools of the first and third colours. */
export function shaderBackgroundFallback(palette: Rgb[]): string;

/** Starts a shader background in `el`'s canvas. Returns a function that stops it. */
export function shaderBackground(el: HTMLElement, config: ShaderBackgroundConfig): () => void;
