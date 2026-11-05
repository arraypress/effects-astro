# What every effect does for you

- **Runs only when it is seen.** One animation loop for the page; an effect draws only while it is within 128px of the viewport and the tab is showing.
- **Draws at what the device can afford.** The pixel ratio is capped at 2 on a desktop and 1.5 on a phone or tablet, and heavier passes (the light's prism split) are dropped on phones.
- **Respects reduced motion.** Every effect has a still state: one frame, a static date, the text simply there.
- **Has a fallback.** No WebGL: a still gradient, or the element's background. No hovering pointer: nothing waits for a hover.
- **Keeps content readable.** Effects are decoration (`aria-hidden`); real text stays in the page for screen readers and search; moving content has a pause button where it runs on.
- **Survives view transitions.** Effects start on `astro:page-load` and stop when their element leaves the page.
- **Mixes colour in Oklab**, so palettes blend without muddy midpoints.
- **Sends nothing anywhere.** No telemetry, no network.
