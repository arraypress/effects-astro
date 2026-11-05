# effects-astro docs

Effects for Astro sites, as components: shader backgrounds, a real fluid, logos made of glass, particles or cubes, text that glitches, scrambles or types itself, glass panels and marquees: what makes a page look alive. Small UI pieces (countdowns, sliders, drop zones, tooltips) live in [`@arraypress/ui-astro`](https://github.com/LumiThemes/ui-astro); counters and drag-to-scroll in [`@arraypress/behaviors-astro`](https://github.com/arraypress/behaviors-astro). Plain WebGL, Canvas and CSS with no third-party dependencies (`<Scene>`'s shaders come from the owner's own [`@logomarks/shaders`](https://github.com/Logomarks/shaders)), and with the fallbacks a theme needs built in.

Every prop of every component is in **[COMPONENTS.md](../COMPONENTS.md)**, generated from the components' own types.

## Contents

- [What every effect does for you](guarantees.md): visibility, device budgets, reduced motion, fallbacks
- [The effects](effects.md): backgrounds, Paper shaders, logos and shapes, text, surfaces, stylesheets
- [Your own logo](logos.md): `text` or `src` for the logo effects
- [Palettes and colours](colours.md): the named palettes, `setColors`
- [Runtime](runtime.md): every effect as a function, without Astro
- [Demo](demo.md)
- [Credits](credits.md)
