# Components

Every component in `@arraypress/effects-astro`, with every prop. Generated from the components' own types by `node scripts/components-doc.mjs`; do not edit by hand.

Import each from its own path: `import Name from '@arraypress/effects-astro/Name.astro'`.

## `<AsciiRain>`

AsciiRain: data rain on a rippling surface, drawn in text characters, with red and blue fringes at the glyph edges. The pointer ripples the surface and a click sends a ring out. See src/runtime/ascii-rain.js.

```astro
<section class="hero" style="position: relative; background: #000">
  <AsciiRain colors={['#6d28d9', '#2563eb', '#22d3ee']} quiet={{ x: 0.25, y: 0.4, radius: 0.6 }} />
  <h1>…</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `colors` | `string[]` | Three CSS hex colours the dimmer glyphs take; the brightest go white. Default white. |
| `glyphs` | `string` | A character set (`data`: hollow and solid bars; `bars`, `ascii`, `blocks`, `binary`, `boxes`) or the characters, darkest first. Default `data`. |
| `cell` | `number` | A character cell's height in CSS px. Default 14. |
| `aspect` | `number` | A cell's width over its height. Default 1 for `data`, 0.6 for type. |
| `angle` | `number` | Which way the streaks run, degrees: 0 rightwards, 90 down, 180 left, 270 up. Default 0. |
| `lines` | `number` | Streak lanes across the surface. Default 40. |
| `trail` | `number` | A streak's length, a share of the gap between them (0–1). Default 0.3. |
| `density` | `number` | How many lanes have a streak at any time, 0–1. Default 0.7. |
| `width` | `number` | A lane's streak width, a share of the lane (0–1). Default 0.9. |
| `speed` | `number` | How fast the streaks run. Default 1. |
| `variance` | `number` | How much each lane's speed differs, 0–1. Default 0.6. |
| `ripple` | `number` | How tall the surface's waves are; 0 for flat. Default 1. |
| `waves` | `number` | How close together the waves are. Default 1. |
| `tilt` | `number` | How far the surface leans back, degrees (0 face-on, 80 nearly edge-on). Default 58. |
| `zoom` | `number` | How much of the surface fills the frame (larger is closer). Default 1. |
| `lighting` | `number` | How strongly the waves are lit and shaded; 0 for flat. Default 1. |
| `aberration` | `number` | How far blue bleeds left and red right of each glyph, CSS px; 0 for none. Default 3. |
| `interactive` | `boolean` | Whether the pointer ripples the surface and a click drops a ring. Default true. |
| `quiet` | `{ x?: number; y?: number; radius?: number; depth?: number } \| null` | An area kept clear: centre (0–1 from the top left), radius (share of the height), depth (0–1). |
| `font` | `string` | The font the glyphs are drawn in. Default a monospace stack. |
| `fixed` | `boolean` | Fill the viewport (position: fixed). Default false. |
| `class` | `string` | Classes for the element. |

## `<Backdrop>`

Backdrop: six animated shader backgrounds for a hero or section, tinted from `--color-accent` with no settings (the page's, or a section's own): mesh-gradient, grain-gradient, silk, band-lens, grid and waves. See src/runtime/backdrop.js.

```astro
<section style="position: relative">
  <Backdrop effect="silk" speed={0.6} intensity={0.7} />
  <h1>Your hero</h1>
</section>
<Backdrop effect="mesh-gradient" static frame={14} intensity={0.45} fade="none" fixed />
```

| Prop | Type | |
|---|---|---|
| `effect` (required) | `BackdropName` | Which backdrop. |
| `colors` | `string[]` | Up to four colours (hex or `rgb()`); those missing come from `--color-accent` where it sits: the accent, the accent towards `--color-bg`, its hue +36°, its hue −32° lifted. Only mesh-gradient, grain-gradient and silk use the fourth. Default all four from the accent. |
| `speed` | `number` | How fast it moves, 0–4. Default 1. |
| `intensity` | `number` | How strong it is (brightness and contrast, not opacity), 0–2. Default 1. |
| `static` | `boolean` | One frame, never the loop: for a backdrop that is wallpaper. Default false. |
| `frame` | `number` | With `static`, the moment drawn, in seconds. Default 12. |
| `interactive` | `boolean` | Lean towards the pointer, on devices that hover. Default false. |
| `opacity` | `number` | Its opacity, 0–1, to fade it against the section without changing the shader. Default 1. |
| `blend` | `string` | CSS `mix-blend-mode` with what is behind it (`screen`, `lighten`, `plus-lighter`…), for layering over imagery. Default normal. |
| `fade` | `'none' \| 'bottom' \| 'top' \| 'both'` | Fade it out towards an edge, so it melts into the page: 'bottom', 'top', 'both' (top and bottom) or 'none'. Default 'bottom'. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<BorderSweep>`

