/**
 * @module @arraypress/effects-astro/paper
 *
 * The Paper Shaders catalogue on our stage: thirty shaders (mesh and grain
 * gradients, god rays, liquid metal, water, warp, dithering, halftones,
 * metaballs, voronoi and more), each with the presets Paper ships, run
 * without React and without the npm package. The shader sources are
 * vendored unchanged in src/vendor/paper (Apache-2.0; see its LICENSE and
 * NOTICE); this is the host that feeds them.
 *
 * Settings are Paper's own names (`distortion`, `swirl`, `colorBack`…),
 * each becoming its `u_` uniform: colours from CSS strings, `colors` as an
 * array (and its count), named options (`shape: 'wave'`) as their numbers,
 * and the sizing uniforms every shader needs (without them the shaders
 * draw one flat colour). A `preset` is the starting point; settings
 * override it. `image` feeds the shaders that bend or trace a picture
 * (fluted glass, water, lens distortion, liquid metal, halftones…), and
 * `gradient` makes one from colours when there is no picture.
 *
 * Each shader is its own module, loaded when used, so a page pays only for
 * the shaders on it. Needs WebGL 2; without it the element's background
 * shows. With prefers-reduced-motion, one still frame.
 */

import { createStage } from './stage.js';
import { watchColors } from './mount.js';
import { loadImage, imageTexture } from './image.js';
import { vertexShaderSource } from '../vendor/paper/vertex-shader.js';
import { getShaderColorFromString } from '../vendor/paper/get-shader-color-from-string.js';
import { getShaderNoiseTexture } from '../vendor/paper/get-shader-noise-texture.js';
import { PRESETS, ENUMS, RENAMES, FITS } from '../vendor/paper/presets.js';

/**
 * @typedef {object} PaperConfig
 * @property {string} shader The shader, by its file name: `mesh-gradient`, `god-rays`, `liquid-metal`…
 * @property {string} [preset] One of the shader's presets, by name (`Beach`, `Ink`…; any case). Default its first.
 * @property {Record<string, unknown>} [params] Paper's settings for the shader, over the preset's.
 * @property {string[]} [colors] The shader's colours, over the preset's (where it takes a list).
 * @property {string} [image] A picture for the shaders that bend or trace one.
 * @property {string[]} [gradient] Colours to make a picture from, when there is no `image`.
 * @property {number} [gradientAngle=135] The made picture's angle, degrees.
 * @property {number} [speed] How fast it moves, over the preset's (0 is still).
 * @property {number} [scale=1] Share of the pixel ratio drawn at.
 */

/** The shaders that sample their picture blurred (mip levels), as Paper's React components set up. */
const MIPMAPPED = new Set(['fluted-glass', 'gem-smoke', 'heatmap', 'liquid-metal', 'lens-distortion', 'paper-texture', 'water']);

/** The shaders whose picture preparation reads a dark shape: given a black silhouette, so a white or coloured logo works. */
const SILHOUETTE = new Set(['heatmap']);

/** Settings that are not uniforms: they steer the host. */
const HOST = new Set(['speed', 'frame']);

/**
 * A shader's module name as its export's prefix: `god-rays` → `godRays`.
 *
 * @param {string} name The file name.
 * @returns {string} camelCase.
 */
const camel = (name) => name.replace(/-(\w)/g, (_, c) => c.toUpperCase());

/**
 * The shader's settings: its preset (the named one or its first), with the
 * config's colours and settings over it.
 *
 * @param {PaperConfig} config The config.
 * @returns {Record<string, any>} Every setting.
 * @throws {Error} When the shader is not in the catalogue.
 */
export function paperSettings(config) {
	const presets = PRESETS[/** @type {keyof typeof PRESETS} */ (config.shader)];
	if (!presets) throw new Error(`No Paper shader "${config.shader}"`);
	const wanted = config.preset?.toLowerCase();
	const preset = presets.find((p) => p.name.toLowerCase() === wanted) ?? presets[0];
	return {
		...preset.params,
		...(config.colors ? { colors: config.colors } : {}),
		...(config.speed !== undefined ? { speed: config.speed } : {}),
		...config.params,
	};
}

