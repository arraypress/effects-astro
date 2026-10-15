# AGENTS.md

Notes for coding agents. People should start at the [README](README.md). Two parts: using the effects in a site, and working on this package.

## Using the effects in a site

Import each component from its own path (`import AsciiRain from '@arraypress/effects-astro/AsciiRain.astro'`). Every prop is in [COMPONENTS.md](COMPONENTS.md).

Pick by what is asked for:

| Asked for | Use |
|---|---|
| An animated, colourful background for a page or hero | `<LightField>` (liquid light), `<FlutedGlass>` (light, gallery-white or dark), `<AsciiRain>` (techy, dark), `<DotGrid>` (quiet, minimal), `<SignalLines>` / `<WaveBars>` (audio) |
| Something to play with: ink, smoke, liquid, "interactive" | `<Ink>` over a section, or `<LightField>` (it has the fluid under it), or `<DotGrid>` (click ripples) |
| A gradient, noise, halftone or liquid-metal look by name | `<PaperShader shader="…" preset="…">`; the demo's Paper page shows every preset |
| A themed hero background by name (aurora, mesh gradient, waves, synthwave grid, particles, grain, beams, silk…), tinted from the site's accent | `<Backdrop effect="…">`; `static` when it sits behind body copy or is `fixed` |
| A "we sell worldwide" section | `<WorldRoutes>` with the cities that matter to the shop |
| A still light or texture over a background | `<GlowField>`, `<Grain>` |
| The brand's logo as the hero's centrepiece | `<GlassGlyph>`, `<ParticleLogo>`, `<VoxelLogo>`, `<PointCloud>`, all with `src="/logo.svg"` or `text` |
| A footer wordmark | `<SpotlightText fit>`, `<PixelGlitchText fit>`, `<OutlineWordmark>` |
| Sections that arrive on scroll, site-wide | `<ScrollReveal />` once in the layout, then reveal.css classes (`fade-in-up`…) on elements |
| Text that arrives or moves | `<Reveal>`, `<ScrambleText>`, `<Typewriter>`, `<HighlightSweep>`, `<Marquee>` |
| Stats, prices, a savings calculator | `<CountUp>` (set `data-value` to change it), `<Range>` |
| A row of products or packs to browse | `<Carousel>` |
| An upload | `<Dropzone>` (set `data-busy` while processing) |
| A story, roadmap or process | `<Timeline>` |
| A small logo mark, a loading or "live" sign | `<PulseMark>`, `.fx-live` from `motion.css` |
| Tooltips | `tooltip.css` and `data-tip` (repeat the words in `aria-label`) |
| Cards and buttons that respond | `<Glass>`, `<BorderSweep>`, `<Tilt>`, `<Magnetic>`, `<Parallax>`; `<Cursor>` once per site |
| A music or digital-goods shop | `<VinylSleeve>`, `<Equalizer>`, `<Countdown>`, `<Skeleton>`, `motion.css` (`.fx-heartbeat`, `.fx-bump`, `.fx-pulse-ring`) |
| Page chrome | `<ScrollProgress>`, `<BackToTop>` |

Things that trip people up:

- **`fixed` backgrounds need a transparent `body`.** They sit at `z-index: -1` behind the page: `body { background: transparent }` and paint the page colour on `html`.
- **Non-fixed effects fill their nearest positioned ancestor.** Give the section `position: relative`, and put the effect before the content.
- **Headlines over a busy background:** pass `quiet` (`<LightField>`, `<AsciiRain>`) so it dims behind them.
- **Logos:** `src` takes any image URL; only where it is opaque counts. A `font` puts the weight first: `"900 Anton, sans-serif"`.
- **Clicks:** effects that react to clicks ignore links, buttons and form fields. Add `data-effect-ignore` to anything else whose clicks are its own.
- **`<SpotlightText fill="dodge">`** blends with what is behind it: no stacking context may sit between them (no `z-index` on a positioned ancestor, no `opacity`, `transform`, `filter` or `isolation`). Use `fill="solid"` where that cannot be arranged.
- **Styling a component's element** from the page needs `:global(.its-class)`, since the element belongs to the component.
- **`<PaperShader>` needs WebGL 2** and shows `background` without it. Its picture shaders take `image` (same origin, or served with CORS).
- **Changing colours at runtime:** `setColors(el, colors, glint?)` from `@arraypress/effects-astro`.
- **Do not reimplement** reduced motion, WebGL checks, pausing off screen or pixel-ratio caps around the components: they do all of it.

## Working on this package

Plain ES modules in `src/` with hand-written `.d.ts` files beside them: components in `src/components/`, the runtime in `src/runtime/` (one concern a file), stylesheets in `src/styles/`. No build step and no dependencies. `demo/` is an Astro site (not published): a gallery of every effect, each opening its own full-screen page.

| | |
|---|---|
| `npm test` | Node's test runner over `tests/*.test.js`. Run before every commit. |
| `npm run docs` | Regenerates COMPONENTS.md from the components' `Props` and the runtime `.d.ts` files. Run after changing any prop. |
| `cd demo && npm run dev` | The demo gallery on http://127.0.0.1:4400. |
| `cd demo && npm run thumbs [slug…]` | Recaptures the gallery's thumbnails (needs the demo running and Google Chrome). |

The shaders and canvases cannot run under Node. After changing an effect, check it in the demo: it draws, the console has no `[effects-astro]` warnings, and reduced motion, a touch screen and a WebGL-less browser each get their still state or fallback.

### House rules

- **A new effect** is a runtime module (`src/runtime/<name>.js` + `.d.ts`, exporting `name(el, config) => stop`), a component (`src/components/<Name>.astro`) and a showcase in the demo: `demo/src/showcase/<slug>.astro` (served at `/fx/<slug>`), an entry in `demo/src/gallery.js`, and its thumbnail (`npm run thumbs <slug>`). Canvas components render `<EffectCanvas name="<name>">` and call `mount('[data-effect-<name>]', fn)`.
- **Build on the shared parts:** `createStage` for a WebGL effect, `createCanvas2D` for a Canvas one, `animate` for any loop, `pointerIn` / `trail` / `pressAt` for the pointer, `watchColors` for `data-colors`, `drawShape` for logos and text shapes, `GLSL_*` for shader pieces. Each effect keeps the guarantees in the README.
- **No repetition.** Anything two effects need goes in its own runtime module and is imported.
- **JSDoc on every function**, nested ones included: a short description, `@param` for each parameter, `@returns`, `@throws` where it applies. Every prop has a doc comment with its default (COMPONENTS.md is built from them). Keep the `.d.ts` files in step. Plain, concise voice: what a thing does and why.
- **Colour in Oklab** (`mixOklab`, `paletteAt`, `GLSL_PALETTE`), never mixed in RGB.
- **No telemetry, no network, no dependencies.** Effects ship inside sites for other people's visitors.
- **`src/vendor/paper/` is Paper's code, unchanged but for dropped source-map comments** (Apache-2.0). Update it by re-vendoring a release and regenerating `presets.js`; never edit it by hand.
- **Credit what is adapted**, in the module's header, the README's Credits and LICENSE, and only from MIT-compatible sources. shaders.com's open-source components (MIT) may be adapted; its presets and sections are licensed content and may not be copied, even modified.
- **Every change goes in CHANGELOG.md** (Keep a Changelog, SemVer). Commit and push only with the owner's go-ahead; the owner publishes to npm.