BorderSweep: a light travelling round an element's outline, on hover and focus or (`always`) all the time. A wrapper for `class="sweep-ring"` from border-sweep.css; for elements you render yourself, import `@arraypress/effects-astro/border-sweep.css` and add the class.

```astro
<BorderSweep as="a" href="/pricing" class="card" color="#a5b4fc" always>…</BorderSweep>
```

| Prop | Type | |
|---|---|---|
| `as` | `HTMLTag` | The element to render. Default `div`. |
| `color` | `string` | The light's colour. Default the text colour. |
| `speed` | `number` | Seconds a lap takes. Default 2.6. |
| `width` | `number` | The ring's width, px. Default 1. |
| `always` | `boolean` | Run all the time, not only on hover. Default false. |
| `class` | `string` | Classes for the element. |

## `<Cursor>`

Cursor: a custom cursor for the whole page: a dot at the pointer and a ring that trails it. Over links, buttons and anything with `data-cursor` the ring swells, showing that element's `data-cursor` text as a label (`<a data-cursor="View">`). The system cursor stays; it is not hidden. Only with a mouse or trackpad; no trail with reduced motion. Place it once, in the layout. See src/runtime/cursor.js.

```astro
<Cursor color="#ffffff" />
```

| Prop | Type | |
|---|---|---|
| `ease` | `number` | How quickly the ring catches up, 0–1 (1 is no trail). Default 0.18. |
| `targets` | `string` | What makes the ring swell. Default `a, button, [data-cursor]`. |
| `color` | `string` | The dot's and ring's colour. Default white. |
| `size` | `number` | The ring's size at rest, px. Default 32. |
| `blend` | `string` | Blend with the page: `difference` inverts what is under it, readable on any ground. Default `difference`. |

## `<DotGrid>`

DotGrid: a sea of dots you can drop stones into. A slow current moves through a fixed grid of dots, a swell sits under the pointer, and a click sends a widening ripple across, lifting and pushing the dots. See src/runtime/dot-grid.js.

```astro
<DotGrid fixed color="#ffffff" pitch={26} />
```

| Prop | Type | |
|---|---|---|
| `color` | `string` | The dots' colour. Default `#ffffff`. |
| `pitch` | `number` | Space between dots, CSS px. Default 26. |
| `dot` | `number` | A dot's size at rest, CSS px. Default 1.6. |
| `round` | `boolean` | Round dots rather than square. Default false. |
| `flow` | `number` | How strongly the noise current lights and nudges the dots; 0 for none. Default 1. |
| `speed` | `number` | How fast a ripple travels, CSS px a second. Default 620. |
| `life` | `number` | Seconds before a ripple is spent. Default 2.6. |
| `push` | `number` | How far a ripple displaces dots, CSS px. Default 9. |
| `radius` | `number` | The pointer's swell, CSS px; 0 for none. Default 210. |
| `greet` | `boolean` | Drop one ripple from the middle soon after it first comes on screen. Default true. |
| `ripples` | `boolean` | Whether clicks drop ripples. Default true. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<FitText>`

FitText: one line of text sized to exactly span its parent's content width, whatever the text and the window. See src/runtime/fit-text.js. Give it a CSS font-size as the fallback without script.

```astro
<FitText as="div" class="wordmark">Northwave</FitText>
```

| Prop | Type | |
|---|---|---|
| `as` | `HTMLTag` | The element to render. Default `div`. |
| `class` | `string` | Classes for the element. |

## `<FlutedGlass>`

FlutedGlass: a pane of slanted fluted glass over soft blooms of colour, the main one following the pointer. Each rib bends what is behind it and fringes it with a thin rainbow. See src/runtime/fluted-glass.js.

```astro
<section class="hero" style="position: relative">
  <FlutedGlass colors={['#4f46e5', '#a78bfa', '#f0abfc']} />
  <h1>Brands seen through <em>a different light.</em></h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `colors` | `string[]` | The blooms' colours, the one that follows the pointer first. Default indigo, violet, pink. |
