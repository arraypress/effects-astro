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
| `colors` | `string[]` | Three CSS hex colours the glyphs take, the brightest nearly white. Default a cool cyan and green. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
| `glitch` | `number` | How often rows jump sideways for a moment, their colours splitting wider; 0 for never. Default 1. |
| `glyphs` | `string` | A character set (`data`: hollow and solid bars; `bars`, `ascii`, `blocks`, `binary`, `boxes`) or the characters, darkest first. Default `data`. |
| `cell` | `number` | A character cell's height in CSS px. Default 14. |
| `aspect` | `number` | A cell's width over its height. Default 1 for `data`, 0.6 for type. |
| `angle` | `number` | Which way the streaks run, degrees: 0 rightwards, 90 down, 180 left, 270 up. Default 0. |
| `lines` | `number` | Streak lanes across the surface. Default 40. |
| `trail` | `number` | A streak's length, a share of the gap between them (0–1). Default 0.3. |
| `density` | `number` | How many lanes have a streak at any time, 0–1. Default 0.7. |
| `width` | `number` | A lane's streak width, a share of the lane (0–1). Default 0.9. |
| `pattern` | `'cloud' \| 'waves'` | A still cloud of data, or streaks running on a rippling surface. Default `cloud`. |
| `speed` | `number` | How fast it moves: the rows stream, or the streaks run; 0 for one still frame. Default 1. |
| `variance` | `number` | How much each lane's speed differs, 0–1. Default 0.6. |
| `ripple` | `number` | How tall the surface's waves are; 0 for flat. Default 1. |
| `waves` | `number` | How close together the waves are. Default 1. |
| `tilt` | `number` | How far the surface leans back, degrees (0 face-on, 80 nearly edge-on). Default 58. |
| `zoom` | `number` | How much of the surface fills the frame (larger is closer). Default 1. |
| `lighting` | `number` | How strongly the waves are lit and shaded; 0 for flat. Default 1. |
| `aberration` | `number` | How far blue bleeds left and red right of each glyph, CSS px; 0 for none. Default 3. |
| `interactive` | `boolean` | With `waves`, whether the pointer ripples the surface and a click drops a ring. Default true. |
| `quiet` | `{ x?: number; y?: number; radius?: number; depth?: number } \| null` | An area kept clear: centre (0–1 from the top left), radius (share of the height), depth (0–1). |
| `font` | `string` | The font the glyphs are drawn in. Default a monospace stack. |
| `fixed` | `boolean` | Fill the viewport (position: fixed). Default false. |
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

## `<Caustics>`

Caustics: sunlight through rippling water onto a pool floor, a bright, shifting net of light over an aqua ground, with a faint rainbow at the edges of its lines. The pointer stirs the water where it is; faint tiles can lie on the floor. See src/runtime/caustics.js.

```astro
<section class="hero" style="position: relative">
  <Caustics tiles quiet={{ radius: 0.5 }} />
  <h1>The pool is <em>open.</em></h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `colors` | `string[]` | The water and the light, in any order: the darkest is the deep water towards the edges, the lightest the light, the one between the floor. One or two colours work too. Default aqua `#2cc3d0`, deep teal `#0b7ea8`, sun `#f2fff9`. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
| `background` | `string` | The ground the edges fall away into, and what shows without WebGL. Default: the deep water, darkened. |
| `scale` | `number` | How large the net of light is, 0.4–3: 2 doubles it. Default 1. |
| `speed` | `number` | How fast the water moves, 0–3; 0 holds it still. Default 1. |
| `intensity` | `number` | How bright the light is, 0–2. Default 1. |
| `tiles` | `boolean` | Faint pool tiles on the floor, bent by the water. Default false. |
| `interactive` | `boolean` | Whether the pointer disturbs the water where it is. Default true. |
| `quiet` | `{ x?: number; y?: number; radius?: number; depth?: number } \| null` | An area where the light is kept low behind copy: centre (0–1 from the top left), radius (a share of the height), depth (0–1). Default none; `{}` for the middle. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<ColorPanels>`

ColorPanels: translucent panels of colour that swing open out of the dark and sweep past, like pages turning towards you. Paper's color-panels shader (Apache-2.0, vendored), with its settings as plain props; each prop's default is the Opening preset's, and with another `preset` the props left out are that preset's.

```astro
<ColorPanels />
<ColorPanels preset="Glass" background="#0b0b10" />
<ColorPanels palette="Lagoon" density={3} edges quiet={{ radius: 0.5 }} />
```

| Prop | Type | |
|---|---|---|
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
| `quiet` | `{ x?: number; y?: number; radius?: number; depth?: number }` | Dims it towards its `background` behind the copy: the centre (`x` across, `y` down, 0–1), the `radius` (of the height) and the `depth`, 0–1. Default none. |
| `preset` | `'Opening' \| 'Default' \| 'Glass' \| 'Gradient'` | Paper's preset to start from: `Opening` (cyan panels opening out of the dark, on plum), `Default` (seven colours fanning out over black), `Glass` (four colours with lit, blurred edges, on clear) or `Gradient` (panels shading from one colour to the next, on aqua). Default `'Opening'`. |
| `colors` | `string[]` | The panels' colours, up to seven, taken in turn. Default `['#00ffff']`. |
| `background` | `string` | The colour behind the panels. Default `'#570044'`. |
| `density` | `number` | How closely the panels follow one another, 0.25–7. Default 2.21. |
| `skewLeft` | `number` | Skews each panel's left edge as it nears, -1–1. Default -1. |
| `skewRight` | `number` | Skews each panel's right edge as it nears, -1–1. Default -1. |
| `length` | `number` | How long the panels are, 0–3. Default 0.52. |
| `edges` | `boolean` | Light along each panel's edges. Default false. |
| `blur` | `number` | Softens the panels' sides, 0–0.5 (0 sharp). Default 0. |
| `fadeInner` | `number` | Fades the panels where they meet, at the centre, 0–1. Default 0. |
| `fadeOuter` | `number` | Fades the panels at their outer ends, nearest you, 0–1. Default 1. |
| `blend` | `number` | Shades each panel into the next colour, 0–1 (0 one colour each). Default 0. |
| `zoom` | `number` | How large the panels are drawn, 0.1–4. Default 2.32. |
| `rotation` | `number` | Turns the whole look, degrees, 0–360. Default 360. |
| `offset` | `[number, number]` | Where the panels' centre sits, `[x, y]`, -1–1, right and down. Default `[-0.3, 0.6]`. |
| `speed` | `number` | How fast the panels turn, 0–4 (0 holds). Default 2. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
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

## `<DotSurface>`

DotSurface: a halftone sea. A grid of round dots lies on a slowly rolling sheet seen in perspective, each dot sized and lit by how the light catches the sheet: lit crests swell into large bright dots, troughs shrink to pinpoints. The pointer raises a soft swell; a click sends a ring across. See src/runtime/dot-surface.js.

```astro
<DotSurface color="#ff8a1f" quiet={{ x: 0.3, y: 0.3, radius: 0.5 }} />
```

| Prop | Type | |
|---|---|---|
| `color` | `string` | The dots' colour. Default `#ff8a1f`. |
| `colors` | `string[]` | A gradient instead (up to five), blended in Oklab, from near to far or left to right (see `gradient`). |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors` or `color`. |
| `gradient` | `'depth' \| 'width'` | Which way `colors` runs: near to far, or left to right. Default `depth`. |
| `pitch` | `number` | Space between dots, CSS px, at the middle of the sheet (nearer is wider, further closer). Default 10. |
| `dot` | `number` | The largest dot, CSS px, at the middle of the sheet. Default 6. |
| `amplitude` | `number` | How tall the swells are: 1 a gentle roll, 2 a heavy sea, 0 flat. Default 1. |
| `speed` | `number` | How fast the sheet rolls; 0 holds it still. Default 1. |
| `tilt` | `number` | The camera's angle above the sheet, degrees (10 grazing, 70 nearly overhead). Default 42. |
| `light` | `[number, number, number]` | Where the light comes from: x right, y up, z into the distance. Default `[-0.5, 0.6, -0.6]`. |
| `interactive` | `boolean` | Whether the pointer raises a swell and a click sends a ring. Default true. |
| `quiet` | `{ x?: number; y?: number; radius?: number; depth?: number } \| null` | An area kept dim behind copy: centre (0–1 from the top left), radius (a share of the height), depth (0–1). Default none; `{}` for the middle. |
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
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
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
<Glass refract dispersion={0.5} style="border-radius: 28px">…</Glass>
```

