# Runtime

The package's main entry is the runtime the components are built on, for use without Astro or to build more: every effect as a function (`lightField(el, config)` and so on: start it on an element, get back a function that stops it), and the parts they share. Each module can also be imported on its own, which keeps a page's script small: `import { glassSheen } from '@arraypress/effects-astro/runtime/glass-sheen'`.

| Export | |
|---|---|
| `paperShader(el, config)`, `paperSettings`, `paperUniforms` | Paper's shaders, and the settings and uniforms for a shader and preset |
| `scene(el, config)`, `sceneSettings` | `<Scene>`: an `@logomarks/shaders` scene on an element's canvas, and its props as that package's options |
| `paperLook(el, config)`, `paperLookSettings`, `PAPER_LOOKS` | The Paper looks (`<ColorPanels>`…): a look's plain props as a Paper shader's settings, and the looks by name |
| `createStage(el, options)` | A full-canvas WebGL effect: context, program, sizing, the loop, reduced motion, clean-up |
| `createCanvas2D(el, options)`, `claimCanvas(el)`, `grainPattern`, `grainOnto` | The same for Canvas 2D effects (taking over a canvas the host claimed for WebGL), and grain laid onto strokes only |
| `createFluid(gl, options)`, `stir(fluid, el, options)` | A Stable Fluids solve, and its pointer hookup |
| `createPoints(gl, vertex)`, `projectPoint`, `GLSL_PROJECT` | Particles as soft points, with a 3D projection matched in JavaScript |
| `drawShape`, `samplePoints`, `gridPoints`, `distanceField`, `blurField`, `fontAt` | Shapes from text or images, and what effects take from them |
| `createGlyphs`, `GLYPH_SETS`, `GLSL_GLYPHS` | Text characters as a texture, for ASCII effects |
| `createTrackers(el, count)` | Machine-vision tracker boxes over an effect |
| `createFountain(options)`, `fadeSteps`, `shadeAt`, `tierSizes`, `pixelRect`, `inkedCells`, `MAX_PIXELS` | `<PixelFountain>`'s pure, seeded simulation (fixed 60 Hz steps, a pooled 400 pixels), its colour ramp, its grid snapping and the cells a wordmark fills |
| `textNodesWithin(root, skip)`, `paintGlyphs(ctx, texts, origin)` | Text nodes at any depth, and text redrawn into a canvas glyph by glyph where the browser laid it out |
| `parseColor`, `toHex`, `toOklab`, `fromOklab`, `mixOklab`, `paletteAt`, `GLSL_OKLAB`, `GLSL_PALETTE`, `GLSL_NOISE`, `GLSL_QUIET` | Colour in Oklab and shared shader pieces |
| `isLand(lat, lon)`, `LAND`, `CITIES` | Where the land is (Natural Earth, 1.5°), and cities by name |
| `inView(el, show)` | A callback as an element scrolls into view |
| `scrollReveal(config)`, `REVEAL_CLASSES` | Class-based scroll reveal for a whole page |
| `animate(el, frame)` | A frame callback on the page's one loop, while `el` is near the screen |
| `budget(cap)` | A cap on how many effects run at once: the rest wait their turn and start as one stops (with `whenNear`, a wall of cards keeps under the browser's WebGL contexts) |
| `pointerIn`, `trail`, `pressAt`, `CLICK_IGNORE` | The pointer over an element, its strokes, and presses |
| `pixelRatio`, `isMobileGpu`, `prefersReducedMotion`, `canHover` | The device checks every effect makes |
| `mount(selector, setup)`, `readConfig`, `watchColors` | Start an effect on every matching element, now and after each view transition |

## Export

Pictures, plain SVG and video of an element on the page, made in the browser. These are imported by path only (`import { snapshot } from '@arraypress/effects-astro/runtime/export/snapshot'`), not from the main entry. SVG is drawn from `data:` URLs, never `blob:`, so a page whose CSP allows `img-src data:` can use them. `export/video` needs [mediabunny](https://mediabunny.dev), an optional peer dependency: `npm install mediabunny`.

| Module | Exports | |
|---|---|---|
| `export/snapshot` | `snapshot(el, { square, skip })` | An element as a self-contained SVG (`<foreignObject>`, every computed style inline, pictures, canvases and fonts inlined): `svg(scale)` draws it pixel for pixel; `update(moved)` rewrites what a stepped `clock` moved |
| `export/clean-svg` | `cleanSvg(el, long)`, `cleanIssues(el)` | An element rebuilt as plain SVG (rects, pictures, inline SVG, `<text>`) that a design tool can edit; `cleanIssues` lists what stops it (a filter, a gradient, a shadow…), and `cleanSvg` refuses then |
| `export/clock` | `clock(root)` | The CSS animations under an element, paused and stepped by hand (`seek(ms)`, `moved()`, `release()`) for an exact recording |
| `export/raster` | `drawSvg(svg, width, height, canvas?, settle?)`, `rasterize(svg, { width, height }, type?, quality?)`, `imageOf(canvas, type?, quality?)`, `pngOf`, `svgDataUrl`, `decodeImage` | SVG to a canvas, and a canvas or an SVG to a PNG (or a JPEG at a quality) |
| `export/video` | `record({ width, height, fps, duration, draw, progress, signal })`, `canRecord()` | Frames drawn by you to MP4 (H.264), or WebM where the browser cannot encode it; WebCodecs |
| `export/save` | `save(data, filename)`, `fileSlug(text)` | A file handed to the browser to save, and a name for it from any text |
| `export/fonts`, `export/fetch`, `export/styles` | `fontFaceCss(el)`, `toDataUrl(url)`, `inlineCssUrls(css)`, `declarations(el)`, `releaseDefaults()` | The pieces under them: the `@font-face` rules an element's text uses, files as `data:` URLs, computed style as the few declarations that matter |

```js
import { snapshot } from '@arraypress/effects-astro/runtime/export/snapshot';
import { drawSvg, pngOf } from '@arraypress/effects-astro/runtime/export/raster';
import { save, fileSlug } from '@arraypress/effects-astro/runtime/export/save';

const snap = await snapshot(card);
const k = 2160 / Math.max(snap.width, snap.height);
const canvas = await drawSvg(snap.svg(k), Math.round(snap.width * k), Math.round(snap.height * k));
save(await pngOf(canvas), `${fileSlug(title)}.png`);
```
