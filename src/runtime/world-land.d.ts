/** Natural Earth's land on a 1.5° grid from 84°N to 60°S, as alternating sea and land runs in base 36. */
export const LAND: { cols: number; rows: number; step: number; top: number; runs: string };

/** Whether a point (degrees north, degrees east) is on land. */
export function isLand(lat: number, lon: number): boolean;

/** How much land is at a point, 0–1, blended between the four nearest cells: above 0.5 is land, with rounded coasts. */
export function landAt(lat: number, lon: number): number;
