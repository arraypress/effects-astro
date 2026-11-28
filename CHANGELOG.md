# Changelog

All notable changes to `@arraypress/effects-astro` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.16.1] — 2026-11-28

### Changed

- **WaterSurface**: long, smooth swells. Most of the height is now in a few swells about 0.6 m long with a narrow spread
  and smooth sine crests (each wave carries a `peaked` 0–1 blend between a sine and the old peaked profile); the short
  ripples stay peaked, run with the swell and gather on its forward faces, so they read as riding it. A long lens (13°)
  at a low angle (pitch 13) stacks the swells in rows as the reference photo does, the sky's gradient near the horizon is
  steeper so every ripple shows light against dark, and the sparkle is brighter and scattered more on the crests. The
  night and ink looks are lifted; dusk's sky is lighter. Still an exact 30 s loop, still a pure function of time.
- **Planet**: the flare's ghosts no longer drift over the lockup. They line up through an optical centre high to one
  side (`ghostCentre`, away from the sun), climbing past the lockup to the space above it, and any in the lockup's band
  fade out. The streak along the horizon is unchanged.

## [Unreleased]

## [0.16.0] — 2026-11-28

### Added

- **Planet** (`planet`, `./runtime/planet`, `<Planet>`; the owner: "maybe one with a 3d globe or planet behind it,
  spinning with the lens flares"): a planet seen from low orbit at sunrise. The camera hangs a little above a sphere so
  its night side is a vast dark curve across the lower frame; the sun crests the limb, climbs a little and sets back over
  a slow cycle (`period`, `rises`, `rise`, `phase`), an anamorphic flare (the lens-flare's streak, veil and ghosts) along
  the horizon as strong as the sun is showing; the thin air along the limb is lit warm beside the sun and Rayleigh blue
  above it, a Mie lobe round the sun, dark on the night side; city lights on the land and a faint moonlit surface, the
  sun's glint on the sea at the limb; the planet turns slowly (`spin`). The Earth is textured from NASA's Blue Marble
  (`day`) and Black Marble city lights with a water mask (`aux`), both public domain, which the page serves; `mars`,
  `moon` (airless: a hard limb) and `giant` are drawn from noise. A pure function of the time; the sun's place on the frame
  is found once a frame (`sunPlace`), not per pixel. Still: `planetStill` (CSS).
- **Video of live effects** (`./runtime/export/field-video`: `recordField`, `fieldFrames`, `loopPlan`; the owner: "ability
  to export videos is important"). A WebGL or Canvas 2D effect and what sits on it (the lockup, the words) as a seamless
  looping MP4 (or WebM): the effect is held, started again so it runs from time 0, and stepped by hand frame by frame
  at the video's resolution, each frame read into a `live` snapshot of its element and drawn. The same settings make the
  same frames every time. Few effects repeat exactly, so the loop is closed by a crossfade (the recording runs 0.6 s past
  its end and the tail fades into the head the video starts after); an effect that does repeat declares its period on
  its element (`data-effect-cycle`, as the paint drip now does) and is recorded whole, with no crossfade.
- **`holdFrames(root, { ratio })`** (loop.js): the page's loop leaves the effects under an element alone and `seek(ms)`
  draws them at exact times from 0, a simulation stepped 1/60 s at a time as it would run live; effects started under
  the hold are held from their first frame, and `Math.random` is a seeded one while a hold is on (an effect's grain and
  scatter come out the same); its `ready()` waits for the pictures the effects are still loading (`track(promise)`,
  which `loadImage` now calls), so a run never starts on the frames before a photo arrives. `frameNow()`: what effects now read the time with instead of
  `performance.now()` (every effect switched), the held time while a hold is on. `animate(el, frame, hooks)` takes a
  `hold` hook: `createStage` and `createCanvas2D` draw at the export's resolution while held, and stop adapting theirs.
- `snapshot(el, { live: true })` keeps every canvas, blank ones too, and its new `canvases()` reads them again into the
  copy (in the task that drew them).
- **WaterSurface** (`waterSurface`, `./runtime/water-surface`): moving water seen close and low through a long lens, after a
  photo the owner sent ("ultra realistic water as a background"). Waves summed from a spectrum (long swells to wind
  ripples, the deep-water dispersion relation, peaked crests), a camera a little above the water pitched down into it,
  each wave filtered by the pixel's footprint and the lens's circle of confusion with the slope it loses carried into the
  glint's roughness (so the water out of focus turns soft, as a real lens's does), Schlick's Fresnel between the
  reflected sky and the water's own colour (lit through thin crests), a Beckmann sun glint, a sparkle of tiny facets where
  the water is in focus, a ring of ripples spreading from a point. Five looks (`dusk`, `teal`, `night`, `golden`, `ink`).
  A pure function of the time: every wave makes whole turns of `loop` seconds (default 30), so it repeats exactly and a
  recording can ask for any frame (`waterTime`). Stills: `waterStill` (CSS) and `waterStillSvg` (noise lit as
  ripples, sharp across the middle and soft above and below).

## [0.15.0] — 2026-11-28

### Added

- **One WebGL context for many effects** (`shareContexts()`, `./runtime/shared-gl`). A browser keeps about sixteen WebGL
  contexts and drops the oldest, so a wall of thirty live cards could only run half of them (the owner: "about 50% on
  that page are not moving"). With sharing on, every stage draws in one hidden context and copies its frame into its own
  canvas (a Canvas 2D one, `drawImage`), so any number run; only what is on screen draws. Each stage gets a tracked view of
  the context (`trackGL`) that remembers the state it set (capabilities, blending, pixel storage, each unit's texture)
  and the resources it made: before it draws the context is put back to its defaults and its state laid on again, and
  when it stops its resources are deleted. An opaque stage keeps its alpha at 1. Off by default (an effect on its own
  page keeps a context of its own); a multisampled stage (`antialias`) always does.

### Changed

- **GlassDrop and GlassStack refract a photo** (`backdrop`, same origin, covering the element). Over it the glass is clear:
  the photo is magnified in the flat middle (`magnify`) and bent hard at the bevel, the colours parting as far as it bends;
  the backdrop is soft round the glass and sharp through it (`soften`, a mip bias), as a lens brings what is behind into
  focus. GlassDrop's glass takes the logo's colour as light through tinted glass does (deeper where it is thicker), goes
  dark in a band inside its rim, casts a shadow with a caustic in it (`shadow`), swells slowly like liquid (`flow`) and
  its light drifts (`lightDrift`); GlassStack's discs are thick lenses with dispersion (`dispersion`). Without a backdrop
  both draw as before. `dim` sets how bright the photo shows.

Two live effects after the owner's references for the Logomarks Lookbook: a spray-stencil badge with paint running off
it, and a flower photo in shallow focus. In the house style: timed in seconds, a pure JS twin for tests, a still, and
nothing off screen.

### Added

- **LensFlare** (`lensFlare`, `flareStill`, `flareSource`, `flareGhosts`, `streakAt`; `<LensFlare>`): an anamorphic lens
  flare built the way the lens makes one: a small hot source and its glow, the long thin horizontal streak a
  cylindrical element smears it into (the coating's colour, white at its core, falling off along its length) with a
  fainter parallel second streak, a veil of scattered light, and soft ghosts on the line from the source through the
  frame's centre (squeezed upright as anamorphic ghosts are, brighter at the rim, a hair of colour at their edge). The
  source drifts slowly and the ghosts travel the other way through the centre, as real ones do; a faint flicker and
  grain; a filmic shoulder so the hot parts burn rather than clip. Opaque, a quiet area, a CSS still.
- **SunWall** (`sunWall`, `sunWallStill`, `blindsAt`, `spectrumRgb`; `<SunWall>`): low sunlight on a plaster wall, either
  through venetian blinds (a skewed patch of hard bars whose penumbra grows with the throw, breathing as the slats
  tilt, creeping as the sun moves) or as a prism throws it (a patch of sun and beside it in the shade a short, bowed,
  saturated spectrum, red to violet, its colours blurred into each other). The light is multiplied into the paint, not
  laid over it; plaster grain and fall-off; a quiet area dims the light behind copy.

- `<PaintDrip>` (`paintDrip`, `dripStill`, `dripRun`, `dripAt`, `dripAnchors`, `dripPlan`, `dripClock`, `dripPath`,
  `dripsAtRest`, `DRIP_DEFAULTS`, `DEPTH_STEP`): a mark (`src`, any image; its alpha) sprayed in paint on a lit, grained
  ground, the paint running. Drips hang only from the mark's outer lower silhouette (read off its coverage: never a
  counter or a stripe end inside it; gentle, low edges and the low points of a run likelier), pool
  until the paint passes what surface tension holds, then fall under gravity against viscosity, laying paint behind so
  the head's bead shrinks and slows and the body thins, and stop when spent or when they meet something; a wet sheen
  fades as they dry. Staggered, seeded volumes and starts; they hold (`hold`), fade and run again. `color`,
  `background`, `box`, `drips`, `volume`, `floor`, `glow`, `spray` (a speckled spray edge), `grain`, `seed`. Canvas 2D;
  redrawn only while something moves. A drip's outline is pure SVG path data (`dripPath`; `dripsAtRest` for all at full
  length), which the canvas fills, so a still can show the resting frame; pass `anchors` (from `dripAnchors`) and the
  canvas runs the same drips the still shows.
- `<PhotoBokeh>` (`photoBokeh`, `photoBokehStill`, `focusAt`, `blurAt`, `discAt`, `highlightTints`, `BOKEH_DEFAULTS`,
  `MAX_DISCS`): a photo (`src`) through a lens racking its focus near to far and back (`rate`), the depth guessed from
  the picture's blurred brightness and colour and its height (`near`), the blur a golden-angle disc of taps read from
  the mipmaps (`blur`); a few large out-of-focus lights (`discs`, `size`, `glow`, round or six-bladed `shape`), soft
  filled glows with no ring at the edge, tinted from the photo's highlights and brighter where they cross them, drift
  slowly up through it (`drift`); `vignette`, `grain`, `quiet`. Transparent until the photo loads.

## [0.14.0] — 2026-11-28

Two backgrounds and more for the dithered gradient, after the owner's Fluid, Fluted Glass and Dithered Gradient
backgrounds for the Logomarks Lookbook, in the house style of 0.11 and 0.12: timed in seconds with nothing kept between
frames, colours in Oklab, a `quiet` area behind copy, `speed: 0` for a still, a CSS still for before the shader starts,
and a pure JS twin for tests.

### Added

- `<FluidFolds>` (`fluidFolds`, `foldsStill`, `foldHeight`, `foldHue`, `foldColors`, `FOLD_STYLES`): glossy folds of liquid colour on a dark ground, a height field warped by slow noise and lit from one side, an iridescent rim where a fold turns away and a glassy highlight on each crest, its colour drifting along a ramp of three; `style: 'liquid'` (poured enamel) or `'dunes'` (long silk dunes under a dark sky, `level`); `scale`, `warp`, `gloss`, `light`, `hue`, `rate`, `grain`, `seed`.
- `<FlutedBokeh>` (`flutedBokeh`, `bokehStill`, `bokehLights`, `bokehAt`, `reedSample`, `bokehColors`, `BOKEH_GLASS`, `MAX_LIGHTS`): coloured lights out of focus behind upright reeded glass, each flute a squeezed slice (`squeeze`) with red and blue parted at its seams (`dispersion`) and the light smeared a little upright (`streak`), or behind a wall of square glass blocks (`mode: 'blocks'`), the lights drifting slowly (`lights`, `size`, `glow`, `drift`, `rate`); `seams`, `grain`, `seed`.
- `<DitherGradient>`: two shapes, `orb` (a soft glow wandering about its centre) and `pill` (a long glowing capsule), sized by `size`; and three colours (`colors` dim, middle, bright) blend through the middle one (`gradientRamp`). Two colours blend exactly as before.


## [0.13.0] — 2026-11-26

Two glass logos for the Logomarks Lookbook, our own constructions after the ideas of reactdrops.dev's Liquid Glass Logo
and Glass Slab Logo (no code, shaders or assets taken: their licence forbids reuse in a component library; see
docs/credits.md).

### Added

- `<GlassDrop>` (`glassDrop`): a logo arriving as liquid glass. A drop forms, lands with rings running out, and spreads into a glass tile with the logo rising under it (`form: 'tile'`), or into the logo's own shape in tinted glass (`form: 'mark'`); it holds, then melts away and leaves the logo flat at `restScale`. Plays once, or on a `loop` whose rounds start from the resting logo, so a page can show the resting logo as its still. `depth`, `dispersion`, `bevel`, `highlights`, `caustics`, `bloom`, `ripples`, `tint`, `lightAngle`, `radius`, the colours (`background`, `color`, `plate`, `light`), `size`, `markScale`, `speed`, `delay`, `hold`, `loopDelay`, `rest: 'glass'` to keep the glass.
- `runtime/glass-drop-plan` (`dropAt`, `dropCycle`, `dropLayout`, `DROP_PHASES`, `DROP_SIZE`): GlassDrop's timeline and layout, pure, so a page can lay a still exactly where the effect leaves the logo.
- `<GlassStack>` (`glassStack`, `stackLayout`, `sliceTints`): a logo as a stack of tinted glass discs in front of a lit card, seen a little from below: the logo cut into `slabs` slices, every stretch of logo in a slice a disc, tints along `colors` (2–6) from top to bottom; the discs grow from the bottom up (`intro`, `introDuration`), then the stack leans on its own (`sway`) and toward the pointer (`tilt`). `phase`, `band`, `depth`, `thickness`, `ior`, `reflectivity`, `density`, `opacity`, `exposure`, `ambient`, `cardSize`, `lightAngle`, `logoScale`.
- `runtime/slab-runs` (`sliceRuns`, `runsTexture`, `slabGrowth`): GlassStack's slicing (a slice samples a band, so small parts are kept) and intro, pure.
- `runtime/glass-optics` (`GLSL_STUDIO`, `lightVector`): a small studio for glass to mirror and Schlick's fresnel, shared by both.

## [0.12.0] — 2026-11-26

Four backgrounds after reference images the owner collected for the Logomarks Lookbook, in the house style of 0.11:
timed in seconds with nothing kept between frames, sized by the element, colours in Oklab, a `quiet` area behind copy,
`speed: 0` for a still, a CSS still for before the shader starts, and a pure JS twin for tests.

### Added

- `<DitherGradient>` (`ditherGradient`, `gradientStill`, `gradientDots`, `gradientTone`): a soft colour gradient drawn only in dots, in five shapes (`wave`, `band`, `swirl`, `pinwheel`, `steps`), square dots an 8×8 ordered dither thins out (`mode: 'bayer'`) or round halftone dots that shrink (`mode: 'halftone'`); `angle`, `level`, `soft`, `arms`, `twist`, `block`, `steps`, `rate`. Its quiet area's opening is squared, so a smooth tone clears well inside the radius.
- `<TruchetField>` (`truchetField`, `truchetStill`, `truchetTile`, `truchetTone`): quarter-arc Truchet tiles joining into loops, a few turning a quarter at a time on their own clocks (`period`, `turn`), a slow noise brightening and thickening the lines (`scale`, `drift`, `thin`), optionally shaded like tubes (`tube`).
- `<PixelHorizon>` (`pixelHorizon`, `horizonStill`, `horizonBlocks`): a flat colour filling one `side` and breaking up into square blocks, winking on and off along a swaying, wandering frontier (`level`, `spread`, `sway`, `wander`, `rate`); one canvas pixel a block.
- `<FlutedGlow>` (`flutedGlow`, `glowStill`, `glowAt`, `fluteSample`): a ring, orb or rising light through upright reeded glass, breathing slowly, with seams and grain; opaque, no pointer, made to sit behind copy.
- `runtime/bayer` (`bayer`, `GLSL_BAYER`): the 8×8 Bayer threshold, as GLSL and JS, now shared by DitherField and DitherGradient.
- `<PixelFountain source="pointer">` (a block-dust trail where the pointer moves, `trail`, `press`, `TRAIL_CAP`, `POINTER_DEFAULTS`) and `<PixelGlitchText glitch={false}>` (the text at rest only): merged to main on 2026-11-21 from a parked branch; opt-in, and not yet tested end to end in a browser.

### Changed

- `<DitherField>`'s Bayer matrix comes from `runtime/bayer`; `bayer` is still exported from `runtime/dither-field`. Nothing it draws changes.

## [0.11.0] — 2026-11-20

Six backgrounds after Processing sketches shared with the owner, modernised: on the GPU (FlowField on Canvas 2D), timed in
seconds, sized by the element so a card and a hero look alike, colours in Oklab, a `quiet` area behind copy, `speed: 0`
for a still, and each with a pure JS twin for stills and tests. Made for the Logomarks Lookbook's field cards.

### Added

- `<LightLeak>` (`lightLeak`, `lightLeakStill`): a soft, slow lava-lamp or light-leak colour field, four colours darkest first, `quietTone` for the tone the quiet area flattens to, `drift` for how fast it moves (0.3; the sketch's own 0.04 loops in four and a half minutes, made for a long mix behind it, and looked still on a card). After `lavalamp_bg`.
- `<DitherField>` (`ditherField`, `ditherStill`): a noise field in square dots, Bayer-dithered edges into a banded core, ripples from an `origin`, one canvas pixel per dot. After `ripple_dither_bg`.
- `<CascadeGrid>` (`cascadeGrid`, `cascadeStill`): hexagons or dots (`cell`) run like a scrolling spectrogram, the level analytic in the shader (no ring buffer). After `hex_spectrogram_bg` and `circle_grid_bg`.
- `<FlowField>` (`flowField`): fine particle trails riding an evolving noise flow, Canvas 2D (no WebGL context), stepped at a fixed rate. After `perlin_field_bg`.
- `<VoronoiMesh>` (`voronoiMesh`, `meshStill`): two tiers of thin Voronoi outlines, the inner cells confined to their macro cell and pulsing; exact border distance in the shader. After `voronoi_bg`.
- `<KineticGrid>` (`kineticGrid`, `gridStill`): a wireframe grid that seeded raindrops ripple, pulses running along the wires, no CPU physics. After `grid_bg`.
- `runtime/hash-noise`: Hash without Sine (`hash33`), gradient noise (`grad`, `gnoise`) and the warped field (`noiseField`), as GLSL and matching JS, shared by AsciiNoise, DitherField, CascadeGrid, VoronoiMesh and KineticGrid.

### Changed

- `<AsciiNoise>`'s noise now comes from `runtime/hash-noise`; `noiseField` is still exported from `runtime/ascii-noise`. Nothing it draws changes.

## [0.10.0] — 2026-11-20

### Added

- `<AsciiNoise>` (`asciiNoise`, `runtime/ascii-noise`): a field of slow noise drawn as a grid of monospace characters, soft-edged blobs of type drifting and morphing, the quiet cells in one colour and the loud in another (Oklab). Nine ramps (`NOISE_RAMPS`: `ascii`, `shade`, `digits`, `rise`, `quads`, `bars`, `arrows`, `letters`, `dense`) or any characters; `cell` or `cols`, `scale`, `contrast`, `brightness`, `drift`, `evolve`, `offset`, `speed`, `quiet`, `background`, `font` (loaded before the glyphs are drawn). The same field in plain JavaScript (`noiseField`, `asciiCells`), so a page can lay the first frame as text and the shader starts on the same cells. After `ascii_noise_bg`, a Processing sketch shared with the owner.

### Fixed

- The demo's Cloudflare build (`lumithemes-effects`, effects.lumithemes.com), failing since `@logomarks/shaders` became a
  dependency in 0.6.1: a clean install of `demo/` links the library from the parent (`file:..`) without installing the
  parent's own dependencies, so `@logomarks/shaders` couldn't be resolved, from the demo's heroes or from the library's
  runtime. The demo now depends on it itself, and `vite.resolve.dedupe` resolves the library's imports of it from the
  demo's `node_modules`. The published package is unchanged.

## [0.9.0] — 2026-11-15

### Added

- `<BorderSweep long>` (`sweep-ring--long`): a longer light, a faint lead-in over the quarter lap before it, then the light and its tail.
- `<BorderSweep outset>` (`--sweep-outset`): the ring moved out past the edge, px; `1` lays it over a 1px border. Default 0, as before.
- `<BorderSweep focus>`: which focus lights it. `within` (the default, as before) when it or anything in it has the focus, `visible` (`sweep-ring--focus-visible`) only on its own keyboard focus, `none` (`sweep-ring--focus-none`) never, hover only. The selectors keep their weight (`:where`), so a site's overrides hold.
- `<BorderSweep still>`: what reduced motion shows. `ring` (the default, as before) a still lit edge, `none` (`sweep-ring--still-none`) nothing.
- `<GlitchText copies="pseudo">` (`glitch-text--pseudo`): the two copies drawn as the element's `::before` and `::after` from a `data-text` the component writes from the slot's words, so the text is one element. For plain text. The default, `spans`, is unchanged.
- `<GlitchText variant="skew">` (`glitch-text--skew`): another glitch. The whole word shakes and skews while the copies tear through three bands each, shifted by a share of the type size (em), the second at 0.9 opacity. With either markup. The default, `slice`, is unchanged.
- `<Marquee copies>`: how many times the content is laid, 2–4 (default 4, as before); the strip moves by one of them a loop (`--marquee-shift`). Two is enough when one set is always wider than the strip.
- `<Marquee role>`: `region` (the default, as before), `marquee` or `note`.
- `<Marquee still="hold">` (`still-hold`): with reduced motion the strip held where it starts, every set laid and none scrollable, rather than one set to scroll by hand (`scroll`, the default).
- `plainText(html)` (`components/text.js`): a rendered slot's words, its tags dropped and its character references decoded.

### Changed

- `<Marquee fade={0}>` draws no mask at all, rather than one with edges of no width. Nothing shows differently.

The options come from the Logomarks site, so its border sweep, hero glitch and ticker can be these components.

## [0.8.0] — 2026-11-15

### Added

- `runtime/export/*`: an element on the page saved as a picture, a plain SVG or a video, made in the browser. Imported by path only, not from the main entry.
  - `export/snapshot`: `snapshot(el, { square, skip })`, the element as a self-contained SVG (a copy in a `<foreignObject>`, every computed style written inline, its pseudo-elements as rules, its pictures, canvases and fonts inlined), pixel-faithful when drawn, at any `svg(scale)`. `update(moved)` rewrites only what a stepped clock moved, so a recording draws frame after frame cheaply. `rootStyle`, `pseudoCss` and `snapshotSvg` are its pure parts.
  - `export/clean-svg`: `cleanSvg(el, long)`, the element rebuilt as plain SVG (rects, pictures, its inline SVGs with their styles as attributes, its words as `<text>`, its fonts inlined) that a design tool can open and edit. `cleanIssues(el)` lists what plain SVG cannot say faithfully (a filter or blend, a gradient or image background, a shadow, a clip, a rotated box, a pseudo-element that paints), and `cleanSvg` refuses then. Built on `export/svg-attrs` (`inlineSvg`, `attrValue`, `aboutOrigin`), `export/svg-text` (`textLines`, `groupLines`, `transformText`), `export/probe` (`cssColor`, `pixelColor`, `fontMetrics`) and `export/format`.
  - `export/clock`: `clock(root)`, the CSS animations under an element paused and stepped by hand (`seek(ms)`, `moved()`, `release()`), for a recording that is exact however long a frame takes to draw.
  - `export/raster`: `drawSvg(svg, width, height, canvas?, settle?)`, `rasterize(svg, { width, height, settle? }, type?, quality?)` (an SVG to a PNG's bytes, or a JPEG's or WebP's at a quality), `imageOf(canvas, type?, quality?)`, `pngOf`, `svgDataUrl` and `decodeImage`. SVG is drawn from a `data:` URL, never a `blob:` one, so a page whose CSP allows `img-src data:` can use it.
  - `export/video`: `record({ width, height, fps, duration, draw, progress, signal })`, frames drawn by the caller encoded with WebCodecs to MP4 (H.264), or WebM (VP9, VP8 or AV1) where the browser cannot, each at its exact time; `canRecord()`. `pickFormat`, `eachFrame` and `evenSize` are its separable parts.
  - `export/save`: `save(data, filename, type?)` hands a file to the browser; `fileSlug(text)` makes a file name's part from any text.
  - `export/fonts` (`fontFaceCss`: the `@font-face` rules an element's text uses, only the weights and unicode ranges it needs, files inlined), `export/fetch` (`toDataUrl`, `inlineCssUrls`, `hasOuterUrl`, `outerUrls`, `blobToDataUrl`: files as `data:` URLs, each fetched once) and `export/styles` (`declarations`, `releaseDefaults`, `kept`, `pseudoShows`: computed style as only the declarations that differ from the browser's defaults).
- `budget(cap)` (`runtime/budget`, and the main entry): a cap on how many things run at once. `take(key, run)` runs it now if there is room, else when a turn comes up (the longest-waiting first); the function it returns gives the turn back. With `whenNear`, a wall of live cards keeps under the browser's WebGL contexts and spares the main thread.
- **An optional peer dependency:** `mediabunny` (`^1.62.1`), loaded only when `export/video` records. Nothing else needs it.

## [0.7.0] — 2026-11-07

### Added

- `<PixelFountain>`: retro 8-bit sparks for a footer. Chunky square pixels (`cell`, 8px) fire up out of the host's top edge, with a little `spread`, `gravity` pulling them back and a `drift`ing wind, and break down as they rise: through a short ramp of colours (from `color`, default the acid lime `#c8ff00`, then a darker lime, olive and gone; or `colors`, or a `palette`), shrinking a whole pixel step at a time (a double block, a block, half, a quarter) or, by `split`'s chance, splitting into two to four of its quarters that scatter; by `flicker`'s chance they blink out like a dying CRT pixel. Each is drawn on its own size's grid, anchored to the edge, in whole device pixels, so motion reads as stepped and the blocks stay crisp at any pixel ratio. A few trickle up on their own (`rate` a second per 1,000px of edge); moving the pointer over the host fires a stream from under it, and a click or tap a power-up (`burst` pixels whose first frames burn white). `source="text"` fires from the filled cells of the host's text instead (mostly the letters' tops), so a wordmark sheds pixels. The canvas sits `rise` px above the host (over it and above it for text), takes no pointer events, and reads the host's; `host` names the host when the fountain sits in a strip of its own; `zIndex`, `lazy`, `seed`. Canvas 2D, at most 400 pixels in a pool that allocates nothing as it runs, drawn only near the screen and while the tab shows; a still scatter with reduced motion; `setColors` recolours it live. `createFountain` is its pure, seeded simulation in fixed 60 Hz steps (the same seed and emits give the same pixels at any frame rate), with `fadeSteps`, `shadeAt`, `tierSizes`, `pixelRect`, `inkedCells` and `MAX_PIXELS`.
- `textNodesWithin(root, skip)` and `paintGlyphs(ctx, texts, origin)` (`text.js`): text nodes at any depth, and text drawn into a canvas glyph by glyph where the browser laid it out, each in its own element's font. `<PixelGlitchText>` now draws with `paintGlyphs` (no change to how it looks).
- `<EffectCanvas style>`: more inline style for the element (a component's own custom properties, a z-index).
- The demo has two `<PixelFountain>` heroes: an arcade footer in lime, and "Game over" shedding pixels.

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
