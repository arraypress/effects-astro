# Paper Shaders (vendored)

From [Paper Shaders](https://github.com/paper-design/shaders), © 2026 Paper, under the Apache License 2.0 ([LICENSE](LICENSE), [NOTICE](NOTICE)).

- `shaders/*.js`, `shader-sizing.js`, `shader-utils.js`, `vertex-shader.js`, `get-shader-noise-texture.js` and `get-shader-color-from-string.js` are copied from `@paper-design/shaders` 0.0.81. The only change is that their source-map comments are removed, since the maps are not shipped.
- `presets.js` is generated from `@paper-design/shaders-react` 0.0.81. It holds each shader's presets and the named options its settings take, as plain data.

The host that runs them, `src/runtime/paper.js`, is ours.