| `background` | `string` | The ground behind the glass. Default `#f4f4f5`. |
| `angle` | `number` | The flutes' slant, degrees from vertical. Default -35. |
| `frequency` | `number` | Flutes across the longer side. Default 9. |
| `softness` | `number` | 0: flat flutes with sharp seams; 1: a gentle curve all across. Default 0.5. |
| `refraction` | `number` | How hard each flute bends what is behind it. Default 1.5. |
| `dispersion` | `number` | How far the colours part at the seams; 0 for none. Default 0.6. |
| `highlight` | `number` | The highlight along each flute; 0 for none. Default 0.35. |
| `bloom` | `number` | How strong the blooms are. Default 1. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<Glass>`

Glass: a liquid glass panel, with a rim that catches the light and a sheen that follows the pointer. A wrapper for `class="glass"` from glass.css that also starts the sheen; for elements you render yourself, import `@arraypress/effects-astro/glass.css` and add the class, then call `glassSheen()` once.

```astro
<Glass as="article" class="card" tint="#08080a">…</Glass>
```

| Prop | Type | |
|---|---|---|
| `as` | `HTMLTag` | The element to render. Default `div`. |
| `tint` | `string` | The body's tint colour. Default near-black. |
| `amount` | `number` | How much of the tint the body takes, 0–100 (%). Default 30. |
| `blur` | `number` | How much it blurs what is behind, px. Default 20. |
| `lift` | `number` | How far it rises on hover, px; 0 for none. Default 2. |
| `class` | `string` | Classes for the element. |

## `<GlassGlyph>`

GlassGlyph: a character or a logo as a thick slab of moulded glass over a dark ground lit by one coloured light, which follows the pointer. The glass bends the light through its rims and glints where it faces it. See src/runtime/glass-glyph.js.

```astro
<section class="hero" style="position: relative">
  <GlassGlyph text="7" font="900 Anton, sans-serif" colors={['#c6ff00', '#9fb08a']} />
  <h1>…</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `text` | `string` | The character or word to make of glass. |
| `font` | `string` | Its CSS font, without the size. Default: the page's, bold. |
| `src` | `string` | An image (an SVG logo) to make of glass instead. |
| `area` | `{ x: number; y: number; width: number; height: number }` | Where the shape sits, each 0–1 from the top left. Default the right half. |
| `colors` | `string[]` | The light's colour, then the glass's tint. Default acid green, white. |
| `background` | `string` | The ground. Default `#050505`. |
| `refraction` | `number` | How hard the glass bends what is behind it at its edges. Default 1. |
| `thickness` | `number` | How far in from the edge the bending reaches, a share of the height. Default 0.06. |
| `zoom` | `number` | How much the glass magnifies what is behind its middle. Default 1.04. |
| `aberration` | `number` | How far the colours part where it bends; 0 for none. Default 0.6. |
| `frost` | `number` | Frosted glass: how much what is behind is blurred, 0–1. Default 0. |
| `tint` | `number` | How much the glass takes the tint colour, 0–1. Default 0.1. |
| `highlight` | `number` | The lit rim and the glint. Default 0.8. |
| `fresnel` | `number` | The soft glow just inside the edge. Default 0.5. |
| `lightAngle` | `number` | Where the light comes from, degrees (0 right, 90 top). Default 135. |
| `glow` | `number` | How strong the coloured light behind is. Default 1. |
| `halftone` | `boolean` | The patch of dots behind the light. Default true. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<GlowField>`

GlowField: a still light laid over a section's background, or over a shader: a hard light source above an organic wash, so a headline has something to sit in. Pure CSS gradients, so it costs nothing on the GPU and cannot fail to start.

```astro
<section class="hero" style="position: relative">
  <GlowField variant="beam" color="#a5b4fc" />
  <h1>…</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `variant` | `'bloom' \| 'beam' \| 'horizon' \| 'wash'` | The shape of the light. Default `bloom`. |
| `color` | `string` | The light's colour. Default white. |
| `intensity` | `number` | A multiplier on its strength; 1 as designed. Default 1. |
| `tone` | `'dark' \| 'light'` | The ground it is on: `dark` adds light, `light` shades. Default `dark`. |
| `x` | `number` | Where across the top the light comes from, 0–100 (%). Default 50. |
| `class` | `string` | Classes for the element. |

## `<Grain>`

Grain: a film-grain texture over a section (or the whole page with `fixed`). Big smooth gradients band on 8-bit screens; grain dithers them, so a shader reads as film rather than plastic. Blended with `overlay`, which keeps blacks black and textures the mid-tones, as film grain does, where plain alpha would lift the blacks into fog.

```astro
<section style="position: relative">
  <LightField colors={…} />
  <Grain opacity={0.2} />
  <h1>…</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `opacity` | `number` | How strong, 0–1 (stronger than the number suggests, with overlay). Default 0.22. |
| `frequency` | `number` | How fine; higher is finer (0.75 is about 1px). Default 0.75. |
| `fixed` | `boolean` | Cover the viewport (position: fixed). Default false. |
| `blend` | `string` | The blend with what is under it. Default `overlay`. |
| `class` | `string` | Classes for the element. |

## `<HighlightSweep>`

HighlightSweep: a marker-pen underline that sweeps in under a word, once, after the page has drawn. For the one phrase a headline turns on. CSS only; with reduced motion the underline is simply there.

```astro
<h1>Sell <HighlightSweep color="#c084fc">beats</HighlightSweep> online.</h1>
```

| Prop | Type | |
|---|---|---|
| `color` | `string` | The underline's colour. Default the text colour. |
| `thickness` | `number` | How thick, em. Default 0.18. |
| `opacity` | `number` | How strong, 0–1. Default 0.45. |
| `delay` | `number` | Seconds before it starts. Default 0.4. |
| `duration` | `number` | Seconds the sweep takes. Default 1.6. |
| `class` | `string` | Classes for the element. |

## `<Ink>`

Ink: ink in water over whatever is behind it. The pointer stirs it and trails ink in the palette's colours; a click drops a bloom that bursts open and curls into eddies, then fades. Clear where there is no ink. See src/runtime/ink.js.

```astro
<section class="hero" style="position: relative">
  <Ink colors={['#2216f7', '#55bdff', '#a702ff']} />
  <h1>…</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `colors` (required) | `string[]` | The ink's palette, as CSS hex, looped through as it is laid. |