| Prop | Type | |
|---|---|---|
| `as` | `HTMLTag` | The element to render. Default `div`. |
| `tint` | `string` | The body's tint colour. Default near-black. |
| `amount` | `number` | How much of the tint the body takes, 0–100 (%). Default 30. |
| `blur` | `number` | How much it blurs what is behind, px. Default 20, or 0.5 with `refract`. |
| `lift` | `number` | How far it rises on hover, px; 0 for none. Default 2. |
| `refract` | `boolean \| number` | Bends what is behind like a thick lens at the rim, 0–2, or `true` for 1. Chromium only; elsewhere the frost stays. Default false. |
| `dispersion` | `number` | With `refract`, how much the rim splits what it bends into colours, 0–1. Default 0.35. |
| `bezel` | `number` | With `refract`, how wide the bending rim is, px. Default 28. |
| `specular` | `number` | With `refract`, how bright the highlight along the rim is, 0–1. Default 0.7. |
| `class` | `string` | Classes for the element. |

## `<GlassGlyph>`

GlassGlyph: a character or a logo as a thick slab of dark, smoked glass, lit from behind by beams of one coloured light. The light barely shows on the near-black ground; the glass catches it and glows with it through its body and bevels. The slab turns slowly on its own and leans away from the pointer; the light stays put. See src/runtime/glass-glyph.js.

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
| `light` | `{ x: number; y: number }` | Where the beams of light cross, each 0–1 from the top left. Default two fifths of the way into the shape's area, a little below its middle. |
| `colors` | `string[]` | The light's colour, then the glass's tint. Default acid green, white. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
| `background` | `string` | The ground. Default `#050505`. |
| `refraction` | `number` | How hard the glass bends what is behind it, most of all across its bevels, 0–2. Default 1. |
| `thickness` | `number` | How wide the bevel round the edge is, a share of the height, 0.01–0.1. Default 0.035. |
| `zoom` | `number` | How much the glass magnifies the light behind it, 1–1.3. Default 1.04. |
| `aberration` | `number` | How far the colours part where it bends, 0–2; 0 for none. Default 0.6. |
| `frost` | `number` | Frosted glass: how much more the light through it is blurred, 0–1. Default 0. |
| `tint` | `number` | How much the glass takes the tint colour, 0–1. Default 0.1. |
| `highlight` | `number` | The lit rims and the glints, 0–2. Default 0.8. |
| `fresnel` | `number` | How much the bevels mirror the light, 0–1. Default 0.5. |
| `lightAngle` | `number` | Where the light on the rims comes from, degrees, 0–360 (0 right, 90 top). Default 135. |
| `glow` | `number` | How strong the coloured light is, 0–2. Default 1. |
| `ambient` | `number` | How much of the light shows outside the glass, 0–1: 0 is a black ground, 1 the full beams. Default 0.1. |
| `halftone` | `boolean` | Dither the light outside the glass into dots where it fades. Default false. |
| `sway` | `number` | How far the slab turns on its own and away from the pointer, 0–2; 0 holds it still. Default 1. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<GlowField>`

GlowField: a light laid over a section's background, or over a shader: a hard light source above an organic wash, so a headline has something to sit in. Pure CSS gradients that move only by transform and opacity, so it costs next to nothing and cannot fail to start.

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
| `still` | `boolean` | Hold the light still. Default false. |
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
| `still` | `boolean` | Hold the grain still. Default false. |
| `class` | `string` | Classes for the element. |

## `<HaloRing>`

HaloRing: a ring of light on a dark ground, a soft-cornered outline around the copy whose bright core line glows inward a little and far outward. Colour travels around it, and its hottest stretches burn to white; the pointer draws it close and lights it up. See src/runtime/halo-ring.js.

```astro
<section class="hero" style="position: relative">
  <HaloRing colors={['#ffb020', '#ff5a6e', '#2f7bff']} />
  <h1>Something new arrives Friday.</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `colors` | `string[]` | Three colours looped around the ring, blended in Oklab. Default amber, coral, electric blue (`['#ffb020', '#ff5a6e', '#2f7bff']`). |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
