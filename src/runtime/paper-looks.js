/**
 * @module @arraypress/effects-astro/paper-looks
 *
 * The Paper looks: Paper shaders made backgrounds of their own (each a
 * component, `<ColorPanels>`…), named for the look. Each is its shader,
 * the preset its props start from, and which of Paper's settings each of
 * its own props sets (`skewLeft` → `angle1`). The props every look shares
 * (`background`, `zoom`, `rotation`, `offset`, `colors`, `palette`,
 * `speed`, `quiet`) are mapped once, in src/runtime/paper-look.js.
 */

/** @typedef {import('./paper-looks.js').PaperLook} PaperLook */

/** @type {Readonly<Record<import('./paper-looks.js').PaperLookName, PaperLook>>} */
export const PAPER_LOOKS = {
	'color-panels': {
		shader: 'color-panels',
		preset: 'Opening',
		props: { density: 'density', skewLeft: 'angle1', skewRight: 'angle2', length: 'length', edges: 'edges', blur: 'blur', fadeInner: 'fadeIn', fadeOuter: 'fadeOut', blend: 'gradient' },
	},
};