| `trail` | `number` | How much ink a stroke leaves, 0 for none (strokes still push). Default 0.35. |
| `drops` | `boolean` | Whether a click or tap drops a bloom of ink. Default true. |
| `force` | `number` | How hard the pointer pushes. Default 1. |
| `curl` | `number` | Swirl kept alive between strokes. Default 28. |
| `fade` | `number` | How fast the ink fades, per second. Default 0.55. |
| `diffusion` | `number` | How much the ink spreads and softens as it moves, 0–1. Default 0.35. |
| `radius` | `number` | The size of a stroke's splats and of a drop, 1 as standard. |
| `momentum` | `number` | How fast the motion dies away, per second (lower flows on longer). Default 0.25. |
| `opacity` | `number` | The ink's strongest cover, 0–1. Default 1. |
| `ignore` | `string` | Clicks on these are theirs, not the ink's. Default: links, buttons, form fields and `[data-effect-ignore]`. |
| `fixed` | `boolean` | Fill the viewport (position: fixed). Default false. |
| `class` | `string` | Classes for the element. |

## `<LightField>`

LightField: liquid light in three colours, bending around the pointer, with a real fluid under it that the pointer stirs and a click drops ink into. See src/runtime/light-field.js for how it is drawn.

```astro
<LightField fixed colors={['#7c3aed', '#db2777', '#06b6d4']} quiet={{ y: 0.45 }} />
```

| Prop | Type | |
|---|---|---|
| `colors` (required) | `string[]` | The light's three colours, as CSS hex. |
| `glint` | `string` | The caustic bands' colour. Default a warm white, `#fff3c4`. |
| `speed` | `number` | How fast the light moves. Default 1. |
| `lens` | `number` | How strongly the pointer bends the light; 0 for not at all. Default 1. |
| `prism` | `boolean` | Split the colours at the edges. Default true; always off on phones. |
| `fluid` | `boolean \| { trail?: number; drops?: boolean; force?: number; fade?: number; diffusion?: number; radius?: number; curl?: number; ignore?: string }` | The fluid under the light: false for none, or its settings. Default true. |
| `quiet` | `{ x?: number; y?: number; radius?: number; depth?: number } \| null` | An area where the light dims: centre (0–1 from the top left), radius (share of the height), depth (0–1). |
| `vignette` | `number` | How much the corners darken, 0–1. Default 0.45. |
| `grain` | `number` | Film grain. Default 0.035. |
| `scale` | `number` | Share of the pixel ratio drawn at. Default 0.5. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `background` | `string` | The colour under the light, and under the fallback gradient. Default `#08080a`. |
| `class` | `string` | Classes for the element. |

## `<Magnetic>`

Magnetic: an element the pointer pulls on. As the pointer comes near it leans towards it, its contents a little further, and springs back when the pointer goes: a call to action that feels like a soft object. See src/runtime/magnetic.js. Still on touch screens and with reduced motion.

```astro
<Magnetic as="a" href="/start" class="button" strength={0.35}>Start selling</Magnetic>
```

| Prop | Type | |
|---|---|---|
| `strength` | `number` | How far it follows the pointer, a share of the pointer's distance from its centre. Default 0.3. |
| `reach` | `number` | How far outside the element the pull starts, CSS px. Default 40. |
| `as` | `HTMLTag` | The element to render. Default `span`. |
| `class` | `string` | Classes for the element. |

## `<Marquee>`

Marquee: an endless strip that scrolls sideways, for "as featured in" logos, artist names, a ticker of offers. Pass `items` (text), or anything as the slot (logos, images, cards).

```astro
<Marquee items={['Marcus Vane', 'Vivid Skye', 'Lunaire']} separator="✦" />
<Marquee speed={30} direction="right"><img src="/press/wire.svg" alt="Wire" />…</Marquee>
```