| `shape` | `HaloShape` | The outline: a rounded hexagon, a rounded rectangle fitted to the element, a circle, or a slow drift between the hexagon and a squarer rectangle. Default `morph`. |
| `corner` | `number` | How round the corners are: 0 sharp, 1 as round as they go. Default 0.3. |
| `margin` | `number` | Space between the ring and the element's edge, a share of its shorter side. Default 0.05. |
| `thickness` | `number` | The bright core line, CSS px. Default 10. |
| `glow` | `number` | How far and how strongly the light spreads; 0 for the bare line. Default 1. |
| `speed` | `number` | How fast the colour travels and the shape drifts; 0 holds it still. Default 1. |
| `background` | `string` | The ground. Default `#0d0c10`. |
| `interactive` | `boolean` | Whether the ring leans towards the pointer and lights up near it. Default true. |
| `quiet` | `{ x?: number; y?: number; radius?: number; depth?: number } \| null` | An area kept dim behind copy: centre (0–1 from the top left), radius (a share of the height), depth (0–1). Default none; `{}` for the middle. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
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

## `<ImageRipple>`

ImageRipple: a photo under a skin of water. The pointer drags a wake through it and a click drops a ring; the waves bend the photo, part its colours a little at their fronts and catch the light on their crests, then settle back to the still, sharp photo. See src/runtime/image-ripple.js.

```astro
<section class="hero" style="position: relative">
  <ImageRipple src="/photos/lake.jpg" alt="A misty lake at dawn" />
  <h1>…</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `src` (required) | `string` | The photo's URL (same origin, or served with CORS). |
| `strength` | `number` | How far the ripples bend the photo, 0–3. Default 1. |
| `size` | `number` | How wide the ripples the pointer makes are, 0.3–3. Default 1. |
| `viscosity` | `number` | How thick the water is: more settles sooner, with smaller ripples, 0.25–4. Default 1. |
| `fringe` | `number` | How far the colours part at the wave fronts, 0–3; 0 for none. Default 1. |
| `interactive` | `boolean` | Whether the pointer ripples it; false leaves the plain photo. Default true. |
| `fit` | `'cover' \| 'contain'` | How the photo fills the element, as CSS `object-fit`. Default `cover`. |
| `alt` | `string` | The photo's text alternative. Default empty: decoration. |
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
| `colors` | `string[]` | The ink's colours, as CSS hex, looped through as it is laid. Default the palette's, or Peacock's. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
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

## `<InkField>`

InkField: ink in water, lit by a lamp that follows the pointer. Slow emitters keep the ink moving across the whole field; moving the pointer pushes it aside and leaves a faint trail, and the lamp rests at the upper left when the pointer is away. The field dims in the middle, behind the copy. Twelve named palettes (Trirat's), or colours of your own. See src/runtime/ink-field.js.

```astro
<InkField fixed palette="Peacock" />
```

| Prop | Type | |
|---|---|---|
| `palette` | `PaletteName \| (string & {})` | One of the shared palettes (`PALETTES`, any case). Default `'Lumetri'`. |
| `colors` | `string[]` | Three colours as CSS hex, in place of the palette's (fewer are looped). Default the palette's. |
| `glint` | `string` | A glint colour, in place of the palette's (unused by the ink look). Default the palette's. |
| `interactive` | `boolean` | The pointer stirs the ink and the lamp follows it, on devices that hover. Default true. |
| `drops` | `boolean` | A press drops ink that blooms open (not on links, buttons or fields). Off by default: on a page-wide field, stray clicks would splash. Default false. |
| `lamp` | `{ x?: number; y?: number }` | Where the lamp rests when the pointer is away, 0–1 from the top left. Default `{ x: 0.14, y: 0.14 }`. |
| `still` | `boolean` | Hold one frame of settled ink and never animate, as with reduced motion: for a field behind body copy. Default false. |
| `scale` | `number` | Share of the pixel ratio drawn at. Default 0.5. |
| `audio` | `AudioSource` | Follow the sound playing: `'page'` for whatever plays, or a CSS selector for an `<audio>`/`<video>` or a player's container (a WaveformPlayer). Kicks stir the ink and it brightens with the beat; while nothing plays it keeps its own motion. Default none. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<IsoCity>`

IsoCity: a small isometric city in flat-shaded low poly, with cars driving its streets and the brand's taxis among them, in its `accent`. Click a street and the nearest taxi comes: its route draws in, it pulls in at the pin, and it picks up with a hop. `night` lights the windows, lamps and headlights. See src/runtime/iso-city.js.

```astro
<section class="hero" style="position: relative">
  <IsoCity accent="#f2a53a" side="right" quiet={{ x: 0.25, radius: 0.5 }} />
  <h1>Your ride, <em>two streets away.</em></h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `colors` | `string[]` | Buildings, parks, roads. Default warm off-white, sage and graphite (at night slate, deep green and near-black). |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), softened into a city, when there are no `colors`; its first colour becomes the taxis'. |
| `accent` | `string` | The taxis' colour. Default `#f2a53a` (amber; `#ffb547` at night). |
| `background` | `string` | The ground the city fades into. Default `#e9e3d8` (`#0d1219` at night). |
| `cars` | `number` | How many cars, 0–60. Default 24. |
| `taxis` | `number` | How many of them are taxis: a share, 0–1, or a count, 1–60. Default 0.3. |
| `speed` | `number` | How fast they drive, 0–3; 0 holds them still. Default 1. |
| `seed` | `number` | Which city, 1–9999: the same seed always builds the same streets and buildings. Default 7. |
| `size` | `number` | Blocks across, 3–10. Default 6. |
| `night` | `boolean` | Night: lit windows, street lamps, headlight beams and glowing roof signs. Default false. |
| `interactive` | `boolean` | A click or tap on a street calls the nearest taxi by road, which drives there and picks up. Default true. |
| `drift` | `boolean` | Let the view drift very slowly. Default true. |
| `zoom` | `number` | How close the camera is, 0.5–2. Default 1. |
| `side` | `'center' \| 'left' \| 'right'` | Where the city sits on a wide screen (centred on a narrow one). Default `center`. |
| `quiet` | `{ x?: number; y?: number; radius?: number; depth?: number } \| null` | An area faded towards the background behind copy: centre (0–1 from the top left), radius (a share of the height), depth (0–1). Default none; `{}` for the middle. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<LightField>`

LightField: liquid light in three colours, bending around the pointer, with a real fluid under it that the pointer stirs and a click drops ink into. See src/runtime/light-field.js for how it is drawn.

```astro
<LightField fixed colors={['#7c3aed', '#db2777', '#06b6d4']} quiet={{ y: 0.45 }} />
```

| Prop | Type | |
|---|---|---|
| `colors` | `string[]` | The light's three colours, as CSS hex. Default the palette's, or Lumetri's. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
| `glint` | `string` | The caustic bands' colour. Default the palette's glint, or a warm white, `#fff3c4`. |
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

