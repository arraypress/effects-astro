# Changelog

All notable changes to `@arraypress/effects-astro` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Unreleased

### Added

- Backgrounds:
  - `<LightField>`: liquid light with caustics, a prism split and a pointer lens, over a real fluid.
  - `<Ink>`: the fluid alone, with diffusion.
  - `<InkField>`: ink in water lit by a lamp that follows the pointer, over a small stable-fluids sim, from Trirat's LumiThemes shader; his twelve palettes by name (`INK_PALETTES`) or `colors`, eased live through `setColors`; a settled still frame with reduced motion, the palette as soft pools without a float render target.
  - `<AsciiRain>`: a still cloud of data in text characters by default (no loop runs while it is still), or streaks on a ray-marched wave surface with `pattern="waves"`: solid bars fading out through hollow and faint ones, with a blue-to-red lens fringe. White unless given colours.
  - `<FlutedGlass>`.
  - `<DotGrid>`: click ripples.
  - `<SignalLines>`: waveform lines drawn as light in WebGL: summed and tone-mapped so hot cores run white, back lines out of focus and lens-fringed (`depth`), loud passages brighter, a shimmer where lines cross, pulses that light the lines they pass, the pointer as a lens and lamp (`bend`), film grain in the light, `quiet`.
  - `<WaveBars>`: rounded glowing bars over a reflection in WebGL, a `colors` gradient, bars that retune like a meter with peak caps that hold then fall (`peaks`), a playhead (`sweep`) that lights and kicks the bars it plays, a pointer scrub (`scrub`), `glow`, `quiet`.
  - `<DotSurface>`: a halftone sea, round dots on a slowly rolling sheet in perspective, each sized and lit by the light; the pointer raises a swell and a click sends a ring; `color` or an Oklab `colors` gradient across depth or width, `quiet`.
  - `<ShaderBackground effect="…">`: the six strongest shader backgrounds of `@arraypress/effect-canvas-astro`, which it replaces (mesh-gradient, grain-gradient, silk, band-lens, grid, waves; its faint and plain ones are left to `<GlowField>` and `<Grain>`), tinted from `--color-accent` (the second colour mixed towards `--color-bg` in Oklab); `speed`, `intensity`, `static` + `frame`, `interactive`, `blend`, `fade` and `fixed`; a CSS gradient without WebGL.
  - `<WorldRoutes>`: a dotted world map (from Natural Earth) with comets between cities; routes as `[from, to]`, `{ from, to, color, label, speed, width, dashed }` or a lone place from a `home` hub; a `colors` palette and Oklab `gradient`s; city `markers`, `halo`s and collision-aware `labels`; `curve="great-circle"`, `dashed` arcs, `arcOpacity`, `width`, `tail`, `glow`, `comets`, `ping`; `region` (named, `routes`, or a lat/lon box) with `fit`, `dotShape`, `graticule` and a wrapping `drift`; hovering a city or route picks it out and names it.
  - `<HaloRing>`: a ring of light around centred copy on a dark ground: a soft-cornered outline drifting between a rounded hexagon and a rounded rectangle (or held as `hexagon`, `rect` or `circle`), colour travelling round it in Oklab, the hottest stretches burning to white, a little glow inward and a long one outward; the pointer draws it close and lights it up. `corner`, `margin`, `thickness`, `glow`, `speed`, `quiet`.
  - `<SilkRibbon>`: a wide ribbon of satin twisting across a light ground, folds gathering where it turns and a sheen along each one, over a soft out-of-focus glow; the folds undulate and lean towards the pointer. `side`, `twist`, `folds`, `glow`, `speed`.
  - `<GlowField>`: bloom, beam, horizon and wash.
  - `<Grain>`.
