/** The thirty Paper shaders, by file name. */
export type PaperShaderName =
	| 'color-panels' | 'dithering' | 'dot-grid' | 'dot-orbit' | 'fluted-glass' | 'gem-smoke' | 'god-rays'
	| 'grain-gradient' | 'halftone-cmyk' | 'halftone-dots' | 'heatmap' | 'image-dithering' | 'lens-distortion'
	| 'liquid-metal' | 'mesh-gradient' | 'metaballs' | 'neuro-noise' | 'paper-texture' | 'perlin-noise'
	| 'pulsing-border' | 'simplex-noise' | 'smoke-ring' | 'spiral' | 'static-mesh-gradient'
	| 'static-radial-gradient' | 'swirl' | 'voronoi' | 'warp' | 'water' | 'waves';

export interface PaperConfig {
	/** The shader, by its file name. */
	shader: PaperShaderName;
	/** One of the shader's presets, by name (any case). Default its first. */
	preset?: string;
	/** Paper's settings for the shader (`distortion`, `colorBack`…), over the preset's. */
	params?: Record<string, unknown>;
	/** The shader's colours, over the preset's. */
	colors?: string[];
	/** A picture for the shaders that bend or trace one. */
	image?: string;
	/** Colours to make a picture from, when there is no `image`. */
	gradient?: string[];
	/** The made picture's angle, degrees. Default 135. */
	gradientAngle?: number;
	/** How fast it moves, over the preset's (0 is still). */
	speed?: number;
	/** Share of the pixel ratio drawn at. Default 1. */
	scale?: number;
}

/** A shader's settings: its preset with the config's settings over it. Throws for an unknown shader. */
export function paperSettings(config: PaperConfig): Record<string, any>;

/** Settings as uniforms: `u_` names, colours as RGBA, named options as numbers. */
export function paperUniforms(shader: string, settings: Record<string, any>): Record<string, number | boolean | number[] | number[][]>;

/** Starts a Paper shader in `el`'s canvas. Returns a function that stops it. */
export function paperShader(el: HTMLElement, config: PaperConfig): () => void;