/**
 * The settings as uniforms: `u_` names, colours as RGBA, named options as
 * their numbers, `colors` with its count.
 *
 * @param {string} shader The shader.
 * @param {Record<string, any>} settings Its settings.
 * @returns {Record<string, number | boolean | number[] | number[][]>} Uniform values by name.
 */
export function paperUniforms(shader, settings) {
	/** @type {Record<string, any>} */
	const out = {};
	const named = ENUMS[/** @type {keyof typeof ENUMS} */ (shader)] ?? {};
	/** @type {Record<string, string>} */
	const renamed = RENAMES[/** @type {keyof typeof RENAMES} */ (shader)] ?? {};
	for (const [setting, value] of Object.entries(settings)) {
		if (HOST.has(setting) || value === undefined || value === null) continue;
		// Some settings feed a uniform of another name (`size` → `u_pxSize`).
		const key = renamed[setting] ?? setting;
		if (key === 'colors' && Array.isArray(value)) {
			out.u_colors = value.map((c) => getShaderColorFromString(c));
			out.u_colorsCount = value.length;
		} else if (key === 'fit') {
			out.u_fit = typeof value === 'string' ? FITS[/** @type {keyof typeof FITS} */ (value)] ?? 2 : value;
		} else if (typeof value === 'string' && /** @type {Record<string, any>} */ (named)[setting]) {
			out[`u_${key}`] = /** @type {Record<string, any>} */ (named)[setting][value] ?? 0;
		} else if (typeof value === 'string') {
			out[`u_${key}`] = getShaderColorFromString(value);
		} else {
			out[`u_${key}`] = value;
		}
	}
	return out;
}

/**
 * A picture as a black silhouette: wherever it is opaque, black.
 *
 * @param {string} src The picture's URL.
 * @returns {Promise<string>} A URL of the silhouette (PNG).
 */
async function silhouette(src) {
	const img = await loadImage(src);
	const canvas = document.createElement('canvas');
	canvas.width = img.naturalWidth || 512;
	canvas.height = img.naturalHeight || 512;
	const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
	ctx.globalCompositeOperation = 'source-in';
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	return canvas.toDataURL();
}

/**
 * A picture made from colours: a linear gradient, square.
 *
 * @param {string[]} colors The colours.
 * @param {number} angle Degrees.
 * @returns {Promise<HTMLImageElement>} The picture.
 */
function gradientImage(colors, angle) {
	const size = 512;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
	const a = (angle * Math.PI) / 180;
	const dx = Math.cos(a) * size;
	const dy = Math.sin(a) * size;
	const g = ctx.createLinearGradient((size - dx) / 2, (size - dy) / 2, (size + dx) / 2, (size + dy) / 2);
	colors.forEach((c, i) => g.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), c));
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, size, size);
	return loadImage(canvas.toDataURL());
}

/**
 * Starts a Paper shader on an element: a canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {PaperConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function paperShader(el, config) {
	let stopped = false;
	let stop = () => {};
	start(el, config)
		.then((s) => {
			if (stopped) s();
			else stop = s;
		})
		.catch((error) => console.warn('[effects-astro]', error));
	return () => {
		stopped = true;
		stop();
	};
}

/**
 * Loads the shader and its pictures, then starts it.
 *
 * @param {HTMLElement} el The element.
 * @param {PaperConfig} config The settings.
 * @returns {Promise<() => void>} Stops it.
 */
