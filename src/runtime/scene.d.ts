import type { SceneOptions } from '@arraypress/shaders';
import type { PaletteName } from './palettes.js';

/** A scene's name: one of `@arraypress/shaders`' scenes. */
export type SceneName =
	| 'marble'
	| 'frosted'
	| 'ribs'
	| 'tiles'
	| 'blob'
	| 'chrome'
	| 'glitter'
	| 'foil'
	| 'ribbon'
	| 'spiral'
	| 'swirl'
	| 'arches'
	| 'spheres'
	| 'spheres2'
	| 'strands'
	| 'rings'
	| 'ink-water'
	| 'topo'
	| 'oil-bubbles'
	| 'melting-hologram';

/** A `<Scene>`'s settings, as its element carries them. */
export interface SceneConfig {
	/** The scene. */
	name: SceneName;
	/** A named palette (PALETTES). */
	palette?: PaletteName | (string & {});
	/** One to three colours (hex), over the palette's. */
	colors?: string[];
	/** The highlight colour (hex). */
	glint?: string;
	/** The scene's own settings by key. */
	params?: Record<string, number>;
	speed?: number;
	hue?: number;
	sat?: number;
	exposure?: number;
	tint?: string;
	tintAmount?: number;
	zoom?: number;
	angle?: number;
	grain?: number;
	fps?: number;
	scale?: number;
	/** The component's `lazy`: hold a context only while near the screen (true, or a CSS length). Default true. */
	near?: boolean | string;
}

/** A `<Scene>`'s settings as `@arraypress/shaders`' options: the palette found by name, `near` as `lazy`. */
export function sceneSettings(config: SceneConfig): { name: SceneName; options: SceneOptions };

/** Starts a scene on an element's canvas; returns a function that stops it. */
export function scene(el: HTMLElement, config: SceneConfig): () => void;
