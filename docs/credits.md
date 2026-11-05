# Credits

- The fluid is Jos Stam's Stable Fluids, after Pavel Dobryakov's [WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) (MIT, © 2017 Pavel Dobryakov).
- `<FlutedGlass>`'s flute geometry and `<GlassGlyph>`'s lens model are adapted from the FlutedGlass and Glass components of [Shaders](https://github.com/shader-effects-inc/shaders) (MIT, © 2026 Shader Effects Inc.).
- `<ShaderBackground>` is the shader set from the earlier `@arraypress/effect-canvas-astro` package; `silk` follows Inigo Quilez's domain-warping technique; `grain-gradient` dithers along its colour ramp as Paper's grain gradient does, with Dave Hoskins' [Hash without Sine](https://www.shadertoy.com/view/4djSRW) (MIT, © 2014 David Hoskins).
- `<PaperShader>` and the Paper looks (`<ColorPanels>`) run [Paper Shaders](https://github.com/paper-design/shaders) (Apache-2.0, © 2026 Paper), vendored unchanged in `src/vendor/paper/` with their presets. Powered by Paper Shaders: https://shaders.paper.design
- `<InkField>` is adapted from Trirat's ink shader for LumiThemes (its sim, display shader, emitters, lamp and twelve palettes), on Jos Stam's Stable Fluids in the shape of Pavel Dobryakov's WebGL-Fluid-Simulation (MIT, © 2017 Pavel Dobryakov).
- `<WorldRoutes>`'s land is sampled from [Natural Earth](https://www.naturalearthdata.com)'s 1:110m land (public domain).
- `<Ocean>`'s and `<LiquidMetal>`'s tone curve is Krzysztof Narkowicz's ACES fit.
- `<Glass refract>`'s lens (an SDF displacement map with a specular channel, fed to `feDisplacementMap` through `backdrop-filter`, and a three-pass RGB split) is adapted from Sam Asante's [liquid-glass](https://github.com/samasante/liquid-glass) (MIT, © 2026 Sam Asante).
- Oklab is Björn Ottosson's.

The full notices are in [LICENSE](../LICENSE).
