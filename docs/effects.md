# The effects

Every prop of every component is in **[COMPONENTS.md](../COMPONENTS.md)**, generated from the components' own types.

**Backgrounds** (fill their section, or the page with `fixed`)

| Component | | Drawn with |
|---|---|---|
| `<LightField>` | Liquid light in three colours with caustic glints and a pointer lens, over a real fluid that the pointer stirs and a click drops ink into | WebGL |
| `<Ink>` | The fluid on its own: ink in water over whatever is behind | WebGL 2 |
| `<InkField>` | Ink in water, lit by a lamp that follows the pointer: slow emitters keep it moving, the pointer stirs it, twelve named palettes (`palette="Peacock"`) that a palette switcher recolours live; with `audio`, the beat stirs it | WebGL |
| `<LightLeak>` | A soft, slow lava-lamp or light-leak colour field: drifting fBm blobs under a gentle warp, four colours (darkest first) mixed in Oklab, a breath too slow to see; `quiet` flattens it to one tone behind copy | WebGL |
| `<DitherField>` | A slow noise field in square dots: Bayer-dithered edges into a solid, colour-banded core, with ripples running out from a corner and bent into shore-wave shapes; two colours, one dot per pixel so it is cheap on a wall of cards | WebGL |
| `<CascadeGrid>` | A grid of hexagons or dots run like a scrolling spectrogram: each column shows the same made-up spectrum a little later, so waves cascade across it and cells swell from idle specks to reactive shapes, busier low down; outline, solid or cored cells, four directions | WebGL |
| `<FlowField>` | Hundreds of short, fine trails riding a slowly evolving noise flow, born, gathering into streams and fading; how many there are, how fast they travel and how heavy the lines are drift slowly; white on black by default | Canvas |
| `<VoronoiMesh>` | A Voronoi mesh in thin lines on a deep ground, in two tiers: macro cells whose seeds orbit slowly, and inner cells inside each that pulse outward from its seed; pale stone and dusty rose on maroon by default | WebGL |
| `<KineticGrid>` | A fine wireframe grid that ripples where drops land, rings spreading and settling and brighter where the wires stretch, with thin ring pulses running along the lines; opaque dark ground by default | WebGL |
| `<DitherGradient>` | A soft colour gradient drawn only in dots: a wavy horizon, a glowing band, a swirl, a pinwheel, stepped columns, a soft orb or a glowing pill, in two or three colours, in square dots an 8×8 ordered dither thins out (`mode="bayer"`) or round halftone dots that shrink (`mode="halftone"`), two colours mixed in Oklab; `quiet` clears it behind copy | WebGL |
| `<TruchetField>` | Truchet tiles: quarter arcs on opposite corners joining into loops and S-bends, a few tiles turning a quarter at a time on their own clocks, a slow noise brightening and thickening the lines in drifting patches, optionally shaded like tubes | WebGL |
| `<PixelHorizon>` | A flat colour filling one side and breaking up into square blocks toward the other, blocks winking on and off along a slowly swaying, wandering frontier; one canvas pixel a block, so it is cheap on a wall of cards | WebGL |
| `<FlutedGlow>` | A soft ring, orb or rising light seen through upright reeded glass, each flute a stretched slice with faint seams and grain, breathing slowly; no pointer, made to sit behind copy (opaque) | WebGL |
| `<FluidFolds>` | Glossy folds of liquid colour on a dark ground, warped by slow noise and lit from one side, an iridescent rim where a fold turns away and a glassy highlight on each crest, the colour drifting along a ramp of three; poured enamel (`style="liquid"`) or long silk dunes (`style="dunes"`); no pointer, made to sit behind copy (opaque) | WebGL |
| `<FlutedBokeh>` | Coloured lights out of focus behind upright reeded glass, each flute a squeezed slice with a thin rainbow at its seams and the light smeared a little upright, or behind a wall of square glass blocks (`mode="blocks"`); the lights drift slowly; no pointer, made to sit behind copy (opaque) | WebGL |
| `<PaintDrip>` | A mark sprayed in paint, the paint running: drips pool on its lower edges, break away, fall under gravity against the paint's viscosity (a bead at the head, the body thinning), slow, stop and dry, then fade and run again; a speckled spray edge and a glow (opaque) | Canvas 2D |
| `<PhotoBokeh>` | A photo racking its focus near to far and back (a depth guessed from the picture), soft out-of-focus lights tinted from its highlights drifting up through it; made for flowers behind a mark | WebGL |
| `<LensFlare>` | An anamorphic lens flare: a hot source, its long thin blue (or amber, teal) streak, a veil, and soft ghosts on the line through the centre that travel against the source as it drifts | WebGL |
| `<SunWall>` | Low sunlight on a plaster wall, through venetian blinds (hard bars, the penumbra growing with the throw) or with a prism's short spectrum beside a patch of sun, creeping slowly | WebGL |
| `<AsciiNoise>` | A field of slow noise drawn as monospace characters, soft-edged blobs of type drifting and morphing, quiet cells in one colour and loud in another; nine ramps (punctuation, shade blocks, numerals, rising blocks, quadrants, bars, arrows, letters, the long classic) | WebGL |
| `<AsciiRain>` | Streams of data in text characters, rows sliding at their own pace, a cool cyan-green cast, a lens fringe and the odd glitch (or, with `pattern="waves"`, streaks on a rippling 3D surface) | WebGL |
| `<FlutedGlass>` | Slanted fluted glass bending soft blooms of colour, one following the pointer | WebGL |
| `<DotGrid>` | A sea of dots with a drifting current; a click sends a ripple across | Canvas |
| `<SignalLines>` | Waveform lines drawn as light: sharp in front, out of focus and lens-fringed behind, a shimmer where they cross, pulses of light running along them, and the pointer a lens they part round; with `audio`, the waveform of the sound playing | WebGL |
| `<WaveBars>` | A glowing bar waveform over its reflection, retuning like a meter with peak caps that hold and fall, a playhead that lights the bars it plays, and the pointer scrubbing; with `audio`, the spectrum of the sound playing on the page | WebGL |
| `<DotSurface>` | A halftone sea: dots on a slowly rolling sheet in perspective, sized and lit by the light; the pointer raises a swell, a click sends a ring | WebGL |
| `<ShaderBackground>` | Six shader backgrounds by name (`mesh-gradient`, `grain-gradient`, `silk`, `band-lens`, `grid`, `waves`), tinted from the page's `--color-accent` unless given `colors`; `static` for wallpaper | WebGL |
| `<HaloRing>` | A ring of light around centred copy: a soft-cornered outline drifting between a hexagon and a rounded rectangle, colour travelling round it and burning white where it is hottest, glowing far outward; the pointer draws it close | WebGL |
| `<SilkRibbon>` | A wide ribbon of satin twisting across a light ground, folds gathering where it turns and a sheen along each, over a soft glow; the folds undulate and lean to the pointer | WebGL |
| `<Topography>` | A survey map that never sits still: crisp contour lines of a slowly drifting landscape, every fifth heavier; the pointer lifts the ground and lights its lines, `labels` adds elevation numbers | WebGL |
| `<Caustics>` | Sunlight rippling through water onto a pool floor: a shifting net of light with a faint rainbow at its edges, stirred by the pointer; optional tiles | WebGL |
| `<RainOnGlass>` | Rain on a window over a photo: beads, drops running down in clearing trails, each a lens holding the scene upside down, soft bokeh behind fog; the pointer wipes a patch | WebGL |
| `<Ocean>` | Photoreal open sea to the horizon: wind-driven waves, a glittering sun path, light through thin crests, whitecaps, high cloud and haze; `time` dawn, noon, sunset or a moonlit night; the camera drifts with the pointer | WebGL |
| `<IsoCity>` | A tiny isometric low-poly city with traffic keeping its lanes and the brand's taxis; click a street and the nearest one drives round to pick you up; `night` lights the windows and headlights | WebGL |
| `<ColorPanels>` | Translucent panels of colour swinging open out of the dark and sweeping past like turning pages: Paper's color-panels shader with plain props (`density`, `skewLeft`, `length`, `edges`, `blur`, `blend`…), its Opening preset by default (`preset` for the others) | WebGL 2 |
| `<Galaxy>` | Deep space in a palette's colours: soft nebula clouds with dust lanes, shimmering glitter and twinkling stars, drifting slowly | Canvas |
| `<Scene>` | One of twenty studio-lit scenes from [`@logomarks/shaders`](https://github.com/Logomarks/shaders) by `name`: liquid marble, frosted or ribbed glass, glossy tiles, chrome, glitter, holographic foil, a neon ribbon, pastel spheres, glass rings, ink in water, oil bubbles, a melting hologram, topographic lines and more; any `palette` recolours it, `params` reshapes it, lazy by default | WebGL 2 |
| `<WorldRoutes>` | A dotted world map with comets of light arcing between cities: a home hub, per-route colours and Oklab gradients, labels, regions, great-circle arcs, hover | Canvas |
| `<GlowField>` | A light to lay over a background: a bloom, a swaying stage spotlight, a horizon or a wash, breathing gently | CSS |
| `<Grain>` | Flickering film grain, to dither smooth gradients and make a picture read as film | CSS |

**Paper shaders**: `<PaperShader shader="mesh-gradient" preset="beach">`, any of the 30 shaders from [Paper](https://shaders.paper.design) with each of their 124 presets, run on the same loop and guarantees as the rest. Pass `params` to change any setting, `colors` for the palette, and `image` for the shaders that work on a picture (your logo in `liquid-metal`, `heatmap` or `gem-smoke`; a photo in `fluted-glass`, `halftone-dots`, `water` or `image-dithering`). The looks worth keeping become backgrounds of their own, with plain props: `<ColorPanels>` so far.

`color-panels`, `dithering`, `dot-grid`, `dot-orbit`, `fluted-glass`, `gem-smoke`, `god-rays`, `grain-gradient`, `halftone-cmyk`, `halftone-dots`, `heatmap`, `image-dithering`, `lens-distortion`, `liquid-metal`, `mesh-gradient`, `metaballs`, `neuro-noise`, `paper-texture`, `perlin-noise`, `pulsing-border`, `simplex-noise`, `smoke-ring`, `spiral`, `static-mesh-gradient`, `static-radial-gradient`, `swirl`, `voronoi`, `warp`, `water`, `waves`. The demo shows every preset.

**Logos and shapes** (`text` in any font, or `src`: your own SVG or PNG)

| Component | | Drawn with |
|---|---|---|
| `<GlassDrop>` | A logo arriving as liquid glass: a drop lands with rings running out, spreads into a glass tile over the logo (or into the logo's own shape), bends and splits light at its rim, then melts and leaves the logo flat; once or on a loop | WebGL |
| `<GlassStack>` | A logo as a stack of tinted glass discs in front of a lit card, seen a little from below, growing from the bottom up, then leaning toward the pointer | WebGL |
| `<GlassGlyph>` | The logo as a thick bevelled slab of glass, swaying slowly in front of fixed beams of coloured light that bend through its rims | WebGL |
| `<LiquidMetal>` | The logo as liquid chrome in a slowly turning studio: the pointer dents it and sends ripples across it, a stroke parts it, a click splashes it (a crater, a ring wave, droplets that crawl back), and it pulls itself back into shape; `tint` for gold, rose gold, copper or black chrome | WebGL |
| `<ParticleLogo>` | The logo in thousands of twinkling particles that scatter round the pointer | WebGL |
| `<NeonSwarm>` | The logo held by a swarm of neon particles that flows like a flock, trails light and scatters from the pointer | WebGL |
| `<NebulaLogo>` | The logo filled with drifting nebula gas, a glowing rim, a halo past its edge and twinkling stars; the pointer stirs it | WebGL |
| `<PointCloud>` | A word as a dot matrix among drifting point clouds, optional tracker boxes | WebGL |
| `<VoxelLogo>` | The logo built of cubes, rocking in 3D, dithered to two inks, optional markers | WebGL |

**Text**

| Component | | Drawn with |
|---|---|---|
| `<SpotlightText>` | An outline a soft light under the pointer fills in | CSS + JS |
| `<PixelGlitchText>` | Text that breaks into pixels under the pointer | Canvas |
| `<PixelFountain>` | Retro 8-bit sparks: chunky pixels fire up out of a footer's top edge (or a wordmark's letters with `source="text"`), step through lime, darker lime and olive, shrink or split and flicker out; a trickle on its own, a stream under the pointer, a power-up on a click | Canvas |
| `<OutlineWordmark>` | A huge outlined name sinking out of the page, a beam passing through and a light under the pointer filling the letters | CSS + SVG |
| `<FitText>` | One line sized to span its parent exactly | JS |
| `<ScrambleText>` | Text resolving out of random characters | JS |
| `<Typewriter>` | Phrases typed one after another behind a caret | JS |
| `<Reveal>` | Content, or each word, rising into place on scroll | CSS + JS |
| `<ScrollReveal>` | Once in a layout: anything with a reveal.css class (`fade-in-up`, `zoom-in`, `flip-left`…) arrives on scroll | CSS + JS |
| `<HighlightSweep>` | A marker underline sweeping in under a word | CSS |
| `<GlitchText>` | A headline that glitches every few seconds, each on its own beat: two coloured copies sliced and shifted for a few frames; livelier under the pointer | CSS |
| `<Marquee>` | An endless strip of names or logos, with a pause button | CSS + JS |
| `<VariableType>` | A variable-font headline whose letters swell heavier and wider under the pointer in a springy wave, and drift gently on their own | JS |

**Surfaces and interaction**

| Component | | Drawn with |
|---|---|---|
| `<ImageRipple>` | A hero photo that ripples like water under the pointer: a wake as it moves, a ring where you click, a soft colour split at the wave fronts and light on the crests, then back to the still, sharp photo; a real `<img>` underneath | WebGL |
| `<ProductStack>` | A store's product covers floating in a 3D fan, stack or carousel arc with depth of field and a glossy sheen; leans to the pointer, fans apart on hover, lifts the cover under it; real, focusable links | CSS + JS |
| `<MosaicReveal>` | A slideshow whose pictures change through a GPU transition: tiles flipping in a diagonal wave, a pixel-sort melt, pixelation or a glowing dissolve | WebGL |
| `<RadiantGlass>` | A cluster of frosted glass tiles on a dark ground, glowing from inside with soft drifting light that shifts with the pointer; a two-tone rim and a halo on each | WebGL |
| `<Glass>` | A liquid glass panel with a lit rim and a pointer sheen; `refract` bends the live page behind it like a thick lens, with colour at the rim (Chromium; elsewhere it stays frosted) | CSS + JS |
| `<BorderSweep>` | A light travelling round an outline (or two chasing each other); `inset` for cards that clip | CSS |
| `<Tilt>` | A card that leans towards the pointer, with a glare | CSS + JS |
| `<Parallax>` | Layers that drift with the pointer by depth | CSS + JS |
| `<Magnetic>` | A button the pointer pulls on | CSS + JS |
| `<Cursor>` | A dot and a trailing ring that swells over links | CSS + JS |
| `<PulseMark>` | A small animated mark: LED matrix, turning rings or sonar | SVG + CSS |

**Stylesheets**, for elements you render yourself:

| Import | Classes |
|---|---|
| `@arraypress/effects-astro/glass.css` | `.glass` (call `glassSheen()` once for the sheen) |
| `@arraypress/effects-astro/border-sweep.css` | `.sweep-ring`, `--always`, `--fast`, `--two`, `--inset`, `--long`, `--focus-visible`, `--focus-none`, `--still-none`; `--sweep-outset` |
| `@arraypress/effects-astro/glitch-text.css` | `.glitch-text` with its copies `.glitch-text-a` and `.glitch-text-b` (markup in the file), or `--pseudo` with a `data-text`; `--skew` |
| `@arraypress/effects-astro/motion.css` | `.fx-pulse-ring`, `.fx-heartbeat`, `.fx-bump` (replay with `bump(el)`), `.fx-shimmer`, `.fx-pulse`, `.fx-wiggle`, `.fx-shake`, `.fx-settle`, `.fx-live` (a status dot) |
| `@arraypress/effects-astro/reveal.css` | `.fade-in`, `.fade-in-up/down/left/right`, `.slide-in-*`, `.zoom-in`, `.zoom-out`, `.flip-up/down/left/right`, `.blur-in` (with `<ScrollReveal />`) |
