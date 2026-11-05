# @arraypress/effects-astro

Effects for Astro sites, as components: shader backgrounds, a real fluid, logos made of glass, particles or cubes, text that glitches, scrambles or types itself, glass panels and marquees. Plain WebGL, Canvas and CSS with no third-party dependencies, and the fallbacks a theme needs built in.

## Install

```bash
npm install @arraypress/effects-astro
```

Astro 6 or 7. The runtime underneath (`@arraypress/effects-astro`) works without Astro.

## Quick start

```astro
---
import LightField from '@arraypress/effects-astro/LightField.astro';
---
<LightField fixed colors={['#7c3aed', '#db2777', '#06b6d4']} />
```

## What's in it

- [The effects](https://github.com/arraypress/effects-astro/blob/main/docs/effects.md): backgrounds, Paper shaders, logos, text, surfaces and stylesheets
- [Every prop](https://github.com/arraypress/effects-astro/blob/main/COMPONENTS.md), generated from the components' types
- [What every effect does for you](https://github.com/arraypress/effects-astro/blob/main/docs/guarantees.md): runs only when seen, reduced motion, fallbacks
- [Your own logo](https://github.com/arraypress/effects-astro/blob/main/docs/logos.md)
- [Palettes and colours](https://github.com/arraypress/effects-astro/blob/main/docs/colours.md)
- [Runtime](https://github.com/arraypress/effects-astro/blob/main/docs/runtime.md): the effects without Astro
- [Credits](https://github.com/arraypress/effects-astro/blob/main/docs/credits.md)

## Links

- [Demo](https://effects.lumithemes.com)
- [Docs](https://github.com/arraypress/effects-astro/tree/main/docs)
- [Changelog](https://github.com/arraypress/effects-astro/blob/main/CHANGELOG.md)
- [Licence](https://github.com/arraypress/effects-astro/blob/main/LICENSE)
- [`@arraypress/ui-astro`](https://github.com/LumiThemes/ui-astro) for small UI pieces; [`@arraypress/behaviors-astro`](https://github.com/arraypress/behaviors-astro) for counters and drag-to-scroll

## Licence

MIT © ArrayPress Limited; author David Sherlock. Third-party notices are in [LICENSE](https://github.com/arraypress/effects-astro/blob/main/LICENSE).
