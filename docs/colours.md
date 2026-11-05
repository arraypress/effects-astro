# Palettes and colours

## Palettes

Every effect that takes `colors` also takes `palette`, one of eighteen named sets: Lumetri, Forest, Cadmium, Peacock, Vermillion, Barbie, Uranium, Azure, Ruby, Ultramarine, Saffron, Crimson, Ember, Lagoon, Citrus, Glacier, Rosewater, Mono (the first twelve are Trirat's, from the LumiThemes ink). An effect's own `colors` win; a palette fills in when there are none, shaped to what the effect takes:

```astro
<LightField palette="Lagoon" />
<NeonSwarm src="/logo.svg" palette="Citrus" />
<WorldRoutes home="london" palette="Ember" />
```

`PALETTES` (from `@arraypress/effects-astro`) is the list, for a site's own palette switcher.

## Changing colours

The WebGL effects (`<LightField>`, `<InkField>`, `<Ink>`, `<AsciiRain>`, `<FlutedGlass>`, `<GlassGlyph>`, `<LiquidMetal>`, `<ParticleLogo>`, `<NeonSwarm>`, `<NebulaLogo>`, `<PointCloud>`, `<VoxelLogo>`, `<SignalLines>`, `<WaveBars>`, `<DotSurface>`, `<HaloRing>`, `<SilkRibbon>`, `<RadiantGlass>`, `<Topography>`, `<Caustics>`, `<RainOnGlass>`, `<MosaicReveal>`, `<Ocean>`, `<IsoCity>`, `<Scene>`) and `<Galaxy>` read a `data-colors` attribute; `setColors` writes it. A light or an ink field eases to the new palette in about a second; ink, rain and the rest take it from their next frame. Set before an effect starts, it is its colours from the first frame.

```js
import { setColors } from '@arraypress/effects-astro';

setColors(document.querySelector('[data-effect-light-field]'), ['#e11d48', '#f97316', '#7c3aed'], '#fde68a');
```