| Prop | Type | |
|---|---|---|
| `items` | `string[]` | Text items; or pass content as the slot. |
| `speed` | `number` | Seconds for one set to pass. Default 40. |
| `direction` | `'left' \| 'right'` | `left` scrolls right to left. Default `left`. |
| `separator` | `string` | Shown between items (text items only). |
| `gap` | `string` | Space between items, CSS length. Default `2.5rem`. |
| `pauseOnHover` | `boolean` | Pause while the pointer is over it. Default true. |
| `pauseButton` | `boolean` | Show a pause button. Default true. |
| `fade` | `number` | How wide the faded edges are, % of the strip. Default 8. |
| `labels` | `{ pause: string; resume: string }` | The pause button's labels, for other languages. Default English. |
| `label` | `string` | What the strip is, for screen readers. Default the items joined. |
| `class` | `string` | Classes for the element. |

## `<OutlineWordmark>`

OutlineWordmark: a name at enormous scale, drawn as one outline, cropped so it sinks out of the bottom of the page, with a bright beam travelling through the letters. A page's closing mark: it ends on the brand rather than trailing off after the last link column, and as an outline it reads as texture rather than a second logo.

```astro
<OutlineWordmark text="ArrayPress" color="var(--accent)" />
```

| Prop | Type | |
|---|---|---|
| `text` (required) | `string` | The name. |
| `color` | `string` | The colour of the outline and the beam. Default `currentColor`. |
| `crop` | `number` | Share of the glyph height left showing, 0–1. Default 0.68. |
| `size` | `number` | Type size, as a share of the box's width (18 is 18% of it). Default 18. |
| `stroke` | `number` | The outline's width, px. Default 2. |
| `opacity` | `number` | How strong the resting outline is, 0–1. Default 0.42. |
| `beam` | `boolean` | The travelling beam. Default true. |
| `speed` | `number` | Seconds the beam takes to cross. Default 5.5. |
| `spotlight` | `boolean` | A light under the pointer that fills the letters. Default true. |
| `radius` | `number` | The light's radius, a share of the type size. Default 0.6. |
| `tracking` | `number` | Letter spacing, em. Default -0.02. |
| `font` | `string` | CSS font-family. Default inherited. |
| `weight` | `number \| string` | CSS font-weight. Default 700. |
| `class` | `string` | Classes for the element. |

## `<PaperShader>`

PaperShader: any of the thirty Paper Shaders (mesh and grain gradients, god rays, liquid metal, water, warp, dithering, halftones, metaballs, voronoi, smoke rings and more), with Paper's own presets, and no React. See src/runtime/paper.js; the shaders are vendored from Paper (Apache-2.0).

```astro
<PaperShader shader="mesh-gradient" preset="beach" />
<PaperShader shader="god-rays" colors={['#a78bfa', '#f0abfc']} params={{ density: 0.4 }} opacity={0.6} />
<PaperShader shader="liquid-metal" image="/logo.svg" />
```

| Prop | Type | |
|---|---|---|
| `shader` (required) | `PaperShaderName` | The shader, by its file name. |
| `preset` | `string` | One of the shader's presets, by name (any case). Default its first. |
| `params` | `Record<string, unknown>` | Paper's settings for the shader (`distortion`, `colorBack`…), over the preset's. |
| `colors` | `string[]` | The shader's colours, over the preset's. |
| `image` | `string` | A picture for the shaders that bend or trace one. |
| `gradient` | `string[]` | Colours to make a picture from, when there is no `image`. |
| `gradientAngle` | `number` | The made picture's angle, degrees. Default 135. |
| `speed` | `number` | How fast it moves, over the preset's (0 is still). |
| `scale` | `number` | Share of the pixel ratio drawn at. Default 1. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `background` | `string` | The colour shown before it draws, and without WebGL 2. Default transparent. |
| `opacity` | `number` | Its opacity, 0–1, for backdrops under copy. Default 1. |
| `class` | `string` | Classes for the element. |

## `<Parallax>`

Parallax: a layer that drifts with the pointer over its region, by its depth; give layers different depths (negative ones move against the pointer) and they separate into depth. Decorative blobs behind a hero, a floating product shot. See src/runtime/tilt.js.

```astro
<section class="hero" data-parallax-root style="position: relative">
  <Parallax depth={18} class="blob one" />
  <Parallax depth={-12} class="blob two" />
</section>
```

| Prop | Type | |
|---|---|---|
| `as` | `HTMLTag` | The element to render. Default `div`. |
| `depth` | `number` | How far it drifts at the region's edge, px; negative moves against the pointer. Default 18. |
| `within` | `string` | A selector for the region. Default the nearest `[data-parallax-root]`, or the parent. |
| `class` | `string` | Classes for the element. |

## `<ParticleLogo>`

ParticleLogo: a logo or a word in thousands of twinkling particles that scatter and swirl round the pointer and tilt towards it, each dot fringed red and blue, over two slow blooms of colour. See src/runtime/particle-logo.js.