## `<LiquidMetal>`

LiquidMetal: a logo or a word made of liquid chrome. At rest it is a polished slab of metal reflecting a slowly turning studio; the pointer dents it and sends ripples across it, a stroke parts it, a click splashes it (a crater, a ring wave, droplets that fall and crawl back), and surface tension pulls it back into shape with a last wobble. See src/runtime/liquid-metal.js.

```astro
<section class="hero" style="position: relative; background: #0b0c0e">
  <LiquidMetal src="/logo.svg" />
  <h1>…</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `text` | `string` | A word to make of metal. |
| `font` | `string` | Its CSS font, without the size. Default: the page's, bold. |
| `src` | `string` | An image (an SVG logo) to make of metal instead. |
| `area` | `{ x: number; y: number; width: number; height: number }` | Where the logo sits, each 0–1 from the top left. Default the right half. |
| `size` | `number` | How much of its area the logo fills: 1 fits it, less shrinks it about the area's middle. Default 1. |
| `tint` | `MetalName \| (string & {})` | The metal: a name, or a CSS hex colour (its colour face on). Default `chrome`. |
| `colors` | `string[]` | The studio's colours, reflected in the metal: the sky, the horizon, the floor. Default a neutral studio. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`: it tints the studio. |
| `bevel` | `number` | How wide its rounded edges are. Default 1. |
| `viscosity` | `number` | How thick the metal is: more settles sooner, with smaller ripples. Default 1. |
| `tension` | `number` | How hard it pulls back into shape: more reforms sooner, with a quicker wobble. Default 1. |
| `ripple` | `number` | How hard the pointer pushes into it. Default 1. |
| `interactive` | `boolean` | Whether it reacts to the pointer at all. Default true. |
| `shadow` | `number` | The soft shadow under it; 0 for none. Default 1. |
| `background` | `string` | A ground behind the metal (any CSS background). Default none: transparent. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
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

## `<MosaicReveal>`

MosaicReveal: a slideshow of pictures that change through a GPU transition: tiles flipping over in a diagonal wave, a melt into sorted streaks, blocks coarsening and refining, or a dissolve with a glowing edge. For a product gallery or a portfolio hero. See src/runtime/mosaic-reveal.js.

```astro
<section class="hero" style="position: relative">
  <MosaicReveal images={[{ src: '/work/1.jpg', alt: 'A walnut stool' }, { src: '/work/2.jpg', alt: 'An oak bench' }]} transition="dissolve" />
  <h1>Furniture made <em>to outlive us.</em></h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `transition` | `MosaicTransition` | How one picture becomes the next: tiles flipping in a diagonal wave, melting into sorted streaks, blocks coarsening and refining, or a noise dissolve with a glowing edge. Default `'tiles'`. |
| `interval` | `number` | Seconds each picture stays, 2–12. Default 5. |
| `duration` | `number` | Seconds a change takes, 0.4–3. Default 1.6. |
| `tiles` | `number` | Tiles across the longer side, 3–24; also the coarsest blocks for `pixelate`. Default 9. |
| `autoplay` | `boolean` | Move on by itself (held while hovered, focused or off screen). Default true. |
| `colors` | `string[]` | The dissolve's glowing edge: its outer colour, then its core. Default amber, cream. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`: its first colour round its glint. |
| `background` | `string` | What shows between the tiles as they flip. Default `#0c0b0a`. |
| `reducedMotion` | `'fade' \| 'swap'` | With prefers-reduced-motion: a short crossfade, or a swap at once. Default `'fade'`. |
| `images` (required) | `{ src: string; alt: string }[]` | The pictures, in order, each `{ src, alt }`: same origin, or served with CORS. |
| `controls` | `boolean` | Dots that pick a picture, the current one filling as it plays. Default true. |
| `label` | `string` | What the slideshow is called, for assistive technology. Default `'Gallery'`. |
| `class` | `string` | Classes for the element. |
| `style` | `string` |  |

## `<NebulaLogo>`

NebulaLogo: a logo or a word filled with drifting nebula gas in the palette's colours, brightest towards its edges, with a glowing rim, a soft halo of gas leaking past the edge and faint stars twinkling inside. The pointer brightens the gas near it and stirs it as it moves. See src/runtime/nebula-logo.js.

```astro
<section class="hero" style="position: relative">
  <NebulaLogo src="/logo.svg" />
  <h1>…</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `text` | `string` | A word (or a character) to fill with gas. |
| `font` | `string` | Its CSS font, without the size. Default: the page's, bold. |
| `src` | `string` | An image (an SVG logo, a PNG) to fill instead. |
| `area` | `{ x: number; y: number; width: number; height: number }` | Where the shape sits, each 0–1 from the top left. Default the right half. |
| `colors` | `string[]` | The gas's palette, three colours; the first, darkened, is also the thin gas's. Default teal, amber, rose. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
| `background` | `string` | The ground. Default `#05070a`. |
| `speed` | `number` | How fast the gas drifts. Default 1. |
| `glow` | `number` | The rim and the halo leaking past the edge; 0 for neither. Default 1. |
| `stars` | `number` | How many stars twinkle inside; 0 for none. Default 1. |
| `stir` | `number` | How much the pointer stirs and brightens the gas; 0 for not at all. Default 1. |
| `scale` | `number` | Share of the pixel ratio the gas is drawn at: it is soft, so a little below full costs nothing visible and saves most of the work. Default 0.6. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<NeonSwarm>`

NeonSwarm: a logo or a word held by a swarm of glowing particles that flows like a flock round its shape, shimmering and breathing, with short neon trails in the palette's colours. The pointer scatters them and they stream back; on arrival they gather from a loose cloud. See src/runtime/neon-swarm.js.

```astro
<section class="hero" style="position: relative">
  <NeonSwarm src="/logo.svg" />
  <h1>…</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `text` | `string` | A word (or a character) to gather the swarm into. |