- `<PaperShader>`: Paper's 30 shaders and 124 presets (Apache-2.0, vendored), with `params`, `colors` and `image`.
- Logos and shapes, each from text or an SVG or PNG (`src`):
  - `<GlassGlyph>`: a thick bevelled slab lit from behind by fixed beams of light in a pinwheel, dithered to halftone where they fade; it sways slowly on its own and leans away from the pointer, showing its side walls, while the light barely moves. Bright rims, bevels that reflect the light, beams refracted and split through the glass. `light`, `sway`.
  - `<LiquidMetal>`: the logo as a slab of polished chrome in a studio made in the shader (sky, horizon, floor, softboxes, a key light; Fresnel), turning slowly so the reflections glide, over a GPU wave simulation: the pointer dents it and ripples run out, a stroke parts it and it flows back, a click splashes a crater with a ring wave and droplets that fall and crawl back in; surface tension reforms the exact logo with a last wobble, then the simulation sleeps. `tint` (chrome, gold, rose-gold, copper, black-chrome or hex), `palette`/`colors` tint the studio, `bevel`, `viscosity`, `tension`, `ripple`, `interactive`, `shadow`.
  - `<ParticleLogo>`.
  - `<NeonSwarm>`: a few thousand neon particles on curl-noise springs hold the logo, shimmering and breathing, with fading trails and bloom; the pointer scatters them; they gather from a cloud on arrival.
  - `<NebulaLogo>`: domain-warped nebula gas inside the logo, densest at its edges, with dust lanes, a glowing rim, a halo past the edge and twinkling stars; the pointer brightens the gas and leaves a wake that stirs it.
  - `<PointCloud>`: optional tracker boxes.
  - `<VoxelLogo>`: dithered, optional markers.
- Text:
  - `<SpotlightText>`.
  - `<PixelGlitchText>`: optional outline.
  - `<OutlineWordmark>`: the beam, and a spotlight under the pointer.
  - `<FitText>`, and `fit` on the wordmark components.
  - `<ScrambleText>`.
  - `<Typewriter>`.
  - `<Reveal>`: whole or word by word.
  - `<ScrollReveal>` and `reveal.css`: class-based scroll reveal for a whole site (fades, slides, zooms, flips, blur), replacing the `@arraypress/reveal-astro` package with the same classes and props.
  - `<HighlightSweep>`.
  - `<Marquee>`: a pause button.
- Surfaces and interaction:
  - `<RadiantGlass>`: a cluster of frosted glass tiles on a dark ground, glowing from inside with soft peach, blue and white light that drifts and shifts with the pointer, each with a two-tone rim and a halo; one cheap shader, the frosting an analytic blur. `layout` (cross, diagonal, single), `shape` (diamond, square, circle), `side`, `size`, `frost`, `glow`, `rim`, `speed`.
  - `<Glass>` (and `glass.css`).
  - `<BorderSweep>` (and `border-sweep.css`).
  - `<Tilt>`.
  - `<Parallax>`.
  - `<Magnetic>`.
  - `<Cursor>`.
  - `<PulseMark>`: matrix, rings and sonar marks.
- `motion.css` (pulse ring, heartbeat, bump, shimmer, attention, settle, a live status dot) with `bump()`.
- `palette` on every effect that takes colours: eighteen named sets (`PALETTES`), Trirat's twelve and six more, shaped to what each effect takes; an effect's own `colors` win.
- `setColors`, for changing a WebGL effect's palette on the fly.
- The runtime:
  - **Shared set-up:** `createStage` (WebGL) and `createCanvas2D`; one animation loop that runs only what is near the screen; view-transition-safe mounting.
  - **Simulation and drawing:** a Stable Fluids solve with pointer strokes as ribbons; points, shapes, distance fields, glyph textures and tracker overlays.
  - **Colour:** Oklab on the CPU and in GLSL.
  - **GPU simulations:** `createPingPong` and `floatFormats`, a pair of float render targets, full or half floats, WebGL 1 or 2.
  - **Device checks:** pixel-ratio cap, phones, reduced motion, hover.
- COMPONENTS.md, generated from the components' types (`npm run docs`).
- A demo (`demo/`): a page for each group, every effect a working hero, each ShaderBackground and Paper shader on its own, live only while near the screen.
- Effects added to or taken out of the page after it loads start and stop by themselves, and a WebGL effect taken out gives its GPU context back at once.

Effects brought together from the WaveGrid (SampleGrid), SellGrid, ArrayPress, AgentGrid, LinkGrid and LaunchGrid themes, the LumiThemes, FilterSpark, waveform-player, SugarCart, Statement Buster, Pure Papers, Sample Foundry, Graphic Foundry, Loopcuts, Producer Space and David Sherlock sites, and new.