```astro
<section class="hero" style="position: relative">
  <ParticleLogo src="/logo.svg" />
  <h1>Rewind <em>wild.</em></h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `text` | `string` | A word (or a character, an emoji) to draw in particles. |
| `font` | `string` | Its CSS font, without the size. Default: the page's, bold. |
| `src` | `string` | An image (an SVG logo, a PNG) to draw in particles instead. |
| `area` | `{ x: number; y: number; width: number; height: number }` | Where the shape sits, each 0–1 from the top left. Default the middle. |
| `colors` | `string[]` | The dots' two colours, then the two blooms'. Default white, ice blue, violets. |
| `background` | `string` | The ground. Default `#030305`. |
| `count` | `number` | How many particles (half on phones). Default 16000. |
| `size` | `number` | A particle's size, CSS px. Default 2.2. |
| `swarm` | `number` | How strongly they scatter round the pointer; 0 for not at all. Default 1. |
| `tilt` | `number` | How far the mark tilts towards the pointer. Default 1. |
| `aberration` | `number` | How far red and blue part, CSS px; 0 for none. Default 1.5. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<PixelGlitchText>`

PixelGlitchText: one line of text that breaks into pixels under the pointer and knits back together behind it. With `stroke`, a hollow outline at rest that the pixels fill in. See src/runtime/pixel-glitch.js.

```astro
<footer>
  <PixelGlitchText as="div" class="wordmark" fit stroke={1.5} aria-hidden="true">Northwave</PixelGlitchText>
</footer>
```

| Prop | Type | |
|---|---|---|
| `cell` | `number` | The heat grid's cell, CSS px. Default 14. |
| `reach` | `number` | How far the pointer's heat reaches, CSS px. Default 120. |
| `decay` | `number` | Heat kept each frame (0.9 is gone in about half a second). Default 0.9. |
| `block` | `number` | The pixel block size at full heat, CSS px. Default 22. |
| `shift` | `number` | How far the hottest rows slip sideways, CSS px. Default 16. |
| `stroke` | `number` | With a width (CSS px), the text at rest is an outline that the pixels fill. Default 0 (solid). |
| `as` | `HTMLTag` | The element to render. Default `span`. |
| `fit` | `boolean` | Size the text to span its parent's width. Default false. |
| `class` | `string` | Classes for the element. |

## `<PointCloud>`

PointCloud: a word drawn as a matrix of bright dots among rippling sheets of point cloud, the scene tilting towards the pointer. With `trackers`, boxes lock onto the word like a detector's debug view. See src/runtime/point-cloud.js.

```astro
<section class="hero" style="position: relative">
  <PointCloud text="inference" />