| `font` | `string` | Its CSS font, without the size. Default: the page's, bold. |
| `src` | `string` | An image (an SVG logo, a PNG) to gather it into instead. |
| `area` | `{ x: number; y: number; width: number; height: number }` | Where the shape sits, each 0–1 from the top left. Default the right half. |
| `colors` | `string[]` | The palette across the swarm, three colours. Default neon cyan, lime, magenta. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
| `background` | `string` | The ground. Default `#030406`. |
| `count` | `number` | How many particles (half on phones). Default 6000. |
| `size` | `number` | A particle's glowing core, CSS px. Default 2.4. |
| `trail` | `number` | How long the trails are, 0 (none) to 0.95. Default 0.82. |
| `flow` | `number` | How far the swarm drifts and breathes round the shape; 0 holds it still. Default 1. |
| `scatter` | `number` | How hard the pointer scatters them; 0 for not at all. Default 1. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<Ocean>`

Ocean: open sea to the horizon, photoreal, as a hero background. Waves at every scale run before the wind, sunlight glows through their thin crests, a glittering path runs out under the sun, whitecaps break on a rough sea and high cloud drifts in the sky and its reflection. `time` sets the hour (dawn, noon, sunset, a moonlit night); the camera drifts with the pointer. See src/runtime/ocean.js.

```astro
<section class="hero" style="position: relative">
  <Ocean time="sunset" />
  <h1>Out past the <em>break.</em></h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `time` | `'dawn' \| 'noon' \| 'sunset' \| 'night'` | The time of day: the sun, the sky's colours and the water's (`night` has a moon and stars). Default `sunset`. |
| `waves` | `number` | The sea state: 0 glassy, 1 a fresh breeze, 2 rough with whitecaps. Default 1. |
| `wind` | `number` | Where the waves run, degrees 0–360: 0 straight towards the viewer, 90 from left to right. Default 30. |
| `speed` | `number` | How fast the sea moves; 0 holds it still. Default 1. |
| `height` | `number` | How high the camera is above the water, metres, 1–20 (raised as far as the waves need). Default 4. |
| `horizon` | `number` | Where the horizon sits, 0–1 up the frame. Default 0.3. |
| `clouds` | `boolean` | Soft high cloud in the sky and its reflection. Default true. |
| `sun` | `{ x?: number; y?: number } \| null` | Where the sun (or moon) sits instead of the time's place: 0–1 across and up the frame. Default none. |
| `colors` | `string[]` | Tints, kept to each part's lightness: the sky, the water and the light. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case) to tint with, when there are no `colors`. |
| `interactive` | `boolean` | Whether the camera drifts with the pointer. Default true. |
| `quiet` | `{ x?: number; y?: number; radius?: number; depth?: number } \| null` | An area dimmed behind copy: centre (0–1 from the top left), radius (a share of the height), depth (0–1). Default none; `{}` for the middle. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
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
| `colors` | `string[]` | The dots' two colours, then the two blooms'. Default white, ice blue, deep teal, midnight blue. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
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
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
| `background` | `string` | The ground. Default `#020205`. |
| `columns` | `number` | Dots across the word's grid. Default 110. |
| `dot` | `number` | A word dot's size, a share of the grid's spacing. Default 0.72. |
| `sheets` | `number` | How many sheets of point cloud. Default 9. |
| `pointSize` | `number` | A cloud point's size, CSS px. Default 2.2. |
| `trackers` | `number` | Tracker boxes locking onto the word, a detector's debug look (try 4); 0 for none. Default 0. |
| `tilt` | `number` | How far the scene tilts towards the pointer. Default 1. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<ProductStack>`

ProductStack: a store's product covers floating in 3D, in a fan, a stack or a carousel arc, with depth of field, soft shadows and a gloss that sweeps across the cover in front. The stack leans towards the pointer; hovered, the covers fan apart and the one under the pointer lifts forward and comes into focus; left alone, they drift. See src/runtime/product-stack.js.

```astro
<ProductStack items={[{ src: '/covers/drums.webp', href: '/p/drums', alt: 'Night Drums, a sample pack' }, …]} />
<ProductStack layout="arc"><a href="/p/serif"><img src="/covers/serif.webp" alt="Halden Serif" /></a>…</ProductStack>
```

| Prop | Type | |
|---|---|---|
| `items` | `StackItem[]` | The covers. Without them, the children are the covers: each a link (or another element) holding one image. |
| `layout` | `'fan' \| 'stack' \| 'arc'` | How the covers are laid out: a hand of cards (`fan`, the middle cover in front), a deck seen at an angle (`stack`, the first in front) or a carousel arc (`arc`). Default `fan`. |
| `spread` | `number` | How far apart the covers sit, 0–2. Default 1. |
| `tilt` | `number` | How far the stack leans towards the pointer, degrees, 0–30. Default 12. |
| `float` | `number` | How far the covers drift when left alone, 0–1; 0 holds them still. Default 0.5. |
| `depth` | `number` | Depth of field: how much the covers behind dim and soften, 0–1. Default 0.6. |
| `interactive` | `boolean` | Lean towards the pointer, fan apart on hover and lift the cover under the pointer or in focus. Default true. |
| `size` | `string` | The widest a cover gets, a CSS length; covers shrink to fit the container. Default `280px`. |
| `ratio` | `number` | A cover's width over its height: 1 square, 0.75 a book. Default 1. |
| `radius` | `number` | The covers' corner radius, px, 0–40. Default 10. |
| `label` | `string` | The group's name for screen readers. Default `Products`. |
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

## `<RadiantGlass>`

RadiantGlass: a cluster of frosted glass tiles on a dark ground, lit from inside by big soft lights drifting behind them, which shift with the pointer. Each tile has a thin two-tone rim and a soft halo. See src/runtime/radiant-glass.js.

```astro
<section class="hero" style="position: relative">
  <RadiantGlass side="left" />
  <h1 style="text-align: right">…</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `colors` | `string[]` | The lights' colours, the last the hot colour where they gather. Default amber, blue, white. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. Its colours light the glass; its glint is the hot colour. |
