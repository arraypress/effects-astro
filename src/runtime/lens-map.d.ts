/** The signed distance from a point to a rounded rectangle's edge (px, negative inside), and the edge's outward unit normal there. The point is in px from the rectangle's top left. */
export function roundedRect(x: number, y: number, width: number, height: number, radius: number): { distance: number; nx: number; ny: number };

/** How hard the glass bends `depth` px in from its edge: 1 at the rim, easing to 0 at the bezel's inner edge; 0 outside the bezel or the panel. */
export function bend(depth: number, bezel: number): number;

/** How brightly the rim catches the light `depth` px in from the edge, whose outward normal is (`nx`, `ny`): a thin line, brightest facing the top left. 0–1. */
export function shine(depth: number, nx: number, ny: number, bezel: number): number;

/** A rounded panel's lens map, RGBA row by row at one pixel per CSS px: red and green where each point looks (0.5 + half the bend, towards the middle), blue the rim's highlight, alpha opaque. */
export function lensMap(width: number, height: number, radius: number, bezel: number): Uint8ClampedArray<ArrayBuffer>;
