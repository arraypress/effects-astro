# Changelog

All notable changes to `@arraypress/effects-astro` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Unreleased

### Added

- Backgrounds:
  - `<LightField>`: liquid light with caustics, a prism split and a pointer lens, over a real fluid.
  - `<Ink>`: the fluid alone, with diffusion.
  - `<AsciiRain>`: streaks on a ray-marched wave surface, in text characters: solid bars fading out through hollow and faint ones, with a blue-to-red lens fringe. White unless given colours.
  - `<FlutedGlass>`.
  - `<DotGrid>`: click ripples.
  - `<SignalLines>`.
  - `<WaveBars>`.
  - `<Backdrop effect="…">`: the fifteen shader backgrounds of `@arraypress/effect-canvas-astro`, which it replaces, tinted from `--color-accent` (the second colour mixed towards `--color-bg` in Oklab); `speed`, `intensity`, `static` + `frame`, `interactive`, `blend`, `fade` and `fixed`; a CSS gradient without WebGL.
  - `<WorldRoutes>`: a dotted world map (from Natural Earth) with comets between cities.
  - `<GlowField>`: bloom, beam, horizon and wash.
  - `<Grain>`.
- `<PaperShader>`: Paper's 30 shaders and 124 presets (Apache-2.0, vendored), with `params`, `colors` and `image`.
- Logos and shapes, each from text or an SVG or PNG (`src`):
  - `<GlassGlyph>`.
  - `<ParticleLogo>`.
  - `<PointCloud>`: optional tracker boxes.
  - `<VoxelLogo>`: dithered, optional markers.
- Text:
  - `<SpotlightText>`.
  - `<PixelGlitchText>`: optional outline.
  - `<OutlineWordmark>`: the beam.
  - `<FitText>`, and `fit` on the wordmark components.
  - `<ScrambleText>`.
  - `<Typewriter>`.
  - `<Reveal>`: whole or word by word.
  - `<ScrollReveal>` and `reveal.css`: class-based scroll reveal for a whole site (fades, slides, zooms, flips, blur), replacing the `@arraypress/reveal-astro` package with the same classes and props.
  - `<HighlightSweep>`.
  - `<Marquee>`: a pause button.
  - `<CountUp>`: counts to its value on arrival and glides to new ones.
- Surfaces and interaction:
  - `<Glass>` (and `glass.css`).
  - `<BorderSweep>` (and `border-sweep.css`).
  - `<Tilt>`.
  - `<Parallax>`.
  - `<Magnetic>`.
  - `<Cursor>`.
  - `<Carousel>`: drag and throw with a mouse, snap, edge fades, arrows.
  - `<Dropzone>`: a file drop target with an edge light and a busy scan.
  - `<Range>`: a filled slider with a formatted value.
  - `<Timeline>`: fills as the page scrolls.
  - `<PulseMark>`: matrix, rings and sonar marks.
  - `tooltip.css`: tooltips from `data-tip`.
- For shops:
  - `<VinylSleeve>`.
  - `<Equalizer>`.
  - `<Countdown>`.
  - `<Skeleton>`.
  - `<ScrollProgress>`.
  - `<BackToTop>`.
  - `motion.css` (pulse ring, heartbeat, bump, shimmer, attention, settle, a live status dot) with `bump()`.
- `setColors`, for changing a WebGL effect's palette on the fly.
- The runtime:
  - **Shared set-up:** `createStage` (WebGL) and `createCanvas2D`; one animation loop that runs only what is near the screen; view-transition-safe mounting.
  - **Simulation and drawing:** a Stable Fluids solve with pointer strokes as ribbons; points, shapes, distance fields, glyph textures and tracker overlays.
  - **Colour:** Oklab on the CPU and in GLSL.
  - **Device checks:** pixel-ratio cap, phones, reduced motion, hover.
- COMPONENTS.md, generated from the components' types (`npm run docs`).
- A demo site with a page per effect (`demo/`).

Effects brought together from the WaveGrid (SampleGrid), SellGrid, ArrayPress, AgentGrid, LinkGrid and LaunchGrid themes, the LumiThemes, FilterSpark, waveform-player, SugarCart, Statement Buster, Pure Papers, Sample Foundry, Graphic Foundry, Loopcuts, Producer Space and David Sherlock sites, and new.