| `background` | `string` | The ground. Default `#060818`. |
| `layout` | `'cross' \| 'diagonal' \| 'single'` | The tiles: four in a plus, three on a slant, or one large. Default `cross`. |
| `shape` | `'diamond' \| 'square' \| 'circle'` | Each tile's shape: a rounded square on its corner, square on, or round. Default `diamond`. |
| `side` | `'left' \| 'right'` | Which side the cluster sits on, leaving the other for the copy. Default `left`. |
| `size` | `number` | The cluster's size; 1 fills the height. Default 1. |
| `frost` | `number` | How blurred the light through the glass is; 0 for clear. Default 1. |
| `glow` | `number` | How strong the halo round each tile is; 0 for none. Default 1. |
| `rim` | `number` | How bright the rim line is; 0 for none. Default 1. |
| `speed` | `number` | How fast the lights drift. Default 1. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<RainOnGlass>`

RainOnGlass: rain on a window over a photo, like looking out of a café on a wet evening. Beads sit on the glass; larger drops run down it, leaving clear trails that fog over again; each drop holds the photo sharp and upside down, while the rest is soft behind the condensation, its lights opened into bokeh. The pointer wipes a clear patch. See src/runtime/rain-on-glass.js.

```astro
<section class="hero" style="position: relative">
  <RainOnGlass src="/photos/street-at-night.jpg" alt="A wet street of neon signs at night" />
  <h1>Come in out of the rain.</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `src` (required) | `string` | The photo behind the glass (same origin, or served with CORS). |
| `rain` | `number` | How much rain, 0–1: beads on the glass and drops running down it. Default 0.6. |
| `blur` | `number` | How soft the photo is behind the glass, 0–1. Default 0.6. |
| `fog` | `number` | How thick the condensation is, 0–1. Default 0.5. |
| `speed` | `number` | How fast the drops run and the beads come and go, 0–3. Default 1. |
| `interactive` | `boolean` | The pointer wipes a clear patch that fogs back over. Default true. |
| `tint` | `string` | The colour of the fog. Default `#a3b8cc`. |
| `bokeh` | `number` | How strongly the photo's lights open into bokeh discs, 0–1. Default 0.6. |
| `colors` | `string[]` | Colours for the bokeh discs. Default: each light's own colour. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
| `alt` | `string` | What the photo shows, for the `<img>` under the glass. Default empty (decorative). |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
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

## `<ShaderBackground>`

ShaderBackground: six animated shader backgrounds for a hero or section, tinted from `--color-accent` with no settings (the page's, or a section's own): mesh-gradient, grain-gradient, silk, band-lens, grid and waves. See src/runtime/shader-background.js.

```astro
<section style="position: relative">
  <ShaderBackground effect="silk" speed={0.6} intensity={0.7} />
  <h1>Your hero</h1>
</section>
<ShaderBackground effect="mesh-gradient" static frame={14} intensity={0.45} fade="none" fixed />
```

| Prop | Type | |
|---|---|---|
| `effect` (required) | `ShaderBackgroundName` | Which shader background. |
| `colors` | `string[]` | Up to four colours (hex or `rgb()`); those missing come from `--color-accent` where it sits: the accent, the accent towards `--color-bg`, its hue turned 30° towards yellow and lifted, its hue turned 45° away from yellow (in Oklab). Only mesh-gradient, grain-gradient and silk use the fourth. Default all four from the accent. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
| `speed` | `number` | How fast it moves, 0–4. Default 1. |
| `intensity` | `number` | How strong it is (brightness and contrast, not opacity), 0–2. Default 1. |
| `static` | `boolean` | One frame, never the loop: for a shader background that is wallpaper. Default false. |
| `frame` | `number` | With `static`, the moment drawn, in seconds. Default 12. |
| `interactive` | `boolean` | Lean towards the pointer, on devices that hover. Default false. |
| `opacity` | `number` | Its opacity, 0–1, to fade it against the section without changing the shader. Default 1. |
| `blend` | `string` | CSS `mix-blend-mode` with what is behind it (`screen`, `lighten`, `plus-lighter`…), for layering over imagery. Default normal. |
| `fade` | `'none' \| 'bottom' \| 'top' \| 'both'` | Fade it out towards an edge, so it melts into the page: 'bottom', 'top', 'both' (top and bottom) or 'none'. Default 'bottom'. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<SignalLines>`

SignalLines: layered waveform lines drawn as light, with a drifting loudness: sharp bright lines in front, soft out-of-focus ones behind, a shimmer where they cross, pulses of light running along them, and the pointer as a lens they part round. A quiet audio motif for behind a hero's copy. See src/runtime/waves.js.

```astro
<section class="hero" style="position: relative">
  <SignalLines />
  <h1>…</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `color` | `string` | One colour for every line. Default: the `colors` gradient. |
| `colors` | `string[]` | Colours the lines run through from left to right, blended in Oklab. Default sea-glass, ice and pale gold. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors` or `color`. |
| `pulse` | `string` | The pulses' colour. Default `#fafafa`. |
| `lines` | `number` | How many lines, 2–12. Default 7. |
| `amplitude` | `number` | How tall the waves are. Default 1. |
| `speed` | `number` | How fast they move. Default 1. |
| `pulses` | `number` | How often pulses run; 0 for none. Default 1. |
| `glow` | `number` | How much light the lines and pulses give off, 0–2. Default 1. |
| `grain` | `number` | Film grain in the light, 0–1. Default 0.5. |
| `depth` | `number` | How far out of focus the back lines are, and how much their colours fringe; 0 for all sharp. Default 1. |
| `bend` | `number` | How far the lines part round the pointer and how much it lights them; 0 for not at all. Default 1. |
| `audio` | `AudioSource` | Follow the sound playing: `'page'` for whatever plays, or a CSS selector for an `<audio>`/`<video>` or a player's container (a WaveformPlayer). The lines carry its waveform, as tall as it is loud, and kicks send pulses; while nothing plays they keep their own motion. Default none. |
| `quiet` | `{ x?: number; y?: number; radius?: number; depth?: number } \| null` | An area where the light dims (behind a headline): centre x/y (0–1, from the top left), radius (a share of the height) and depth (0 none, 1 dark). Default none. |
| `fade` | `boolean` | Fade the left and right edges out. Default true. |
| `class` | `string` | Classes for the element. |

