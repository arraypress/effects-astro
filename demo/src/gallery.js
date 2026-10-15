/**
 * Every effect in the gallery, in the order shown: its page's slug, its
 * name, its group and one line about it. `href` sends the card somewhere
 * other than `/fx/<slug>`, and `thumb` its thumbnail elsewhere again;
 * `theme` is the page's ground.
 *
 * @type {{ slug: string, name: string, group: string, blurb: string, href?: string, thumb?: string, theme?: 'dark' | 'light' }[]}
 */
export const GALLERY = [
	{ slug: 'light-field', name: 'LightField', group: 'Backgrounds', blurb: 'Liquid light over a real fluid. Stir it; click to drop ink.' },
	{ slug: 'ink', name: 'Ink', group: 'Backgrounds', blurb: 'Ink in water that the pointer stirs.' },
	{ slug: 'ascii-rain', name: 'AsciiRain', group: 'Backgrounds', blurb: 'Data streaks on a rippling surface, in text characters.' },
	{ slug: 'fluted-glass', name: 'FlutedGlass', group: 'Backgrounds', blurb: 'Slanted fluted glass bending soft blooms of colour.', theme: 'light' },
	{ slug: 'backdrop', name: 'Backdrop', group: 'Backgrounds', blurb: 'Fifteen accent-tinted shader backgrounds by name.', href: '/backdrop' },
	{ slug: 'paper', name: 'PaperShader', group: 'Backgrounds', blurb: "Paper's thirty shaders and every preset.", href: '/paper', thumb: '/paper/mesh-gradient' },
	{ slug: 'dot-grid', name: 'DotGrid', group: 'Backgrounds', blurb: 'A sea of dots; a click sends a ripple across.' },
	{ slug: 'signal-lines', name: 'SignalLines', group: 'Backgrounds', blurb: 'Waveform lines with pulses of light running along them.' },
	{ slug: 'wave-bars', name: 'WaveBars', group: 'Backgrounds', blurb: 'A mirrored bar waveform retuning itself.' },
	{ slug: 'world-routes', name: 'WorldRoutes', group: 'Backgrounds', blurb: 'A dotted world map with comets between cities.' },
	{ slug: 'glow-field', name: 'GlowField', group: 'Backgrounds', blurb: 'A still light: bloom, beam, horizon or wash.' },
	{ slug: 'grain', name: 'Grain', group: 'Backgrounds', blurb: 'Film grain, to dither smooth gradients.' },

	{ slug: 'glass-glyph', name: 'GlassGlyph', group: 'Logos and wordmarks', blurb: 'Your logo as clear glass, bending light at its edges.' },
	{ slug: 'particle-logo', name: 'ParticleLogo', group: 'Logos and wordmarks', blurb: 'The logo in particles that scatter round the pointer.' },
	{ slug: 'point-cloud', name: 'PointCloud', group: 'Logos and wordmarks', blurb: 'A word as a dot matrix among drifting point clouds.' },
	{ slug: 'voxel-logo', name: 'VoxelLogo', group: 'Logos and wordmarks', blurb: 'The logo built of cubes, rocking in 3D, dithered.' },
	{ slug: 'spotlight-text', name: 'SpotlightText', group: 'Logos and wordmarks', blurb: 'An outline a soft light under the pointer fills in.' },
	{ slug: 'pixel-glitch-text', name: 'PixelGlitchText', group: 'Logos and wordmarks', blurb: 'Text that breaks into pixels under the pointer.' },
	{ slug: 'outline-wordmark', name: 'OutlineWordmark', group: 'Logos and wordmarks', blurb: 'A huge outlined name sinking off the page, a beam passing.' },
	{ slug: 'fit-text', name: 'FitText', group: 'Logos and wordmarks', blurb: 'One line sized to span its parent exactly.' },

	{ slug: 'scramble-text', name: 'ScrambleText', group: 'Text', blurb: 'Text resolving out of random characters.' },
	{ slug: 'typewriter', name: 'Typewriter', group: 'Text', blurb: 'Phrases typed one after another behind a caret.' },
	{ slug: 'reveal', name: 'Reveal', group: 'Text', blurb: 'Content, or each word, rising into place on scroll.' },
	{ slug: 'scroll-reveal', name: 'ScrollReveal', group: 'Text', blurb: 'Fades, slides, zooms and flips by class, site-wide.' },
	{ slug: 'highlight-sweep', name: 'HighlightSweep', group: 'Text', blurb: 'A marker underline sweeping in under a word.' },
	{ slug: 'marquee', name: 'Marquee', group: 'Text', blurb: 'An endless strip of names, with a pause button.' },
	{ slug: 'count-up', name: 'CountUp', group: 'Text', blurb: 'Numbers counting up to their value on arrival.' },

	{ slug: 'glass', name: 'Glass', group: 'Surfaces and interaction', blurb: 'Liquid glass panels with a lit rim and a sheen.' },
	{ slug: 'border-sweep', name: 'BorderSweep', group: 'Surfaces and interaction', blurb: 'A light travelling round an outline.' },
	{ slug: 'tilt', name: 'Tilt', group: 'Surfaces and interaction', blurb: 'Cards that lean towards the pointer, with a glare.' },
	{ slug: 'parallax', name: 'Parallax', group: 'Surfaces and interaction', blurb: 'Layers drifting with the pointer by depth.' },
	{ slug: 'magnetic', name: 'Magnetic', group: 'Surfaces and interaction', blurb: 'Buttons the pointer pulls on.' },
	{ slug: 'cursor', name: 'Cursor', group: 'Surfaces and interaction', blurb: 'A dot and a trailing ring that swells over links.' },
	{ slug: 'carousel', name: 'Carousel', group: 'Surfaces and interaction', blurb: 'Cards to drag and throw, settling aligned.' },
	{ slug: 'dropzone', name: 'Dropzone', group: 'Surfaces and interaction', blurb: 'A file drop target with a scanning line while busy.' },
	{ slug: 'range', name: 'Range', group: 'Surfaces and interaction', blurb: 'Filled sliders driving a gliding result.' },
	{ slug: 'timeline', name: 'Timeline', group: 'Surfaces and interaction', blurb: 'Dated steps down a line that fills as you scroll.' },
	{ slug: 'pulse-mark', name: 'PulseMark', group: 'Surfaces and interaction', blurb: 'Small animated marks: LED matrix, rings, sonar.' },
	{ slug: 'tooltip', name: 'tooltip.css', group: 'Surfaces and interaction', blurb: 'Tooltips from a data-tip attribute.' },

	{ slug: 'vinyl-sleeve', name: 'VinylSleeve', group: 'Shop and page', blurb: 'A record sliding out of its sleeve and spinning.' },
	{ slug: 'equalizer', name: 'Equalizer', group: 'Shop and page', blurb: 'Level-meter bars that bounce while playing.' },
	{ slug: 'countdown', name: 'Countdown', group: 'Shop and page', blurb: 'Days, hours, minutes and seconds to a drop.' },
	{ slug: 'skeleton', name: 'Skeleton', group: 'Shop and page', blurb: 'Shimmering loading placeholders.' },
	{ slug: 'motion', name: 'motion.css', group: 'Shop and page', blurb: 'Pulse rings, heartbeats, bumps, a live dot.' },
	{ slug: 'scroll-progress', name: 'ScrollProgress', group: 'Shop and page', blurb: 'A reading-progress bar.' },
	{ slug: 'back-to-top', name: 'BackToTop', group: 'Shop and page', blurb: 'A button that floats in once you have scrolled.' },
];

/**
 * Where a gallery entry's page is.
 *
 * @param {(typeof GALLERY)[number]} entry The entry.
 * @returns {string} Its URL path.
 */
export const pageOf = (entry) => entry.href ?? `/fx/${entry.slug}`;
