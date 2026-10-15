/**
 * What the generated props (props.json, from `npm run docs`) cannot know:
 * the props a hero sets for its content and placement rather than its look,
 * components the panel cannot remake live, and the odd range to change.
 */

/** Props the panel never shows: content, placement and plumbing, set by the hero's markup. */
export const HIDDEN = new Set(['src', 'text', 'font', 'area', 'fixed', 'class', 'as', 'quiet', 'within', 'ignore', 'effect', 'shader', 'preset', 'params', 'image']);

/** Components with no panel: they play once, rewrite their own content, or come several to a hero with settings of their own. */
export const OFF = new Set(['Cursor', 'Marquee', 'Parallax', 'PixelGlitchText', 'PulseMark', 'Reveal', 'ScrambleText', 'ScrollReveal', 'Typewriter']);

/**
 * Per component: more props to hide, and a prop's range, step or default
 * to change (a default its doc gives only in words).
 *
 * @type {Record<string, { hide?: string[] } & Record<string, { min?: number, max?: number, step?: number, default?: unknown } | string[]>>}
 */
export const TWEAKS = {
	InkField: { hide: ['scale'] },
	LightField: { hide: ['scale'] },
	PaperShader: { hide: ['gradientAngle'] },
	Glass: { tint: { default: '#08080a' } },
	ShaderBackground: { frame: { min: 0, max: 60 } },
	OutlineWordmark: { weight: { min: 100, max: 900, step: 100 } },
	NeonSwarm: { count: { min: 1000, max: 12000, step: 100 } },
	ParticleLogo: { count: { min: 2000, max: 30000, step: 500 } },
};