## `<SilkRibbon>`

SilkRibbon: a wide ribbon of satin twisting across a light ground, soft folds gathering where it turns and a sheen along each one, with an out-of-focus glow of the same colours behind it. The folds undulate slowly and lean towards the pointer. See src/runtime/silk-ribbon.js.

```astro
<section class="hero" style="position: relative">
  <SilkRibbon side="right" />
  <h1>Soft to the touch.</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `colors` | `string[]` | The satin's colours, shaded from the darkest to the lightest whatever their order. Default hot pink, coral, peach. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
| `background` | `string` | The ground around the ribbon. Default `#f6f4f1`. |
| `side` | `'right' \| 'left' \| 'center'` | Where the ribbon runs. Default `right`. |
| `twist` | `number` | How tightly it turns along its length; 0 lies flat. Default 1. |
| `folds` | `number` | How deep the folds along it are; 0 for flat satin. Default 1. |
| `glow` | `number` | The soft out-of-focus glow behind it; 0 for none. Default 1. |
| `speed` | `number` | How fast the folds move. Default 1. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<SpotlightText>`

SpotlightText: one line of text as a faint outline that a light under the pointer fills in, falling off as light does: bright for a short way, then a long soft tail. See src/runtime/spotlight.js.

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

## `<Topography>`

Topography: a survey map that never sits still. The contour lines of a slowly drifting landscape, every fifth an index line drawn heavier, at a constant pixel width. Under the pointer the ground swells and its lines glow; `labels` sets small elevation numbers on a few index lines. See src/runtime/topography.js.

```astro
<section class="hero" style="position: relative">
  <Topography colors={['#8a5a33']} background="#f3ead6" labels />
  <h1>Every trail, <em>walked first.</em></h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `colors` | `string[]` | The lines' colour, or a gradient by elevation from the valleys to the peaks (up to five), blended in Oklab. Default a pale blue. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), as a gradient by elevation, when there are no `colors`. |
| `background` | `string` | The ground the lines are drawn on. Default `#0c1a2b`. |
| `density` | `number` | About how many lines cross the screen from top to bottom, 6–60. Default 24. |
| `thickness` | `number` | The lines' width, CSS px, 0.5–3; index lines are twice as wide. Default 1. |
| `major` | `number` | Every n-th line is an index line, drawn heavier, 0–10; 0 for none. Default 5. |
| `scale` | `number` | How large the hills are, 0.4–3. Default 1. |
| `speed` | `number` | How fast the land drifts, 0–4; 0 holds it still. Default 1. |
| `glow` | `number` | How strongly the lines glow under the pointer, 0–2; 0 for none. Default 1. |
| `interactive` | `boolean` | Whether the pointer raises the ground and lights its lines. Default true. |
| `labels` | `boolean` | Small elevation numbers on a few index lines. Default false. |
| `quiet` | `{ x?: number; y?: number; radius?: number; depth?: number } \| null` | An area kept dim behind copy: centre (0–1 from the top left), radius (a share of the height), depth (0–1). Default none; `{}` for the middle. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
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

## `<VariableType>`

VariableType: a headline in a variable font whose letters swell under the pointer, heavier and wider in a smooth wave, and ease back when it leaves; with nothing over it, a gentle swell travels along the line. For a type foundry, or any bold brand. The text stays real text. See src/runtime/variable-type.js.

```astro
<VariableType as="h1" fit>Torsion</VariableType>
<VariableType as="h2" axes={{ wght: [300, 1000], wdth: [100, 151], slnt: [0, -10] }}>Bend</VariableType>
```

| Prop | Type | |
|---|---|---|
| `axes` | `Axes` | The axes that swell, `{ tag: [rest, peak] }`. Axes the font lacks do nothing. Default `{ wght: [100, 900], wdth: [75, 125] }`. |
| `radius` | `number` | How far a swell reaches from the pointer, in ems (0.3–4). Default 1.1. |
| `falloff` | `number` | How it drops off: 0 a broad hill, 1 a sharp peak (0–1). Default 0.5. |
| `idle` | `number` | How far the travelling swell rises with nothing over the text: 0 none, 1 to the peak (0–1). Default 0.35. |
| `fit` | `boolean` | Size the line so that at its widest swell it spans its parent's width. Default false. |
| `as` | `HTMLTag` | The element to render. Default `div`. |
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
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
| `size` | `number` | How large the solid is in its area (1 just fits when face-on). Default 1.3. |
| `cells` | `number` | Cubes across the shape. Default 28. |
| `depth` | `number` | Cubes deep. Default 4. |
| `dither` | `number` | The dither's pixel size, CSS px; 0 for smooth shading. Default 2. |
| `markers` | `number` | Tracking markers ringing the solid (try 6); 0 for none. Default 0. |
| `rock` | `number` | How far it rocks and turns towards the pointer. Default 1. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `class` | `string` | Classes for the element. |

## `<WaveBars>`

WaveBars: a glowing bar waveform over its reflection, retuning every couple of seconds like a meter (peak marks that hold and drop), with a playhead sweeping across that lights and kicks the bars it plays, and the pointer scrubbing. A quiet audio motif for behind a hero's copy. See src/runtime/waves.js.

```astro
<section class="hero" style="position: relative">
  <WaveBars />
  <h1>…</h1>
</section>
```