</section>
```

| Prop | Type | |
|---|---|---|
| `text` | `string` | The word drawn in dots. |
| `font` | `string` | Its CSS font, without the size. Default: the page's, bold. |
| `src` | `string` | An image (an SVG logo) to draw in dots instead. |
| `area` | `{ x: number; y: number; width: number; height: number }` | Where the word sits, each 0–1 from the top left. Default across the middle. |
| `colors` | `string[]` | The word's dots, then the clouds' low and high colours. Default white, deep blue, sky blue. |
| `background` | `string` | The ground. Default `#020205`. |
| `columns` | `number` | Dots across the word's grid. Default 110. |
| `dot` | `number` | A word dot's size, a share of the grid's spacing. Default 0.72. |
| `sheets` | `number` | How many sheets of point cloud. Default 9. |
| `pointSize` | `number` | A cloud point's size, CSS px. Default 2.2. |
| `trackers` | `number` | Tracker boxes locking onto the word, a detector's debug look (try 4); 0 for none. Default 0. |
| `tilt` | `number` | How far the scene tilts towards the pointer. Default 1. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<PulseMark>`

PulseMark: a small animated mark for a logo, a loading state or a "live" badge, drawn in SVG and moved by CSS alone (no script).

```astro
<PulseMark variant="sonar" size={40} color="#00ff88" glow />
```

| Prop | Type | |
|---|---|---|
| `variant` | `'matrix' \| 'rings' \| 'sonar'` | The mark. Default `matrix`. |
| `size` | `number \| string` | Its width and height, px or any CSS length. Default `1em`. |
| `color` | `string` | Its colour. Default the text colour. |
| `glow` | `boolean` | A soft glow round it. Default false. |
| `cells` | `number` | Blocks along each side of the matrix. Default 6. |
| `speed` | `number` | Speed, as a multiple. Default 1. |
| `label` | `string` | Its accessible name; without one it is decorative. |
| `class` | `string` | Classes for the element. |

## `<Reveal>`

Reveal: content that rises, slides, zooms or un-blurs into place as it scrolls into view; with `words` and `text`, each word on its own, one after another. Visible without JavaScript (only once the script runs is it hidden to be revealed) and with reduced motion. See src/runtime/text-motion.js.

```astro
<Reveal from="up"><h2>Made for one kind of business</h2></Reveal>
<Reveal as="h1" words text="Skip the build. Start selling." />
```

| Prop | Type | |
|---|---|---|
| `from` | `'up' \| 'down' \| 'left' \| 'right' \| 'fade' \| 'zoom' \| 'blur'` | How it arrives. Default `up`. |
| `words` | `boolean` | Each word arrives on its own, one after another. Default false. |
| `stagger` | `number` | Seconds between words. Default 0.06. |
| `delay` | `number` | Seconds before it starts. Default 0. |
| `once` | `boolean` | Only the first time it comes into view. Default true. |
| `as` | `HTMLTag` | The element to render. Default `div`. |
| `text` | `string` | With `words`: the text, split into words. |
| `duration` | `number` | Seconds the arrival takes. Default 0.7. |
| `distance` | `number` | How far it travels, px. Default 24. |
| `class` | `string` | Classes for the element. |

## `<ScrambleText>`

ScrambleText: text that resolves out of random characters, left to right, when it scrolls into view, and again on hover if asked. For a label, a stat, a short headline. Screen readers and search get the real text; the scramble is drawn over it. See src/runtime/text-motion.js.

```astro
<h2><ScrambleText text="Inference at the edge" hover /></h2>
```

| Prop | Type | |
|---|---|---|
| `characters` | `string` | What it scrambles through. Default letters, digits and a few symbols. |
| `duration` | `number` | Seconds to resolve. Default 0.9. |
| `hover` | `boolean` | Scramble again when the pointer comes over it. Default false. |
| `text` (required) | `string` | The text. |
| `as` | `HTMLTag` | The element to render. Default `span`. |
| `class` | `string` | Classes for the element. |

## `<ScrollReveal>`

ScrollReveal: scroll reveal for a whole site by class. Put it once in the layout, then `class="fade-in-up"` (or any reveal.css class: fades, slides, zooms, flips, `blur-in`) on anything that should arrive as it scrolls into view. Survives view transitions; everything shows without JavaScript and with reduced motion. For one element, or word by word, use `<Reveal>`. See src/runtime/scroll-reveal.js.

```astro
<ScrollReveal />
<section class="fade-in-up">…</section>
<div class="zoom-in" style="--reveal-delay: 0.1s">…</div>
```

| Prop | Type | |
|---|---|---|
| `selector` | `string` | What to reveal. Default the reveal.css classes. |
| `visibleClass` | `string` | The class added on arrival. Default `is-visible`. |
| `threshold` | `number` | How much must be in view, 0–1. Default 0.08. |
| `rootMargin` | `string` | The observer's margin. Default `0px 0px -10% 0px`. |
| `once` | `boolean` | Reveal once; false hides it again when it leaves, to replay. Default true. |

## `<SignalLines>`

SignalLines: layered waveform lines with a drifting loudness, front lines glowing, and pulses of light running along them. A quiet audio motif for behind a hero's copy. See src/runtime/waves.js.

```astro
<section class="hero" style="position: relative">
  <SignalLines />
  <h1>…</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `color` | `string` | The lines' colour. Default `#aeaeb8`. |
| `pulse` | `string` | The pulses' colour. Default `#fafafa`. |
| `lines` | `number` | How many lines. Default 7. |
| `amplitude` | `number` | How tall the waves are. Default 1. |
| `speed` | `number` | How fast they move. Default 1. |
| `pulses` | `number` | How often pulses run; 0 for none. Default 1. |
| `grain` | `number` | Grain on the strokes, 0–1. Default 0.5. |
| `fade` | `boolean` | Fade the left and right edges out. Default true. |
| `class` | `string` | Classes for the element. |

## `<SpotlightText>`

SpotlightText: one line of text as a hollow outline that a soft light under the pointer fills in. See src/runtime/spotlight.js.

```astro
<SpotlightText as="div" class="wordmark" aria-hidden="true">LumiThemes</SpotlightText>
```

| Prop | Type | |
|---|---|---|
| `radius` | `number` | The light's radius, a share of the font size. Default 0.85. |
| `reach` | `number` | How far outside the text (CSS px) the pointer still lights it. Default 40. |
| `as` | `HTMLTag` | The element to render. Default `span`. |
| `stroke` | `string` | The outline's width. Default `1.5px`. |
| `fill` | `'dodge' \| 'solid'` | How the lit letters fill. Default `dodge`. |
| `fit` | `boolean` | Size the text to span its parent's width. Default false. |
| `class` | `string` | Classes for the element. |

## `<Tilt>`

Tilt: a card, an image or an object that leans towards the pointer in perspective while it is over it, with a soft glare that follows, and settles back when it leaves. See src/runtime/tilt.js.

```astro
<Tilt as="a" href="/release" class="card" max={6} glare>…</Tilt>
```

