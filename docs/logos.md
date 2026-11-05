# Your own logo

The logo effects take `text` (any word, character or emoji, in the font you name with `font`, weight first: `font="900 Anton, sans-serif"`), or `src`: any image URL, an SVG logo or a transparent PNG. Only its shape is used: where it is opaque. `area` places it within the section (`{ x, y, width, height }`, 0–1 from the top left).

```astro
<VoxelLogo src="/logo.svg" cells={36} colors={['#a7f3d0', '#08090a']} />
<ParticleLogo src="/logo.svg" area={{ x: 0.5, y: 0.1, width: 0.45, height: 0.8 }} />
<GlassGlyph text="7" font="900 Anton, sans-serif" />
```
