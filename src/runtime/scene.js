/**
 * @module @arraypress/effects-astro/scene
 *
 * A scene from `@logomarks/shaders` on an effect's canvas: liquid marble,
 * frosted glass, glossy tiles, chrome, glitter, holographic foil, ink in
 * water and the rest, recoloured by a palette and shaped by the scene's own
 * settings. `<Scene>` is the component.
 *
 * The scene is loaded by name, each in its own chunk, so a page ships only
 * the shaders it shows. Its laziness is the package's own, not mount()'s:
 * it holds a WebGL context only while near the screen and gives it back
 * four seconds after it leaves, on a fresh canvas, and it caps its frame
 * rate, adapts its resolution, pauses off screen and draws one still frame
 * with reduced motion. `setColors` recolours it live.
 */

import { scene as run, LOOK } from '@logomarks/shaders/core';
import { load } from '@logomarks/shaders/load';
import { findPalette } from './palettes.js';
import { watchColors } from './mount.js';

/**
 * @typedef {import('./scene.js').SceneConfig} SceneConfig
 * @typedef {import('@logomarks/shaders').SceneOptions} SceneOptions
 */

/** The settings a `<Scene>` hands to its scene as they are: the look, the colours, the params, the frame rate and resolution. */
const OPTIONS = /** @type {(keyof SceneConfig)[]} */ ([...Object.keys(LOOK), 'colors', 'glint', 'params', 'fps', 'scale']);

/**
 * A `<Scene>`'s settings as the package's options: its palette found by
 * name (an unknown one is warned about and the scene's own colours kept),
 * `near` as `lazy`, and the rest as they are.
 *
 * @param {SceneConfig} config The component's settings.
 * @returns {{ name: SceneConfig['name'], options: SceneOptions }} The scene and its options.
 */
export function sceneSettings(config) {
	const { name, palette, near = true } = config;
	// Only the scene's own options: anything else a component is handed (Astro's `slot`, say) is not the scene's.
	/** @type {Record<string, unknown>} */
	const options = Object.fromEntries(OPTIONS.filter((k) => config[k] !== undefined).map((k) => [k, config[k]]));
	if (palette) {
		const found = findPalette(palette);
		if (found) options.palette = found;
		else console.warn('[effects-astro]', `No palette "${palette}"`);
	}
	options.lazy = near;
	return { name, options: /** @type {SceneOptions} */ (options) };
}

/**
 * Starts a scene on an element's canvas.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn on).
 * @param {SceneConfig} config The scene and its settings.
 * @returns {() => void} Stops it.
 */
export function scene(el, config) {
	const canvas = el.querySelector('canvas');
	if (!canvas) return () => {};
	const { name, options } = sceneSettings(config);
	let stopped = false;
	/** @type {import('@logomarks/shaders').SceneHandle | null} */
	let handle = null;
	let unwatch = () => {};
	load(name)
		.then((def) => {
			if (stopped) return;
			const h = run(canvas, def, options);
			handle = h;
			unwatch = watchColors(el, (next) => h.set({ colors: next.colors.slice(0, 3), ...(next.glint ? { glint: next.glint } : {}) }));
		})
		.catch((error) => console.warn('[effects-astro]', error?.message ?? error));
	return () => {
		stopped = true;
		unwatch();
		handle?.stop();
	};
}
