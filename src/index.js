/**
 * @arraypress/effects-astro
 *
 * GPU effects for Astro sites, as components imported from their own paths
 * (`@arraypress/effects-astro/LightField.astro`, …). This entry is the
 * runtime underneath, for use without Astro or to build more: the effects
 * as plain functions, the stage they share, the fluid simulation, point and
 * shape helpers, colour in Oklab, the shared animation loop, the pointer,
 * and the device checks every effect makes.
 *
 * @module @arraypress/effects-astro
 */

export { lightField } from './runtime/light-field.js';
export { ink } from './runtime/ink.js';
export { spotlight } from './runtime/spotlight.js';
export { asciiRain } from './runtime/ascii-rain.js';
export { glassGlyph } from './runtime/glass-glyph.js';
export { flutedGlass } from './runtime/fluted-glass.js';
export { particleLogo } from './runtime/particle-logo.js';
export { pointCloud } from './runtime/point-cloud.js';
export { voxelLogo } from './runtime/voxel-logo.js';
export { pixelGlitch } from './runtime/pixel-glitch.js';
export { fit, fitText } from './runtime/fit-text.js';
export { textNodes, textRange } from './runtime/text.js';
export { dotGrid } from './runtime/dot-grid.js';
export { signalLines, waveBars } from './runtime/waves.js';
export { dotSurface } from './runtime/dot-surface.js';
export { tilt, parallax } from './runtime/tilt.js';
export { magnetic } from './runtime/magnetic.js';
export { cursor } from './runtime/cursor.js';
export { scramble, typewriter, reveal } from './runtime/text-motion.js';
export { marquee } from './runtime/marquee.js';
export { glassSheen } from './runtime/glass-sheen.js';
export { bump } from './runtime/motion.js';
export { worldRoutes, CITIES } from './runtime/world-routes.js';
export { REGIONS } from './runtime/world-map.js';
export { isLand, LAND } from './runtime/world-land.js';
export { inView } from './runtime/in-view.js';
export { scrollReveal, REVEAL_CLASSES } from './runtime/scroll-reveal.js';
export { backdrop, backdropPalette, backdropSettings } from './runtime/backdrop.js';
export { inkField, inkFieldSettings } from './runtime/ink-field.js';
export { PALETTES, findPalette, pickColors } from './runtime/palettes.js';
export { neonSwarm } from './runtime/neon-swarm.js';
export { nebulaLogo } from './runtime/nebula-logo.js';
export { createCanvas2D, grainPattern, grainOnto } from './runtime/canvas2d.js';
export { paperShader, paperSettings, paperUniforms } from './runtime/paper.js';
export { createStage } from './runtime/stage.js';
export { createPoints, projectPoint, GLSL_PROJECT } from './runtime/points.js';
export { createTrackers } from './runtime/trackers.js';
export { drawShape, samplePoints, gridPoints, distanceField, blurField, fontAt } from './runtime/shape.js';
export { createGlyphs, GLYPH_SETS, GLSL_GLYPHS } from './runtime/glyphs.js';
export { GLSL_NOISE, GLSL_PALETTE, GLSL_QUIET, paletteUniform, quietUniform } from './runtime/glsl.js';
export { createFluid, stir } from './runtime/fluid.js';
export { parseColor, toHex, toOklab, fromOklab, mixOklab, paletteAt, GLSL_OKLAB } from './runtime/color.js';
export { animate } from './runtime/loop.js';
export { pointerIn, trail, pressAt, CLICK_IGNORE } from './runtime/pointer.js';
export { pixelRatio, isMobileGpu, prefersReducedMotion, canHover } from './runtime/device.js';
export { getContext, createProgram, bindTriangle, VERTEX } from './runtime/gl.js';
export { mount, readConfig, watchColors } from './runtime/mount.js';

/**
 * Changes the colours of a WebGL effect (`<LightField>`, `<Ink>`,
 * `<AsciiRain>`, `<FlutedGlass>`, `<GlassGlyph>`, `<ParticleLogo>`,
 * `<PointCloud>`, `<VoxelLogo>`): a light eases to them in about a second,
 * the others take them from their next frame.
 *
 * @param {Element | null} el The effect's element (`[data-effect-light-field]` and so on).
 * @param {string[]} colors The new palette, as CSS hex, in the order the effect's `colors` takes.
 * @param {string} [glint] A light field's new glint colour.
 */
export function setColors(el, colors, glint) {
	if (!(el instanceof HTMLElement)) return;
	el.dataset.colors = JSON.stringify(glint ? { colors, glint } : { colors });
}