| Prop | Type | |
|---|---|---|
| `as` | `HTMLTag` | The element to render. Default `div`. |
| `max` | `number` | The most it leans, degrees. Default 8. |
| `perspective` | `number` | The perspective's distance, px; smaller is more dramatic. Default 900. |
| `glare` | `boolean` | A light glare that follows the pointer. Default false. |
| `lift` | `number` | How far it lifts towards the viewer while tilted, px. Default 0. |
| `within` | `string` | A selector for a larger region to follow the pointer over. Default the element. |
| `class` | `string` | Classes for the element. |

## `<Typewriter>`

Typewriter: types phrases one after another behind a blinking caret, deleting each before the next. "Sell beats / sample packs / presets." Screen readers get the phrases as a list once, not a stream of letters; with reduced motion the first phrase simply shows. See src/runtime/text-motion.js.

```astro
<h1>Sell <Typewriter phrases={['beats', 'sample packs', 'presets']} /> online.</h1>
```

| Prop | Type | |
|---|---|---|
| `phrases` (required) | `string[]` | What it types, in turn. |
| `speed` | `number` | Milliseconds a character when typing. Default 55. |
| `pause` | `number` | Milliseconds a finished phrase stays. Default 1600. |
| `loop` | `boolean` | Start again after the last. Default true. |
| `caret` | `string` | The caret's colour. Default the text colour. |
| `class` | `string` | Classes for the element. |

## `<VoxelLogo>`

VoxelLogo: a logo or character built of cubes, rocking slowly in perspective and turning towards the pointer, outlined where cubes meet and dithered down to two inks. With `markers`, tracking markers ring it. See src/runtime/voxel-logo.js.

```astro
<section class="cta" style="position: relative">
  <VoxelLogo text="✳" colors={['#a7f3d0', '#08090a']} />
  <h2>Your next release starts here.</h2>
</section>
```

| Prop | Type | |
|---|---|---|
| `text` | `string` | A character or word to build in cubes. |
| `font` | `string` | Its CSS font, without the size. Default: the page's, bold. |
| `src` | `string` | An image (an SVG logo) to build instead. |
| `area` | `{ x: number; y: number; width: number; height: number }` | Where the solid sits, each 0–1 from the top left. Default the right half. |
| `colors` | `string[]` | The ink, then the paper. Default mint on near-black. |
| `size` | `number` | How large the solid is in its area (1 just fits when face-on). Default 1.3. |
| `cells` | `number` | Cubes across the shape. Default 28. |
| `depth` | `number` | Cubes deep. Default 4. |
| `dither` | `number` | The dither's pixel size, CSS px; 0 for smooth shading. Default 2. |
| `markers` | `number` | Tracking markers ringing the solid (try 6); 0 for none. Default 0. |
| `rock` | `number` | How far it rocks and turns towards the pointer. Default 1. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<WaveBars>`

WaveBars: a mirrored bar waveform whose bars ease to new heights every couple of seconds, as if being tuned, with a band of light drifting across. A quiet audio motif for behind a hero's copy. See src/runtime/waves.js.

```astro
<section class="hero" style="position: relative">
  <WaveBars />
  <h1>…</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `color` | `string` | The bars' colour. Default `#aeaeb8`. |
| `step` | `number` | Space between bars, CSS px. Default 8. |
| `bar` | `number` | A bar's width, CSS px. Default 3. |
| `height` | `number` | The tallest bar, a share of the height either side of the middle. Default 0.34. |
| `every` | `number` | Seconds between retunes. Default 2. |
| `sweep` | `boolean` | The band of light drifting across. Default true. |
| `grain` | `number` | Grain on the bars, 0–1. Default 0.4. |
| `fade` | `boolean` | Fade the left and right edges out. Default true. |
| `class` | `string` | Classes for the element. |

## `<WorldRoutes>`

WorldRoutes: a dotted world map with routes arcing between cities, a comet of light running along each and pinging the city it lands on. For "sell worldwide" and "customers in 40 countries" sections. Name cities (`london`, `tokyo`… see CITIES in src/runtime/world-routes.js) or give [latitude, longitude]. The map fits inside its box, centred.

```astro
<WorldRoutes color="#ff6b6b" routes={[['london', 'new-york'], ['london', 'tokyo']]} />
```

| Prop | Type | |
|---|---|---|
| `routes` | `[Place, Place][]` | The routes, each from a place to a place. Default ten routes round the world. |
| `color` | `string` | The routes' colour. Default `#38bdf8`. |
| `land` | `string` | The land dots' colour. Default `#ffffff`. |
| `landOpacity` | `number` | The land dots' opacity. Default 0.18. |
| `pitch` | `number` | Space between land dots, CSS px. Default 7. |
| `dot` | `number` | A land dot's radius, CSS px. Default 1.4. |
| `lap` | `number` | Seconds a comet takes along a route. Default 3.2. |
| `lift` | `number` | How high the arcs bow, a share of their length. Default 0.3. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |
