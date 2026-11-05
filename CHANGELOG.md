# Changelog

All notable changes to `@arraypress/effects-astro` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.1] — 2026-11-06

### Changed

- Depends on `@logomarks/shaders` `^0.1.1` (renamed from `@arraypress/shaders`); the imports, types and docs use the new name. No code changes.

## [0.6.0] — 2026-11-05

### Added

- `<PixelGlitchText tear="row">` (`pixelGlitch` `tear: 'row'`): a whole row tears at once, now and then, by its hottest cell (over 0.45 heat, on about a third of frames, by up to half of `shift` either way), as the Logomarks site's footer did. The default, `cell`, is unchanged: each hot cell slips on its own. `rowTears(heat, cols, rows, shift, random?)` is its pure part.
- `<PixelGlitchText ghost="…">` (`pixelGlitch` `ghost`): a colour for a copy of the blocks, nudged 3px right behind them, an accent under the break (the Logomarks footer's is pink, `rgba(255, 62, 165, 0.85)`). None by default.
- `<Galaxy rng="park-miller">` (`galaxy` `rng`): the Park–Miller minimal standard generator (× 16807 mod 2³¹ − 1), as the Logomarks studio's first galaxy drew with, beside the default mulberry32. With it the glitter and stars come from one stream that runs on across resizes, as they did there. Named for the algorithm, not `legacy`: it is a standard generator anyone can choose, and the name says what the numbers are.
- `<Galaxy starSeed>`: the glitter and stars' own seed (default `seed × 31 + 1`, as before).
- `<Galaxy blend="srgb">`: the ramp blended plainly in sRGB (its near-black the first colour's bytes × 0.18), painted exactly along its stops, beside the default Oklab. `rng: 'park-miller'`, `seed: 7`, `starSeed: 31` and `blend: 'srgb'` draw the studio's first sky to the pixel (a test checks its nebula byte for byte). `galaxyStops(colors, blend)` gives the stops; `galaxyRamp` and `nebulaPixels` take the blend and a `smooth` flag.
- Canvas 2D effects take over a canvas the host already claimed for WebGL: `createCanvas2D` (and so `<Galaxy>`, `<DotGrid>`, `<WorldRoutes>`) puts a fresh canvas in its place, with its attributes, and gives the host's back when it stops; an element with no canvas gets one. `claimCanvas(el)` is that step on its own. A page that makes one WebGL canvas for whichever effect it shows no longer needs a plain one for these.
- `parkMiller(seed)`, `randomFrom(name, seed)` and `RANDOMS` beside `seededRandom`. `Canvas2D` has `dpr`.

### Changed

- `<Galaxy>` draws in device pixels, and its stars as a radial gradient each (a 64px sprite before), with crosses of light a CSS pixel thick (a device pixel before), so it matches the studio's first galaxy at any pixel ratio. A star's tint is picked from the tints in proportion (a 0–1 value), so the same seed gives stars different tints from 0.5.x. A resize while the element has no size scatters nothing.
- `nebulaField` returns a `Float64Array` (it was `Float32Array`), so painting along exact stops matches to the byte; a handful of pixels in the default Oklab nebula move one step on the ramp.

## [0.5.1] — 2026-11-05

### Fixed

- Paper shaders load in production builds: static loader map instead of a variable import. `paperShader` (and `<PaperShader>`, `<PaperBackground>`, `<LiveGradient>`) loaded each shader with `` import(`../vendor/paper/shaders/${name}.js`) ``, which Vite leaves untouched inside node_modules, so a site built with the package asked for `/vendor/paper/shaders/<name>.js` and got a 404 (dev worked). Each shader now has its own literal `import()`, split into its own chunk as before, and an unknown shader name throws a clear error. A test keeps every module in `src` free of imports built at run time.

## [0.5.0] — 2026-11-05

### Added

- `<Scene name="…">`: the twenty scenes of [`@arraypress/shaders`](https://github.com/arraypress/shaders) as backgrounds (`marble`, `frosted`, `ribs`, `tiles`, `blob`, `chrome`, `glitter`, `foil`, `ribbon`, `spiral`, `swirl`, `arches`, `spheres`, `spheres2`, `strands`, `rings`, `ink-water`, `topo`, `oil-bubbles`, `melting-hologram`), from the Logomarks site's scenes lab. `palette` (any of `PALETTES`, by name) or `colors` + `glint` recolour it, and `setColors` recolours it live. `params` reshapes it (each scene's settings are `PARAMS[name]` in that package). The look props are `speed`, `hue`, `sat`, `exposure`, `tint`, `tintAmount`, `zoom`, `angle` and `grain`, and there are also `fps`, `scale`, `fixed`, `opacity` and `background`. It's lazy by default, with the package's own lifecycle: it holds a context only near the screen and gives it back four seconds after it leaves, on a fresh canvas. It draws at 30 fps and adapts its resolution, and with reduced motion it draws one still frame. Without WebGL 2 its colours show as soft blooms over its ground. A bad scene name, param or colour fails the build. Each scene's shader loads in its own chunk. `scene(el, config)` and `sceneSettings(config)` are its runtime.
- The demo has a `<Scene>` hero (marble in Barbie), plus one for each other scene in its own colours.

### Changed

- **A dependency:** `@arraypress/shaders` (`^0.1.0`), the owner's own, for `<Scene>`.

## [0.4.0] — 2026-11-04

### Added

- `<GlitchText>`: a headline that glitches now and then. Two coloured copies of it (pink `#ff3ea5` and blue `#2e4bff`) flash over it for a few frames, sliced into bands with `clip-path` and shifted sideways, every `every` seconds (5), each instance on its own beat (a random `delay` fixed at build time); livelier under the pointer (`hoverEvery`, 1.6), on the text or a link or button round it. `colors` or `palette`, `blend` (`multiply` on a light ground, `screen` on a dark one), `as`. CSS only (`glitch-text.css`, for markup you render yourself); the plain text with reduced motion. From the Logomarks site's Custom card.
- `<Galaxy>`: deep space in a palette's colours, in Canvas 2D: soft nebula clouds of layered value noise with ridged dust lanes through them, coloured along a ramp blended in Oklab (near-black, the colours, a pale top), fine glitter shimmering over them, and stars twinkling each on its own beat (the brightest with a cross of light), drifting slowly. `colors`/`palette` (and `setColors` live), `speed`, `stars`, `glitter`, `seed`, `background`, `fixed`, `lazy`; one still frame with reduced motion. `nebulaField`, `galaxyRamp` and `nebulaPixels` are its pure parts. From the Logomarks studio's showcase.
- `<BorderSweep lights={2}>` (`sweep-ring--two`): two lights chasing each other half a lap apart. `<BorderSweep inset>` (`sweep-ring--inset`): the ring inside the edge and over the content (z-index 3), for cards that clip (`overflow: hidden`) and fill themselves with a picture or a canvas. The default ring is unchanged; its colour is still `--sweep-color`.
- `outlineAlpha(rgba, width, height, radius)`: the outline of a shape from its coverage, one outline round shapes that touch.

### Changed

- `<PixelGlitchText stroke>`: the outline at rest is one outline round the whole word (the solid letters less themselves eroded by the stroke's width), so letters that touch or overlap under tight tracking merge instead of each outline crossing the next. It runs inside the letters' edge now, where the pixels fill. The text is also repainted once its own face has loaded (`document.fonts.load`), not only on `document.fonts.ready`, so a face used only there no longer leaves the canvas in the fallback font. From the Logomarks site's footer.

## [0.3.0] — 2026-11-04

### Added

- **Lazy effects:** any effect marked `lazy` (`data-effect-lazy`, `lazy` in its settings, or `<EffectCanvas lazy>`) runs only while it's near the screen and gives its WebGL context back when it's away, so a page can carry many (a browser keeps about sixteen contexts and drops the oldest). `whenNear(el, start, { margin })` does the same from code. A running effect's element carries `data-effect-live`.
- `<EffectCanvas fadeIn>`: the canvas fades in over its `background` once the effect starts.
- `<LiveGradient colors={…}>`: Paper's mesh gradient in your colours, morphing slowly under film grain, with the same colours as a still CSS gradient first and without WebGL; lazy by default. `liveGradient(colors, options)` builds its settings for pages that write their own HTML.
- `<Ink dark>`: dark ink on a light ground (the ink's cover follows the dye's brightness, so dark dye alone barely showed).

## [0.2.0] — 2026-11-04

### Added

- `<Ink idle={4}>`: drops ink on its own every so many seconds, so it moves before anyone touches it. Counted in frames run, so it waits while the ink is off screen or the tab is hidden. `stir()` now returns `bloom(x, y)` too, to drop ink from code.

## [0.1.1] — 2026-11-02

### Fixed

- `<PaperShader>`s that trace a picture (`gem-smoke`, `liquid-metal`, `heatmap`) now hand the prepared picture to the shader as a `data:` URL instead of a `blob:` one, so they draw under a Content Security Policy that allows `data:` images but not `blob:` (they showed only their background before). No object URL is left unrevoked.

## [0.1.0] — 2026-10-16

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
  - `<ShaderBackground effect="…">`: the six strongest shader backgrounds of `@arraypress/effect-canvas-astro`, which it replaces (mesh-gradient, grain-gradient, silk, band-lens, grid, waves; its faint and plain ones are left to `<GlowField>` and `<Grain>`), tinted from `--color-accent` (the second colour mixed towards `--color-bg` in Oklab, the others its hue turned in Oklab, 30° towards yellow and lifted and 45° away, with `turnHue`); `grain-gradient` is a grainy poster gradient, three luminous lights sweeping through deep shadow, their edges dithered into fine film grain that renews twelve times a second at any speed, with a calmer centre for copy; `speed`, `intensity`, `static` + `frame`, `interactive`, `blend`, `fade` and `fixed`; a CSS gradient without WebGL.
  - `<WorldRoutes>`: a dotted world map (from Natural Earth) with comets between cities; routes as `[from, to]`, `{ from, to, color, label, speed, width, dashed }` or a lone place from a `home` hub; a `colors` palette and Oklab `gradient`s; city `markers`, `halo`s and collision-aware `labels`; `curve="great-circle"`, `dashed` arcs, `arcOpacity`, `width`, `tail`, `glow`, `comets`, `ping`; `region` (named, `routes`, or a lat/lon box) with `fit`, `dotShape`, `graticule` and a wrapping `drift`; hovering a city or route picks it out and names it.
  - `<HaloRing>`: a ring of light around centred copy on a dark ground: a soft-cornered outline drifting between a rounded hexagon and a rounded rectangle (or held as `hexagon`, `rect` or `circle`), colour travelling round it in Oklab, the hottest stretches burning to white, a little glow inward and a long one outward; the pointer draws it close and lights it up. `corner`, `margin`, `thickness`, `glow`, `speed`, `quiet`.
  - `<SilkRibbon>`: a wide ribbon of satin twisting across a light ground, folds gathering where it turns and a sheen along each one, over a soft out-of-focus glow; the folds undulate and lean towards the pointer. `side`, `twist`, `folds`, `glow`, `speed`.
  - `<Topography>`: contour lines of a slowly drifting landscape at a constant pixel width, every n-th an index line; the pointer raises the ground and makes its lines glow; one colour or an Oklab gradient by elevation, `background`, `density`, `thickness`, `major`, `scale`, `speed`, `glow`, `quiet`, and optional `labels` (elevation numbers set along index lines, the line broken around them).
  - `<Caustics>`: sunlight through rippling water onto a pool floor, in one fragment shader: two drifting nets of light bent by a swell, with colour fringes, a depth falloff towards the edges, optional tiles bent by the water, and the pointer disturbing the surface. `colors` in any order (or `palette`), `background`, `scale`, `speed`, `intensity`, `tiles`, `interactive`, `quiet`.
  - `<RainOnGlass>`: rain on a window over a photo (`src`, `alt`), like looking out of a café on a wet night: beads sit on the glass and larger drops run down it, leaving clear trails that fog over again; each drop holds the photo sharp and upside down, while the rest is soft behind the condensation with its lights opened into bokeh. The pointer wipes a clear patch that fogs back over. `rain`, `blur`, `fog`, `speed`, `interactive`, `tint`, `bokeh`, `colors`/`palette` for the bokeh; a real `<img>` underneath, softened without WebGL.
  - `<Ocean>`: photoreal open water as a hero background: directional steep-crested waves at real deep-water speeds, a marched heightfield on a curved Earth with analytic normals and per-pixel wave filtering, Fresnel sky reflections, light through thin crests, a sun (or moon) glitter path, whitecaps, high cloud, haze and ACES tone mapping; `time` (dawn, noon, sunset, night), `waves`, `wind`, `speed`, `height`, `horizon`, `clouds`, `sun`, `colors`/`palette` tints, pointer parallax, `quiet`.
  - `<IsoCity>`: a small isometric low-poly city, generated from a `seed`, with cars keeping their lanes, slowing into turns and waiting at crossings, people crossing, and the brand's Tesla-shaped taxis in its `accent`; click a street and the nearest taxi by road draws its route, pulls in at the pin and picks up; `night` lights windows, lamps and headlights. `cars`, `taxis`, `speed`, `size`, `zoom`, `side`, `drift`, `interactive`, `quiet`, `colors`/`palette`.
  - `<GlowField>`: bloom, beam (a stage spotlight: a cone from the rig landing in a pool of light), horizon and wash, breathing, the beam swaying slowly; `still` holds it.
  - `<Grain>`: film grain that flickers a dozen times a second as film does (one layer moved by transform); `still` holds it.
- `<PaperShader>`: Paper's 30 shaders and 124 presets (Apache-2.0, vendored), with `params`, `colors` and `image`.
- `<ColorPanels>`: translucent panels of colour swinging open out of the dark, Paper's color-panels shader as a background of its own: plain props (`density`, `skewLeft`, `skewRight`, `length`, `edges`, `blur`, `fadeInner`, `fadeOuter`, `blend`, `zoom`, `rotation`, `offset`, `speed`, `background`, `colors`/`palette`), each defaulting to the Opening preset, `preset` for the others, `quiet` behind copy. The first Paper look: `PAPER_LOOKS`, `paperLook` and `paperLookSettings` map a look's plain props to Paper's settings, so each further look is a component's props and a row in the table.
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
  - `<VariableType>`: a variable-font headline whose letters swell in weight and width (or any axes, `axes={{ tag: [rest, peak] }}`) under the pointer or a finger on a spring, with a travelling idle swell; real, selectable text split by `splitLetters`; `fit` sizes the line so its widest swell spans the parent; `--swell` per letter for CSS.
  - `<ScrambleText>`.
  - `<Typewriter>`.
  - `<Reveal>`: whole or word by word.
  - `<ScrollReveal>` and `reveal.css`: class-based scroll reveal for a whole site (fades, slides, zooms, flips, blur), replacing the `@arraypress/reveal-astro` package with the same classes and props.
  - `<HighlightSweep>`.
  - `<Marquee>`: a pause button.
- Surfaces and interaction:
  - `<ImageRipple>`: a photo under a skin of water: the pointer drags a wake, a click drops a ring, and the waves bend the photo with a soft colour fringe and glints before settling back to the exact photo; it sleeps when calm, and reduced motion, no WebGL or no float targets show the plain `<img>`. `src`, `alt`, `strength`, `size`, `viscosity`, `fringe`, `interactive`, `fit`.
  - `<ProductStack>`: product covers (real links and images, as `items` or children) floating in 3D in a `fan`, `stack` or `arc` layout, with depth of field (`depth`), soft shadows and a glossy sheen across the front cover; it leans towards the pointer (`tilt`), fans apart on hover or focus and lifts the cover under the pointer, and drifts when left alone (`float`); `spread`, `size`, `ratio`, `radius`, `interactive`. CSS transforms on the compositor, idle on the main thread.
  - `<MosaicReveal>`: a slideshow for a product gallery or portfolio hero whose pictures change through one GPU shader, as `tiles` flipping in a diagonal wave, a `pixel-sort` melt, `pixelate` or a `dissolve` with a glowing edge; it moves on every `interval` (held while hovered, focused or off screen) and takes the arrow keys, a swipe and optional dots; the pictures are real images, read out politely and crossfaded with reduced motion or without WebGL. `runtime/slideshow.js` holds the timing and controls.
  - `<RadiantGlass>`: a cluster of frosted glass tiles on a dark ground, glowing from inside with soft peach, blue and white light that drifts and shifts with the pointer, each with a two-tone rim and a halo; one cheap shader, the frosting an analytic blur. `layout` (cross, diagonal, single), `shape` (diamond, square, circle), `side`, `size`, `frost`, `glow`, `rim`, `speed`.
  - `<Glass>` (and `glass.css`); `refract` gives real liquid-glass refraction, opt-in: the live page behind a panel bends as through a thick lens, hardest at the rim, with dispersion and a rim highlight (`dispersion`, `bezel`, `specular`); text stays selectable and links clickable. Chromium only, feature-tested; Safari and Firefox keep the frost. For `class="glass"`: `--glass-refract` and friends plus `glassLens()`, or `liquidGlass(el, options)`; the lens map in `runtime/lens-map.js`. The technique is adapted from Sam Asante's liquid-glass (MIT).
  - `<BorderSweep>` (and `border-sweep.css`).
  - `<Tilt>`.
  - `<Parallax>`.
  - `<Magnetic>`.
  - `<Cursor>`.
  - `<PulseMark>`: matrix, rings and sonar marks.
- `motion.css` (pulse ring, heartbeat, bump, shimmer, attention, settle, a live status dot) with `bump()`.
- **Audio reactivity.** `<WaveBars>`, `<SignalLines>` and `<InkField>` take `audio` (`"page"`, or a selector for an `<audio>`/`<video>` or a WaveformPlayer's container) and follow the sound playing: the bars show its spectrum and the playhead follows the track, the lines carry its waveform and kicks send pulses, kicks stir and brighten the ink. One AudioContext and one analyser per element, shared by every effect, made only after the visitor interacts and suspended when the sound stops; cross-origin audio without CORS is left alone with a warning. `audioSignal` (`runtime/audio.js`) and the meter in `runtime/audio-meter.js`.
- `palette` on every effect that takes colours: eighteen named sets (`PALETTES`), Trirat's twelve and six more, shaped to what each effect takes; an effect's own `colors` win.
- `setColors`, for changing a WebGL effect's palette on the fly.
- The runtime:
  - **Shared set-up:** `createStage` (WebGL) and `createCanvas2D`; one animation loop that runs only what is near the screen; view-transition-safe mounting.
  - **Simulation and drawing:** a Stable Fluids solve with pointer strokes as ribbons; points, shapes, distance fields, glyph textures and tracker overlays.
  - **Colour:** Oklab on the CPU and in GLSL.
  - **Gradients in GLSL:** `GLSL_RAMP` (`runtime/ramp.js`), an Oklab gradient read by position.
  - **Blur:** `boxBlur` (`runtime/blur.js`), a three-pass box blur on the CPU.
  - **3D:** `createMesh` (flat-shaded mesh builder), `isoCamera`, `instancing` (WebGL 1 and 2) and `seededRandom`; `createStage` takes `antialias`.
  - **Pictures:** `loadImage`, `imageTexture` and `coverScale` / `GLSL_COVER` (`runtime/image.js`), for effects that draw a photo or a cover.
  - **GPU simulations:** `createPingPong` and `floatFormats`, a pair of float render targets, full or half floats, WebGL 1 or 2; `createHeightField` and `GLSL_HEIGHT_FIELD`, the water simulation under `<LiquidMetal>` and `<ImageRipple>`.
  - **Device checks:** pixel-ratio cap, phones, reduced motion, hover.
- COMPONENTS.md, generated from the components' types (`npm run docs`).
- A demo (`demo/`, live at effects.lumithemes.com): one gallery, every effect a working hero, each ShaderBackground and Paper shader on its own (Paper's among the backgrounds, to pick looks from), shown one at a time with its own URL (`/#liquid-metal`); filters by type (`/?type=logos`), and arrows, ← → keys and swipes step through the filter; the old group pages redirect, an "All effects" overview lists them, and a Customise panel on each (palettes, colour pickers, a control for every prop, generated from the components' types by `npm run docs`) shows the exact line to copy, with accented copy following the effect's colour.
- Effects added to or taken out of the page after it loads start and stop by themselves, and a WebGL effect taken out gives its GPU context back at once.

Effects brought together from the WaveGrid (SampleGrid), SellGrid, ArrayPress, AgentGrid, LinkGrid and LaunchGrid themes, the LumiThemes, FilterSpark, waveform-player, SugarCart, Statement Buster, Pure Papers, Sample Foundry, Graphic Foundry, Loopcuts, Producer Space and David Sherlock sites, and new.
