# @arraypress/effects-astro

Effects for Astro sites, as components: shader backgrounds, a real fluid, logos made of glass, particles or cubes, text that glitches, scrambles or types itself, glass panels and marquees: what makes a page look alive. Small UI pieces (countdowns, sliders, drop zones, tooltips) live in [`@arraypress/ui-astro`](https://github.com/LumiThemes/ui-astro); counters and drag-to-scroll in [`@arraypress/behaviors-astro`](https://github.com/arraypress/behaviors-astro). Plain WebGL, Canvas and CSS with no dependencies, and with the fallbacks a theme needs built in.

```astro
---
import LightField from '@arraypress/effects-astro/LightField.astro';
---
<LightField fixed colors={['#7c3aed', '#db2777', '#06b6d4']} />
```

Every prop of every component is in **[COMPONENTS.md](COMPONENTS.md)**, generated from the components' own types.

## Install

```bash
npm install @arraypress/effects-astro
```

Astro 6 or 7. The runtime underneath (`@arraypress/effects-astro`) works without Astro.

## What every effect does for you

- **Runs only when it is seen.** One animation loop for the page; an effect draws only while it is within 128px of the viewport and the tab is showing.
- **Draws at what the device can afford.** The pixel ratio is capped at 2 on a desktop and 1.5 on a phone or tablet, and heavier passes (the light's prism split) are dropped on phones.
- **Respects reduced motion.** Every effect has a still state: one frame, a static date, the text simply there.
- **Has a fallback.** No WebGL: a still gradient, or the element's background. No hovering pointer: nothing waits for a hover.
- **Keeps content readable.** Effects are decoration (`aria-hidden`); real text stays in the page for screen readers and search; moving content has a pause button where it runs on.
- **Survives view transitions.** Effects start on `astro:page-load` and stop when their element leaves the page.
- **Mixes colour in Oklab**, so palettes blend without muddy midpoints.
- **Sends nothing anywhere.** No telemetry, no network.

## The effects

**Backgrounds** (fill their section, or the page with `fixed`)

| Component | | Drawn with |
|---|---|---|
| `<LightField>` | Liquid light in three colours with caustic glints and a pointer lens, over a real fluid that the pointer stirs and a click drops ink into | WebGL |
| `<Ink>` | The fluid on its own: ink in water over whatever is behind | WebGL 2 |
| `<InkField>` | Ink in water, lit by a lamp that follows the pointer: slow emitters keep it moving, the pointer stirs it, twelve named palettes (`palette="Peacock"`) that a palette switcher recolours live | WebGL |
| `<AsciiRain>` | Streams of data in text characters, rows sliding at their own pace, a cool cyan-green cast, a lens fringe and the odd glitch (or, with `pattern="waves"`, streaks on a rippling 3D surface) | WebGL |
| `<FlutedGlass>` | Slanted fluted glass bending soft blooms of colour, one following the pointer | WebGL |
| `<DotGrid>` | A sea of dots with a drifting current; a click sends a ripple across | Canvas |
| `<SignalLines>` | Layered waveform lines with pulses of light running along them | Canvas |
| `<WaveBars>` | A mirrored bar waveform retuning itself, a band of light drifting across | Canvas |
| `<Backdrop>` | Six shader backgrounds by name (`mesh-gradient`, `grain-gradient`, `silk`, `band-lens`, `grid`, `waves`), tinted from the page's `--color-accent` unless given `colors`; `static` for wallpaper | WebGL |
| `<WorldRoutes>` | A dotted world map with comets of light arcing between cities | Canvas |
| `<GlowField>` | A still light (bloom, beam, horizon or wash) to lay over a background | CSS |
| `<Grain>` | Film grain, to dither smooth gradients | CSS |

**Paper shaders**: `<PaperShader shader="mesh-gradient" preset="beach">`, any of the 30 shaders from [Paper](https://shaders.paper.design) with each of their 124 presets, run on the same loop and guarantees as the rest. Pass `params` to change any setting, `colors` for the palette, and `image` for the shaders that work on a picture (your logo in `liquid-metal`, `heatmap` or `gem-smoke`; a photo in `fluted-glass`, `halftone-dots`, `water` or `image-dithering`).

`color-panels`, `dithering`, `dot-grid`, `dot-orbit`, `fluted-glass`, `gem-smoke`, `god-rays`, `grain-gradient`, `halftone-cmyk`, `halftone-dots`, `heatmap`, `image-dithering`, `lens-distortion`, `liquid-metal`, `mesh-gradient`, `metaballs`, `neuro-noise`, `paper-texture`, `perlin-noise`, `pulsing-border`, `simplex-noise`, `smoke-ring`, `spiral`, `static-mesh-gradient`, `static-radial-gradient`, `swirl`, `voronoi`, `warp`, `water`, `waves`. The demo shows every preset.

**Logos and shapes** (`text` in any font, or `src`: your own SVG or PNG)

| Component | | Drawn with |
|---|---|---|
| `<GlassGlyph>` | The logo as clear glass, bending a coloured light at its edges | WebGL |
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
| `<OutlineWordmark>` | A huge outlined name sinking out of the page, a beam passing through and a light under the pointer filling the letters | CSS + SVG |
| `<FitText>` | One line sized to span its parent exactly | JS |
| `<ScrambleText>` | Text resolving out of random characters | JS |
| `<Typewriter>` | Phrases typed one after another behind a caret | JS |
| `<Reveal>` | Content, or each word, rising into place on scroll | CSS + JS |
| `<ScrollReveal>` | Once in a layout: anything with a reveal.css class (`fade-in-up`, `zoom-in`, `flip-left`…) arrives on scroll | CSS + JS |
| `<HighlightSweep>` | A marker underline sweeping in under a word | CSS |
| `<Marquee>` | An endless strip of names or logos, with a pause button | CSS + JS |

**Surfaces and interaction**

| Component | | Drawn with |
|---|---|---|
| `<Glass>` | A liquid glass panel with a lit rim and a pointer sheen | CSS + JS |
| `<BorderSweep>` | A light travelling round an outline | CSS |
| `<Tilt>` | A card that leans towards the pointer, with a glare | CSS + JS |
| `<Parallax>` | Layers that drift with the pointer by depth | CSS + JS |
| `<Magnetic>` | A button the pointer pulls on | CSS + JS |
| `<Cursor>` | A dot and a trailing ring that swells over links | CSS + JS |
| `<PulseMark>` | A small animated mark: LED matrix, turning rings or sonar | SVG + CSS |

**Stylesheets**, for elements you render yourself:

| Import | Classes |
|---|---|
| `@arraypress/effects-astro/glass.css` | `.glass` (call `glassSheen()` once for the sheen) |
| `@arraypress/effects-astro/border-sweep.css` | `.sweep-ring`, `--always`, `--fast` |
| `@arraypress/effects-astro/motion.css` | `.fx-pulse-ring`, `.fx-heartbeat`, `.fx-bump` (replay with `bump(el)`), `.fx-shimmer`, `.fx-pulse`, `.fx-wiggle`, `.fx-shake`, `.fx-settle`, `.fx-live` (a status dot) |
| `@arraypress/effects-astro/reveal.css` | `.fade-in`, `.fade-in-up/down/left/right`, `.slide-in-*`, `.zoom-in`, `.zoom-out`, `.flip-up/down/left/right`, `.blur-in` (with `<ScrollReveal />`) |

## Your own logo

The logo effects take `text` (any word, character or emoji, in the font you name with `font`, weight first: `font="900 Anton, sans-serif"`), or `src`: any image URL, an SVG logo or a transparent PNG. Only its shape is used: where it is opaque. `area` places it within the section (`{ x, y, width, height }`, 0–1 from the top left).

```astro
<VoxelLogo src="/logo.svg" cells={36} colors={['#a7f3d0', '#08090a']} />
<ParticleLogo src="/logo.svg" area={{ x: 0.5, y: 0.1, width: 0.45, height: 0.8 }} />
<GlassGlyph text="7" font="900 Anton, sans-serif" />
```

## Changing colours

The WebGL effects (`<LightField>`, `<InkField>`, `<Ink>`, `<AsciiRain>`, `<FlutedGlass>`, `<GlassGlyph>`, `<ParticleLogo>`, `<NeonSwarm>`, `<NebulaLogo>`, `<PointCloud>`, `<VoxelLogo>`) read a `data-colors` attribute; `setColors` writes it. A light or an ink field eases to the new palette in about a second; ink, rain and the rest take it from their next frame. Set before an effect starts, it is its colours from the first frame.

```js
import { setColors } from '@arraypress/effects-astro';

setColors(document.querySelector('[data-effect-light-field]'), ['#e11d48', '#f97316', '#7c3aed'], '#fde68a');
```

## Runtime

The package's main entry is the runtime the components are built on, for use without Astro or to build more: every effect as a function (`lightField(el, config)` and so on: start it on an element, get back a function that stops it), and the parts they share. Each module can also be imported on its own, which keeps a page's script small: `import { glassSheen } from '@arraypress/effects-astro/runtime/glass-sheen'`.

| Export | |
|---|---|
| `paperShader(el, config)`, `paperSettings`, `paperUniforms` | Paper's shaders, and the settings and uniforms for a shader and preset |
| `createStage(el, options)` | A full-canvas WebGL effect: context, program, sizing, the loop, reduced motion, clean-up |
| `createCanvas2D(el, options)`, `grainPattern`, `grainOnto` | The same for Canvas 2D effects, and grain laid onto strokes only |
| `createFluid(gl, options)`, `stir(fluid, el, options)` | A Stable Fluids solve, and its pointer hookup |
| `createPoints(gl, vertex)`, `projectPoint`, `GLSL_PROJECT` | Particles as soft points, with a 3D projection matched in JavaScript |
| `drawShape`, `samplePoints`, `gridPoints`, `distanceField`, `blurField`, `fontAt` | Shapes from text or images, and what effects take from them |
| `createGlyphs`, `GLYPH_SETS`, `GLSL_GLYPHS` | Text characters as a texture, for ASCII effects |
| `createTrackers(el, count)` | Machine-vision tracker boxes over an effect |
| `parseColor`, `toHex`, `toOklab`, `fromOklab`, `mixOklab`, `paletteAt`, `GLSL_OKLAB`, `GLSL_PALETTE`, `GLSL_NOISE`, `GLSL_QUIET` | Colour in Oklab and shared shader pieces |
| `isLand(lat, lon)`, `LAND`, `CITIES` | Where the land is (Natural Earth, 1.5°), and cities by name |
| `inView(el, show)` | A callback as an element scrolls into view |
| `scrollReveal(config)`, `REVEAL_CLASSES` | Class-based scroll reveal for a whole page |
| `animate(el, frame)` | A frame callback on the page's one loop, while `el` is near the screen |
| `pointerIn`, `trail`, `pressAt`, `CLICK_IGNORE` | The pointer over an element, its strokes, and presses |
| `pixelRatio`, `isMobileGpu`, `prefersReducedMotion`, `canHover` | The device checks every effect makes |
| `mount(selector, setup)`, `readConfig`, `watchColors` | Start an effect on every matching element, now and after each view transition |

## Demo

`demo/` is an Astro site: a page for each group (backgrounds, Backdrop, Paper, logos, wordmarks, text, surfaces), every effect on it a working hero, each Backdrop and Paper shader on its own (a hero's effect runs only while it is near the screen):

```bash
cd demo && npm install && npm run dev   # http://127.0.0.1:4400
```

## Credits

- The fluid is Jos Stam's Stable Fluids, after Pavel Dobryakov's [WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) (MIT, © 2017 Pavel Dobryakov).
- `<FlutedGlass>`'s flute geometry and `<GlassGlyph>`'s lens model are adapted from the FlutedGlass and Glass components of [Shaders](https://github.com/shader-effects-inc/shaders) (MIT, © 2026 Shader Effects Inc.).
- `<Backdrop>` is the shader set from the earlier `@arraypress/effect-canvas-astro` package; `silk` follows Inigo Quilez's domain-warping technique.
- `<PaperShader>` runs [Paper Shaders](https://github.com/paper-design/shaders) (Apache-2.0, © 2026 Paper), vendored unchanged in `src/vendor/paper/` with their presets. Powered by Paper Shaders: https://shaders.paper.design
- `<InkField>` is adapted from Trirat's ink shader for LumiThemes (its sim, display shader, emitters, lamp and twelve palettes), on Jos Stam's Stable Fluids in the shape of Pavel Dobryakov's WebGL-Fluid-Simulation (MIT, © 2017 Pavel Dobryakov).
- `<WorldRoutes>`'s land is sampled from [Natural Earth](https://www.naturalearthdata.com)'s 1:110m land (public domain).
- Oklab is Björn Ottosson's.

The full notices are in [LICENSE](LICENSE).

## Licence

MIT © ArrayPress Limited
