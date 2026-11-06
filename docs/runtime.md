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
| `pointerIn`, `trail`, `pressAt`, `CLICK_IGNORE` | The pointer over an element, its strokes, and presses |
| `pixelRatio`, `isMobileGpu`, `prefersReducedMotion`, `canHover` | The device checks every effect makes |
| `mount(selector, setup)`, `readConfig`, `watchColors` | Start an effect on every matching element, now and after each view transition |