| Prop | Type | |
|---|---|---|
| `color` | `string` | One colour for every bar. Default: the `colors` gradient. |
| `colors` | `string[]` | Colours the bars run through from left to right, blended in Oklab. Default teal, ice and apricot. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors` or `color`. |
| `step` | `number` | Space between bars, CSS px. Default 8. |
| `bar` | `number` | A bar's width, CSS px. Default 3. |
| `height` | `number` | The tallest bar, a share of the height either side of the middle. Default 0.34. |
| `every` | `number` | Seconds between retunes. Default 2. |
| `sweep` | `boolean` | The playhead sweeping across, lighting the bars it plays. Default true. |
| `grain` | `number` | Film grain in the light, 0–1. Default 0.4. |
| `peaks` | `boolean` | Peak marks over the bars that hold, then drop, as a meter's do. Default true. |
| `glow` | `number` | How much light the bars and playhead give off, 0–2. Default 1. |
| `scrub` | `number` | How much the bars under the pointer rise and light; 0 for not at all. Default 1. |
| `audio` | `AudioSource` | Follow the sound playing: `'page'` for whatever plays, or a CSS selector for an `<audio>`/`<video>` or a player's container (a WaveformPlayer). The bars show its spectrum (bass in the middle) and the playhead follows the track; while nothing plays they keep their own motion. Default none. |
| `quiet` | `{ x?: number; y?: number; radius?: number; depth?: number } \| null` | An area where the light dims (behind a headline): centre x/y (0–1, from the top left), radius (a share of the height) and depth (0 none, 1 dark). Default none. |
| `fade` | `boolean` | Fade the left and right edges out. Default true. |
| `class` | `string` | Classes for the element. |

## `<WorldRoutes>`

WorldRoutes: a dotted world map with routes arcing between cities, a comet of light running along each and pinging the city it lands on. For "sell worldwide" and "customers in 40 countries" sections, or with `home`, "shipped from our studio to everywhere". Name cities (`london`, `tokyo`… see CITIES in src/runtime/world-plan.js) or give [latitude, longitude] or `{ name, lat, lon }`. Routes take their own colour, label, speed, width and dash; `colors` gives each city a colour of a palette, and `gradient` blends each route between its two. The map shows the world or a `region` (`europe`, `routes`, a box), fitted to its box; hovering a city or a route picks it out and names it.

```astro
<WorldRoutes home="london" routes={['new-york', 'tokyo', { to: 'sydney', color: '#f97316' }]} colors={['#e0f2fe', '#38bdf8', '#2dd4bf']} gradient labels />
```

| Prop | Type | |
|---|---|---|
| `routes` | `RouteSpec[]` | The routes: `[from, to]`, a place alone (from `home`), or `{ from, to, color, label, speed, width, dashed }`. A place is a key of CITIES, [degrees north, degrees east], or `{ name, lat, lon }`. Default ten routes round the world, or, with a `home`, routes from it to ten cities round the world. |
| `home` | `Place` | A hub: routes with no `from` start here, and it is marked out with a ring and a halo. Default none. |
| `color` | `string` | The routes' colour. Default `#38bdf8`. |
| `colors` | `string[]` | A palette in place of `color`: each city takes the next colour in the order they appear (a home city takes the first and keeps it), and each route the colour of the city it runs to. Default none. |
| `palette` | `PaletteName \| (string & {})` | A shared palette by name (`PALETTES`, any case), when there are no `colors`. |
| `gradient` | `boolean` | Blend each route from its origin's colour to its destination's, in Oklab (with `colors`). Default false. |
| `land` | `string` | The land dots' colour, and the names'. Default `#ffffff`. |
| `landOpacity` | `number` | The land dots' opacity. Default 0.18. |
| `pitch` | `number` | Space between land dots, CSS px. Default 7. |
| `dot` | `number` | A land dot's radius, CSS px. Default 1.4. |
| `dotShape` | `'round' \| 'square'` | The land dots' shape: `round` or `square`. Default `round`. |
| `graticule` | `boolean \| number` | Faint lines of latitude and longitude, in dots: true for every 30°, or the degrees between them. Default false. |
| `region` | `RegionName \| 'routes' \| Bounds` | What the map shows: `world`, `europe`, `north-america`, `south-america`, `africa`, `middle-east`, `asia`, `oceania`, `routes` (fitted round the cities and the arcs between them), or [[south, west], [north, east]]. Default `world`. |
| `fit` | `'contain' \| 'cover'` | `contain` shows all of the region; `cover` fills the box with it. Default `contain`. |
| `drift` | `number` | Pan the map east this many degrees a second (negative for west), round and round the world. Default 0. |
| `lap` | `number` | Seconds a comet takes along a route. Default 3.2. |
| `lift` | `number` | How high the arcs bow, a share of their length. Default 0.3, or 0.08 with a great-circle `curve`. |
| `curve` | `'bow' \| 'great-circle'` | `bow`: arcs bow up between the cities. `great-circle`: they follow the shortest way over the globe, over the date line where that is shorter. Default `bow`. |
| `arcOpacity` | `number` | The faint arcs' opacity. Default 0.14. |
| `dashed` | `boolean` | Dash the faint arcs, the dashes running from origin to destination. Default false. |
| `width` | `number` | The comets' width, CSS px; the faint arcs are a line half as wide. Default 2.2. |
| `tail` | `number` | A comet's length, a share of its route. Default 0.28. |
| `glow` | `number` | The glow round a comet's head, CSS px; 0 for none. Default 10. |
| `comets` | `number` | Comets on each route at once. Default 1. |
| `ping` | `number` | How wide the ring a landing comet opens grows, CSS px; 0 for none. Default 17. |
| `markers` | `boolean` | Mark the cities with a dot. Default true. |
| `markerSize` | `number` | A city dot's radius, CSS px. Default 2.2. |
| `halo` | `boolean` | A soft halo breathing round every city (the home city always has one). Default false. |
| `labels` | `boolean` | Name the cities, leaving out names that would overlap (hovering a city names it either way). Default false. |
| `font` | `string` | The names' CSS font. Default `500 11px system-ui, sans-serif`. |
| `interactive` | `boolean` | Hovering a city or a route (not through a link or button) brightens it and names it. Default true. |
| `fixed` | `boolean` | Fill the viewport, behind the page (position: fixed, z-index -1). Default false. |
| `fade` | `boolean \| 'top' \| 'bottom' \| 'both'` | Fade the edges out, for a cropped map: true for the left and right, or 'top', 'bottom' or 'both'. Default false. |
| `class` | `string` | Classes for the element. |