async function start(el, config) {
	/** @type {Record<string, any>} */
	const module = await import(`../vendor/paper/shaders/${config.shader}.js`);
	const fragment = module[`${camel(config.shader)}FragmentShader`];
	if (!fragment) throw new Error(`No fragment shader in Paper's "${config.shader}"`);
	let settings = paperSettings(config);

	// The pictures: the shader's image (prepared, for the shaders that trace
	// one), and the noise texture some of them sample.
	/** @type {Record<string, HTMLImageElement>} */
	const pictures = {};
	if (fragment.includes('u_image')) {
		let src = config.image;
		const prepare = Object.keys(module).find((k) => k.startsWith('toProcessed'));
		if (src && prepare) {
			if (SILHOUETTE.has(config.shader)) src = await silhouette(src);
			const result = await module[prepare](src);
			// The helpers name their result differently: `pngBlob` (liquid metal, gem smoke) or `blob` (heatmap).
			src = URL.createObjectURL(result.pngBlob ?? result.blob);
		}
		if (src) pictures.u_image = await loadImage(src);
		else if (config.gradient?.length) pictures.u_image = await gradientImage(config.gradient, config.gradientAngle ?? 135);
	}
	if (fragment.includes('u_noiseTexture')) {
		const noise = getShaderNoiseTexture();
		if (noise) pictures.u_noiseTexture = await noise.decode().then(() => noise);
	}

	const startTime = performance.now();
	/** @type {Map<string, { type: number, size: number, location: WebGLUniformLocation }>} */
	const active = new Map();

	const { stage, stop } = createStage(el, {
		fragment,
		vertex: vertexShaderSource,
		webgl1: false,
		scale: config.scale ?? 1,
		setup({ gl, program }) {
			const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
			for (let i = 0; i < count; i++) {
				const info = /** @type {WebGLActiveInfo} */ (gl.getActiveUniform(program, i));
				const name = info.name.replace(/\[0\]$/, '');
				const location = gl.getUniformLocation(program, info.name);
				if (location) active.set(name, { type: info.type, size: info.size, location });
			}
			// The pictures, each on its own unit, with its aspect ratio where the shader wants it.
			let unit = 0;
			for (const [name, img] of Object.entries(pictures)) {
				const slot = active.get(name);
				if (!slot) continue;
				gl.activeTexture(gl.TEXTURE0 + unit);
				imageTexture(gl, img, { mipmap: name === 'u_image' && MIPMAPPED.has(config.shader) });
				gl.uniform1i(slot.location, unit);
				const ratio = active.get(`${name}AspectRatio`);
				if (ratio) gl.uniform1f(ratio.location, img.naturalWidth / img.naturalHeight);
				unit++;
			}
			const isImage = active.get('u_isImage');
			if (isImage) gl.uniform1i(isImage.location, pictures.u_image ? 1 : 0);
		},
		uniforms({ gl, canvas, ratio }, now) {
			/**
			 * Sets one uniform by its declared type.
			 *
			 * @param {string} name The uniform.
			 * @param {any} value Its value.
			 */
			const set = (name, value) => {
				const slot = active.get(name);
				if (!slot || value === undefined) return;
				const { type, location } = slot;
				if (type === gl.FLOAT) gl.uniform1f(location, Number(value));
				else if (type === gl.BOOL || type === gl.INT) gl.uniform1i(location, value ? Number(value) : 0);
				else if (type === gl.FLOAT_VEC2) gl.uniform2fv(location, value);
				else if (type === gl.FLOAT_VEC3) gl.uniform3fv(location, value.slice(0, 3));
				else if (type === gl.FLOAT_VEC4) {
					const flat = Array.isArray(value[0]) ? value.flat() : value;
					if (flat.length) gl.uniform4fv(location, flat);
				}
			};
			const time = ((now - startTime) / 1000) * (settings.speed ?? 1) + (settings.frame ?? 0) / 1000;
			set('u_time', time);
			set('u_resolution', [canvas.width, canvas.height]);
			set('u_pixelRatio', ratio);
			for (const [name, value] of Object.entries(paperUniforms(config.shader, settings))) set(name, value);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		settings = { ...settings, colors: next.colors };
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
